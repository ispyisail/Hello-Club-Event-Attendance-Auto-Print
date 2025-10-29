/**
 * @fileoverview This module configures and exports a Winston logger instance.
 * The logger is set up to write to different files for info and error levels,
 * and also logs to the console in non-production environments.
 * @module logger
 */

const winston = require('winston');
const { maskSensitiveData } = require('./secrets-manager');

/**
 * Custom format to mask sensitive data in log messages
 */
const maskSecretsFormat = winston.format((info) => {
  // Mask sensitive data in the message
  if (typeof info.message === 'string') {
    info.message = maskSensitiveData(info.message);
  }

  // Mask sensitive data in the stack trace if present
  if (typeof info.stack === 'string') {
    info.stack = maskSensitiveData(info.stack);
  }

  return info;
});

/**
 * The Winston logger instance.
 * @type {winston.Logger}
 */
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    maskSecretsFormat(), // Mask sensitive data before logging
    winston.format.printf(({ level, message, timestamp, stack }) => {
      if (stack) {
        return `${timestamp} ${level}: ${message} - ${stack}`;
      }
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: 'activity.log', level: 'info' }),
    new winston.transports.File({ filename: 'error.log', level: 'error' })
  ]
});

// Add console logging:
// - Always enabled in development (NODE_ENV !== 'production')
// - In production, can be enabled by setting LOG_TO_CONSOLE=true
// This helps with debugging in production environments
const shouldLogToConsole = process.env.NODE_ENV !== 'production' ||
                           process.env.LOG_TO_CONSOLE === 'true';

if (shouldLogToConsole) {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message, timestamp }) => {
        return `${timestamp} ${level}: ${message}`;
      })
    ),
  }));
}

module.exports = logger;
