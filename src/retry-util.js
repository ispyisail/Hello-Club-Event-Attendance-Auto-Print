/**
 * @fileoverview Utility functions for retrying operations with exponential backoff.
 * @module retry-util
 */

const logger = require('./logger');
const { DEFAULTS } = require('./constants');

/**
 * Sleeps for a specified duration.
 * @param {number} ms - Milliseconds to sleep.
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retries an async operation with exponential backoff.
 * @param {Function} operation - Async function to retry.
 * @param {Object} options - Retry options.
 * @param {number} [options.maxAttempts=3] - Maximum number of retry attempts.
 * @param {number} [options.baseDelay=2000] - Base delay in milliseconds (will be exponentially increased).
 * @param {string} [options.operationName='operation'] - Name of the operation for logging.
 * @returns {Promise<*>} The result of the operation.
 * @throws {Error} If all retry attempts fail.
 */
async function retryWithBackoff(operation, options = {}) {
  const {
    maxAttempts = DEFAULTS.RETRY_ATTEMPTS,
    baseDelay = DEFAULTS.RETRY_DELAY_BASE_MS,
    operationName = 'operation'
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();
      if (attempt > 1) {
        logger.info(`${operationName} succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts) {
        logger.error(`${operationName} failed after ${maxAttempts} attempts:`, error.message);
        break;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.warn(`${operationName} failed (attempt ${attempt}/${maxAttempts}): ${error.message}. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError;
}

module.exports = {
  sleep,
  retryWithBackoff
};
