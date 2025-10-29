/**
 * @fileoverview Simple web-based dashboard for monitoring service status.
 * Provides a Windows-friendly GUI interface.
 * @module web-dashboard
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { performHealthCheck } = require('./health-check');
const { readStatus } = require('./status-tracker');
const { getDb } = require('./database');
const logger = require('./logger');

const PORT = process.env.DASHBOARD_PORT || 3030;

/**
 * Generates the HTML for the dashboard.
 * @returns {string} HTML content.
 */
function generateDashboardHTML() {
  const healthCheck = performHealthCheck();
  const status = readStatus() || {};

  const db = getDb();
  const recentEvents = db.prepare(`
    SELECT * FROM events
    ORDER BY startDate DESC
    LIMIT 10
  `).all();

  const stats = {
    total: db.prepare("SELECT COUNT(*) as count FROM events").get().count,
    pending: db.prepare("SELECT COUNT(*) as count FROM events WHERE status = 'pending'").get().count,
    processed: db.prepare("SELECT COUNT(*) as count FROM events WHERE status = 'processed'").get().count
  };

  const statusColor = healthCheck.overall === 'HEALTHY' ? '#28a745' :
                      healthCheck.overall === 'DEGRADED' ? '#ffc107' : '#dc3545';

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Hello Club - Service Dashboard</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="30">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header h1 { color: #333; margin-bottom: 5px; }
    .header .subtitle { color: #666; font-size: 14px; }
    .status-badge {
      display: inline-block;
      padding: 5px 15px;
      border-radius: 20px;
      font-weight: bold;
      color: white;
      background: ${statusColor};
      margin-left: 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    .card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .card h2 {
      font-size: 16px;
      color: #666;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card .value {
      font-size: 36px;
      font-weight: bold;
      color: #333;
    }
    .card .label { color: #999; font-size: 14px; margin-top: 5px; }
    .check-item {
      padding: 10px;
      margin: 5px 0;
      border-radius: 4px;
      background: #f8f9fa;
    }
    .check-ok { border-left: 4px solid #28a745; }
    .check-warning { border-left: 4px solid #ffc107; }
    .check-error { border-left: 4px solid #dc3545; }
    .event-list {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .event-item {
      padding: 10px;
      border-bottom: 1px solid #eee;
    }
    .event-item:last-child { border-bottom: none; }
    .event-name { font-weight: bold; color: #333; }
    .event-date { color: #666; font-size: 14px; }
    .event-status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }
    .status-pending { background: #fff3cd; color: #856404; }
    .status-processed { background: #d4edda; color: #155724; }
    .refresh-note {
      text-align: center;
      color: #999;
      font-size: 12px;
      margin-top: 20px;
    }
    .config-item {
      padding: 8px 0;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
    }
    .config-item:last-child { border-bottom: none; }
    .config-label { color: #666; }
    .config-value { font-weight: bold; color: #333; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>
        Hello Club Service Dashboard
        <span class="status-badge">${healthCheck.overall}</span>
      </h1>
      <div class="subtitle">Last updated: ${new Date().toLocaleString()}</div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>Total Events</h2>
        <div class="value">${stats.total}</div>
        <div class="label">in database</div>
      </div>
      <div class="card">
        <h2>Pending</h2>
        <div class="value">${stats.pending}</div>
        <div class="label">awaiting processing</div>
      </div>
      <div class="card">
        <h2>Processed</h2>
        <div class="value">${stats.processed}</div>
        <div class="label">completed</div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <h2>System Checks</h2>
        ${Object.entries(healthCheck.checks).map(([name, check]) => `
          <div class="check-item check-${check.status === 'OK' ? 'ok' : check.status === 'WARNING' ? 'warning' : 'error'}">
            <strong>${name}:</strong> ${check.status}
            ${check.message ? `<br><small>${check.message}</small>` : ''}
          </div>
        `).join('')}
      </div>

      <div class="card">
        <h2>Configuration</h2>
        ${status.config ? `
          <div class="config-item">
            <span class="config-label">Fetch Window:</span>
            <span class="config-value">${status.config.fetchWindowHours}h</span>
          </div>
          <div class="config-item">
            <span class="config-label">Pre-Event Query:</span>
            <span class="config-value">${status.config.preEventQueryMinutes}min</span>
          </div>
          <div class="config-item">
            <span class="config-label">Service Interval:</span>
            <span class="config-value">${status.config.serviceRunIntervalHours}h</span>
          </div>
          <div class="config-item">
            <span class="config-label">Print Mode:</span>
            <span class="config-value">${status.config.printMode}</span>
          </div>
        ` : '<p>No configuration data available</p>'}
      </div>
    </div>

    <div class="event-list">
      <h2 style="margin-bottom: 15px;">Recent Events</h2>
      ${recentEvents.length > 0 ? recentEvents.map(event => `
        <div class="event-item">
          <div class="event-name">${event.name}</div>
          <div class="event-date">
            ${new Date(event.startDate).toLocaleString()}
            <span class="event-status status-${event.status}">${event.status.toUpperCase()}</span>
          </div>
        </div>
      `).join('') : '<p>No events found</p>'}
    </div>

    <div class="refresh-note">
      ⟳ Page auto-refreshes every 30 seconds
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Starts the web dashboard server.
 */
function startDashboard() {
  const server = http.createServer((req, res) => {
    try {
      if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(generateDashboardHTML());
      } else if (req.url === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(performHealthCheck()));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    } catch (error) {
      logger.error('Dashboard error:', error.message);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  });

  server.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('  Hello Club - Web Dashboard Started');
    console.log('='.repeat(60));
    console.log(`  Open in browser: http://localhost:${PORT}`);
    console.log(`  Dashboard auto-refreshes every 30 seconds`);
    console.log('='.repeat(60));
    console.log('\nPress Ctrl+C to stop the dashboard server.\n');
    logger.info(`Web dashboard started on port ${PORT}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\nError: Port ${PORT} is already in use.`);
      console.error('Try setting a different port: DASHBOARD_PORT=3031 node src/index.js dashboard\n');
    } else {
      console.error(`\nServer error: ${error.message}\n`);
    }
    process.exit(1);
  });

  return server;
}

module.exports = {
  startDashboard,
  generateDashboardHTML
};
