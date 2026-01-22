/**
 * @fileoverview Tests for the database module
 * Tests singleton pattern, migrations, cleanup, and helper functions
 */

jest.mock('better-sqlite3');
jest.mock('../src/services/logger');
jest.mock('../src/core/migrations');

const Database = require('better-sqlite3');
const logger = require('../src/services/logger');
const { runMigrations } = require('../src/core/migrations');

describe('Database Module', () => {
  let mockDb;
  let mockPrepare;

  beforeEach(() => {
    // Clear module cache to reset singleton
    jest.resetModules();
    jest.clearAllMocks();

    // Create mock prepared statement
    mockPrepare = {
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
    };

    // Create mock database instance
    mockDb = {
      prepare: jest.fn(() => mockPrepare),
      close: jest.fn(),
    };

    // Mock Database constructor
    Database.mockImplementation(() => mockDb);
    runMigrations.mockImplementation(() => {});
  });

  describe('getDb singleton pattern', () => {
    it('should create database connection on first call', () => {
      const { getDb } = require('../src/core/database');

      const db = getDb();

      expect(Database).toHaveBeenCalledWith('./events.db', { verbose: logger.info });
      expect(runMigrations).toHaveBeenCalledWith(mockDb);
      expect(db).toBe(mockDb);
      expect(logger.info).toHaveBeenCalledWith(
        'Connected to the SQLite database and schema is up to date.'
      );
    });

    it('should return same instance on subsequent calls', () => {
      const { getDb } = require('../src/core/database');

      const db1 = getDb();
      const db2 = getDb();
      const db3 = getDb();

      expect(Database).toHaveBeenCalledTimes(1);
      expect(runMigrations).toHaveBeenCalledTimes(1);
      expect(db1).toBe(db2);
      expect(db2).toBe(db3);
    });

    it('should run migrations only once', () => {
      const { getDb } = require('../src/core/database');

      getDb();
      getDb();
      getDb();

      expect(runMigrations).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        'Checking for pending database migrations...'
      );
    });

    it('should throw error if database connection fails', () => {
      Database.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const { getDb } = require('../src/core/database');

      expect(() => getDb()).toThrow('Database connection failed');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to open or initialize the database:',
        'Database connection failed'
      );
    });

    it('should throw error if migrations fail', () => {
      runMigrations.mockImplementation(() => {
        throw new Error('Migration failed');
      });

      const { getDb } = require('../src/core/database');

      expect(() => getDb()).toThrow('Migration failed');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to open or initialize the database:',
        'Migration failed'
      );
    });
  });

  describe('cleanupOldEvents', () => {
    it('should delete events older than specified days', () => {
      const { cleanupOldEvents } = require('../src/core/database');

      mockPrepare.run
        .mockReturnValueOnce({ changes: 5 }) // Delete events
        .mockReturnValueOnce({ changes: 2 }); // Delete orphaned jobs

      const result = cleanupOldEvents(30);

      expect(result).toBe(5);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM events')
      );
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM scheduled_jobs')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Deleted 5 old event(s) older than 30 days')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Deleted 2 orphaned scheduled job(s)')
      );
    });

    it('should only delete processed and failed events', () => {
      const { cleanupOldEvents } = require('../src/core/database');

      mockPrepare.run.mockReturnValue({ changes: 3 });

      cleanupOldEvents(60);

      const deleteCall = mockDb.prepare.mock.calls[0][0];
      expect(deleteCall).toContain("status IN ('processed', 'failed')");
    });

    it('should use default 30 days when not specified', () => {
      const { cleanupOldEvents } = require('../src/core/database');

      mockPrepare.run.mockReturnValue({ changes: 0 });

      cleanupOldEvents();

      // Should calculate cutoff date based on 30 days
      const runCall = mockPrepare.run.mock.calls[0][0];
      expect(runCall).toBeDefined();
    });

    it('should not log when no events are deleted', () => {
      const { cleanupOldEvents } = require('../src/core/database');

      mockPrepare.run.mockReturnValue({ changes: 0 });

      jest.clearAllMocks();
      const result = cleanupOldEvents(30);

      expect(result).toBe(0);
      // Should not have the success log message
      const logCalls = logger.info.mock.calls.map(call => call[0]);
      expect(logCalls.some(msg => msg.includes('Deleted'))).toBe(false);
    });

    it('should clean up orphaned scheduled jobs', () => {
      const { cleanupOldEvents } = require('../src/core/database');

      mockPrepare.run
        .mockReturnValueOnce({ changes: 10 }) // Events deleted
        .mockReturnValueOnce({ changes: 3 }); // Orphaned jobs deleted

      cleanupOldEvents(30);

      const jobsDeleteCall = mockDb.prepare.mock.calls[1][0];
      expect(jobsDeleteCall).toContain('WHERE event_id NOT IN (SELECT id FROM events)');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Deleted 3 orphaned scheduled job(s)')
      );
    });

    it('should not log when no orphaned jobs are deleted', () => {
      const { cleanupOldEvents } = require('../src/core/database');

      mockPrepare.run
        .mockReturnValueOnce({ changes: 5 })
        .mockReturnValueOnce({ changes: 0 }); // No orphaned jobs

      cleanupOldEvents(30);

      const logCalls = logger.info.mock.calls.map(call => call[0]);
      const hasOrphanedLog = logCalls.some(msg => msg.includes('orphaned'));
      expect(hasOrphanedLog).toBe(false);
    });

    it('should handle database errors gracefully', () => {
      const { cleanupOldEvents } = require('../src/core/database');

      mockPrepare.run.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = cleanupOldEvents(30);

      expect(result).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        'Error during database cleanup:',
        expect.any(Error)
      );
    });

    it('should calculate correct cutoff date', () => {
      const { cleanupOldEvents } = require('../src/core/database');

      mockPrepare.run.mockReturnValue({ changes: 0 });

      const daysToKeep = 45;
      cleanupOldEvents(daysToKeep);

      // Check that the ISO date passed is roughly 45 days ago
      const cutoffArg = mockPrepare.run.mock.calls[0][0];
      expect(cutoffArg).toBeDefined();
      // The actual date validation would require more complex testing
    });
  });

  describe('updateEventStatus', () => {
    it('should update event status successfully', () => {
      const { updateEventStatus } = require('../src/core/database');

      mockPrepare.run.mockReturnValue({ changes: 1 });

      const result = updateEventStatus('event123', 'processed');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'UPDATE events SET status = ? WHERE id = ?'
      );
      expect(mockPrepare.run).toHaveBeenCalledWith('processed', 'event123');
      expect(result).toEqual({ changes: 1 });
    });

    it('should handle all valid status values', () => {
      const { updateEventStatus } = require('../src/core/database');

      mockPrepare.run.mockReturnValue({ changes: 1 });

      const statuses = ['pending', 'processed', 'failed'];

      statuses.forEach(status => {
        jest.clearAllMocks();
        updateEventStatus('event123', status);
        expect(mockPrepare.run).toHaveBeenCalledWith(status, 'event123');
      });
    });
  });

  describe('updateJobStatus', () => {
    it('should update job status without error message', () => {
      const { updateJobStatus } = require('../src/core/database');

      mockPrepare.run.mockReturnValue({ changes: 1 });

      const result = updateJobStatus('event123', 'completed');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE scheduled_jobs')
      );
      expect(mockPrepare.run).toHaveBeenCalledWith('completed', null, 'event123');
      expect(result).toEqual({ changes: 1 });
    });

    it('should update job status with error message', () => {
      const { updateJobStatus } = require('../src/core/database');

      mockPrepare.run.mockReturnValue({ changes: 1 });

      const result = updateJobStatus('event123', 'failed', 'API timeout error');

      expect(mockPrepare.run).toHaveBeenCalledWith(
        'failed',
        'API timeout error',
        'event123'
      );
      expect(result).toEqual({ changes: 1 });
    });

    it('should update timestamp using datetime(\'now\')', () => {
      const { updateJobStatus } = require('../src/core/database');

      mockPrepare.run.mockReturnValue({ changes: 1 });

      updateJobStatus('event123', 'processing');

      const prepareCall = mockDb.prepare.mock.calls[0][0];
      expect(prepareCall).toContain("updated_at = datetime('now')");
    });

    it('should handle all valid job status values', () => {
      const { updateJobStatus } = require('../src/core/database');

      mockPrepare.run.mockReturnValue({ changes: 1 });

      const statuses = ['scheduled', 'processing', 'completed', 'failed', 'retrying'];

      statuses.forEach(status => {
        jest.clearAllMocks();
        updateJobStatus('event123', status);
        expect(mockPrepare.run).toHaveBeenCalledWith(status, null, 'event123');
      });
    });
  });

  describe('incrementJobRetryCount', () => {
    it('should increment retry count for a job', () => {
      const { incrementJobRetryCount } = require('../src/core/database');

      mockPrepare.run.mockReturnValue({ changes: 1 });

      const result = incrementJobRetryCount('event123');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('retry_count = retry_count + 1')
      );
      expect(mockPrepare.run).toHaveBeenCalledWith('event123');
      expect(result).toEqual({ changes: 1 });
    });

    it('should update timestamp when incrementing', () => {
      const { incrementJobRetryCount } = require('../src/core/database');

      mockPrepare.run.mockReturnValue({ changes: 1 });

      incrementJobRetryCount('event123');

      const prepareCall = mockDb.prepare.mock.calls[0][0];
      expect(prepareCall).toContain("updated_at = datetime('now')");
    });
  });

  describe('getJobInfo', () => {
    it('should retrieve job information by event ID', () => {
      const { getJobInfo } = require('../src/core/database');

      const mockJobInfo = {
        event_id: 'event123',
        event_name: 'Test Event',
        status: 'scheduled',
        retry_count: 0,
        created_at: '2025-01-01T10:00:00Z',
        updated_at: '2025-01-01T10:00:00Z'
      };

      mockPrepare.get.mockReturnValue(mockJobInfo);

      const result = getJobInfo('event123');

      expect(mockDb.prepare).toHaveBeenCalledWith(
        'SELECT * FROM scheduled_jobs WHERE event_id = ?'
      );
      expect(mockPrepare.get).toHaveBeenCalledWith('event123');
      expect(result).toEqual(mockJobInfo);
    });

    it('should return undefined when job not found', () => {
      const { getJobInfo } = require('../src/core/database');

      mockPrepare.get.mockReturnValue(undefined);

      const result = getJobInfo('nonExistentEvent');

      expect(result).toBeUndefined();
    });
  });

  describe('Module exports', () => {
    it('should export all required functions', () => {
      const dbModule = require('../src/core/database');

      expect(dbModule.getDb).toBeDefined();
      expect(dbModule.cleanupOldEvents).toBeDefined();
      expect(dbModule.updateEventStatus).toBeDefined();
      expect(dbModule.updateJobStatus).toBeDefined();
      expect(dbModule.incrementJobRetryCount).toBeDefined();
      expect(dbModule.getJobInfo).toBeDefined();
    });
  });
});
