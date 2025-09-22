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
    getAllAttendees,
    handleApiError,
    createAndPrintPdf,
} = require('../functions');
const { openDb } = require('../database');
const PdfGenerator = require('../pdf-generator');
const logger = require('../logger');
const { print } = require('pdf-to-printer');
const { sendEmailWithAttachment } = require('../email-service');


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

        it('should throw on API error', async () => {
            mockApi.get.mockRejectedValue({ request: {} }); // Simulate network error
            const config = { fetchWindowHours: 24, allowedCategories: [] };

            await expect(fetchAndStoreUpcomingEvents(config)).rejects.toThrow('Network Error: No response received while fetching upcoming events');
        });
    });

    describe('processScheduledEvents', () => {
        it('should process a due event, generate a PDF, and update its status', async () => {
            const dueEvent = { id: 1, name: 'Due Event', startDate: new Date().toISOString() };
            mockDb.all.mockResolvedValue([dueEvent]); // Simulate one event is due

            // Mock the API call for getEventDetails
            const fullEventDetails = { data: { ...dueEvent, description: 'Full details' } };
            mockApi.get.mockResolvedValueOnce(fullEventDetails);

            // Mock the API call for getAllAttendees
            const mockAttendees = {
                data: {
                    attendees: [{ id: 101, firstName: 'John', lastName: 'Doe' }],
                    meta: { total: 1, count: 1 }
                }
            };
            mockApi.get.mockResolvedValueOnce(mockAttendees);


            const config = { preEventQueryMinutes: 5, outputFilename: 'test.pdf', pdfLayout: {}, printMode: 'local' };
            await processScheduledEvents(config);

            // Check that it queried for due events
            expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining("SELECT * FROM events"), expect.any(Array));

            // Check that getEventDetails was called
            expect(mockApi.get).toHaveBeenCalledWith('/event/1');

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

            // Mock the API call for getEventDetails
            const fullEventDetails = { data: { ...dueEvent, description: 'Full details' } };
            mockApi.get.mockResolvedValueOnce(fullEventDetails);

            // Simulate zero attendees
            mockApi.get.mockResolvedValueOnce({ data: { attendees: [], meta: { total: 0, count: 0 } } });

            const config = { preEventQueryMinutes: 5, pdfLayout: {} };
            await processScheduledEvents(config);

            expect(mockApi.get).toHaveBeenCalledWith('/event/2');
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

        it('should skip an event if fetching attendees fails and continue with the next', async () => {
            const event1 = { id: 1, name: 'Event 1' };
            const event2 = { id: 2, name: 'Event 2' };
            mockDb.all.mockResolvedValue([event1, event2]);

            // Mock successful details for event 1
            mockApi.get.mockResolvedValueOnce({ data: event1 });
            // Mock failing attendees for event 1
            mockApi.get.mockRejectedValueOnce(new Error('Attendee Fetch Failed'));

            // Mock successful details for event 2
            mockApi.get.mockResolvedValueOnce({ data: event2 });
            // Mock successful attendees for event 2
            mockApi.get.mockResolvedValueOnce({ data: { attendees: [{ id: 101, name: 'Attendee' }], meta: { total: 1, count: 1 } } });

            const config = { preEventQueryMinutes: 5, outputFilename: 'test.pdf', pdfLayout: {}, printMode: 'local' };
            await processScheduledEvents(config);

            // Verify that we did not try to mark event 1 as processed
            expect(mockDb.run).not.toHaveBeenCalledWith("UPDATE events SET status = 'processed' WHERE id = ?", [1]);
            // Verify that event 2 was successfully processed
            expect(mockDb.run).toHaveBeenCalledWith("UPDATE events SET status = 'processed' WHERE id = ?", [2]);
            // Verify the db connection is closed at the end
            expect(mockDb.close).toHaveBeenCalled();
        });
    });

    describe('getAllAttendees', () => {
        it('should fetch all attendees using pagination', async () => {
            const eventId = 1;
            // Mock page 1
            mockApi.get.mockResolvedValueOnce({
                data: {
                    attendees: Array(100).fill({}).map((_, i) => ({ id: i, name: `Attendee ${i}` })),
                    meta: { total: 150, count: 100 }
                }
            });
            // Mock page 2
            mockApi.get.mockResolvedValueOnce({
                data: {
                    attendees: Array(50).fill({}).map((_, i) => ({ id: i + 100, name: `Attendee ${i + 100}` })),
                    meta: { total: 150, count: 50 }
                }
            });

            const attendees = await getAllAttendees(eventId);

            expect(attendees.length).toBe(150);
            expect(mockApi.get).toHaveBeenCalledTimes(2);
            expect(mockApi.get).toHaveBeenCalledWith('/eventAttendee', { params: { event: eventId, limit: 100, offset: 0 } });
            expect(mockApi.get).toHaveBeenCalledWith('/eventAttendee', { params: { event: eventId, limit: 100, offset: 100 } });
        });

        it('should return a sorted list of attendees by name', async () => {
            const eventId = 2;
            mockApi.get.mockResolvedValue({
                data: {
                    attendees: [
                        { firstName: 'Charlie', lastName: 'Davis' },
                        { firstName: 'Alice', lastName: 'Smith' },
                        { firstName: 'Bob', lastName: 'Johnson' },
                    ],
                    meta: { total: 3, count: 3 }
                }
            });

            const attendees = await getAllAttendees(eventId);

            expect(attendees.map(a => a.firstName)).toEqual(['Charlie', 'Bob', 'Alice']);
        });
    });

    describe('handleApiError', () => {
        it('should log and throw a 401 error message', () => {
            const error = { response: { status: 401 } };
            const context = 'testing auth';
            expect(() => handleApiError(error, context)).toThrow('API Error: 401 Unauthorized while testing auth');
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('401 Unauthorized'));
        });

        it('should log and throw a generic API error message', () => {
            const error = { response: { status: 500, data: 'Server Error' } };
            const context = 'testing server error';
            expect(() => handleApiError(error, context)).toThrow('API Error: 500 while testing server error');
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('API Error: 500'), 'Server Error');
        });

        it('should log and throw a network error message', () => {
            const error = { request: {} };
            const context = 'testing network issue';
            expect(() => handleApiError(error, context)).toThrow('Network Error: No response received while testing network issue');
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Network Error'));
        });

        it('should log and throw an unexpected error message', () => {
            const error = new Error('Unexpected');
            const context = 'testing unexpected';
            expect(() => handleApiError(error, context)).toThrow('An unexpected error occurred while testing unexpected: Unexpected');
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Unexpected'));
        });
    });

    describe('createAndPrintPdf', () => {
        const event = { id: 1, name: 'Test Event' };
        const attendees = [{ id: 101, name: 'Test Attendee' }];
        const layout = {};

        it('should generate a PDF and print it locally', async () => {
            await createAndPrintPdf(event, attendees, 'output.pdf', layout, 'local');
            expect(PdfGenerator.prototype.generate).toHaveBeenCalledWith('output.pdf');
            expect(print).toHaveBeenCalledWith('output.pdf');
            expect(sendEmailWithAttachment).not.toHaveBeenCalled();
        });

        it('should generate a PDF and send it via email', async () => {
            await createAndPrintPdf(event, attendees, 'output.pdf', layout, 'email');
            expect(PdfGenerator.prototype.generate).toHaveBeenCalledWith('output.pdf');
            expect(sendEmailWithAttachment).toHaveBeenCalled();
            expect(print).not.toHaveBeenCalled();
        });

        it('should throw if local printing fails', async () => {
            print.mockRejectedValue(new Error('Printer not found'));
            await expect(createAndPrintPdf(event, attendees, 'output.pdf', layout, 'local'))
                .rejects.toThrow('Printer not found');
        });
    });
});
