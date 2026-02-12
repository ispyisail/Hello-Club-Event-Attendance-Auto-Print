/**
 * @fileoverview Tests for the health check module
 * Tests health status reporting and file writing
 */

// Mock dependencies BEFORE importing the module
jest.mock('../src/core/database');
jest.mock('../src/core/api-client');
jest.mock('../src/utils/memory-monitor');
jest.mock('fs');

const { getHealthStatus, writeHealthFile, startHealthChecks } = require('../src/core/health-check');
const { getDb, checkDatabaseHealth } = require('../src/core/database');
const { getCacheStats, getCircuitBreakerStatus } = require('../src/core/api-client');
const { getMemoryStats } = require('../src/utils/memory-monitor');
const fs = require('fs');

describe('Health Check Module', () => {
  let mockDb;
  let mockStmt;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup mock database
    mockStmt = {
      get: jest.fn(() => ({ count: 5 })),
    };
    mockDb = {
      prepare: jest.fn(() => mockStmt),
    };
    getDb.mockReturnValue(mockDb);

    // Setup mock cache stats
    getCacheStats.mockReturnValue({
      total: 10,
      maxSize: 1000,
      valid: 8,
      expired: 2,
      utilizationPercent: 1,
    });

    // Setup mock database health
    checkDatabaseHealth.mockReturnValue({ healthy: true, lastCheck: new Date().toISOString() });

    // Setup mock circuit breaker status
    getCircuitBreakerStatus.mockReturnValue({ state: 'CLOSED', failures: 0, successes: 0 });

    // Setup mock memory stats
    getMemoryStats.mockReturnValue(null);

    // Setup mock fs
    fs.existsSync.mockReturnValue(true);
    fs.writeFileSync.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when all checks pass', () => {
      const status = getHealthStatus();

      expect(status.status).toBe('healthy');
      expect(status.timestamp).toBeDefined();
      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.memory).toBeDefined();
      expect(status.checks).toBeDefined();
    });

    it('should include database check with event count', () => {
      mockStmt.get.mockReturnValueOnce({ count: 15 });

      const status = getHealthStatus();

      expect(status.checks.database.status).toBe('ok');
      expect(status.checks.database.eventCount).toBe(15);
    });

    it('should return unhealthy when database fails', () => {
      getDb.mockImplementation(() => {
        throw new Error('DB Connection Failed');
      });

      const status = getHealthStatus();

      expect(status.status).toBe('unhealthy');
      expect(status.checks.database.status).toBe('error');
      expect(status.checks.database.error).toBe('DB Connection Failed');
    });

    it('should check log file existence', () => {
      fs.existsSync
        .mockReturnValueOnce(true) // activity.log
        .mockReturnValueOnce(true); // error.log

      const status = getHealthStatus();

      expect(status.checks.logging.status).toBe('ok');
      expect(status.checks.logging.activityLog).toBe(true);
      expect(status.checks.logging.errorLog).toBe(true);
    });

    it('should return warning when log files are missing', () => {
      fs.existsSync
        .mockReturnValueOnce(false) // activity.log missing
        .mockReturnValueOnce(true); // error.log exists

      const status = getHealthStatus();

      expect(status.checks.logging.status).toBe('warning');
      expect(status.checks.logging.activityLog).toBe(false);
    });

    it('should include cache stats', () => {
      getCacheStats.mockReturnValue({
        total: 25,
        maxSize: 1000,
        valid: 20,
        expired: 5,
        utilizationPercent: 2.5,
      });

      const status = getHealthStatus();

      expect(status.checks.cache.status).toBe('ok');
      expect(status.checks.cache.total).toBe(25);
      expect(status.checks.cache.valid).toBe(20);
    });

    it('should handle cache stats error', () => {
      getCacheStats.mockImplementation(() => {
        throw new Error('Cache error');
      });

      const status = getHealthStatus();

      expect(status.checks.cache.status).toBe('error');
      expect(status.checks.cache.error).toBe('Cache error');
    });

    it('should include job counts', () => {
      mockStmt.get
        .mockReturnValueOnce({ count: 10 }) // events count
        .mockReturnValueOnce({ count: 3 }) // pending jobs
        .mockReturnValueOnce({ count: 1 }); // failed jobs

      const status = getHealthStatus();

      expect(status.checks.jobs.status).toBe('ok');
      expect(status.checks.jobs.pending).toBe(3);
      expect(status.checks.jobs.failed).toBe(1);
    });

    it('should return degraded status when many jobs have failed', () => {
      mockStmt.get
        .mockReturnValueOnce({ count: 10 }) // events count
        .mockReturnValueOnce({ count: 2 }) // pending jobs
        .mockReturnValueOnce({ count: 10 }); // failed jobs (>5)

      const status = getHealthStatus();

      expect(status.status).toBe('degraded');
      expect(status.checks.jobs.failed).toBe(10);
    });

    it('should handle jobs query error', () => {
      // First call for events succeeds, then jobs queries fail
      mockDb.prepare
        .mockReturnValueOnce({ get: jest.fn(() => ({ count: 5 })) }) // events
        .mockReturnValueOnce({
          get: jest.fn(() => {
            throw new Error('Query failed');
          }),
        }); // pending jobs

      const status = getHealthStatus();

      expect(status.checks.jobs.status).toBe('error');
    });
  });

  describe('writeHealthFile', () => {
    it('should write health status to file', () => {
      writeHealthFile();

      expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('service-health.json'), expect.any(String));
    });

    it('should write valid JSON', () => {
      writeHealthFile();

      const writtenData = fs.writeFileSync.mock.calls[0][1];
      expect(() => JSON.parse(writtenData)).not.toThrow();
    });

    it('should handle write errors gracefully', () => {
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Write failed');
      });

      // Should not throw
      expect(() => writeHealthFile()).not.toThrow();
    });

    it('should include all health check data in written file', () => {
      writeHealthFile();

      const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);

      expect(writtenData.timestamp).toBeDefined();
      expect(writtenData.status).toBeDefined();
      expect(writtenData.checks).toBeDefined();
      expect(writtenData.checks.database).toBeDefined();
      expect(writtenData.checks.logging).toBeDefined();
      expect(writtenData.checks.cache).toBeDefined();
      expect(writtenData.checks.jobs).toBeDefined();
    });
  });

  describe('startHealthChecks', () => {
    it('should write initial health file immediately', () => {
      startHealthChecks(60);

      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    });

    it('should set up periodic health checks', () => {
      startHealthChecks(30);

      // Initial write
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

      // Advance time by 30 seconds
      jest.advanceTimersByTime(30000);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);

      // Advance time by another 30 seconds
      jest.advanceTimersByTime(30000);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(3);
    });

    it('should use default interval of 60 seconds', () => {
      startHealthChecks();

      // Initial write
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

      // Advance time by 59 seconds - should not trigger
      jest.advanceTimersByTime(59000);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

      // Advance time by 1 more second (60 total) - should trigger
      jest.advanceTimersByTime(1000);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    });
  });
});
