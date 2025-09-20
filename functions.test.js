const funcs = require('./functions');
const fs = require('fs');
const { print } = require('pdf-to-printer');

jest.mock('fs');
jest.mock('pdf-to-printer');

describe('main', () => {
  let getNextEventMock, getAllAttendeesMock, createAndPrintPdfMock;

  beforeEach(() => {
    jest.useFakeTimers();
    getNextEventMock = jest.fn();
    getAllAttendeesMock = jest.fn();
    createAndPrintPdfMock = jest.fn();
    fs.readFileSync.mockClear();
    print.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should run and print a PDF if an event is within the window', async () => {
    const fakeNow = new Date();
    const eventDate = new Date(fakeNow.getTime() + 10 * 60 * 1000);
    const mockEvent = { id: 1, name: 'Test Event', startDate: eventDate.toISOString() };

    fs.readFileSync.mockReturnValue(JSON.stringify({}));
    getNextEventMock.mockResolvedValue(mockEvent);
    getAllAttendeesMock.mockResolvedValue([{}]);

    await funcs.main({}, { getNextEvent: getNextEventMock, getAllAttendees: getAllAttendeesMock, createAndPrintPdf: createAndPrintPdfMock });

    expect(getNextEventMock).toHaveBeenCalledTimes(1);
    expect(getAllAttendeesMock).toHaveBeenCalledWith(1);
    expect(createAndPrintPdfMock).toHaveBeenCalledTimes(1);
  });

  it('should not run if event is outside the window', async () => {
    const fakeNow = new Date();
    const eventDate = new Date(fakeNow.getTime() + 20 * 60 * 1000);
    const mockEvent = { id: 1, name: 'Test Event', startDate: eventDate.toISOString() };

    fs.readFileSync.mockReturnValue(JSON.stringify({ printWindowMinutes: 15 }));
    getNextEventMock.mockResolvedValue(mockEvent);

    await funcs.main({}, { getNextEvent: getNextEventMock, getAllAttendees: getAllAttendeesMock, createAndPrintPdf: createAndPrintPdfMock });

    expect(getAllAttendeesMock).not.toHaveBeenCalled();
    expect(createAndPrintPdfMock).not.toHaveBeenCalled();
  });
});
