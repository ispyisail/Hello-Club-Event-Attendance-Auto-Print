/**
 * @fileoverview HTTP server for Prometheus metrics endpoint.
 * Exposes metrics at /metrics for scraping by Prometheus.
 * @module metrics-server
 */

const http = require('http');
const logger = require('./logger');
const { exportPrometheusMetrics } = require('./metrics');
const { getAllStats: getCircuitBreakerStats } = require('./circuit-breaker');
const { getStats: getDLQStats } = require('./dead-letter-queue');
const { getBackupStats } = require('./backup-scheduler');
const { getDb } = require('./database');

const DEFAULT_PORT = 9090;

/**
 * Generate Prometheus metrics text
 * @returns {string} Metrics in Prometheus format
 */
function generatePrometheusMetrics() {
  const lines = [];

  // Application metrics from metrics.js
  const appMetrics = exportPrometheusMetrics();
  lines.push('# Application Metrics');
  lines.push(appMetrics);
  lines.push('');

  // Circuit breaker metrics
  const cbStats = getCircuitBreakerStats();
  lines.push('# Circuit Breaker Metrics');
  for (const [name, stats] of Object.entries(cbStats)) {
    lines.push(`# HELP circuit_breaker_state Circuit breaker state (0=CLOSED, 1=HALF_OPEN, 2=OPEN)`);
    lines.push(`# TYPE circuit_breaker_state gauge`);
    const stateValue = stats.state === 'CLOSED' ? 0 : stats.state === 'HALF_OPEN' ? 1 : 2;
    lines.push(`circuit_breaker_state{name="${name}"} ${stateValue}`);

    lines.push(`# HELP circuit_breaker_total_calls Total calls through circuit breaker`);
    lines.push(`# TYPE circuit_breaker_total_calls counter`);
    lines.push(`circuit_breaker_total_calls{name="${name}"} ${stats.totalCalls}`);

    lines.push(`# HELP circuit_breaker_successful_calls Successful calls`);
    lines.push(`# TYPE circuit_breaker_successful_calls counter`);
    lines.push(`circuit_breaker_successful_calls{name="${name}"} ${stats.successfulCalls}`);

    lines.push(`# HELP circuit_breaker_failed_calls Failed calls`);
    lines.push(`# TYPE circuit_breaker_failed_calls counter`);
    lines.push(`circuit_breaker_failed_calls{name="${name}"} ${stats.failedCalls}`);

    lines.push(`# HELP circuit_breaker_rejected_calls Rejected calls`);
    lines.push(`# TYPE circuit_breaker_rejected_calls counter`);
    lines.push(`circuit_breaker_rejected_calls{name="${name}"} ${stats.rejectedCalls}`);
  }
  lines.push('');

  // Dead letter queue metrics
  const dlqStats = getDLQStats();
  lines.push('# Dead Letter Queue Metrics');
  lines.push(`# HELP dlq_total_entries Total entries in dead letter queue`);
  lines.push(`# TYPE dlq_total_entries gauge`);
  lines.push(`dlq_total_entries ${dlqStats.total}`);

  lines.push(`# HELP dlq_pending_entries Pending entries in dead letter queue`);
  lines.push(`# TYPE dlq_pending_entries gauge`);
  lines.push(`dlq_pending_entries ${dlqStats.pending}`);

  lines.push(`# HELP dlq_retried_success Successfully retried entries`);
  lines.push(`# TYPE dlq_retried_success counter`);
  lines.push(`dlq_retried_success ${dlqStats.retriedSuccess}`);

  lines.push(`# HELP dlq_retried_failed Failed retry attempts`);
  lines.push(`# TYPE dlq_retried_failed counter`);
  lines.push(`dlq_retried_failed ${dlqStats.retriedFailed}`);

  for (const [type, count] of Object.entries(dlqStats.byType)) {
    lines.push(`# HELP dlq_entries_by_type Dead letter queue entries by type`);
    lines.push(`# TYPE dlq_entries_by_type gauge`);
    lines.push(`dlq_entries_by_type{type="${type}"} ${count}`);
  }
  lines.push('');

  // Backup metrics
  const backupStats = getBackupStats();
  lines.push('# Backup Metrics');
  lines.push(`# HELP backup_count Total number of backups`);
  lines.push(`# TYPE backup_count gauge`);
  lines.push(`backup_count ${backupStats.count}`);

  lines.push(`# HELP backup_total_size Total size of all backups in bytes`);
  lines.push(`# TYPE backup_total_size gauge`);
  lines.push(`backup_total_size ${backupStats.totalSize}`);

  if (backupStats.count > 0) {
    lines.push(`# HELP backup_newest_timestamp Timestamp of newest backup`);
    lines.push(`# TYPE backup_newest_timestamp gauge`);
    lines.push(`backup_newest_timestamp ${backupStats.newest.getTime() / 1000}`);

    lines.push(`# HELP backup_oldest_timestamp Timestamp of oldest backup`);
    lines.push(`# TYPE backup_oldest_timestamp gauge`);
    lines.push(`backup_oldest_timestamp ${backupStats.oldest.getTime() / 1000}`);
  }
  lines.push('');

  // Database metrics
  try {
    const db = getDb();
    const totalEvents = db.prepare('SELECT COUNT(*) as count FROM events').get();
    const pendingEvents = db.prepare("SELECT COUNT(*) as count FROM events WHERE status = 'pending'").get();
    const processedEvents = db.prepare("SELECT COUNT(*) as count FROM events WHERE status = 'processed'").get();

    lines.push('# Database Metrics');
    lines.push(`# HELP db_total_events Total events in database`);
    lines.push(`# TYPE db_total_events gauge`);
    lines.push(`db_total_events ${totalEvents.count}`);

    lines.push(`# HELP db_pending_events Pending events in database`);
    lines.push(`# TYPE db_pending_events gauge`);
    lines.push(`db_pending_events ${pendingEvents.count}`);

    lines.push(`# HELP db_processed_events Processed events in database`);
    lines.push(`# TYPE db_processed_events gauge`);
    lines.push(`db_processed_events ${processedEvents.count}`);
  } catch (error) {
    logger.error('Failed to fetch database metrics:', error.message);
  }
  lines.push('');

  // Node.js process metrics
  const mem = process.memoryUsage();
  lines.push('# Node.js Process Metrics');
  lines.push(`# HELP nodejs_memory_rss_bytes Resident Set Size in bytes`);
  lines.push(`# TYPE nodejs_memory_rss_bytes gauge`);
  lines.push(`nodejs_memory_rss_bytes ${mem.rss}`);

  lines.push(`# HELP nodejs_memory_heap_total_bytes Total heap size in bytes`);
  lines.push(`# TYPE nodejs_memory_heap_total_bytes gauge`);
  lines.push(`nodejs_memory_heap_total_bytes ${mem.heapTotal}`);

  lines.push(`# HELP nodejs_memory_heap_used_bytes Used heap size in bytes`);
  lines.push(`# TYPE nodejs_memory_heap_used_bytes gauge`);
  lines.push(`nodejs_memory_heap_used_bytes ${mem.heapUsed}`);

  lines.push(`# HELP nodejs_uptime_seconds Node.js process uptime in seconds`);
  lines.push(`# TYPE nodejs_uptime_seconds gauge`);
  lines.push(`nodejs_uptime_seconds ${process.uptime()}`);

  return lines.join('\n');
}

