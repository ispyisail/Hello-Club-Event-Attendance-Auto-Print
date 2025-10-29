/**
 * Error scenario tests for robust error handling
 */

const { fetchAndStoreUpcomingEvents, processScheduledEvents } = require('../src/functions');
const { getDb } = require('../src/database');

// Mock dependencies
jest.mock('../src/api-client');
jest.mock('../src/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));
jest.mock('../src/status-tracker', () => ({
  recordFetch: jest.fn(),
  recordProcess: jest.fn(),
  recordError: jest.fn()
}));
jest.mock('../src/metrics', () => ({
  incrementCounter: jest.fn(),
  recordTiming: jest.fn()
}));
jest.mock('../src/notifications', () => ({
  notifyEventProcessed: jest.fn(),
  notifyError: jest.fn()
}));
jest.mock('../src/event-filters', () => ({
  applyFilters: jest.fn((events) => events)
}));
jest.mock('pdf-to-printer', () => ({
  print: jest.fn()
}));
jest.mock('../src/email-service', () => ({
  sendEmailWithAttachment: jest.fn()
}));
jest.mock('../src/pdf-generator');

const apiClient = require('../src/api-client');
const logger = require('../src/logger');
const statusTracker = require('../src/status-tracker');
const notifications = require('../src/notifications');
const { print } = require('pdf-to-printer');
const emailService = require('../src/email-service');
const PdfGenerator = require('../src/pdf-generator');

describe('Error Scenario Tests', () => {
  let db;

  beforeAll(() => {
    db = getDb();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    db.prepare('DELETE FROM events').run();

    PdfGenerator.mockImplementation(() => ({
      generate: jest.fn()
    }));
  });

  describe('API Failures', () => {
    it('should handle network errors during event fetch', async () => {
      apiClient.getUpcomingEvents.mockRejectedValue(new Error('Network timeout'));

      const config = {
        fetchWindowHours: 24,
        allowedCategories: []
      };

      await expect(fetchAndStoreUpcomingEvents(config)).rejects.toThrow('Network timeout');
      expect(statusTracker.recordError).toHaveBeenCalledWith(
        'fetchAndStoreUpcomingEvents',
        expect.any(String)
      );
    });

    it('should handle 401 unauthorized errors', async () => {
      const error = new Error('API Error: 401 Unauthorized');
      error.response = { status: 401 };
      apiClient.getUpcomingEvents.mockRejectedValue(error);

      const config = {
        fetchWindowHours: 24,
        allowedCategories: []
      };

      await expect(fetchAndStoreUpcomingEvents(config)).rejects.toThrow();
    });

    it('should handle 429 rate limit errors', async () => {
      const error = new Error('Rate limit exceeded');
      error.response = { status: 429 };
      apiClient.getUpcomingEvents.mockRejectedValue(error);

      const config = {
        fetchWindowHours: 24,
        allowedCategories: []
      };

      await expect(fetchAndStoreUpcomingEvents(config)).rejects.toThrow();
    });

    it('should handle 500 server errors', async () => {
      const error = new Error('Internal server error');
      error.response = { status: 500 };
      apiClient.getUpcomingEvents.mockRejectedValue(error);

      const config = {
        fetchWindowHours: 24,
        allowedCategories: []
      };

      await expect(fetchAndStoreUpcomingEvents(config)).rejects.toThrow();
    });

    it('should handle malformed API responses', async () => {
      apiClient.getUpcomingEvents.mockResolvedValue(null);

      const config = {
        fetchWindowHours: 24,
        allowedCategories: []
      };

      await fetchAndStoreUpcomingEvents(config);

      // Should handle gracefully
      expect(statusTracker.recordFetch).toHaveBeenCalledWith(0);
    });

    it('should handle API returning invalid event data', async () => {
      apiClient.getUpcomingEvents.mockResolvedValue([
        { id: 'event-1' } // Missing required fields
      ]);

      const config = {
        fetchWindowHours: 24,
        allowedCategories: [],
        filters: null
      };

      // Should not crash, but may not store invalid events
      await expect(fetchAndStoreUpcomingEvents(config)).resolves.not.toThrow();
    });
  });

  describe('Database Failures', () => {
    it('should handle database write errors', async () => {
      const mockEvents = [{
        id: 'event-1',
        name: 'Test Event',
        startDate: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        categories: [{ name: 'Sports' }]
      }];

      apiClient.getUpcomingEvents.mockResolvedValue(mockEvents);

      // Mock database to throw error
      const originalPrepare = db.prepare.bind(db);
      db.prepare = jest.fn().mockImplementation((sql) => {
        if (sql.includes('INSERT')) {
          throw new Error('Database write error');
        }
        return originalPrepare(sql);
      });

      const config = {
        fetchWindowHours: 24,
        allowedCategories: [],
        filters: null
      };

      await expect(fetchAndStoreUpcomingEvents(config)).rejects.toThrow();

      // Restore original method
      db.prepare = originalPrepare;
    });

    it('should handle database connection errors during processing', async () => {
      // Insert a test event
      db.prepare(`
        INSERT INTO events (id, name, startDate, status)
        VALUES ('event-1', 'Test', ?, 'pending')
      `).run(new Date(Date.now() + 5 * 60 * 1000).toISOString());

      // Mock API responses
      apiClient.getEventDetails.mockResolvedValue({
        id: 'event-1',
        name: 'Test'
      });
      apiClient.getAllAttendees.mockResolvedValue([
        { id: '1', firstName: 'Test', lastName: 'User' }
      ]);

      // Mock database update to fail
      const originalPrepare = db.prepare.bind(db);
      let callCount = 0;
      db.prepare = jest.fn().mockImplementation((sql) => {
        callCount++;
        if (sql.includes('UPDATE') && callCount > 1) {
          throw new Error('Database update error');
        }
        return originalPrepare(sql);
      });

      const config = {
        preEventQueryMinutes: 10,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'local'
      };

      // Should handle error gracefully
      await expect(processScheduledEvents(config)).resolves.not.toThrow();

      db.prepare = originalPrepare;
    });
  });

  describe('PDF Generation Failures', () => {
    it('should handle PDF generation errors', async () => {
      // Insert event
      db.prepare(`
        INSERT INTO events (id, name, startDate, status)
        VALUES ('event-1', 'Test', ?, 'pending')
      `).run(new Date(Date.now() + 5 * 60 * 1000).toISOString());

      apiClient.getEventDetails.mockResolvedValue({ id: 'event-1', name: 'Test' });
      apiClient.getAllAttendees.mockResolvedValue([
        { id: '1', firstName: 'Test', lastName: 'User' }
      ]);

      // Mock PDF generator to throw error
      PdfGenerator.mockImplementation(() => ({
        generate: jest.fn().mockImplementation(() => {
          throw new Error('PDF generation failed');
        })
      }));

      const config = {
        preEventQueryMinutes: 10,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'local'
      };

      await processScheduledEvents(config);

      // Event should still be marked as processed
      const event = db.prepare('SELECT status FROM events WHERE id = ?').get('event-1');
      expect(event.status).toBe('processed');

      // Error notification should be sent
      expect(notifications.notifyError).toHaveBeenCalled();
    });

    it('should handle PDF file write errors', async () => {
      db.prepare(`
        INSERT INTO events (id, name, startDate, status)
        VALUES ('event-1', 'Test', ?, 'pending')
      `).run(new Date(Date.now() + 5 * 60 * 1000).toISOString());

      apiClient.getEventDetails.mockResolvedValue({ id: 'event-1', name: 'Test' });
      apiClient.getAllAttendees.mockResolvedValue([
        { id: '1', firstName: 'Test', lastName: 'User' }
      ]);

      PdfGenerator.mockImplementation(() => ({
        generate: jest.fn().mockImplementation(() => {
          throw new Error('EACCES: permission denied');
        })
      }));

      const config = {
        preEventQueryMinutes: 10,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'local'
      };

      await processScheduledEvents(config);

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Printer Failures', () => {
    it('should handle local printer errors', async () => {
      db.prepare(`
        INSERT INTO events (id, name, startDate, status)
        VALUES ('event-1', 'Test', ?, 'pending')
      `).run(new Date(Date.now() + 5 * 60 * 1000).toISOString());

      apiClient.getEventDetails.mockResolvedValue({ id: 'event-1', name: 'Test' });
      apiClient.getAllAttendees.mockResolvedValue([
        { id: '1', firstName: 'Test', lastName: 'User' }
      ]);

      // Mock printer to fail
      print.mockRejectedValue(new Error('Printer not found'));

      const config = {
        preEventQueryMinutes: 10,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'local'
      };

      await processScheduledEvents(config);

      // Should log error
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle printer offline errors', async () => {
      db.prepare(`
        INSERT INTO events (id, name, startDate, status)
        VALUES ('event-1', 'Test', ?, 'pending')
      `).run(new Date(Date.now() + 5 * 60 * 1000).toISOString());

      apiClient.getEventDetails.mockResolvedValue({ id: 'event-1', name: 'Test' });
      apiClient.getAllAttendees.mockResolvedValue([
        { id: '1', firstName: 'Test', lastName: 'User' }
      ]);

      print.mockRejectedValue(new Error('Printer is offline'));

      const config = {
        preEventQueryMinutes: 10,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'local'
      };

      await processScheduledEvents(config);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle email sending failures', async () => {
      db.prepare(`
        INSERT INTO events (id, name, startDate, status)
        VALUES ('event-1', 'Test', ?, 'pending')
      `).run(new Date(Date.now() + 5 * 60 * 1000).toISOString());

      apiClient.getEventDetails.mockResolvedValue({ id: 'event-1', name: 'Test' });
      apiClient.getAllAttendees.mockResolvedValue([
        { id: '1', firstName: 'Test', lastName: 'User' }
      ]);

      emailService.sendEmailWithAttachment.mockRejectedValue(
        new Error('SMTP connection failed')
      );

      process.env.PRINTER_EMAIL = 'printer@example.com';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';

      const config = {
        preEventQueryMinutes: 10,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'email'
      };

      await processScheduledEvents(config);

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle SMTP authentication failures', async () => {
      db.prepare(`
        INSERT INTO events (id, name, startDate, status)
        VALUES ('event-1', 'Test', ?, 'pending')
      `).run(new Date(Date.now() + 5 * 60 * 1000).toISOString());

      apiClient.getEventDetails.mockResolvedValue({ id: 'event-1', name: 'Test' });
      apiClient.getAllAttendees.mockResolvedValue([
        { id: '1', firstName: 'Test', lastName: 'User' }
      ]);

      emailService.sendEmailWithAttachment.mockRejectedValue(
        new Error('Invalid login: 535 Authentication failed')
      );

      process.env.PRINTER_EMAIL = 'printer@example.com';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'wrong-password';

      const config = {
        preEventQueryMinutes: 10,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'email'
      };

      await processScheduledEvents(config);

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Event Data Errors', () => {
    it('should handle events with no attendees', async () => {
      db.prepare(`
        INSERT INTO events (id, name, startDate, status)
        VALUES ('event-1', 'Empty Event', ?, 'pending')
      `).run(new Date(Date.now() + 5 * 60 * 1000).toISOString());

      apiClient.getEventDetails.mockResolvedValue({
        id: 'event-1',
        name: 'Empty Event'
      });
      apiClient.getAllAttendees.mockResolvedValue([]);

      const config = {
        preEventQueryMinutes: 10,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'local'
      };

      await processScheduledEvents(config);

      // Should skip PDF generation but mark as processed
      expect(PdfGenerator).not.toHaveBeenCalled();
      expect(print).not.toHaveBeenCalled();

      const event = db.prepare('SELECT status FROM events WHERE id = ?').get('event-1');
      expect(event.status).toBe('processed');
    });

    it('should handle events with null attendees', async () => {
      db.prepare(`
        INSERT INTO events (id, name, startDate, status)
        VALUES ('event-1', 'Null Attendees', ?, 'pending')
      `).run(new Date(Date.now() + 5 * 60 * 1000).toISOString());

      apiClient.getEventDetails.mockResolvedValue({
        id: 'event-1',
        name: 'Null Attendees'
      });
      apiClient.getAllAttendees.mockResolvedValue(null);

      const config = {
        preEventQueryMinutes: 10,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'local'
      };

      await processScheduledEvents(config);

      expect(PdfGenerator).not.toHaveBeenCalled();
    });

    it('should handle malformed attendee data', async () => {
      db.prepare(`
        INSERT INTO events (id, name, startDate, status)
        VALUES ('event-1', 'Bad Data', ?, 'pending')
      `).run(new Date(Date.now() + 5 * 60 * 1000).toISOString());

      apiClient.getEventDetails.mockResolvedValue({
        id: 'event-1',
        name: 'Bad Data'
      });
      apiClient.getAllAttendees.mockResolvedValue([
        { id: '1' }, // Missing firstName, lastName
        { id: '2', firstName: 'Jane' }, // Missing lastName
        null, // Null attendee
        undefined // Undefined attendee
      ]);

      const config = {
        preEventQueryMinutes: 10,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'local'
      };

      // Should handle gracefully
      await expect(processScheduledEvents(config)).resolves.not.toThrow();
    });
  });

  describe('Notification Failures', () => {
    it('should continue processing if notification fails', async () => {
      db.prepare(`
        INSERT INTO events (id, name, startDate, status)
        VALUES ('event-1', 'Test', ?, 'pending')
      `).run(new Date(Date.now() + 5 * 60 * 1000).toISOString());

      apiClient.getEventDetails.mockResolvedValue({ id: 'event-1', name: 'Test' });
      apiClient.getAllAttendees.mockResolvedValue([
        { id: '1', firstName: 'Test', lastName: 'User' }
      ]);

      // Mock notification to fail
      notifications.notifyEventProcessed.mockRejectedValue(
        new Error('Webhook failed')
      );

      const config = {
        preEventQueryMinutes: 10,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'local'
      };

      // Should complete despite notification failure
      await expect(processScheduledEvents(config)).resolves.not.toThrow();

      // Event should still be marked as processed
      const event = db.prepare('SELECT status FROM events WHERE id = ?').get('event-1');
      expect(event.status).toBe('processed');
    });
  });

  describe('Configuration Errors', () => {
    it('should handle missing print mode configuration', async () => {
      db.prepare(`
        INSERT INTO events (id, name, startDate, status)
        VALUES ('event-1', 'Test', ?, 'pending')
      `).run(new Date(Date.now() + 5 * 60 * 1000).toISOString());

      apiClient.getEventDetails.mockResolvedValue({ id: 'event-1', name: 'Test' });
      apiClient.getAllAttendees.mockResolvedValue([
        { id: '1', firstName: 'Test', lastName: 'User' }
      ]);

      const config = {
        preEventQueryMinutes: 10,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: undefined // Missing print mode
      };

      // Should handle gracefully
      await expect(processScheduledEvents(config)).resolves.not.toThrow();
    });
  });

  describe('Concurrent Processing Errors', () => {
    it('should handle race conditions when processing same event', async () => {
      db.prepare(`
        INSERT INTO events (id, name, startDate, status)
        VALUES ('event-1', 'Test', ?, 'pending')
      `).run(new Date(Date.now() + 5 * 60 * 1000).toISOString());

      apiClient.getEventDetails.mockResolvedValue({ id: 'event-1', name: 'Test' });
      apiClient.getAllAttendees.mockResolvedValue([
        { id: '1', firstName: 'Test', lastName: 'User' }
      ]);

      const config = {
        preEventQueryMinutes: 10,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'local'
      };

      // Process same event twice concurrently
      await Promise.all([
        processScheduledEvents(config),
        processScheduledEvents(config)
      ]);

      // Should only be processed once
      const event = db.prepare('SELECT status FROM events WHERE id = ?').get('event-1');
      expect(event.status).toBe('processed');
    });
  });
});
