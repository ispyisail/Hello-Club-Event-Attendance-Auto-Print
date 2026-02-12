// Mock other dependencies
jest.mock('../src/core/database');
jest.mock('../src/services/cups-printer');
jest.mock('../src/services/email-service');
jest.mock('../src/services/logger');
jest.mock('../src/core/api-client');

// Mock pdf-generator with sanitizeOutputPath
jest.mock('../src/services/pdf-generator', () => {
  const mockConstructor = jest.fn().mockImplementation(function (event, attendees, layout) {
    this.event = event;
    this.attendees = attendees;
    this.layout = layout;
    this.generate = jest.fn((filename) => {
      const path = require('path');
      return path.resolve(process.cwd(), filename);
    });
  });

  mockConstructor.sanitizeOutputPath = jest.fn((filename) => {
    const path = require('path');
    return path.resolve(process.cwd(), filename);
  });

  return mockConstructor;
});

// Now we can require the modules.
const { fetchAndStoreUpcomingEvents, processScheduledEvents } = require('../src/core/functions');
const { getDb, withRetry, withTransaction } = require('../src/core/database');
const PdfGenerator = require('../src/services/pdf-generator');
const logger = require('../src/services/logger');
const { printPdf } = require('../src/services/cups-printer');
const { getAllAttendees, getEventDetails, getUpcomingEvents } = require('../src/core/api-client');