/**
 * Generate health check JSON
 * @returns {Object} Health status
 */
function generateHealthCheck() {
  const cbStats = getCircuitBreakerStats();
  const dlqStats = getDLQStats();

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      circuitBreakers: {},
      deadLetterQueue: {
        pending: dlqStats.pending,
        status: dlqStats.pending < 100 ? 'ok' : 'warning'
      },
      memory: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        status: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal < 0.9 ? 'ok' : 'warning'
      }
    }
  };

  // Check circuit breaker health
  for (const [name, stats] of Object.entries(cbStats)) {
    health.checks.circuitBreakers[name] = {
      state: stats.state,
      status: stats.state === 'OPEN' ? 'critical' : 'ok'
    };

    if (stats.state === 'OPEN') {
      health.status = 'degraded';
    }
  }

  return health;
}

/**
 * HTTP request handler
 * @param {http.IncomingMessage} req - Request
 * @param {http.ServerResponse} res - Response
 */
function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Request ID for tracing
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  req.requestId = requestId;

  // Log request
  logger.info(`[${requestId}] ${req.method} ${url.pathname} from ${req.socket.remoteAddress}`);

  if (url.pathname === '/metrics') {
    // Prometheus metrics endpoint
    try {
      const metrics = generatePrometheusMetrics();
      res.writeHead(200, {
        'Content-Type': 'text/plain; version=0.0.4',
        'X-Request-ID': requestId
      });
      res.end(metrics);
    } catch (error) {
      logger.error(`[${requestId}] Failed to generate metrics:`, error.message);
      res.writeHead(500, { 'Content-Type': 'text/plain', 'X-Request-ID': requestId });
      res.end('Internal Server Error');
    }
  } else if (url.pathname === '/health') {
    // Health check endpoint
    try {
      const health = generateHealthCheck();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      });
      res.end(JSON.stringify(health, null, 2));
    } catch (error) {
      logger.error(`[${requestId}] Failed to generate health check:`, error.message);
      res.writeHead(500, { 'Content-Type': 'application/json', 'X-Request-ID': requestId });
      res.end(JSON.stringify({ status: 'error', error: error.message }));
    }
  } else if (url.pathname === '/') {
    // Index page with links
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'X-Request-ID': requestId
    });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>Hello Club Metrics Server</title></head>
      <body>
        <h1>Hello Club Metrics Server</h1>
        <ul>
          <li><a href="/metrics">Prometheus Metrics</a></li>
          <li><a href="/health">Health Check</a></li>
        </ul>
        <p>Request ID: ${requestId}</p>
      </body>
      </html>
    `);
  } else {
    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain', 'X-Request-ID': requestId });
    res.end('Not Found');
  }
}

/**
 * Start the metrics server
 * @param {number} port - Port to listen on
 * @returns {http.Server} HTTP server instance
 */
function startMetricsServer(port = DEFAULT_PORT) {
  const server = http.createServer(handleRequest);

  server.listen(port, () => {
    logger.info(`Metrics server started on http://localhost:${port}`);
    logger.info(`  - Prometheus metrics: http://localhost:${port}/metrics`);
    logger.info(`  - Health check: http://localhost:${port}/health`);
  });

  server.on('error', (error) => {
    logger.error(`Metrics server error: ${error.message}`);
  });

  return server;
}

module.exports = {
  startMetricsServer,
  generatePrometheusMetrics,
  generateHealthCheck,
  DEFAULT_PORT
};
