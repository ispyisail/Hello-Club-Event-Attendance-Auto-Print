/**
 * @fileoverview Tests for the statistics module
 * Tests statistics generation, success rates, retry rates, and performance metrics
 */

jest.mock('../src/core/database');
jest.mock('../src/services/logger');

const { getDb } = require('../src/core/database');
const logger = require('../src/services/logger');
const fs = require('fs');

describe('Statistics Module', () => {
  let mockDb;
  let mockPrepare;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock prepared statement
    mockPrepare = {
      all: jest.fn(),
      get: jest.fn(),
    };

    // Create mock database instance
    mockDb = {
      prepare: jest.fn(() => mockPrepare),
    };

    getDb.mockReturnValue(mockDb);
  });

  describe('getStatistics', () => {
    it('should generate comprehensive statistics', () => {
      const { getStatistics } = require('../src/core/statistics');

      // Mock event stats
      mockPrepare.all
        .mockReturnValueOnce([
          { status: 'processed', count: 80 },
          { status: 'failed', count: 15 },
          { status: 'pending', count: 5 }
        ])
        // Mock job stats
        .mockReturnValueOnce([
          { status: 'completed', count: 75, avg_retries: 0.5 },
          { status: 'failed', count: 20, avg_retries: 2.3 },
          { status: 'retrying', count: 5, avg_retries: 1.8 }
        ])
        // Mock performance data
        .mockReturnValueOnce([
          { processing_days: 0.001, status: 'completed' },
          { processing_days: 0.002, status: 'completed' },
          { processing_days: 0.003, status: 'completed' }
        ])
        // Mock recent activity
        .mockReturnValueOnce([
          {
            event_id: 'evt1',
            event_name: 'Event 1',
            status: 'completed',
            retry_count: 0,
            error_message: null,
            updated_at: '2025-01-22T10:00:00Z',
            startDate: '2025-01-23T14:00:00Z'
          }
        ]);

      mockPrepare.get
        .mockReturnValueOnce({ count: 10 }) // Retried jobs
        .mockReturnValueOnce({ count: 5 })  // Current pending
        .mockReturnValueOnce({ count: 3 })  // Current failed
        .mockReturnValueOnce({ count: 2 }); // Current retrying

      const stats = getStatistics(7);

      expect(stats.period).toBe('Last 7 days');
      expect(stats.generated_at).toBeDefined();
      expect(stats.events.total).toBe(100);
      expect(stats.events.byStatus.processed).toBe(80);
      expect(stats.events.byStatus.failed).toBe(15);
      expect(stats.events.byStatus.pending).toBe(5);
      expect(stats.events.successRate).toBe('80.00%');

      expect(stats.jobs.total).toBe(100);
      expect(stats.jobs.byStatus.completed.count).toBe(75);
      expect(stats.jobs.byStatus.completed.avgRetries).toBe('0.50');
      expect(stats.jobs.requiredRetries).toBe(10);
      expect(stats.jobs.retryRate).toBe('10.00%');

      expect(stats.performance).toBeDefined();
      expect(stats.recentActivity).toHaveLength(1);
      expect(stats.currentStatus.pending).toBe(5);
      expect(stats.currentStatus.failed).toBe(3);
      expect(stats.currentStatus.retrying).toBe(2);
    });

    it('should handle zero total events', () => {
      const { getStatistics } = require('../src/core/statistics');

      mockPrepare.all.mockReturnValue([]);
      mockPrepare.get.mockReturnValue({ count: 0 });

      const stats = getStatistics(7);

      expect(stats.events.total).toBe(0);
      expect(stats.events.successRate).toBe('0%');
    });

    it('should handle zero total jobs', () => {
      const { getStatistics } = require('../src/core/statistics');

      mockPrepare.all
        .mockReturnValueOnce([{ status: 'pending', count: 5 }])
        .mockReturnValueOnce([]) // No jobs
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      mockPrepare.get.mockReturnValue({ count: 0 });

      const stats = getStatistics(7);

      expect(stats.jobs.total).toBe(0);
      expect(stats.jobs.retryRate).toBe('0%');
    });

    it('should calculate success rate correctly', () => {
      const { getStatistics } = require('../src/core/statistics');

      mockPrepare.all
        .mockReturnValueOnce([
          { status: 'processed', count: 45 },
          { status: 'failed', count: 5 }
        ])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      mockPrepare.get.mockReturnValue({ count: 0 });

      const stats = getStatistics(7);

      expect(stats.events.successRate).toBe('90.00%');
    });

    it('should calculate retry rate correctly', () => {
      const { getStatistics } = require('../src/core/statistics');

      mockPrepare.all
        .mockReturnValueOnce([])
        .mockReturnValueOnce([
          { status: 'completed', count: 70, avg_retries: 0 },
          { status: 'failed', count: 30, avg_retries: 2 }
        ])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      mockPrepare.get
        .mockReturnValueOnce({ count: 25 }) // Jobs that required retries
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 0 });

      const stats = getStatistics(7);

      expect(stats.jobs.retryRate).toBe('25.00%');
    });

    it('should calculate performance metrics', () => {
      const { getStatistics } = require('../src/core/statistics');

      mockPrepare.all
        .mockReturnValueOnce([])
        .mockReturnValueOnce([])
        // Performance data: convert to minutes (days * 24 * 60)
        .mockReturnValueOnce([
          { processing_days: 0.001, status: 'completed' }, // ~1.44 minutes
          { processing_days: 0.002, status: 'completed' }, // ~2.88 minutes
          { processing_days: 0.003, status: 'completed' }  // ~4.32 minutes
        ])
        .mockReturnValueOnce([]);

      mockPrepare.get.mockReturnValue({ count: 0 });

      const stats = getStatistics(7);

      expect(stats.performance.avgProcessingTime).toBeDefined();
      expect(stats.performance.maxProcessingTime).toBeDefined();
      expect(stats.performance.minProcessingTime).toBeDefined();
    });

    it('should handle zero processing times', () => {
      const { getStatistics } = require('../src/core/statistics');

      mockPrepare.all
        .mockReturnValueOnce([])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([
          { processing_days: 0, status: 'completed' }
        ])
        .mockReturnValueOnce([]);

      mockPrepare.get.mockReturnValue({ count: 0 });

      const stats = getStatistics(7);

      // Should filter out zero processing times
      expect(stats.performance).toBeDefined();
    });

    it('should format recent activity correctly', () => {
      const { getStatistics } = require('../src/core/statistics');

      mockPrepare.all
        .mockReturnValueOnce([])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([
          {
            event_id: 'evt1',
            event_name: 'Test Event',
            status: 'completed',
            retry_count: 2,
            error_message: null,
            updated_at: '2025-01-22T10:00:00Z',
            startDate: '2025-01-23T14:00:00Z'
          },
          {
            event_id: 'evt2',
            event_name: 'Failed Event',
            status: 'failed',
            retry_count: 3,
            error_message: 'API timeout',
            updated_at: '2025-01-22T09:00:00Z',
            startDate: '2025-01-23T15:00:00Z'
          }
        ]);

      mockPrepare.get.mockReturnValue({ count: 0 });

      const stats = getStatistics(7);

      expect(stats.recentActivity).toHaveLength(2);
      expect(stats.recentActivity[0]).toEqual({
        eventId: 'evt1',
        eventName: 'Test Event',
        status: 'completed',
        retryCount: 2,
        error: null,
        lastUpdated: '2025-01-22T10:00:00Z',
        eventDate: '2025-01-23T14:00:00Z'
      });
      expect(stats.recentActivity[1].error).toBe('API timeout');
    });

    it('should use custom time window', () => {
      const { getStatistics } = require('../src/core/statistics');

      mockPrepare.all.mockReturnValue([]);
      mockPrepare.get.mockReturnValue({ count: 0 });

      const stats = getStatistics(30);

      expect(stats.period).toBe('Last 30 days');
    });

    it('should handle database errors gracefully', () => {
      const { getStatistics } = require('../src/core/statistics');

      mockPrepare.all.mockImplementation(() => {
        throw new Error('Database query failed');
      });

      const stats = getStatistics(7);

      expect(stats.error).toBe('Database query failed');
      expect(logger.error).toHaveBeenCalledWith(
        'Error generating statistics:',
        expect.any(Error)
      );
    });

    it('should handle missing job status data', () => {
      const { getStatistics } = require('../src/core/statistics');

      mockPrepare.all
        .mockReturnValueOnce([{ status: 'processed', count: 10 }])
        .mockReturnValueOnce([]) // No job data
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      mockPrepare.get.mockReturnValue({ count: 0 });

      const stats = getStatistics(7);

      expect(stats.jobs.total).toBe(0);
      expect(stats.jobs.byStatus).toEqual({});
    });
  });

  describe('getStatisticsSummary', () => {
    it('should generate formatted summary string', () => {
      const { getStatisticsSummary } = require('../src/core/statistics');

      mockPrepare.all
        .mockReturnValueOnce([
          { status: 'processed', count: 80 },
          { status: 'failed', count: 15 },
          { status: 'pending', count: 5 }
        ])
        .mockReturnValueOnce([
          { status: 'completed', count: 75, avg_retries: 0.5 },
          { status: 'failed', count: 20, avg_retries: 2 },
          { status: 'retrying', count: 5, avg_retries: 1 }
        ])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      mockPrepare.get
        .mockReturnValueOnce({ count: 10 })
        .mockReturnValueOnce({ count: 5 })
        .mockReturnValueOnce({ count: 3 })
        .mockReturnValueOnce({ count: 2 });

      const summary = getStatisticsSummary();

      expect(summary).toContain('Statistics Summary (Last 7 days)');
      expect(summary).toContain('Events: 100 total');
      expect(summary).toContain('Processed: 80');
      expect(summary).toContain('Failed: 15');
      expect(summary).toContain('Pending: 5');
      expect(summary).toContain('Success Rate: 80.00%');
      expect(summary).toContain('Jobs: 100 total');
      expect(summary).toContain('Completed: 75');
      expect(summary).toContain('Retry Rate: 10.00%');
    });

    it('should handle missing data gracefully', () => {
      const { getStatisticsSummary } = require('../src/core/statistics');

      mockPrepare.all.mockReturnValue([]);
      mockPrepare.get.mockReturnValue({ count: 0 });

      const summary = getStatisticsSummary();

      expect(summary).toContain('Events: 0 total');
      expect(summary).toContain('Processed: 0');
      expect(summary).toContain('Success Rate: 0%');
    });
  });

  describe('writeStatisticsFile', () => {
    beforeEach(() => {
      // Mock fs.writeFileSync
      jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    });

    afterEach(() => {
      fs.writeFileSync.mockRestore();
    });

    it('should write statistics to JSON file', () => {
      const { writeStatisticsFile } = require('../src/core/statistics');

      mockPrepare.all.mockReturnValue([]);
      mockPrepare.get.mockReturnValue({ count: 0 });

      writeStatisticsFile('test-stats.json');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'test-stats.json',
        expect.any(String)
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Statistics written to test-stats.json'
      );
    });

    it('should use default filename if not specified', () => {
      const { writeStatisticsFile } = require('../src/core/statistics');

      mockPrepare.all.mockReturnValue([]);
      mockPrepare.get.mockReturnValue({ count: 0 });

      writeStatisticsFile();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'statistics.json',
        expect.any(String)
      );
    });

    it('should write properly formatted JSON', () => {
      const { writeStatisticsFile } = require('../src/core/statistics');

      mockPrepare.all.mockReturnValue([]);
      mockPrepare.get.mockReturnValue({ count: 0 });

      writeStatisticsFile('test.json');

      const jsonContent = fs.writeFileSync.mock.calls[0][1];
      expect(() => JSON.parse(jsonContent)).not.toThrow();

      const parsed = JSON.parse(jsonContent);
      expect(parsed.period).toBe('Last 30 days'); // Uses 30 days for file output
    });

    it('should handle write errors gracefully', () => {
      const { writeStatisticsFile } = require('../src/core/statistics');

      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Write permission denied');
      });

      mockPrepare.all.mockReturnValue([]);
      mockPrepare.get.mockReturnValue({ count: 0 });

      writeStatisticsFile('test.json');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to write statistics file:',
        expect.any(Error)
      );
    });
  });

  describe('Module exports', () => {
    it('should export all required functions', () => {
      const statsModule = require('../src/core/statistics');

      expect(statsModule.getStatistics).toBeDefined();
      expect(statsModule.getStatisticsSummary).toBeDefined();
      expect(statsModule.writeStatisticsFile).toBeDefined();
    });
  });
});
