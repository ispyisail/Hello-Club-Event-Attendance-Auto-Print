const CircuitBreaker = require('../src/utils/circuit-breaker');

describe('CircuitBreaker', () => {
  let breaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      threshold: 3,
      successThreshold: 2,
      timeout: 1000,
      name: 'TestBreaker',
    });
  });

  describe('constructor', () => {
    it('should initialize with correct defaults', () => {
      const status = breaker.getStatus();
      expect(status.state).toBe('CLOSED');
      expect(status.failureCount).toBe(0);
      expect(status.successCount).toBe(0);
    });
  });

  describe('execute', () => {
    it('should execute function and return result when closed', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should track failures and open circuit after threshold', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      // Fail 3 times to reach threshold
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow('fail');
      }

      const status = breaker.getStatus();
      expect(status.state).toBe('OPEN');
      expect(status.failureCount).toBe(3);
    });

    it('should fail fast when circuit is open', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      // Fail 3 times to open circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow('fail');
      }

      // Next call should fail fast without calling fn
      await expect(breaker.execute(fn)).rejects.toThrow('circuit breaker is OPEN');
      expect(fn).toHaveBeenCalledTimes(3); // Not called on 4th attempt
    });

    it('should transition to half-open after timeout', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow();
      }

      expect(breaker.getStatus().state).toBe('OPEN');

      // Wait for timeout (1 second + buffer)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Next call should transition to half-open
      fn.mockResolvedValue('success');
      await breaker.execute(fn);

      const status = breaker.getStatus();
      expect(status.state).toBe('HALF_OPEN');
    });

    it('should close circuit after success threshold in half-open state', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow();
      }

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Succeed twice to close circuit
      fn.mockResolvedValue('success');
      await breaker.execute(fn);
      await breaker.execute(fn);

      const status = breaker.getStatus();
      expect(status.state).toBe('CLOSED');
      expect(status.failureCount).toBe(0);
    });

    it('should reopen circuit if failure occurs in half-open state', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow();
      }

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Fail again in half-open state
      await expect(breaker.execute(fn)).rejects.toThrow('fail');

      const status = breaker.getStatus();
      expect(status.state).toBe('OPEN');
    });
  });

  describe('reset', () => {
    it('should reset circuit breaker to closed state', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow();
      }

      expect(breaker.getStatus().state).toBe('OPEN');

      // Reset
      breaker.reset();

      const status = breaker.getStatus();
      expect(status.state).toBe('CLOSED');
      expect(status.failureCount).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('should return current status information', () => {
      const status = breaker.getStatus();

      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('failureCount');
      expect(status).toHaveProperty('successCount');
      expect(status).toHaveProperty('lastFailureTime');
      expect(status).toHaveProperty('nextAttempt');
    });
  });
});
