/**
 * @fileoverview This module configures and exports a Winston logger instance.
 * The logger is set up to write to different files for info and error levels,
 * and also logs to the console in non-production environments.
 * @module logger
 */

const winston = require('winston');

/**
 * The Winston logger instance.
 * @type {winston.Logger}
 */
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.printf(({ level, message, timestamp, stack }) => {
      if (stack) {
        return `${timestamp} ${level}: ${message} - ${stack}`;
      }
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({
      filename: 'activity.log',
      level: 'info',
      maxsize: 5242880, // 5MB - rotates when file reaches this size
      maxFiles: 5, // keeps 5 old log files (activity.log.1, activity.log.2, etc.)
      tailable: true, // allows log file to be tailed in real-time
    }),
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      maxsize: 5242880, // 5MB - rotates when file reaches this size
      maxFiles: 5, // keeps 5 old log files (error.log.1, error.log.2, etc.)
      tailable: true, // allows log file to be tailed in real-time
    }),
  ],
});

// Handle EPIPE errors at process level (occurs when running Electron without a console)
// This must be set up before adding console transport to prevent crashes
function setupEpipeHandler() {
  // Only set up once
  if (process._epipeHandlerInstalled) return;
  process._epipeHandlerInstalled = true;

  process.stdout?.on?.('error', (err) => {
    if (err.code === 'EPIPE') return; // Silently ignore
  });
  process.stderr?.on?.('error', (err) => {
    if (err.code === 'EPIPE') return; // Silently ignore
  });
}

// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} ${JSON.stringify(info, null, 4)}`
if (process.env.NODE_ENV !== 'production') {
  // Check if stdout is available and writable (not available in some Electron contexts)
  const stdoutAvailable = process.stdout && typeof process.stdout.write === 'function';

  if (stdoutAvailable) {
    setupEpipeHandler();

    const consoleTransport = new winston.transports.Console({
      format: winston.format.simple(),
      stderrLevels: [], // Don't write to stderr to avoid additional EPIPE issues
    });

    logger.add(consoleTransport);
  }
}

module.exports = logger;
