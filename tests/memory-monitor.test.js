const {
  getMemoryUsage,
  checkMemoryUsage,
  startMemoryMonitoring,
  stopMemoryMonitoring,
  getMemoryStats,
  clearHistory,
} = require('../src/utils/memory-monitor');

describe('MemoryMonitor', () => {
  beforeEach(() => {
    clearHistory();
    stopMemoryMonitoring();
  });

  afterEach(() => {
    stopMemoryMonitoring();
    clearHistory();
  });

  describe('getMemoryUsage', () => {
    it('should return memory usage statistics', () => {
      const usage = getMemoryUsage();

      expect(usage).toHaveProperty('rss');
      expect(usage).toHaveProperty('heapTotal');
      expect(usage).toHaveProperty('heapUsed');
      expect(usage).toHaveProperty('external');
      expect(usage).toHaveProperty('timestamp');

      expect(typeof usage.rss).toBe('number');
      expect(typeof usage.heapUsed).toBe('number');
      expect(usage.rss).toBeGreaterThan(0);
    });

    it('should return values in megabytes', () => {
      const usage = getMemoryUsage();

      // Typical Node.js process uses at least 10MB
      expect(usage.rss).toBeGreaterThan(10);
      expect(usage.rss).toBeLessThan(10000); // Unlikely to exceed 10GB in tests
    });
  });

  describe('checkMemoryUsage', () => {
    it('should return healthy status for normal memory usage', () => {
      const result = checkMemoryUsage({
        heapUsedMB: 10000, // Very high threshold
        rssMB: 10000,
      });

      expect(result.healthy).toBe(true);
      expect(result.warnings).toHaveLength(0);
      expect(result.usage).toBeDefined();
    });

    it('should warn when heap usage exceeds threshold', () => {
      const result = checkMemoryUsage({
        heapUsedMB: 1, // Very low threshold
        rssMB: 10000,
      });

      expect(result.healthy).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('High heap usage');
    });

    it('should warn when RSS exceeds threshold', () => {
      const result = checkMemoryUsage({
        heapUsedMB: 10000,
        rssMB: 1, // Very low threshold
      });

      expect(result.healthy).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('High RSS memory');
    });

    it('should build memory history', () => {
      checkMemoryUsage();
      checkMemoryUsage();
      checkMemoryUsage();

      const stats = getMemoryStats();

      expect(stats).not.toBeNull();
      expect(stats.history.samples).toBe(3);
    });
  });

  describe('startMemoryMonitoring and stopMemoryMonitoring', () => {
    it('should start monitoring with default interval', () => {
      expect(() => startMemoryMonitoring()).not.toThrow();
    });

    it('should stop monitoring without errors', () => {
      startMemoryMonitoring(100);
      expect(() => stopMemoryMonitoring()).not.toThrow();
    });

    it('should not throw when stopping already stopped monitoring', () => {
      expect(() => stopMemoryMonitoring()).not.toThrow();
    });
  });

  describe('getMemoryStats', () => {
    it('should return null when no history', () => {
      const stats = getMemoryStats();

      expect(stats).toBeNull();
    });

    it('should return statistics after checks', () => {
      checkMemoryUsage();
      checkMemoryUsage();
      checkMemoryUsage();

      const stats = getMemoryStats();

      expect(stats).not.toBeNull();
      expect(stats.current).toBeDefined();
      expect(stats.history).toBeDefined();
      expect(stats.history.samples).toBe(3);
      expect(stats.history.heapUsed).toHaveProperty('min');
      expect(stats.history.heapUsed).toHaveProperty('max');
      expect(stats.history.heapUsed).toHaveProperty('avg');
    });

    it('should calculate min/max/avg correctly', () => {
      // Generate some checks
      for (let i = 0; i < 5; i++) {
        checkMemoryUsage();
      }

      const stats = getMemoryStats();

      expect(stats.history.heapUsed.min).toBeLessThanOrEqual(stats.history.heapUsed.avg);
      expect(stats.history.heapUsed.max).toBeGreaterThanOrEqual(stats.history.heapUsed.avg);
      expect(stats.history.rss.min).toBeLessThanOrEqual(stats.history.rss.max);
    });
  });

  describe('clearHistory', () => {
    it('should clear memory history', () => {
      checkMemoryUsage();
      checkMemoryUsage();
      checkMemoryUsage();

      expect(getMemoryStats()).not.toBeNull();

      clearHistory();

      expect(getMemoryStats()).toBeNull();
    });
  });
});
