/**
 * @fileoverview Circuit breaker implementation to prevent cascading failures.
 * When a service fails repeatedly, the circuit breaker "opens" to prevent
 * further calls, allowing the service time to recover.
 * @module circuit-breaker
 */

const logger = require('./logger');

/**
 * Circuit breaker states
 */
const STATE = {
  CLOSED: 'CLOSED',     // Normal operation
  OPEN: 'OPEN',         // Blocking calls due to failures
  HALF_OPEN: 'HALF_OPEN' // Testing if service recovered
};

/**
 * Circuit Breaker class
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'CircuitBreaker';
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000; // 60 seconds
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds

    this.state = STATE.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0
    };
  }

  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - Async function to execute
   * @returns {Promise<any>} Result from function
   */
  async execute(fn) {
    this.stats.totalCalls++;

    if (this.state === STATE.OPEN) {
      if (Date.now() < this.nextAttempt) {
        this.stats.rejectedCalls++;
        throw new Error(`Circuit breaker is OPEN for ${this.name}. Rejecting call.`);
      } else {
        // Transition to HALF_OPEN to test if service recovered
        this.state = STATE.HALF_OPEN;
        this.successCount = 0;
        logger.info(`Circuit breaker ${this.name} transitioning to HALF_OPEN state`);
      }
    }

    try {
      const result = await this._executeWithTimeout(fn);
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure();
      throw error;
    }
  }

  /**
   * Execute function with timeout
   * @private
   */
  async _executeWithTimeout(fn) {
    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Circuit breaker timeout')), this.timeout)
      )
    ]);
  }

  /**
   * Handle successful execution
   * @private
   */
  _onSuccess() {
    this.stats.successfulCalls++;
    this.failureCount = 0;

    if (this.state === STATE.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = STATE.CLOSED;
        logger.info(`Circuit breaker ${this.name} recovered. Transitioning to CLOSED state.`);
      }
    }
  }

  /**
   * Handle failed execution
   * @private
   */
  _onFailure() {
    this.stats.failedCalls++;
    this.failureCount++;
    this.successCount = 0;

    if (this.failureCount >= this.failureThreshold) {
      this.state = STATE.OPEN;
      this.nextAttempt = Date.now() + this.resetTimeout;
      logger.error(
        `Circuit breaker ${this.name} OPENED after ${this.failureCount} failures. ` +
        `Will attempt recovery in ${this.resetTimeout}ms`
      );
    }
  }

  /**
   * Get current state
   * @returns {string} Current circuit breaker state
   */
  getState() {
    return this.state;
  }

  /**
   * Get statistics
   * @returns {Object} Circuit breaker statistics
   */
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: new Date(this.nextAttempt).toISOString(),
      ...this.stats,
      successRate: this.stats.totalCalls > 0
        ? (this.stats.successfulCalls / this.stats.totalCalls * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Force reset the circuit breaker (manual recovery)
   */
  reset() {
    this.state = STATE.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    logger.info(`Circuit breaker ${this.name} manually reset to CLOSED state`);
  }

  /**
   * Check if circuit breaker is open
   * @returns {boolean} Whether circuit is open
   */
  isOpen() {
    return this.state === STATE.OPEN && Date.now() < this.nextAttempt;
  }
}

/**
 * Global circuit breakers for different services
 */
const circuitBreakers = {
  api: new CircuitBreaker({
    name: 'HelloClubAPI',
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
    resetTimeout: 60000
  }),
  email: new CircuitBreaker({
    name: 'EmailService',
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 15000,
    resetTimeout: 30000
  }),
  printer: new CircuitBreaker({
    name: 'PrinterService',
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 20000,
    resetTimeout: 30000
  }),
  webhook: new CircuitBreaker({
    name: 'WebhookService',
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 10000,
    resetTimeout: 30000
  })
};

/**
 * Get circuit breaker by name
 * @param {string} name - Circuit breaker name
 * @returns {CircuitBreaker} Circuit breaker instance
 */
function getCircuitBreaker(name) {
  if (!circuitBreakers[name]) {
    throw new Error(`Circuit breaker ${name} not found`);
  }
  return circuitBreakers[name];
}

/**
 * Get all circuit breaker statistics
 * @returns {Object} Statistics for all circuit breakers
 */
function getAllStats() {
  const stats = {};
  for (const [name, breaker] of Object.entries(circuitBreakers)) {
    stats[name] = breaker.getStats();
  }
  return stats;
}

module.exports = {
  CircuitBreaker,
  circuitBreakers,
  getCircuitBreaker,
  getAllStats,
  STATE
};
