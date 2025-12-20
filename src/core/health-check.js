/**
 * @fileoverview Service Health Check Module
 * Provides health status information for monitoring
 */

const fs = require('fs');
const path = require('path');
const { getDb } = require('./database');
const { getCacheStats } = require('./api-client');

const HEALTH_FILE = path.join(process.cwd(), 'service-health.json');

/**
 * Get comprehensive health status
 * @returns {Object} Health status object
 */
function getHealthStatus() {
  const health = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {}
  };

  // Check database connection
  try {
    const db = getDb();
    const result = db.prepare('SELECT COUNT(*) as count FROM events').get();
    health.checks.database = {
      status: 'ok',
      eventCount: result.count
    };
  } catch (error) {
    health.checks.database = {
      status: 'error',
      error: error.message
    };
    health.status = 'unhealthy';
  }

  // Check log files exist
  try {
    const activityLogExists = fs.existsSync('activity.log');
    const errorLogExists = fs.existsSync('error.log');

    health.checks.logging = {
      status: (activityLogExists && errorLogExists) ? 'ok' : 'warning',
      activityLog: activityLogExists,
      errorLog: errorLogExists
    };
  } catch (error) {
    health.checks.logging = {
      status: 'error',
      error: error.message
    };
  }

  // Check cache stats
  try {
    const cacheStats = getCacheStats();
    health.checks.cache = {
      status: 'ok',
      ...cacheStats
    };
  } catch (error) {
    health.checks.cache = {
      status: 'error',
      error: error.message
    };
  }

  // Check scheduled jobs
  try {
    const db = getDb();
    const pendingJobs = db.prepare(`
      SELECT COUNT(*) as count FROM scheduled_jobs
      WHERE status = 'scheduled'
    `).get();

    const failedJobs = db.prepare(`
      SELECT COUNT(*) as count FROM scheduled_jobs
      WHERE status = 'failed'
    `).get();

    health.checks.jobs = {
      status: 'ok',
      pending: pendingJobs.count,
      failed: failedJobs.count
    };

    if (failedJobs.count > 5) {
      health.status = 'degraded';
    }
  } catch (error) {
    health.checks.jobs = {
      status: 'error',
      error: error.message
    };
  }

  return health;
}

/**
 * Write health status to file
 * This allows external monitoring without IPC
 */
function writeHealthFile() {
  try {
    const health = getHealthStatus();
    fs.writeFileSync(HEALTH_FILE, JSON.stringify(health, null, 2));
  } catch (error) {
    console.error('Failed to write health file:', error);
  }
}

/**
 * Start periodic health checks
 * @param {number} intervalSeconds - How often to check (default: 60)
 */
function startHealthChecks(intervalSeconds = 60) {
  // Write initial health file
  writeHealthFile();

  // Update health file periodically
  setInterval(writeHealthFile, intervalSeconds * 1000);
}

module.exports = {
  getHealthStatus,
  writeHealthFile,
  startHealthChecks
};
