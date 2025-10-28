/**
 * @fileoverview This module provides health check functionality to verify service status.
 * @module health-check
 */

const fs = require('fs');
const { readStatus } = require('./status-tracker');
const { getDb } = require('./database');
const logger = require('./logger');

/**
 * Performs a comprehensive health check of the application.
 * @returns {Object} Health check results.
 */
function performHealthCheck() {
  const results = {
    timestamp: new Date().toISOString(),
    checks: {}
  };

  // Check 1: Status file exists and is recent
  try {
    const status = readStatus();
    if (status) {
      results.checks.statusFile = {
        status: 'OK',
        data: status
      };

      // Check if service is running (heartbeat within last 10 minutes)
      if (status.lastHeartbeat) {
        const heartbeatAge = Date.now() - new Date(status.lastHeartbeat).getTime();
        const tenMinutes = 10 * 60 * 1000;
        if (heartbeatAge < tenMinutes) {
          results.checks.serviceRunning = {
            status: 'OK',
            message: `Service is active (last heartbeat ${Math.round(heartbeatAge / 1000)}s ago)`
          };
        } else {
          results.checks.serviceRunning = {
            status: 'WARNING',
            message: `Service may be inactive (last heartbeat ${Math.round(heartbeatAge / 60000)} minutes ago)`
          };
        }
      } else {
        results.checks.serviceRunning = {
          status: 'UNKNOWN',
          message: 'No heartbeat recorded yet'
        };
      }
    } else {
      results.checks.statusFile = {
        status: 'WARNING',
        message: 'Status file does not exist. Service may not have started yet.'
      };
    }
  } catch (error) {
    results.checks.statusFile = {
      status: 'ERROR',
      message: error.message
    };
  }

  // Check 2: Database is accessible
  try {
    const db = getDb();
    const count = db.prepare("SELECT COUNT(*) as count FROM events").get();
    const pending = db.prepare("SELECT COUNT(*) as count FROM events WHERE status = 'pending'").get();
    const processed = db.prepare("SELECT COUNT(*) as count FROM events WHERE status = 'processed'").get();

    results.checks.database = {
      status: 'OK',
      totalEvents: count.count,
      pendingEvents: pending.count,
      processedEvents: processed.count
    };
  } catch (error) {
    results.checks.database = {
      status: 'ERROR',
      message: error.message
    };
  }

  // Check 3: Log files exist and are writable
  try {
    const logFiles = ['activity.log', 'error.log'];
    const logStatus = {};
    for (const logFile of logFiles) {
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        logStatus[logFile] = {
          exists: true,
          size: stats.size,
          lastModified: stats.mtime.toISOString()
        };
      } else {
        logStatus[logFile] = {
          exists: false
        };
      }
    }
    results.checks.logFiles = {
      status: 'OK',
      files: logStatus
    };
  } catch (error) {
    results.checks.logFiles = {
      status: 'ERROR',
      message: error.message
    };
  }

  // Check 4: Environment variables
  const requiredEnvVars = ['API_KEY'];
  const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);

  if (missingEnvVars.length === 0) {
    results.checks.environment = {
      status: 'OK',
      message: 'All required environment variables are set'
    };
  } else {
    results.checks.environment = {
      status: 'ERROR',
      message: `Missing environment variables: ${missingEnvVars.join(', ')}`
    };
  }

  // Overall health
  const hasErrors = Object.values(results.checks).some(check => check.status === 'ERROR');
  const hasWarnings = Object.values(results.checks).some(check => check.status === 'WARNING');

  if (hasErrors) {
    results.overall = 'UNHEALTHY';
  } else if (hasWarnings) {
    results.overall = 'DEGRADED';
  } else {
    results.overall = 'HEALTHY';
  }

  return results;
}

/**
 * Displays the health check results in a human-readable format.
 */
function displayHealthCheck() {
  require('dotenv').config();

  console.log('\n========================================');
  console.log('  Hello Club Service - Health Check');
  console.log('========================================\n');

  const results = performHealthCheck();

  console.log(`Overall Status: ${results.overall}\n`);
  console.log(`Check Time: ${results.timestamp}\n`);

  // Display each check
  for (const [checkName, checkResult] of Object.entries(results.checks)) {
    const statusIcon = checkResult.status === 'OK' ? '✓' :
                       checkResult.status === 'WARNING' ? '⚠' : '✗';
    console.log(`${statusIcon} ${checkName}: ${checkResult.status}`);

    if (checkResult.message) {
      console.log(`  ${checkResult.message}`);
    }

    if (checkName === 'database' && checkResult.status === 'OK') {
      console.log(`  Total Events: ${checkResult.totalEvents}`);
      console.log(`  Pending: ${checkResult.pendingEvents}`);
      console.log(`  Processed: ${checkResult.processedEvents}`);
    }

    if (checkName === 'statusFile' && checkResult.data) {
      const data = checkResult.data;
      if (data.serviceStarted) {
        console.log(`  Service Started: ${data.serviceStarted}`);
      }
      if (data.lastFetch) {
        console.log(`  Last Fetch: ${data.lastFetch.timestamp} (${data.lastFetch.eventCount} events)`);
      }
      if (data.lastProcess) {
        console.log(`  Last Process: ${data.lastProcess.timestamp} (${data.lastProcess.processedCount} events)`);
      }
      if (data.config) {
        console.log(`  Configuration:`);
        console.log(`    - Fetch Window: ${data.config.fetchWindowHours} hours`);
        console.log(`    - Pre-Event Query: ${data.config.preEventQueryMinutes} minutes`);
        console.log(`    - Service Interval: ${data.config.serviceRunIntervalHours} hours`);
        console.log(`    - Print Mode: ${data.config.printMode}`);
        if (data.config.categories && data.config.categories.length > 0) {
          console.log(`    - Categories: ${data.config.categories.join(', ')}`);
        }
      }
      if (data.errors && data.errors.length > 0) {
        console.log(`  Recent Errors (${data.errors.length}):`);
        data.errors.slice(-3).forEach(err => {
          console.log(`    - ${err.timestamp}: ${err.operation} - ${err.message}`);
        });
      }
    }

    if (checkName === 'logFiles' && checkResult.files) {
      for (const [fileName, fileInfo] of Object.entries(checkResult.files)) {
        if (fileInfo.exists) {
          console.log(`  ${fileName}: ${fileInfo.size} bytes (modified: ${fileInfo.lastModified})`);
        } else {
          console.log(`  ${fileName}: Not found`);
        }
      }
    }

    console.log('');
  }

  console.log('========================================');
  console.log('Log Files Location:');
  console.log(`  activity.log - ${process.cwd()}/activity.log`);
  console.log(`  error.log - ${process.cwd()}/error.log`);
  console.log('========================================\n');

  // Exit with appropriate code
  if (results.overall === 'UNHEALTHY') {
    process.exit(1);
  } else if (results.overall === 'DEGRADED') {
    process.exit(2);
  } else {
    process.exit(0);
  }
}

module.exports = {
  performHealthCheck,
  displayHealthCheck
};
