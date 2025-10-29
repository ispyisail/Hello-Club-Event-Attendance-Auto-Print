/**
 * @fileoverview Metrics collection and export for monitoring service performance.
 * @module metrics
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const METRICS_FILE = path.join(process.cwd(), 'metrics.json');

/**
 * Initializes or reads the metrics file.
 * @returns {Object} Metrics data.
 */
function readMetrics() {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      const data = fs.readFileSync(METRICS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error('Failed to read metrics file:', error.message);
  }

  // Return default structure
  return {
    startTime: new Date().toISOString(),
    counters: {
      eventsFetched: 0,
      eventsProcessed: 0,
      pdfGenerated: 0,
      printSuccess: 0,
      printFailure: 0,
      apiCalls: 0,
      errors: 0
    },
    timers: {
      totalFetchTime: 0,
      totalProcessTime: 0,
      averageFetchTime: 0,
      averageProcessTime: 0
    },
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Writes metrics to file.
 * @param {Object} metrics - Metrics data to write.
 */
function writeMetrics(metrics) {
  try {
    metrics.lastUpdated = new Date().toISOString();
    fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2), 'utf8');
  } catch (error) {
    logger.error('Failed to write metrics file:', error.message);
  }
}

/**
 * Increments a counter metric.
 * @param {string} counterName - Name of the counter to increment.
 * @param {number} [amount=1] - Amount to increment by.
 */
function incrementCounter(counterName, amount = 1) {
  const metrics = readMetrics();
  if (metrics.counters[counterName] !== undefined) {
    metrics.counters[counterName] += amount;
  } else {
    metrics.counters[counterName] = amount;
  }
  writeMetrics(metrics);
}

/**
 * Records a timed operation.
 * @param {string} operation - Name of the operation.
 * @param {number} duration - Duration in milliseconds.
 */
function recordTiming(operation, duration) {
  const metrics = readMetrics();

  const totalKey = `total${operation.charAt(0).toUpperCase() + operation.slice(1)}Time`;
  const avgKey = `average${operation.charAt(0).toUpperCase() + operation.slice(1)}Time`;

  if (metrics.timers[totalKey] !== undefined) {
    metrics.timers[totalKey] += duration;

    // Calculate rolling average
    const count = metrics.counters[`${operation}ed`] || 1;
    metrics.timers[avgKey] = metrics.timers[totalKey] / count;
  } else {
    metrics.timers[totalKey] = duration;
    metrics.timers[avgKey] = duration;
  }

  writeMetrics(metrics);
}

/**
 * Records an API call.
 * @param {string} endpoint - API endpoint called.
 * @param {number} duration - Duration in milliseconds.
 * @param {boolean} success - Whether the call succeeded.
 */
function recordApiCall(endpoint, duration, success) {
  incrementCounter('apiCalls');

  const metrics = readMetrics();
  if (!metrics.apiStats) {
    metrics.apiStats = {};
  }

  if (!metrics.apiStats[endpoint]) {
    metrics.apiStats[endpoint] = {
      calls: 0,
      totalDuration: 0,
      averageDuration: 0,
      successes: 0,
      failures: 0
    };
  }

  const stats = metrics.apiStats[endpoint];
  stats.calls++;
  stats.totalDuration += duration;
  stats.averageDuration = stats.totalDuration / stats.calls;

  if (success) {
    stats.successes++;
  } else {
    stats.failures++;
  }

  writeMetrics(metrics);
}

/**
 * Exports metrics to Prometheus format.
 * @returns {string} Metrics in Prometheus format.
 */
function exportPrometheus() {
  const metrics = readMetrics();
  let output = '# HELP hello_club Metrics for Hello Club Service\n';
  output += '# TYPE hello_club_counter counter\n';

  // Export counters
  for (const [key, value] of Object.entries(metrics.counters)) {
    output += `hello_club_${key.toLowerCase()} ${value}\n`;
  }

  // Export timers
  output += '\n# TYPE hello_club_duration_milliseconds gauge\n';
  for (const [key, value] of Object.entries(metrics.timers)) {
    output += `hello_club_${key.toLowerCase()}_milliseconds ${value.toFixed(2)}\n`;
  }

  // Export API stats
  if (metrics.apiStats) {
    output += '\n# TYPE hello_club_api_calls counter\n';
    output += '# TYPE hello_club_api_duration_milliseconds gauge\n';

    for (const [endpoint, stats] of Object.entries(metrics.apiStats)) {
      const cleanEndpoint = endpoint.replace(/[^a-zA-Z0-9_]/g, '_');
      output += `hello_club_api_calls{endpoint="${endpoint}"} ${stats.calls}\n`;
      output += `hello_club_api_duration_milliseconds{endpoint="${endpoint}"} ${stats.averageDuration.toFixed(2)}\n`;
      output += `hello_club_api_successes{endpoint="${endpoint}"} ${stats.successes}\n`;
      output += `hello_club_api_failures{endpoint="${endpoint}"} ${stats.failures}\n`;
    }
  }

  return output;
}

/**
 * Displays metrics in human-readable format.
 */
function displayMetrics() {
  const metrics = readMetrics();

  console.log('\n' + '='.repeat(60));
  console.log('  Hello Club Service - Metrics');
  console.log('='.repeat(60));
  console.log(`Service started: ${metrics.startTime}`);
  console.log(`Last updated: ${metrics.lastUpdated}`);

  // Calculate uptime
  const uptime = new Date() - new Date(metrics.startTime);
  const hours = Math.floor(uptime / (1000 * 60 * 60));
  const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
  console.log(`Uptime: ${hours}h ${minutes}m`);

  console.log('\n' + '-'.repeat(60));
  console.log('Counters:');
  console.log('-'.repeat(60));
  for (const [key, value] of Object.entries(metrics.counters)) {
    console.log(`  ${key.padEnd(30)}: ${value}`);
  }

  console.log('\n' + '-'.repeat(60));
  console.log('Performance:');
  console.log('-'.repeat(60));
  for (const [key, value] of Object.entries(metrics.timers)) {
    console.log(`  ${key.padEnd(30)}: ${value.toFixed(2)}ms`);
  }

  if (metrics.apiStats && Object.keys(metrics.apiStats).length > 0) {
    console.log('\n' + '-'.repeat(60));
    console.log('API Statistics:');
    console.log('-'.repeat(60));
    for (const [endpoint, stats] of Object.entries(metrics.apiStats)) {
      console.log(`  ${endpoint}:`);
      console.log(`    Calls:       ${stats.calls}`);
      console.log(`    Success:     ${stats.successes}`);
      console.log(`    Failures:    ${stats.failures}`);
      console.log(`    Avg Duration: ${stats.averageDuration.toFixed(2)}ms`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log();
}

/**
 * Resets all metrics.
 */
function resetMetrics() {
  const metrics = {
    startTime: new Date().toISOString(),
    counters: {
      eventsFetched: 0,
      eventsProcessed: 0,
      pdfGenerated: 0,
      printSuccess: 0,
      printFailure: 0,
      apiCalls: 0,
      errors: 0
    },
    timers: {
      totalFetchTime: 0,
      totalProcessTime: 0,
      averageFetchTime: 0,
      averageProcessTime: 0
    },
    apiStats: {},
    lastUpdated: new Date().toISOString()
  };
  writeMetrics(metrics);
  logger.info('Metrics reset');
}

module.exports = {
  incrementCounter,
  recordTiming,
  recordApiCall,
  readMetrics,
  exportPrometheus,
  displayMetrics,
  resetMetrics
};
