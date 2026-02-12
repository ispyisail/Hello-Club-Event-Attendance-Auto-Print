/**
 * @fileoverview Systemd Watchdog Integration
 * Notifies systemd that the service is alive and healthy
 */

const logger = require('../services/logger');

let watchdogInterval = null;
let watchdogMicroseconds = null;

/**
 * Parse WATCHDOG_USEC environment variable (microseconds)
 * @returns {number|null} Watchdog interval in milliseconds, or null if not set
 */
function getWatchdogInterval() {
  const usec = process.env.WATCHDOG_USEC;
  if (!usec) {
    return null;
  }

  const microseconds = parseInt(usec, 10);
  if (isNaN(microseconds) || microseconds <= 0) {
    logger.warn('Invalid WATCHDOG_USEC value:', usec);
    return null;
  }

  // Convert to milliseconds and return half the interval
  // (systemd recommends notifying at half the watchdog timeout)
  return Math.floor(microseconds / 2000);
}

/**
 * Notify systemd that the service is alive
 * Uses sd_notify protocol via NOTIFY_SOCKET
 */
function notifyWatchdog() {
  const socket = process.env.NOTIFY_SOCKET;
  if (!socket) {
    return;
  }

  try {
    const dgram = require('dgram');
    const client = dgram.createSocket('unix_dgram');

    const message = Buffer.from('WATCHDOG=1');

    client.send(message, socket, (err) => {
      if (err) {
        logger.debug('Watchdog notify failed:', err.message);
      }
      client.close();
    });
  } catch (error) {
    logger.debug('Watchdog notify error:', error.message);
  }
}

/**
 * Notify systemd that service is ready
 */
function notifyReady() {
  const socket = process.env.NOTIFY_SOCKET;
  if (!socket) {
    return;
  }

  try {
    const dgram = require('dgram');
    const client = dgram.createSocket('unix_dgram');

    const message = Buffer.from('READY=1');

    client.send(message, socket, (err) => {
      if (err) {
        logger.debug('Ready notify failed:', err.message);
      }
      client.close();
    });

    logger.info('✓ Systemd watchdog: Service marked as READY');
  } catch (error) {
    logger.debug('Ready notify error:', error.message);
  }
}

/**
 * Start systemd watchdog integration
 * Call this after service initialization is complete
 */
function startWatchdog() {
  const intervalMs = getWatchdogInterval();

  if (!intervalMs) {
    logger.info('Systemd watchdog not enabled (WATCHDOG_USEC not set)');
    return;
  }

  watchdogMicroseconds = parseInt(process.env.WATCHDOG_USEC, 10);

  logger.info(
    `✓ Systemd watchdog enabled: notifying every ${intervalMs}ms (timeout: ${watchdogMicroseconds / 1000000}s)`
  );

  // Send initial READY notification
  notifyReady();

  // Start periodic watchdog notifications
  watchdogInterval = setInterval(() => {
    notifyWatchdog();
    logger.debug('Watchdog: keepalive sent');
  }, intervalMs);

  // Keep the interval from blocking process exit
  if (watchdogInterval.unref) {
    watchdogInterval.unref();
  }
}

/**
 * Stop watchdog notifications
 */
function stopWatchdog() {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
    logger.info('Systemd watchdog stopped');
  }
}

module.exports = {
  startWatchdog,
  stopWatchdog,
  notifyReady,
  notifyWatchdog,
};
