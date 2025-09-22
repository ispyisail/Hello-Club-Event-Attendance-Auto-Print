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
const { getDb } = require('../database');
const PdfGenerator = require('../pdf-generator');
const logger = require('../logger');
const { print } = require('pdf-to-printer');
const { sendEmailWithAttachment } = require('../email-service');


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
        PdfGenerator.prototype.generate = jest.fn();
    });

    afterEach(() => {
        mockExit.mockRestore();
        // Reset mocks to ensure test isolation
        mockApi.get.mockReset();
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

            expect(mockApi.get).toHaveBeenCalledWith('/event', expect.any(Object));
            expect(getDb).toHaveBeenCalled();
            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR IGNORE'));
            // The 'pending' status is hardcoded in the SQL, so only 3 args are passed to run()
            expect(mockStmt.run).toHaveBeenCalledWith(1, 'Test Event', expect.any(String));
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

            expect(mockStmt.run).toHaveBeenCalledTimes(1);
            // The 'pending' status is hardcoded in the SQL, so only 3 args are passed to run()
            expect(mockStmt.run).toHaveBeenCalledWith(1, 'Event A', '2025-01-01T10:00:00Z');
        });

        it('should not store anything if no events are fetched', async () => {
            mockApi.get.mockResolvedValue({ data: { events: [] } });
            const config = { fetchWindowHours: 24, allowedCategories: [] };
            await fetchAndStoreUpcomingEvents(config);
            expect(getDb).not.toHaveBeenCalled();
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
            mockStmt.all.mockReturnValue([dueEvent]); // Simulate one event is due

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
            // Mock the second call inside getAllAttendees to terminate the loop
            mockApi.get.mockResolvedValueOnce({ data: { attendees: [] } });

            const config = { preEventQueryMinutes: 5, outputFilename: 'test.pdf', pdfLayout: {}, printMode: 'local' };
            await processScheduledEvents(config);

            // Check that it queried for due events
            expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("SELECT * FROM events"));
            expect(mockStmt.all).toHaveBeenCalledWith(expect.any(String));

            // Check that getEventDetails was called
            expect(mockApi.get).toHaveBeenCalledWith('/event/1');

            // Check that it fetched attendees for the due event
            expect(mockApi.get).toHaveBeenCalledWith('/eventAttendee', { params: { event: 1, limit: 100, offset: 0 } });

            // Check that PDF was generated
            expect(PdfGenerator.prototype.generate).toHaveBeenCalledWith('test.pdf');
            // Check that the event status was updated to 'processed'
            expect(mockDb.prepare).toHaveBeenCalledWith("UPDATE events SET status = 'processed' WHERE id = ?");
            expect(mockStmt.run).toHaveBeenCalledWith(1);
        });

        it('should mark an event as processed even if it has no attendees', async () => {
            const dueEvent = { id: 2, name: 'Empty Event' };
            mockStmt.all.mockReturnValue([dueEvent]);

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
            expect(mockStmt.run).toHaveBeenCalledWith(2);
        });

        it('should do nothing if no events are due', async () => {
            // mockStmt.all already defaults to an empty array
            const config = { preEventQueryMinutes: 5 };
            await processScheduledEvents(config);
            expect(mockStmt.all).toHaveBeenCalled();
            // Nothing else should happen
            expect(mockApi.get).not.toHaveBeenCalled();
            expect(mockStmt.run).not.toHaveBeenCalled();
        });

        it('should mark an event as processed even if fetching attendees fails, to prevent retries', async () => {
            const event1 = { id: 1, name: 'Event 1' };
            mockStmt.all.mockReturnValue([event1]);

            // Mock successful details for event 1, then failing attendees
            mockApi.get.mockResolvedValueOnce({ data: event1 });
            mockApi.get.mockRejectedValueOnce(new Error('Attendee Fetch Failed'));

            const config = { preEventQueryMinutes: 5, outputFilename: 'test.pdf', pdfLayout: {}, printMode: 'local' };
            await processScheduledEvents(config);

            // Verify that we logged an error
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to process event 1'));
            // Verify that event 1 was still marked as processed to prevent retries
            expect(mockDb.prepare).toHaveBeenCalledWith("UPDATE events SET status = 'processed' WHERE id = ?");
            expect(mockStmt.run).toHaveBeenCalledWith(1);
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
            // Mock page 3 (empty)
            mockApi.get.mockResolvedValueOnce({ data: { attendees: [] } });


            const attendees = await getAllAttendees(eventId);

            expect(attendees.length).toBe(150);
            expect(mockApi.get).toHaveBeenCalledTimes(3);
            expect(mockApi.get).toHaveBeenCalledWith('/eventAttendee', { params: { event: eventId, limit: 100, offset: 0 } });
            expect(mockApi.get).toHaveBeenCalledWith('/eventAttendee', { params: { event: eventId, limit: 100, offset: 100 } });
        });

        it('should return a sorted list of attendees by name', async () => {
            const eventId = 2;
            mockApi.get.mockResolvedValueOnce({
                data: {
                    attendees: [
                        { firstName: 'Charlie', lastName: 'Davis' },
                        { firstName: 'Alice', lastName: 'Smith' },
                        { firstName: 'Bob', lastName: 'Johnson' },
                    ],
                    meta: { total: 3, count: 3 }
                }
            });
            // Mock the second call to return an empty array to terminate the loop
            mockApi.get.mockResolvedValueOnce({ data: { attendees: [] } });

            const attendees = await getAllAttendees(eventId);

            expect(attendees.map(a => a.firstName)).toEqual(['Charlie', 'Bob', 'Alice']);
            expect(mockApi.get).toHaveBeenCalledTimes(2);
        });

        it('should not enter an infinite loop if the API reports an incorrect total', async () => {
            const eventId = 3;
            // Mock page 1: returns 10 attendees, but claims there are 20 total.
            mockApi.get.mockResolvedValueOnce({
                data: {
                    attendees: Array(10).fill({}).map((_, i) => ({ id: i, name: `Attendee ${i}` })),
                    meta: { total: 20, count: 10 }
                }
            });
            // Mock page 2: returns 0 attendees, but still claims there are 20 total.
            mockApi.get.mockResolvedValueOnce({
                data: {
                    attendees: [],
                    meta: { total: 20, count: 0 }
                }
            });

            const attendees = await getAllAttendees(eventId);

            // If the code is fixed, it should break the loop and return the 10 attendees it found.
            expect(attendees.length).toBe(10);
            expect(mockApi.get).toHaveBeenCalledTimes(2);
        });

        it('should not loop infinitely if meta.count is missing', async () => {
            const eventId = 4;
            // Mock page 1: returns 2 attendees, but has no meta.count
            mockApi.get.mockResolvedValueOnce({
                data: {
                    attendees: [{ id: 1 }, { id: 2 }],
                    meta: { total: 3 } // Missing count
                }
            });
             // Mock page 2: returns the final attendee.
            mockApi.get.mockResolvedValueOnce({
                data: {
                    attendees: [{ id: 3 }],
                    meta: { total: 3, count: 1 }
                }
            });
             // Mock page 3: returns empty, signaling the end.
            mockApi.get.mockResolvedValueOnce({
                data: {
                    attendees: [],
                    meta: { total: 3, count: 0 }
                }
            });

            // This would time out if the bug exists, as offset would become NaN.
            const attendees = await getAllAttendees(eventId);

            // If the code is fixed, it should fetch all 3 attendees.
            expect(attendees.length).toBe(3);
            expect(mockApi.get).toHaveBeenCalledTimes(3);
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
