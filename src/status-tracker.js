/**
 * @fileoverview This module tracks the application's status by maintaining a status file.
 * It records last successful operations to help with debugging and monitoring.
 * @module status-tracker
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const STATUS_FILE = path.join(process.cwd(), 'status.json');

/**
 * Reads the current status from the status file.
 * @returns {Object|null} The status object or null if file doesn't exist.
 */
function readStatus() {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      const data = fs.readFileSync(STATUS_FILE, 'utf8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    logger.error('Failed to read status file:', error.message);
    return null;
  }
}

/**
 * Writes the status to the status file.
 * @param {Object} status - The status object to write.
 */
function writeStatus(status) {
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), 'utf8');
  } catch (error) {
    logger.error('Failed to write status file:', error.message);
  }
}

/**
 * Updates a specific field in the status file.
 * @param {string} key - The key to update.
 * @param {*} value - The value to set.
 */
function updateStatus(key, value) {
  const status = readStatus() || {};
  status[key] = value;
  status.lastUpdated = new Date().toISOString();
  writeStatus(status);
}

/**
 * Records a successful fetch operation.
 * @param {number} eventCount - Number of events fetched.
 */
function recordFetch(eventCount) {
  updateStatus('lastFetch', {
    timestamp: new Date().toISOString(),
    eventCount: eventCount,
    success: true
  });
  logger.info(`Status updated: Last fetch recorded (${eventCount} events)`);
}

/**
 * Records a successful process operation.
 * @param {number} processedCount - Number of events processed.
 */
function recordProcess(processedCount) {
  updateStatus('lastProcess', {
    timestamp: new Date().toISOString(),
    processedCount: processedCount,
    success: true
  });
  logger.info(`Status updated: Last process recorded (${processedCount} events)`);
}

/**
 * Records service startup.
 * @param {Object} config - The service configuration.
 */
function recordServiceStart(config) {
  const status = readStatus() || {};
  status.serviceStarted = new Date().toISOString();
  status.config = {
    fetchWindowHours: config.fetchWindowHours,
    preEventQueryMinutes: config.preEventQueryMinutes,
    serviceRunIntervalHours: config.serviceRunIntervalHours,
    printMode: config.printMode,
    categories: config.allowedCategories
  };
  status.lastUpdated = new Date().toISOString();
  writeStatus(status);
  logger.info('Status updated: Service started');
}

/**
 * Records a heartbeat to show the service is alive.
 */
function recordHeartbeat() {
  updateStatus('lastHeartbeat', new Date().toISOString());
}

/**
 * Records an error in the status file.
 * @param {string} operation - The operation that failed.
 * @param {string} errorMessage - The error message.
 */
function recordError(operation, errorMessage) {
  const status = readStatus() || {};
  if (!status.errors) {
    status.errors = [];
  }
  status.errors.push({
    operation: operation,
    message: errorMessage,
    timestamp: new Date().toISOString()
  });
  // Keep only last 10 errors
  if (status.errors.length > 10) {
    status.errors = status.errors.slice(-10);
  }
  status.lastUpdated = new Date().toISOString();
  writeStatus(status);
}

module.exports = {
  readStatus,
  updateStatus,
  recordFetch,
  recordProcess,
  recordServiceStart,
  recordHeartbeat,
  recordError
};
