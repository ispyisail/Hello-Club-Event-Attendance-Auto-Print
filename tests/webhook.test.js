/**
 * @fileoverview Tests for the webhook notification module
 */

jest.mock('axios');
jest.mock('../src/services/logger');

const axios = require('axios');
const logger = require('../src/services/logger');
const {
  sendWebhook,
  notifyEventProcessed,
  notifyEventFailed,
  notifyJobRetry,
  notifyPermanentFailure,
  notifyServiceStatus
} = require('../src/utils/webhook');

describe('Webhook Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('sendWebhook', () => {
    it('should send webhook successfully', async () => {
      axios.post.mockResolvedValue({
        status: 200,
        data: { success: true }
      });

      const result = await sendWebhook('https://example.com/webhook', {
        event: 'test.event',
        data: { foo: 'bar' }
      });

      expect(axios.post).toHaveBeenCalledWith(
        'https://example.com/webhook',
        { event: 'test.event', data: { foo: 'bar' } },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'HelloClub-Event-Attendance/1.0'
          }
        }
      );

      expect(result).toEqual({
        success: true,
        status: 200,
        data: { success: true }
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Webhook sent successfully')
      );
    });

    it('should return failure when URL is not configured', async () => {
      const result = await sendWebhook(null, { event: 'test' });

      expect(result).toEqual({
        success: false,
        reason: 'No URL configured'
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Webhook URL not configured')
      );
    });

    it('should handle HTTP error responses', async () => {
      axios.post.mockRejectedValue({
        response: {
          status: 500,
          statusText: 'Internal Server Error'
        }
      });

      const promise = sendWebhook('https://example.com/webhook', {
        event: 'test.event'
      });

      // Fast-forward through retry delays
      await jest.runAllTimersAsync();

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 500');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle timeout errors', async () => {
      axios.post.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded'
      });

      const promise = sendWebhook('https://example.com/webhook', {
        event: 'test.event'
      });

      // Fast-forward through retry delays
      await jest.runAllTimersAsync();

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should retry on failure up to 2 times', async () => {
      axios.post
        .mockRejectedValueOnce({ message: 'Network error' })
        .mockRejectedValueOnce({ message: 'Network error' })
        .mockResolvedValueOnce({ status: 200, data: {} });

      const promise = sendWebhook('https://example.com/webhook', {
        event: 'test.event'
      });

      // Fast-forward through retry delays
      await jest.runAllTimersAsync();

      const result = await promise;

      expect(axios.post).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Retrying webhook delivery')
      );
    });

    it('should fail after max retries', async () => {
      axios.post.mockRejectedValue({ message: 'Network error' });

      const promise = sendWebhook('https://example.com/webhook', {
        event: 'test.event'
      });

      // Fast-forward through retry delays
      await jest.runAllTimersAsync();

      const result = await promise;

      expect(axios.post).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(result.success).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('failed after 2 retries')
      );
    });
  });

  describe('notifyEventProcessed', () => {
    it('should send event processed notification with correct payload', async () => {
      axios.post.mockResolvedValue({ status: 200, data: {} });

      const event = {
        id: '123',
        name: 'Test Event',
        startDate: '2025-01-01T10:00:00Z'
      };

      await notifyEventProcessed(event, 25, 'https://example.com/webhook');

      expect(axios.post).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          event: 'event.processed',
          data: expect.objectContaining({
            eventId: '123',
            eventName: 'Test Event',
            eventDate: '2025-01-01T10:00:00Z',
            attendeeCount: 25,
            status: 'success'
          })
        }),
        expect.any(Object)
      );
    });
  });

  describe('notifyEventFailed', () => {
    it('should send event failed notification with error message', async () => {
      axios.post.mockResolvedValue({ status: 200, data: {} });

      const event = {
        id: '123',
        name: 'Test Event',
        startDate: '2025-01-01T10:00:00Z'
      };

      await notifyEventFailed(
        event,
        'API timeout error',
        'https://example.com/webhook'
      );

      expect(axios.post).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          event: 'event.failed',
          data: expect.objectContaining({
            eventId: '123',
            eventName: 'Test Event',
            error: 'API timeout error',
            status: 'failed'
          })
        }),
        expect.any(Object)
      );
    });
  });

  describe('notifyJobRetry', () => {
    it('should send job retry notification with retry count', async () => {
      axios.post.mockResolvedValue({ status: 200, data: {} });

      const event = {
        id: '123',
        name: 'Test Event',
        startDate: '2025-01-01T10:00:00Z'
      };

      await notifyJobRetry(event, 2, 3, 'https://example.com/webhook');

      expect(axios.post).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          event: 'job.retrying',
          data: expect.objectContaining({
            eventId: '123',
            eventName: 'Test Event',
            retryCount: 2,
            maxRetries: 3,
            status: 'retrying'
          })
        }),
        expect.any(Object)
      );
    });
  });

  describe('notifyPermanentFailure', () => {
    it('should send permanent failure notification', async () => {
      axios.post.mockResolvedValue({ status: 200, data: {} });

      const event = {
        id: '123',
        name: 'Test Event',
        startDate: '2025-01-01T10:00:00Z'
      };

      await notifyPermanentFailure(
        event,
        'PDF generation failed',
        3,
        'https://example.com/webhook'
      );

      expect(axios.post).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          event: 'job.permanent_failure',
          data: expect.objectContaining({
            eventId: '123',
            eventName: 'Test Event',
            error: 'PDF generation failed',
            retriesAttempted: 3,
            status: 'permanently_failed'
          })
        }),
        expect.any(Object)
      );
    });
  });

  describe('notifyServiceStatus', () => {
    it('should send service status notification', async () => {
      axios.post.mockResolvedValue({ status: 200, data: {} });

      await notifyServiceStatus(
        'started',
        {
          serviceRunIntervalHours: 1,
          fetchWindowHours: 24,
          scheduledJobsCount: 5
        },
        'https://example.com/webhook'
      );

      expect(axios.post).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          event: 'service.status',
          data: expect.objectContaining({
            status: 'started',
            serviceRunIntervalHours: 1,
            fetchWindowHours: 24,
            scheduledJobsCount: 5
          })
        }),
        expect.any(Object)
      );
    });
  });

  describe('Timestamp validation', () => {
    it('should include ISO timestamp in all notifications', async () => {
      axios.post.mockResolvedValue({ status: 200, data: {} });

      const event = {
        id: '123',
        name: 'Test Event',
        startDate: '2025-01-01T10:00:00Z'
      };

      await notifyEventProcessed(event, 10, 'https://example.com/webhook');

      const callArgs = axios.post.mock.calls[0][1];
      expect(callArgs.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });
});