describe('Event Processing Logic', () => {
  let mockDb;
  let mockStmt;
  let mockExit;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock process.exit to prevent tests from stopping
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

    // Setup a fresh mock database object for each test
    mockStmt = {
      run: jest.fn(() => ({ changes: 1 })),
      all: jest.fn(() => []),
    };

    mockDb = {
      prepare: jest.fn(() => mockStmt),
      run: jest.fn(),
      close: jest.fn(),
      // Mock transaction to just execute the function passed to it.
      transaction: jest.fn((fn) => fn),
    };

    getDb.mockReturnValue(mockDb);

    // Make withTransaction and withRetry execute their callbacks
    withTransaction.mockImplementation((fn) => fn());
    withRetry.mockImplementation((fn) => fn());
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  describe('fetchAndStoreUpcomingEvents', () => {
    it('should fetch events and store them in the database', async () => {
      const mockEvents = [
        {
          id: 1,
          name: 'Test Event',
          startDate: new Date().toISOString(),
          categories: [{ name: 'Test Category' }],
        },
      ];
      getUpcomingEvents.mockResolvedValue(mockEvents);

      const config = {
        fetchWindowHours: 24,
        allowedCategories: ['Test Category'],
      };

      await fetchAndStoreUpcomingEvents(config);

      expect(getUpcomingEvents).toHaveBeenCalledWith(24);
      expect(getDb).toHaveBeenCalled();
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE'));
      // The 'pending' status is hardcoded in the SQL, so only 3 args are passed to run()
      expect(mockStmt.run).toHaveBeenCalledWith(1, 'Test Event', expect.any(String));
    });

    it('should filter events by category', async () => {
      const mockEvents = [
        { id: 1, name: 'Event A', startDate: '2025-01-01T10:00:00Z', categories: [{ name: 'Allowed' }] },
        { id: 2, name: 'Event B', startDate: '2025-01-01T11:00:00Z', categories: [{ name: 'NotAllowed' }] },
      ];
      getUpcomingEvents.mockResolvedValue(mockEvents);

      const config = {
        fetchWindowHours: 24,
        allowedCategories: ['Allowed'],
      };

      await fetchAndStoreUpcomingEvents(config);

      expect(mockStmt.run).toHaveBeenCalledTimes(1);
      // The 'pending' status is hardcoded in the SQL, so only 3 args are passed to run()
      expect(mockStmt.run).toHaveBeenCalledWith(1, 'Event A', '2025-01-01T10:00:00Z');
    });

    it('should not store anything if no events are fetched', async () => {
      getUpcomingEvents.mockResolvedValue([]);
      const config = { fetchWindowHours: 24, allowedCategories: [] };
      await fetchAndStoreUpcomingEvents(config);
      expect(getDb).not.toHaveBeenCalled();
    });

    it('should throw on API error', async () => {
      getUpcomingEvents.mockRejectedValue(new Error('API Down'));
      const config = { fetchWindowHours: 24, allowedCategories: [] };

      await expect(fetchAndStoreUpcomingEvents(config)).rejects.toThrow('API Down');
    });

    it('should not crash if an event has no categories property', async () => {
      const mockEvents = [
        { id: 1, name: 'Event A', startDate: '2025-01-01T10:00:00Z', categories: [{ name: 'Allowed' }] },
        { id: 2, name: 'Event B (no categories)', startDate: '2025-01-01T11:00:00Z' }, // No 'categories' property
        { id: 3, name: 'Event C', startDate: '2025-01-01T12:00:00Z', categories: [{ name: 'Allowed' }] },
      ];
      getUpcomingEvents.mockResolvedValue(mockEvents);

      const config = {
        fetchWindowHours: 24,
        allowedCategories: ['Allowed'],
      };

      // This would throw a TypeError with the buggy code. We assert it doesn't.
      await expect(fetchAndStoreUpcomingEvents(config)).resolves.not.toThrow();

      // And we expect that only the two valid events were processed for storage.
      expect(mockStmt.run).toHaveBeenCalledTimes(2);
      expect(mockStmt.run).toHaveBeenCalledWith(1, 'Event A', '2025-01-01T10:00:00Z');
      expect(mockStmt.run).toHaveBeenCalledWith(3, 'Event C', '2025-01-01T12:00:00Z');
    });
  });

  describe('processScheduledEvents', () => {
    it('should process a due event, generate a PDF, and update its status', async () => {
      const dueEvent = { id: 1, name: 'Due Event', startDate: new Date().toISOString() };
      mockStmt.all.mockReturnValue([dueEvent]); // Simulate one event is due

      // Mock the API calls
      const fullEventDetails = { ...dueEvent, description: 'Full details' };
      getEventDetails.mockResolvedValue(fullEventDetails);
      const mockAttendees = [{ id: 101, firstName: 'John', lastName: 'Doe' }];
      getAllAttendees.mockResolvedValue(mockAttendees);

      const config = { preEventQueryMinutes: 5, outputFilename: 'test.pdf', pdfLayout: {}, printMode: 'local' };
      await processScheduledEvents(config);

      // Check that it queried for due events
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM events'));
      expect(mockStmt.all).toHaveBeenCalledWith(expect.any(String));

      // Check that getEventDetails was called
      expect(getEventDetails).toHaveBeenCalledWith(1);

      // Check that it fetched attendees for the due event
      expect(getAllAttendees).toHaveBeenCalledWith(1);

      // Check that PDF was generated and printed with the sanitized path
      // The constructor is called, so we check that print was called with the safe path
      expect(PdfGenerator).toHaveBeenCalled();
      expect(printPdf).toHaveBeenCalledWith(expect.stringContaining('test.pdf'));

      // Check that the event status was updated to 'processed'
      expect(mockDb.prepare).toHaveBeenCalledWith("UPDATE events SET status = 'processed' WHERE id = ?");
      expect(mockStmt.run).toHaveBeenCalledWith(1);
    });

    it('should mark an event as processed even if it has no attendees', async () => {
      const dueEvent = { id: 2, name: 'Empty Event' };
      mockStmt.all.mockReturnValue([dueEvent]);

      // Mock the API calls
      getEventDetails.mockResolvedValue(dueEvent);
      getAllAttendees.mockResolvedValue([]); // No attendees

      const config = { preEventQueryMinutes: 5, pdfLayout: {} };
      await processScheduledEvents(config);

      expect(getEventDetails).toHaveBeenCalledWith(2);
      expect(getAllAttendees).toHaveBeenCalledWith(2);
      // PDF should NOT be generated (PdfGenerator constructor should not be called)
      expect(PdfGenerator).not.toHaveBeenCalled();
      // Status should still be updated
      expect(mockStmt.run).toHaveBeenCalledWith(2);
    });

    it('should do nothing if no events are due', async () => {
      // mockStmt.all already defaults to an empty array
      const config = { preEventQueryMinutes: 5 };
      await processScheduledEvents(config);
      expect(mockStmt.all).toHaveBeenCalled();
      // Nothing else should happen
      expect(getEventDetails).not.toHaveBeenCalled();
      expect(mockStmt.run).not.toHaveBeenCalled();
    });

    it('should mark an event as failed if fetching attendees fails and re-throw the error', async () => {
      const event1 = { id: 1, name: 'Event 1' };
      mockStmt.all.mockReturnValue([event1]);

      // Mock successful details for event 1, then failing attendees
      getEventDetails.mockResolvedValue(event1);
      getAllAttendees.mockRejectedValue(new Error('Attendee Fetch Failed'));

      const config = { preEventQueryMinutes: 5, outputFilename: 'test.pdf', pdfLayout: {}, printMode: 'local' };

      // The error should be re-thrown
      await expect(processScheduledEvents(config)).rejects.toThrow('Attendee Fetch Failed');

      // Verify that we logged an error with both message and error object
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process event 1'),
        expect.any(Error)
      );
      // Verify that event 1 was marked as failed (not processed)
      expect(mockDb.prepare).toHaveBeenCalledWith("UPDATE events SET status = 'failed' WHERE id = ?");
      expect(mockStmt.run).toHaveBeenCalledWith(1);
    });
  });
});
