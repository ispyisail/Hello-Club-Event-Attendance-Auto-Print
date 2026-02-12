const logger = require('../services/logger');

/**
 * Circuit Breaker pattern implementation to prevent cascading failures.
 * Tracks failure rate and temporarily stops making requests when threshold is exceeded.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Threshold exceeded, all requests fail fast
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 *
 * @example
 * const breaker = new CircuitBreaker({ threshold: 5, timeout: 60000 });
 * const result = await breaker.execute(() => apiCall());
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.threshold || 5; // Number of failures before opening
    this.successThreshold = options.successThreshold || 2; // Successes needed to close from half-open
    this.timeout = options.timeout || 60000; // Time in ms before attempting reset (1 minute default)
    this.name = options.name || 'CircuitBreaker';

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    this.lastFailureTime = null;
  }

  /**
   * Execute a function through the circuit breaker.
   * @param {Function} fn - Async function to execute
   * @returns {Promise<*>} Result of the function
   * @throws {Error} If circuit is open or function fails
   */
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        const waitSeconds = Math.ceil((this.nextAttempt - Date.now()) / 1000);
        throw new Error(
          `${this.name} circuit breaker is OPEN. Service temporarily unavailable. Retry in ${waitSeconds}s.`
        );
      }
      // Timeout expired, try half-open
      this.state = 'HALF_OPEN';
      this.successCount = 0;
      logger.info(`${this.name} circuit breaker entering HALF_OPEN state (testing recovery)`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record a successful execution.
   */
  onSuccess() {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        logger.info(`${this.name} circuit breaker CLOSED (service recovered)`);
      }
    }
  }

  /**
   * Record a failed execution.
   */
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // Failed during recovery test, reopen circuit
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      logger.warn(`${this.name} circuit breaker reopened OPEN (recovery failed, retry in ${this.timeout / 1000}s)`);
    } else if (this.failureCount >= this.failureThreshold) {
      // Threshold exceeded, open circuit
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      logger.error(
        `${this.name} circuit breaker opened OPEN (${this.failureCount} failures, retry in ${this.timeout / 1000}s)`
      );
    }
  }

  /**
   * Get current circuit breaker state.
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.state === 'OPEN' ? this.nextAttempt : null,
    };
  }

  /**
   * Manually reset the circuit breaker to CLOSED state.
   * Useful for testing or manual recovery.
   */
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    logger.info(`${this.name} circuit breaker manually reset to CLOSED`);
  }
}

module.exports = CircuitBreaker;
