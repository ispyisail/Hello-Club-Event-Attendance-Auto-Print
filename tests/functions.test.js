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
const { sendEmailWithAttachment } = require('../src/services/email-service');
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
    it('should store events that carry a print: tag', async () => {
      const mockEvents = [
        {
          id: 1,
          name: 'Test Event',
          startDate: new Date().toISOString(),
          description: 'Weekly session. print:',
        },
      ];
      getUpcomingEvents.mockResolvedValue(mockEvents);

      const config = { fetchWindowHours: 24 };

      await fetchAndStoreUpcomingEvents(config);

      expect(getUpcomingEvents).toHaveBeenCalledWith(24);
      expect(getDb).toHaveBeenCalled();
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO events'));
      // Bare tag → all tag params null; status is hardcoded in the SQL.
      expect(mockStmt.run).toHaveBeenCalledWith(1, 'Test Event', expect.any(String), null, null, null);
    });

    it('should persist per-event tag parameters (lead time, copies, print mode)', async () => {
      const mockEvents = [
        {
          id: 7,
          name: 'Tournament',
          startDate: '2025-01-01T10:00:00Z',
          description: 'print: 30min 2copies email',
        },
      ];
      getUpcomingEvents.mockResolvedValue(mockEvents);

      await fetchAndStoreUpcomingEvents({ fetchWindowHours: 24 });

      expect(mockStmt.run).toHaveBeenCalledWith(7, 'Tournament', '2025-01-01T10:00:00Z', 30, 2, 'email');
    });

    it('should store only tagged events and skip untagged ones', async () => {
      const mockEvents = [
        { id: 1, name: 'Event A', startDate: '2025-01-01T10:00:00Z', description: 'print: local' },
        { id: 2, name: 'Event B', startDate: '2025-01-01T11:00:00Z', description: 'no tag here' },
      ];
      getUpcomingEvents.mockResolvedValue(mockEvents);

      await fetchAndStoreUpcomingEvents({ fetchWindowHours: 24 });

      expect(mockStmt.run).toHaveBeenCalledTimes(1);
      expect(mockStmt.run).toHaveBeenCalledWith(1, 'Event A', '2025-01-01T10:00:00Z', null, null, 'local');
    });

    it('should skip events with a null description without crashing', async () => {
      const mockEvents = [
        { id: 1, name: 'Event A', startDate: '2025-01-01T10:00:00Z', description: 'print:' },
        { id: 2, name: 'Event B (null description)', startDate: '2025-01-01T11:00:00Z', description: null },
        { id: 3, name: 'Event C', startDate: '2025-01-01T12:00:00Z', description: 'print:' },
      ];
      getUpcomingEvents.mockResolvedValue(mockEvents);

      await expect(fetchAndStoreUpcomingEvents({ fetchWindowHours: 24 })).resolves.not.toThrow();

      // Only the two tagged events are stored; the null-description event is skipped.
      expect(mockStmt.run).toHaveBeenCalledTimes(2);
      expect(mockStmt.run).toHaveBeenCalledWith(1, 'Event A', '2025-01-01T10:00:00Z', null, null, null);
      expect(mockStmt.run).toHaveBeenCalledWith(3, 'Event C', '2025-01-01T12:00:00Z', null, null, null);
    });

    it('should not store anything if no events contain a print: tag', async () => {
      const mockEvents = [{ id: 1, name: 'Event A', startDate: '2025-01-01T10:00:00Z', description: 'no tag' }];
      getUpcomingEvents.mockResolvedValue(mockEvents);
      await fetchAndStoreUpcomingEvents({ fetchWindowHours: 24 });
      expect(mockStmt.run).not.toHaveBeenCalled();
    });

    it('should log when there are no new events to store', async () => {
      mockStmt.run.mockReturnValue({ changes: 0 }); // simulate all events already existed
      const mockEvents = [{ id: 1, name: 'Existing', startDate: '2025-01-01T10:00:00Z', description: 'print:' }];
      getUpcomingEvents.mockResolvedValue(mockEvents);

      await fetchAndStoreUpcomingEvents({ fetchWindowHours: 24 });

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('No new events to store'));
    });

    it('should mark a previously-tagged event as cancelled when its tag is removed', async () => {
      // API now returns one tagged event; the DB still has a different pending
      // event (id 2) that is no longer tagged, so it should be cancelled.
      const mockEvents = [{ id: 1, name: 'Still Tagged', startDate: '2025-01-01T10:00:00Z', description: 'print:' }];
      getUpcomingEvents.mockResolvedValue(mockEvents);
      mockStmt.all.mockReturnValue([{ id: 2, name: 'Untagged Now' }]);

      await fetchAndStoreUpcomingEvents({ fetchWindowHours: 24 });

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('cancelled/deleted'));
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("status = 'cancelled'"));
    });

    it('should not store anything if no events are fetched', async () => {
      getUpcomingEvents.mockResolvedValue([]);
      const config = { fetchWindowHours: 24 };
      await fetchAndStoreUpcomingEvents(config);
      expect(getDb).not.toHaveBeenCalled();
    });

    it('should throw on API error', async () => {
      getUpcomingEvents.mockRejectedValue(new Error('API Down'));
      const config = { fetchWindowHours: 24 };

      await expect(fetchAndStoreUpcomingEvents(config)).rejects.toThrow('API Down');
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

      // Check that it queried for pending events (JS-side due filtering)
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM events'));
      expect(mockStmt.all).toHaveBeenCalled();

      // Check that getEventDetails was called
      expect(getEventDetails).toHaveBeenCalledWith(1);

      // Check that it fetched attendees for the due event
      expect(getAllAttendees).toHaveBeenCalledWith(1);

      // Check that PDF was generated and printed with the sanitized path and default copies
      expect(PdfGenerator).toHaveBeenCalled();
      expect(printPdf).toHaveBeenCalledWith(expect.stringContaining('test.pdf'), 1);

      // Check that the event status was updated to 'processed'
      expect(mockDb.prepare).toHaveBeenCalledWith("UPDATE events SET status = 'processed' WHERE id = ?");
      expect(mockStmt.run).toHaveBeenCalledWith(1);
    });

    it('should honour a per-event lead time when deciding what is due', async () => {
      // Event starts in 20 minutes. Config default lead time is 5 min (not due),
      // but the event's own leadMinutes is 30 (due now).
      const startsIn20Min = new Date(Date.now() + 20 * 60 * 1000).toISOString();
      const taggedEvent = { id: 9, name: 'Early Bird', startDate: startsIn20Min, leadMinutes: 30 };
      mockStmt.all.mockReturnValue([taggedEvent]);

      getEventDetails.mockResolvedValue(taggedEvent);
      getAllAttendees.mockResolvedValue([{ id: 1, firstName: 'A', lastName: 'B' }]);

      const config = { preEventQueryMinutes: 5, outputFilename: 'test.pdf', pdfLayout: {}, printMode: 'local' };
      await processScheduledEvents(config);

      expect(getEventDetails).toHaveBeenCalledWith(9);
    });

    it('should pass the per-event copy count to the printer', async () => {
      const dueEvent = { id: 3, name: 'Multi Copy', startDate: new Date().toISOString(), copies: 3 };
      mockStmt.all.mockReturnValue([dueEvent]);

      getEventDetails.mockResolvedValue(dueEvent);
      getAllAttendees.mockResolvedValue([{ id: 1, firstName: 'A', lastName: 'B' }]);

      const config = { preEventQueryMinutes: 5, outputFilename: 'test.pdf', pdfLayout: {}, printMode: 'local' };
      await processScheduledEvents(config);

      expect(printPdf).toHaveBeenCalledWith(expect.stringContaining('test.pdf'), 3);
    });

    it('should use the per-event print mode and warn when copies>1 with email', async () => {
      const dueEvent = {
        id: 4,
        name: 'Emailed',
        startDate: new Date().toISOString(),
        printMode: 'email',
        copies: 2,
      };
      mockStmt.all.mockReturnValue([dueEvent]);

      getEventDetails.mockResolvedValue(dueEvent);
      getAllAttendees.mockResolvedValue([{ id: 1, firstName: 'A', lastName: 'B' }]);

      // Config default is 'local' — the event's tag overrides it to 'email'.
      const config = { preEventQueryMinutes: 5, outputFilename: 'test.pdf', pdfLayout: {}, printMode: 'local' };
      await processScheduledEvents(config);

      expect(printPdf).not.toHaveBeenCalled();
      expect(sendEmailWithAttachment).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('only supported in local print mode'));
    });

    it('should re-throw and log when local printing fails', async () => {
      const dueEvent = { id: 5, name: 'Print Fail', startDate: new Date().toISOString() };
      mockStmt.all.mockReturnValue([dueEvent]);

      getEventDetails.mockResolvedValue(dueEvent);
      getAllAttendees.mockResolvedValue([{ id: 1, firstName: 'A', lastName: 'B' }]);
      printPdf.mockRejectedValue(new Error('Printer offline'));

      const config = { preEventQueryMinutes: 5, outputFilename: 'test.pdf', pdfLayout: {}, printMode: 'local' };
      await expect(processScheduledEvents(config)).rejects.toThrow('Printer offline');

      expect(logger.error).toHaveBeenCalledWith('Failed to print locally:', expect.any(Error));
    });

    it('should mark an event as processed even if it has no attendees', async () => {
      const dueEvent = { id: 2, name: 'Empty Event', startDate: new Date().toISOString() };
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
      const event1 = { id: 1, name: 'Event 1', startDate: new Date().toISOString() };
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
