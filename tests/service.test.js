/**
 * @fileoverview Tests for the service module
 * Tests scheduling, job recovery, retry logic, and error handling
 */

// Mock dependencies BEFORE importing the module
jest.mock('../src/core/database');
jest.mock('../src/core/functions');
jest.mock('../src/utils/webhook');
jest.mock('../src/services/logger');
jest.mock('../src/core/health-check');
jest.mock('../src/core/statistics');

const {
  scheduleEvent,
  recoverPendingJobs,
  isJobAlreadyScheduled,
  processEventWithRetry,
  handleProcessingError,
  scheduleRetry,
  handlePermanentFailure,
  safeWebhookNotify,
  getRetryConfig,
  _getScheduledJobs,
} = require('../src/core/service');

const {
  getDb,
  updateEventStatus,
  updateJobStatus,
  incrementJobRetryCount,
  getJobInfo,
} = require('../src/core/database');

const { processSingleEvent } = require('../src/core/functions');
const { notifyEventProcessed, notifyJobRetry, notifyPermanentFailure } = require('../src/utils/webhook');
const logger = require('../src/services/logger');

describe('Service Module', () => {
  let mockDb;
  let mockStmt;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Clear scheduled jobs map
    const scheduledJobs = _getScheduledJobs();
    scheduledJobs.clear();

    // Setup mock database
    mockStmt = {
      run: jest.fn(() => ({ changes: 1 })),
      get: jest.fn(() => null),
      all: jest.fn(() => []),
    };
    mockDb = {
      prepare: jest.fn(() => mockStmt),
    };
    getDb.mockReturnValue(mockDb);

    // Setup other mocks with default implementations
    updateEventStatus.mockReturnValue({ changes: 1 });
    updateJobStatus.mockReturnValue({ changes: 1 });
    incrementJobRetryCount.mockReturnValue({ changes: 1 });
    getJobInfo.mockReturnValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getRetryConfig', () => {
    it('should return default values when config has no retry section', () => {
      const config = {};
      const result = getRetryConfig(config);

      expect(result.maxRetries).toBe(3);
      expect(result.baseRetryDelay).toBe(5 * 60 * 1000); // 5 minutes
    });

    it('should use config values when provided', () => {
      const config = {
        retry: {
          maxAttempts: 5,
          baseDelayMinutes: 10,
        },
      };
      const result = getRetryConfig(config);

      expect(result.maxRetries).toBe(5);
      expect(result.baseRetryDelay).toBe(10 * 60 * 1000); // 10 minutes
    });
  });

  describe('safeWebhookNotify', () => {
    it('should call the notify function', async () => {
      const mockNotify = jest.fn().mockResolvedValue(undefined);

      await safeWebhookNotify(mockNotify);

      expect(mockNotify).toHaveBeenCalled();
    });

    it('should catch and log errors without throwing', async () => {
      const mockNotify = jest.fn().mockRejectedValue(new Error('Webhook failed'));

      await expect(safeWebhookNotify(mockNotify)).resolves.not.toThrow();
      expect(logger.warn).toHaveBeenCalledWith('Webhook notification failed (non-fatal):', 'Webhook failed');
    });
  });

  describe('isJobAlreadyScheduled', () => {
    it('should return true if job is in memory map', () => {
      const scheduledJobs = _getScheduledJobs();
      scheduledJobs.set(
        'event-1',
        setTimeout(() => {}, 1000)
      );

      const result = isJobAlreadyScheduled('event-1');

      expect(result).toBe(true);
    });

    it('should return true if job is in database with active status', () => {
      mockStmt.get.mockReturnValue({ status: 'scheduled' });

      const result = isJobAlreadyScheduled('event-2');

      expect(result).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('scheduled_jobs'));
    });

    it('should return false if job is not scheduled', () => {
      mockStmt.get.mockReturnValue(null);

      const result = isJobAlreadyScheduled('event-3');

      expect(result).toBe(false);
    });

    it('should return false on database error', () => {
      getDb.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const result = isJobAlreadyScheduled('event-4');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('scheduleEvent', () => {
    it('should schedule event for future processing', () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      const event = {
        id: 'event-1',
        name: 'Test Event',
        startDate: futureDate.toISOString(),
      };
      const config = { preEventQueryMinutes: 5 };

      scheduleEvent(event, config);

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO scheduled_jobs'));
      expect(mockStmt.run).toHaveBeenCalled();

      const scheduledJobs = _getScheduledJobs();
      expect(scheduledJobs.has('event-1')).toBe(true);
    });

    it('should skip already scheduled events', () => {
      const scheduledJobs = _getScheduledJobs();
      scheduledJobs.set(
        'event-1',
        setTimeout(() => {}, 1000)
      );

      const event = { id: 'event-1', name: 'Test', startDate: new Date().toISOString() };

      scheduleEvent(event, { preEventQueryMinutes: 5 });

      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('already has an active job'));
    });

    it('should not schedule past events beyond grace period', () => {
      const pastDate = new Date(Date.now() - 2 * 3600000); // 2 hours ago (beyond 1hr grace)
      const event = {
        id: 'event-2',
        name: 'Past Event',
        startDate: pastDate.toISOString(),
      };
      const config = { preEventQueryMinutes: 5 };

      scheduleEvent(event, config);

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('too far in the past'));

      const scheduledJobs = _getScheduledJobs();
      expect(scheduledJobs.has('event-2')).toBe(false);
    });

    it('should continue scheduling even if database persist fails', () => {
      mockStmt.run.mockImplementation(() => {
        throw new Error('DB write failed');
      });

      const futureDate = new Date(Date.now() + 3600000);
      const event = {
        id: 'event-3',
        name: 'Test Event',
        startDate: futureDate.toISOString(),
      };

      scheduleEvent(event, { preEventQueryMinutes: 5 });

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to persist job'), expect.any(Error));

      // Should still be scheduled in memory
      const scheduledJobs = _getScheduledJobs();
      expect(scheduledJobs.has('event-3')).toBe(true);
    });
  });

  describe('processEventWithRetry', () => {
    it('should process event successfully and update status', async () => {
      const event = { id: 'event-1', name: 'Test Event' };
      const config = {};

      processSingleEvent.mockResolvedValue({ attendeeCount: 10 });

      await processEventWithRetry(event, config);

      expect(processSingleEvent).toHaveBeenCalledWith(event, config);
      expect(updateJobStatus).toHaveBeenCalledWith('event-1', 'completed');
      expect(updateEventStatus).toHaveBeenCalledWith('event-1', 'processed');
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('completed successfully'));
    });

    it('should send webhook notification on success if enabled', async () => {
      const event = { id: 'event-1', name: 'Test Event' };
      const config = {
        webhook: { enabled: true, url: 'https://example.com/webhook' },
      };

      processSingleEvent.mockResolvedValue({ attendeeCount: 5 });
      notifyEventProcessed.mockResolvedValue(undefined);

      await processEventWithRetry(event, config);

      expect(notifyEventProcessed).toHaveBeenCalledWith(event, 5, 'https://example.com/webhook');
    });

    it('should call handleProcessingError on failure', async () => {
      const event = { id: 'event-1', name: 'Test Event' };
      const config = { retry: { maxAttempts: 3, baseDelayMinutes: 5 } };
      const error = new Error('Processing failed');

      processSingleEvent.mockRejectedValue(error);
      getJobInfo.mockReturnValue({ retry_count: 0, status: 'processing' });

      await processEventWithRetry(event, config);

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error processing event'), error);
    });
  });

  describe('handleProcessingError', () => {
    it('should schedule retry when retries remain', async () => {
      const event = { id: 'event-1', name: 'Test Event' };
      const config = { retry: { maxAttempts: 3, baseDelayMinutes: 5 } };
      const error = new Error('Processing failed');

      getJobInfo.mockReturnValue({ retry_count: 0, status: 'processing' });

      await handleProcessingError(event, config, error);

      expect(incrementJobRetryCount).toHaveBeenCalledWith('event-1');
      expect(updateJobStatus).toHaveBeenCalledWith('event-1', 'retrying', error.message);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Scheduling retry 1/3'));
    });

    it('should call handlePermanentFailure when max retries reached', async () => {
      const event = { id: 'event-1', name: 'Test Event' };
      const config = { retry: { maxAttempts: 3, baseDelayMinutes: 5 } };
      const error = new Error('Processing failed');

      getJobInfo.mockReturnValue({ retry_count: 3, status: 'retrying' });

      await handleProcessingError(event, config, error);

      expect(updateJobStatus).toHaveBeenCalledWith('event-1', 'failed', error.message);
      expect(updateEventStatus).toHaveBeenCalledWith('event-1', 'failed');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('permanently failed'));
    });
  });

  describe('scheduleRetry', () => {
    it('should schedule retry with exponential backoff', () => {
      const event = { id: 'event-1', name: 'Test Event' };
      const config = { retry: { maxAttempts: 3, baseDelayMinutes: 5 } };
      const error = new Error('Failed');

      scheduleRetry(event, config, 0, error);

      expect(incrementJobRetryCount).toHaveBeenCalledWith('event-1');
      expect(updateJobStatus).toHaveBeenCalledWith('event-1', 'retrying', error.message);

      const scheduledJobs = _getScheduledJobs();
      expect(scheduledJobs.has('event-1')).toBe(true);
    });

    it('should send webhook notification if enabled', () => {
      const event = { id: 'event-1', name: 'Test Event' };
      const config = {
        retry: { maxAttempts: 3, baseDelayMinutes: 5 },
        webhook: { enabled: true, url: 'https://example.com/webhook' },
      };
      const error = new Error('Failed');

      scheduleRetry(event, config, 1, error);

      expect(notifyJobRetry).toHaveBeenCalled();
    });
  });

  describe('handlePermanentFailure', () => {
    it('should mark event and job as failed', async () => {
      const event = { id: 'event-1', name: 'Test Event' };
      const config = {};
      const error = new Error('Failed permanently');

      await handlePermanentFailure(event, config, error, 3);

      expect(updateJobStatus).toHaveBeenCalledWith('event-1', 'failed', error.message);
      expect(updateEventStatus).toHaveBeenCalledWith('event-1', 'failed');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('permanently failed after 3 retries'));
    });

    it('should send webhook notification if enabled', async () => {
      const event = { id: 'event-1', name: 'Test Event' };
      const config = {
        webhook: { enabled: true, url: 'https://example.com/webhook' },
      };
      const error = new Error('Failed permanently');

      notifyPermanentFailure.mockResolvedValue(undefined);

      await handlePermanentFailure(event, config, error, 3);

      expect(notifyPermanentFailure).toHaveBeenCalledWith(event, error.message, 3, 'https://example.com/webhook');
    });
  });

  describe('recoverPendingJobs', () => {
    it('should reschedule pending jobs on startup', () => {
      const futureTime = new Date(Date.now() + 60000).toISOString();
      mockStmt.all.mockReturnValue([
        {
          event_id: 'e1',
          event_name: 'Event 1',
          scheduled_time: futureTime,
          startDate: new Date(Date.now() + 120000).toISOString(),
        },
      ]);

      recoverPendingJobs({ preEventQueryMinutes: 5 });

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Recovering 1 pending job'));
    });

    it('should mark past-due jobs as failed', () => {
      const pastTime = new Date(Date.now() - 60000).toISOString();
      mockStmt.all.mockReturnValue([
        {
          event_id: 'e1',
          event_name: 'Past Event',
          scheduled_time: pastTime,
          startDate: pastTime,
        },
      ]);

      recoverPendingJobs({ preEventQueryMinutes: 5 });

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('missed scheduled time'));
      expect(mockStmt.run).toHaveBeenCalled();
    });

    it('should log when no pending jobs exist', () => {
      mockStmt.all.mockReturnValue([]);

      recoverPendingJobs({});

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('No pending jobs to recover'));
    });

    it('should handle database errors gracefully', () => {
      getDb.mockImplementation(() => {
        throw new Error('DB Error');
      });

      expect(() => recoverPendingJobs({})).not.toThrow();
      expect(logger.error).toHaveBeenCalledWith('Error recovering pending jobs:', expect.any(Error));
    });

    it('should bypass isJobAlreadyScheduled during recovery', () => {
      // Simulate a recovered job: DB has status='scheduled' but no in-memory setTimeout
      const futureStart = new Date(Date.now() + 120000).toISOString();
      const futureScheduled = new Date(Date.now() + 60000).toISOString();

      mockStmt.all.mockReturnValue([
        {
          event_id: 'recovered-1',
          event_name: 'Recovered Event',
          scheduled_time: futureScheduled,
          startDate: futureStart,
        },
      ]);

      // Make isJobAlreadyScheduled's DB check return a 'scheduled' job
      // (simulates the stale DB record that caused the original bug)
      mockStmt.get.mockReturnValue({ status: 'scheduled' });

      recoverPendingJobs({ preEventQueryMinutes: 1 });

      // The job should still be scheduled in memory despite the DB check
      const scheduledJobs = _getScheduledJobs();
      expect(scheduledJobs.has('recovered-1')).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Recovered job for event'));
    });
  });
});
