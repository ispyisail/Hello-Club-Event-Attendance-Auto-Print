/**
 * Integration tests for end-to-end event processing workflow
 */

const { fetchAndStoreUpcomingEvents, processScheduledEvents } = require('../../src/functions');
const { getDb } = require('../../src/database');

// Mock dependencies
jest.mock('../../src/api-client');
jest.mock('../../src/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));
jest.mock('../../src/status-tracker', () => ({
  recordFetch: jest.fn(),
  recordProcess: jest.fn(),
  recordError: jest.fn()
}));
jest.mock('../../src/metrics', () => ({
  incrementCounter: jest.fn(),
  recordTiming: jest.fn()
}));
jest.mock('../../src/notifications', () => ({
  notifyEventProcessed: jest.fn(),
  notifyError: jest.fn()
}));
jest.mock('../../src/event-filters', () => ({
  applyFilters: jest.fn((events) => events)
}));
jest.mock('pdf-to-printer', () => ({
  print: jest.fn().mockResolvedValue('Print successful')
}));
jest.mock('../../src/email-service', () => ({
  sendEmailWithAttachment: jest.fn().mockResolvedValue(true)
}));
jest.mock('../../src/pdf-generator');

const apiClient = require('../../src/api-client');
const logger = require('../../src/logger');
const statusTracker = require('../../src/status-tracker');
const metrics = require('../../src/metrics');
const notifications = require('../../src/notifications');
const eventFilters = require('../../src/event-filters');
const { print } = require('pdf-to-printer');
const PdfGenerator = require('../../src/pdf-generator');

describe('Event Processing Integration Tests', () => {
  let db;

  beforeAll(() => {
    // Initialize in-memory database for testing
    db = getDb();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Clear database
    db.prepare('DELETE FROM events').run();

    // Mock PDF Generator
    PdfGenerator.mockImplementation(() => ({
      generate: jest.fn()
    }));
  });

  describe('Complete Event Lifecycle', () => {
    it('should fetch, store, and process an event end-to-end', async () => {
      // Setup: Mock API responses
      const mockEvents = [
        {
          id: 'event-123',
          name: 'Test Event',
          startDate: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
          categories: [{ name: 'Sports' }]
        }
      ];

      const mockEventDetails = {
        ...mockEvents[0],
        location: 'Test Location',
        timezone: 'America/Los_Angeles'
      };

      const mockAttendees = [
        { id: '1', firstName: 'John', lastName: 'Doe', phone: '123-456-7890' },
        { id: '2', firstName: 'Jane', lastName: 'Smith', phone: '098-765-4321' }
      ];

      apiClient.getUpcomingEvents.mockResolvedValue(mockEvents);
      apiClient.getEventDetails.mockResolvedValue(mockEventDetails);
      apiClient.getAllAttendees.mockResolvedValue(mockAttendees);

      const config = {
        fetchWindowHours: 24,
        allowedCategories: ['Sports'],
        preEventQueryMinutes: 15,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'local',
        filters: null
      };

      // Step 1: Fetch and store events
      await fetchAndStoreUpcomingEvents(config);

      // Verify event was stored
      const storedEvents = db.prepare('SELECT * FROM events').all();
      expect(storedEvents).toHaveLength(1);
      expect(storedEvents[0].id).toBe('event-123');
      expect(storedEvents[0].status).toBe('pending');

      // Verify metrics were recorded
      expect(metrics.incrementCounter).toHaveBeenCalledWith('eventsFetched', 1);
      expect(metrics.recordTiming).toHaveBeenCalled();
      expect(statusTracker.recordFetch).toHaveBeenCalledWith(1);

      // Step 2: Process the event
      await processScheduledEvents(config);

      // Verify event was processed
      const processedEvents = db.prepare('SELECT * FROM events WHERE status = ?').all('processed');
      expect(processedEvents).toHaveLength(1);

      // Verify PDF generation and printing
      expect(PdfGenerator).toHaveBeenCalledWith(
        mockEventDetails,
        mockAttendees,
        expect.any(Object)
      );
      expect(print).toHaveBeenCalled();

      // Verify notification was sent
      expect(notifications.notifyEventProcessed).toHaveBeenCalledWith(
        'Test Event',
        2,
        'local'
      );
    });

    it('should handle multiple events in the workflow', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          name: 'Event One',
          startDate: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          categories: [{ name: 'Sports' }]
        },
        {
          id: 'event-2',
          name: 'Event Two',
          startDate: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          categories: [{ name: 'Sports' }]
        },
        {
          id: 'event-3',
          name: 'Event Three',
          startDate: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          categories: [{ name: 'Community' }] // Different category
        }
      ];

      apiClient.getUpcomingEvents.mockResolvedValue(mockEvents);
      apiClient.getEventDetails.mockImplementation((id) =>
        Promise.resolve(mockEvents.find(e => e.id === id))
      );
      apiClient.getAllAttendees.mockResolvedValue([
        { id: '1', firstName: 'Test', lastName: 'User' }
      ]);

      const config = {
        fetchWindowHours: 24,
        allowedCategories: ['Sports'], // Only Sports events
        preEventQueryMinutes: 20,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'local',
        filters: null
      };

      // Fetch and store
      await fetchAndStoreUpcomingEvents(config);

      // Should store only Sports events (2 out of 3)
      const storedEvents = db.prepare('SELECT * FROM events').all();
      expect(storedEvents).toHaveLength(2);

      // Process events
      await processScheduledEvents(config);

      // Both should be processed
      const processedEvents = db.prepare('SELECT * FROM events WHERE status = ?').all('processed');
      expect(processedEvents).toHaveLength(2);
    });
  });

  describe('Category Filtering', () => {
    it('should filter events by configured categories', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          name: 'Sports Event',
          startDate: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          categories: [{ name: 'Sports' }]
        },
        {
          id: 'event-2',
          name: 'Music Event',
          startDate: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          categories: [{ name: 'Music' }]
        }
      ];

      apiClient.getUpcomingEvents.mockResolvedValue(mockEvents);

      const config = {
        fetchWindowHours: 24,
        allowedCategories: ['Sports'],
        filters: null
      };

      await fetchAndStoreUpcomingEvents(config);

      const storedEvents = db.prepare('SELECT * FROM events').all();
      expect(storedEvents).toHaveLength(1);
      expect(storedEvents[0].name).toBe('Sports Event');
    });

    it('should process all categories when no filter specified', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          name: 'Sports Event',
          startDate: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          categories: [{ name: 'Sports' }]
        },
        {
          id: 'event-2',
          name: 'Music Event',
          startDate: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          categories: [{ name: 'Music' }]
        }
      ];

      apiClient.getUpcomingEvents.mockResolvedValue(mockEvents);

      const config = {
        fetchWindowHours: 24,
        allowedCategories: [], // Empty = all categories
        filters: null
      };

      await fetchAndStoreUpcomingEvents(config);

      const storedEvents = db.prepare('SELECT * FROM events').all();
      expect(storedEvents).toHaveLength(2);
    });
  });

  describe('Advanced Filtering', () => {
    it('should apply custom filters after category filtering', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          name: 'Championship Tournament',
          startDate: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          categories: [{ name: 'Sports' }]
        },
        {
          id: 'event-2',
          name: 'Cancelled Game',
          startDate: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          categories: [{ name: 'Sports' }]
        }
      ];

      apiClient.getUpcomingEvents.mockResolvedValue(mockEvents);

      // Mock filter to exclude 'cancelled' events
      eventFilters.applyFilters.mockImplementation((events) =>
        events.filter(e => !e.name.toLowerCase().includes('cancelled'))
      );

      const config = {
        fetchWindowHours: 24,
        allowedCategories: ['Sports'],
        filters: { excludeKeywords: ['cancelled'] }
      };

      await fetchAndStoreUpcomingEvents(config);

      // Should only store non-cancelled event
      const storedEvents = db.prepare('SELECT * FROM events').all();
      expect(storedEvents).toHaveLength(1);
      expect(storedEvents[0].name).toBe('Championship Tournament');
    });
  });

  describe('Email vs Local Printing', () => {
    it('should handle local printing mode', async () => {
      const mockEvents = [{
        id: 'event-1',
        name: 'Test Event',
        startDate: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        categories: [{ name: 'Sports' }]
      }];

      apiClient.getUpcomingEvents.mockResolvedValue(mockEvents);
      apiClient.getEventDetails.mockResolvedValue(mockEvents[0]);
      apiClient.getAllAttendees.mockResolvedValue([
        { id: '1', firstName: 'Test', lastName: 'User' }
      ]);

      const config = {
        fetchWindowHours: 24,
        allowedCategories: [],
        preEventQueryMinutes: 10,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'local',
        filters: null
      };

      await fetchAndStoreUpcomingEvents(config);
      await processScheduledEvents(config);

      expect(print).toHaveBeenCalledWith('test.pdf', {});
    });

    it('should handle email printing mode', async () => {
      const emailService = require('../../src/email-service');

      const mockEvents = [{
        id: 'event-1',
        name: 'Test Event',
        startDate: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        categories: [{ name: 'Sports' }]
      }];

      apiClient.getUpcomingEvents.mockResolvedValue(mockEvents);
      apiClient.getEventDetails.mockResolvedValue(mockEvents[0]);
      apiClient.getAllAttendees.mockResolvedValue([
        { id: '1', firstName: 'Test', lastName: 'User' }
      ]);

      // Set up environment for email mode
      process.env.PRINTER_EMAIL = 'printer@example.com';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';

      const config = {
        fetchWindowHours: 24,
        allowedCategories: [],
        preEventQueryMinutes: 10,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'email',
        filters: null
      };

      await fetchAndStoreUpcomingEvents(config);
      await processScheduledEvents(config);

      expect(emailService.sendEmailWithAttachment).toHaveBeenCalled();
    });
  });

  describe('Event Status Management', () => {
    it('should not process events already marked as processed', async () => {
      // Manually insert a processed event
      db.prepare(`
        INSERT INTO events (id, name, startDate, status)
        VALUES ('event-1', 'Already Processed', ?, 'processed')
      `).run(new Date(Date.now() + 5 * 60 * 1000).toISOString());

      const config = {
        preEventQueryMinutes: 10,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'local'
      };

      await processScheduledEvents(config);

      // Should not attempt to process
      expect(apiClient.getEventDetails).not.toHaveBeenCalled();
      expect(print).not.toHaveBeenCalled();
    });

    it('should mark events as processed after successful printing', async () => {
      const mockEvents = [{
        id: 'event-1',
        name: 'Test Event',
        startDate: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        categories: [{ name: 'Sports' }]
      }];

      apiClient.getUpcomingEvents.mockResolvedValue(mockEvents);
      apiClient.getEventDetails.mockResolvedValue(mockEvents[0]);
      apiClient.getAllAttendees.mockResolvedValue([
        { id: '1', firstName: 'Test', lastName: 'User' }
      ]);

      const config = {
        fetchWindowHours: 24,
        allowedCategories: [],
        preEventQueryMinutes: 10,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'local',
        filters: null
      };

      await fetchAndStoreUpcomingEvents(config);

      // Verify initial status
      let event = db.prepare('SELECT status FROM events WHERE id = ?').get('event-1');
      expect(event.status).toBe('pending');

      await processScheduledEvents(config);

      // Verify updated status
      event = db.prepare('SELECT status FROM events WHERE id = ?').get('event-1');
      expect(event.status).toBe('processed');
    });
  });

  describe('Error Handling in Workflow', () => {
    it('should handle API errors during fetch gracefully', async () => {
      apiClient.getUpcomingEvents.mockRejectedValue(new Error('API Error'));

      const config = {
        fetchWindowHours: 24,
        allowedCategories: []
      };

      await expect(fetchAndStoreUpcomingEvents(config)).rejects.toThrow('API Error');
      expect(statusTracker.recordError).toHaveBeenCalled();
      expect(metrics.incrementCounter).toHaveBeenCalledWith('errors');
    });

    it('should mark event as processed even if processing fails', async () => {
      // Insert a pending event
      db.prepare(`
        INSERT INTO events (id, name, startDate, status)
        VALUES ('event-1', 'Test Event', ?, 'pending')
      `).run(new Date(Date.now() + 5 * 60 * 1000).toISOString());

      // Mock API to fail
      apiClient.getEventDetails.mockRejectedValue(new Error('API Failed'));

      const config = {
        preEventQueryMinutes: 10,
        outputFilename: 'test.pdf',
        pdfLayout: { columns: [] },
        printMode: 'local'
      };

      await processScheduledEvents(config);

      // Event should be marked processed to prevent retries
      const event = db.prepare('SELECT status FROM events WHERE id = ?').get('event-1');
      expect(event.status).toBe('processed');

      // Error notification should be sent
      expect(notifications.notifyError).toHaveBeenCalled();
    });
  });

  describe('Duplicate Prevention', () => {
    it('should not insert duplicate events', async () => {
      const mockEvents = [{
        id: 'event-1',
        name: 'Test Event',
        startDate: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        categories: [{ name: 'Sports' }]
      }];

      apiClient.getUpcomingEvents.mockResolvedValue(mockEvents);

      const config = {
        fetchWindowHours: 24,
        allowedCategories: [],
        filters: null
      };

      // Fetch twice
      await fetchAndStoreUpcomingEvents(config);
      await fetchAndStoreUpcomingEvents(config);

      // Should only have one event
      const events = db.prepare('SELECT * FROM events').all();
      expect(events).toHaveLength(1);
    });
  });
});
