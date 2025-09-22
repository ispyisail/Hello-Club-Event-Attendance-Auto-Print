// This is the mock for the `api` object that will be returned by axios.create()
const mockApi = {
    get: jest.fn(),
};

// We mock the axios library. The factory function returns an object that shapes the mock.
// Now, whenever any code in any module calls `require('axios')`, it will get this object.
jest.mock('axios', () => ({
    // The mock for `axios.create` is a jest function that returns our mockApi object.
    create: jest.fn(() => mockApi),
}));

// Mock other dependencies
jest.mock('../database');
jest.mock('../pdf-generator');
jest.mock('pdf-to-printer');
jest.mock('../email-service');
jest.mock('../logger');

// Now we can require the modules.
const {
    fetchAndStoreUpcomingEvents,
    processScheduledEvents,
} = require('../functions');
const { openDb } = require('../database');
const PdfGenerator = require('../pdf-generator');


describe('Event Processing Logic', () => {
    let mockDb;
    let mockExit;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
        mockApi.get.mockClear(); // Clear the history of the mockApi.get calls

        // Mock process.exit to prevent tests from stopping
        mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

        // Setup a fresh mock database object for each test
        mockDb = {
            prepare: jest.fn().mockResolvedValue({
                run: jest.fn().mockResolvedValue({ changes: 1 }),
                finalize: jest.fn().mockResolvedValue(),
            }),
            all: jest.fn().mockResolvedValue([]),
            run: jest.fn().mockResolvedValue(),
            close: jest.fn().mockResolvedValue(),
        };

        // openDb will resolve to our mock database object
        openDb.mockResolvedValue(mockDb);

        // Mock the PDF generator
        PdfGenerator.prototype.generate = jest.fn();
    });

    afterEach(() => {
        mockExit.mockRestore();
    });

    describe('fetchAndStoreUpcomingEvents', () => {
        it('should fetch events and store them in the database', async () => {
            const mockEvents = {
                data: {
                    events: [{
                        id: 1,
                        name: 'Test Event',
                        startDate: new Date().toISOString(),
                        categories: [{ name: 'Test Category' }]
                    }]
                }
            };
            mockApi.get.mockResolvedValue(mockEvents);

            const config = {
                fetchWindowHours: 24,
                allowedCategories: ['Test Category']
            };

            await fetchAndStoreUpcomingEvents(config);

            // Verify API was called
            expect(mockApi.get).toHaveBeenCalledWith('/event', expect.any(Object));
            // Verify database was opened
            expect(openDb).toHaveBeenCalled();
            // Verify data was inserted
            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR IGNORE'));
            const mockStmt = await mockDb.prepare();
            expect(mockStmt.run).toHaveBeenCalledWith(1, 'Test Event', expect.any(String));
            // Verify database was closed
            expect(mockDb.close).toHaveBeenCalled();
        });

        it('should filter events by category', async () => {
            const mockEvents = {
                data: {
                    events: [
                        { id: 1, name: 'Event A', startDate: '2025-01-01T10:00:00Z', categories: [{ name: 'Allowed' }] },
                        { id: 2, name: 'Event B', startDate: '2025-01-01T11:00:00Z', categories: [{ name: 'NotAllowed' }] }
                    ]
                }
            };
            mockApi.get.mockResolvedValue(mockEvents);

            const config = {
                fetchWindowHours: 24,
                allowedCategories: ['Allowed']
            };

            await fetchAndStoreUpcomingEvents(config);
            const mockStmt = await mockDb.prepare();

            // Only Event A should be stored
            expect(mockStmt.run).toHaveBeenCalledTimes(1);
            expect(mockStmt.run).toHaveBeenCalledWith(1, 'Event A', '2025-01-01T10:00:00Z');
        });

        it('should not store anything if no events are fetched', async () => {
            mockApi.get.mockResolvedValue({ data: { events: [] } });
            const config = { fetchWindowHours: 24, allowedCategories: [] };
            await fetchAndStoreUpcomingEvents(config);
            expect(openDb).not.toHaveBeenCalled();
        });

        it('should exit gracefully on API error', async () => {
            mockApi.get.mockRejectedValue(new Error('Network Error'));
            const config = { fetchWindowHours: 24, allowedCategories: [] };

            await fetchAndStoreUpcomingEvents(config);

            expect(mockExit).toHaveBeenCalledWith(1);
        });
    });

    describe('processScheduledEvents', () => {
        it('should process a due event, generate a PDF, and update its status', async () => {
            const dueEvent = { id: 1, name: 'Due Event', startDate: new Date().toISOString() };
            mockDb.all.mockResolvedValue([dueEvent]); // Simulate one event is due

            // Mock a full attendee list for the due event
            mockApi.get.mockResolvedValue({
                data: {
                    attendees: [{ id: 101, firstName: 'John', lastName: 'Doe' }],
                    meta: { total: 1, count: 1 }
                }
            });

            const config = { preEventQueryMinutes: 5, outputFilename: 'test.pdf', printMode: 'local' };
            await processScheduledEvents(config);

            // Check that it queried for due events
            expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM events'), expect.any(Array));
            // Check that it fetched attendees for the due event
            expect(mockApi.get).toHaveBeenCalledWith('/eventAttendee', { params: { event: 1, limit: 100, offset: 0 } });
            // Check that PDF was generated
            expect(PdfGenerator.prototype.generate).toHaveBeenCalledWith('test.pdf');
            // Check that the event status was updated to 'processed'
            expect(mockDb.run).toHaveBeenCalledWith("UPDATE events SET status = 'processed' WHERE id = ?", [1]);
            // Check that the database connection was closed
            expect(mockDb.close).toHaveBeenCalled();
        });

        it('should mark an event as processed even if it has no attendees', async () => {
            const dueEvent = { id: 2, name: 'Empty Event' };
            mockDb.all.mockResolvedValue([dueEvent]);
            // Simulate zero attendees
            mockApi.get.mockResolvedValue({ data: { attendees: [], meta: { total: 0, count: 0 } } });

            const config = { preEventQueryMinutes: 5 };
            await processScheduledEvents(config);

            expect(mockApi.get).toHaveBeenCalledWith('/eventAttendee', { params: expect.objectContaining({ event: 2 }) });
            // PDF should NOT be generated
            expect(PdfGenerator.prototype.generate).not.toHaveBeenCalled();
            // Status should still be updated
            expect(mockDb.run).toHaveBeenCalledWith("UPDATE events SET status = 'processed' WHERE id = ?", [2]);
            expect(mockDb.close).toHaveBeenCalled();
        });

        it('should do nothing if no events are due', async () => {
            // mockDb.all already defaults to an empty array
            const config = { preEventQueryMinutes: 5 };
            await processScheduledEvents(config);
            expect(mockDb.all).toHaveBeenCalled();
            // Nothing else should happen
            expect(mockApi.get).not.toHaveBeenCalled();
            expect(mockDb.run).not.toHaveBeenCalled();
            // The db should still be closed
            expect(mockDb.close).toHaveBeenCalled();
        });
    });
});
