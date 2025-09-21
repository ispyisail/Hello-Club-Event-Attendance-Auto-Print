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

  it('should run and print a PDF if an event is starting now (exactly 0 minutes away)', async () => {
    const fakeNow = new Date();
    // Event starts exactly now
    const eventDate = new Date(fakeNow.getTime());
    const mockEvent = { id: 1, name: 'Test Event Starting Now', startDate: eventDate.toISOString() };

    fs.readFileSync.mockReturnValue(JSON.stringify({ printWindowMinutes: 15 }));
    getNextEventMock.mockResolvedValue(mockEvent);
    getAllAttendeesMock.mockResolvedValue([{}]);

    await funcs.main({}, { getNextEvent: getNextEventMock, getAllAttendees: getAllAttendeesMock, createAndPrintPdf: createAndPrintPdfMock });

    expect(createAndPrintPdfMock).toHaveBeenCalledTimes(1);
  });

  it('should exit if config is invalid', async () => {
    const process = require('process');
    const processExitMock = jest.spyOn(process, 'exit').mockImplementation(() => {});
    fs.readFileSync.mockReturnValue(JSON.stringify({ printWindowMinutes: 'invalid' }));
    await funcs.main({}, { getNextEvent: getNextEventMock, getAllAttendees: getAllAttendeesMock, createAndPrintPdf: createAndPrintPdfMock });
    expect(processExitMock).toHaveBeenCalledWith(1);
    processExitMock.mockRestore();
  });

  it('should not call createAndPrintPdf if getNextEvent returns null', async () => {
    fs.readFileSync.mockReturnValue(JSON.stringify({}));
    getNextEventMock.mockResolvedValue(null);
    await funcs.main({}, { getNextEvent: getNextEventMock, getAllAttendees: getAllAttendeesMock, createAndPrintPdf: createAndPrintPdfMock });
    expect(createAndPrintPdfMock).not.toHaveBeenCalled();
  });

  it('should call createAndPrintPdf if getAllAttendees returns an empty array', async () => {
    const fakeNow = new Date();
    const eventDate = new Date(fakeNow.getTime() + 10 * 60 * 1000);
    const mockEvent = { id: 1, name: 'Test Event', startDate: eventDate.toISOString() };

    fs.readFileSync.mockReturnValue(JSON.stringify({}));
    getNextEventMock.mockResolvedValue(mockEvent);
    getAllAttendeesMock.mockResolvedValue([]);

    await funcs.main({}, { getNextEvent: getNextEventMock, getAllAttendees: getAllAttendeesMock, createAndPrintPdf: createAndPrintPdfMock });

    expect(createAndPrintPdfMock).toHaveBeenCalledTimes(1);
  });

  it('should run and print a PDF if an event is starting now (0 minutes diff)', async () => {
    const fakeNow = new Date();
    // Event starts exactly now
    const eventDate = new Date(fakeNow.getTime());
    const mockEvent = { id: 1, name: 'Test Event', startDate: eventDate.toISOString() };

    fs.readFileSync.mockReturnValue(JSON.stringify({ printWindowMinutes: 15 }));
    getNextEventMock.mockResolvedValue(mockEvent);
    getAllAttendeesMock.mockResolvedValue([{}]);

    await funcs.main({}, { getNextEvent: getNextEventMock, getAllAttendees: getAllAttendeesMock, createAndPrintPdf: createAndPrintPdfMock });

    expect(createAndPrintPdfMock).toHaveBeenCalledTimes(1);
  });
});

describe('getNextEvent', () => {
  let apiGetMock;

  beforeEach(() => {
    apiGetMock = jest.spyOn(funcs.api, 'get');
  });

  afterEach(() => {
    apiGetMock.mockRestore();
  });

  it('should return null if no events are found', async () => {
    apiGetMock.mockResolvedValue({ data: { events: [] } });
    const event = await funcs.getNextEvent();
    expect(event).toBeNull();
  });

  it('should return null if no events match the categories', async () => {
    const events = [{ categories: [{ name: 'Category 1' }] }];
    apiGetMock.mockResolvedValue({ data: { events } });
    const event = await funcs.getNextEvent(['Category 2']);
    expect(event).toBeNull();
  });

  it('should return the first event if no categories are specified', async () => {
    const events = [{ id: 1, categories: [{ name: 'Category 1' }] }];
    apiGetMock.mockResolvedValue({ data: { events } });
    const event = await funcs.getNextEvent();
    expect(event).toEqual(events[0]);
  });

  it('should return the first event that matches a category', async () => {
    const events = [
      { id: 1, categories: [{ name: 'Category 1' }] },
      { id: 2, categories: [{ name: 'Category 2' }] }
    ];
    apiGetMock.mockResolvedValue({ data: { events } });
    const event = await funcs.getNextEvent(['Category 2']);
    expect(event).toEqual(events[1]);
  });

  it('should return null on API error', async () => {
    apiGetMock.mockRejectedValue(new Error('API Error'));
    const event = await funcs.getNextEvent();
    expect(event).toBeNull();
  });
});

describe('getAllAttendees', () => {
  let apiGetMock;

  beforeEach(() => {
    apiGetMock = jest.spyOn(funcs.api, 'get');
  });

  afterEach(() => {
    apiGetMock.mockRestore();
  });

  it('should fetch all attendees with pagination and sort them', async () => {
    const attendees1 = [{ lastName: 'Smith', firstName: 'John' }];
    const attendees2 = [{ lastName: 'Doe', firstName: 'Jane' }];
    apiGetMock.mockResolvedValueOnce({ data: { attendees: attendees1, meta: { total: 2, count: 1 } } });
    apiGetMock.mockResolvedValueOnce({ data: { attendees: attendees2, meta: { total: 2, count: 1 } } });

    const attendees = await funcs.getAllAttendees(1);

    expect(apiGetMock).toHaveBeenCalledTimes(2);
    expect(attendees).toEqual([
      { lastName: 'Doe', firstName: 'Jane' },
      { lastName: 'Smith', firstName: 'John' }
    ]);
  });

  it('should return an empty array on API error', async () => {
    apiGetMock.mockRejectedValue(new Error('API Error'));
    const attendees = await funcs.getAllAttendees(1);
    expect(attendees).toEqual([]);
  });
});

jest.mock('./pdf-generator');
jest.mock('./email-service');

describe('createAndPrintPdf', () => {
  const PdfGenerator = require('./pdf-generator');
  const { sendEmailWithAttachment } = require('./email-service');

  beforeEach(() => {
    PdfGenerator.mockClear();
    sendEmailWithAttachment.mockClear();
    print.mockClear();
  });

  it('should create a PDF and print it locally', async () => {
    const event = { name: 'Test Event' };
    const attendees = [];
    const outputFileName = 'test.pdf';
    const pdfLayout = {};

    await funcs.createAndPrintPdf(event, attendees, outputFileName, pdfLayout, 'local');

    expect(PdfGenerator).toHaveBeenCalledWith(event, attendees, pdfLayout);
    expect(print).toHaveBeenCalledWith(outputFileName);
    expect(sendEmailWithAttachment).not.toHaveBeenCalled();
  });

  it('should create a PDF and send it via email', async () => {
    const event = { name: 'Test Event' };
    const attendees = [];
    const outputFileName = 'test.pdf';
    const pdfLayout = {};

    await funcs.createAndPrintPdf(event, attendees, outputFileName, pdfLayout, 'email');

    expect(PdfGenerator).toHaveBeenCalledWith(event, attendees, pdfLayout);
    expect(print).not.toHaveBeenCalled();
    expect(sendEmailWithAttachment).toHaveBeenCalled();
  });
});

describe('handleApiError', () => {
  const logger = require('./logger');
  const process = require('process');

  let loggerErrorMock, processExitMock;

  beforeEach(() => {
    loggerErrorMock = jest.spyOn(logger, 'error').mockImplementation(() => {});
    processExitMock = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerErrorMock.mockRestore();
    processExitMock.mockRestore();
  });

  it('should log 401 Unauthorized and exit', () => {
    const error = { response: { status: 401 } };
    funcs.handleApiError(error, 'testing');
    expect(loggerErrorMock).toHaveBeenCalledWith('API Error: 401 Unauthorized while testing. Please check your API_KEY in the .env file.');
    expect(processExitMock).toHaveBeenCalledWith(1);
  });

  it('should log other API errors', () => {
    const error = { response: { status: 500, data: 'Internal Server Error' } };
    funcs.handleApiError(error, 'testing');
    expect(loggerErrorMock).toHaveBeenCalledWith('API Error: 500 while testing.', 'Internal Server Error');
    expect(processExitMock).not.toHaveBeenCalled();
  });

  it('should log network errors', () => {
    const error = { request: {} };
    funcs.handleApiError(error, 'testing');
    expect(loggerErrorMock).toHaveBeenCalledWith('Network Error: No response received while testing.');
    expect(processExitMock).not.toHaveBeenCalled();
  });

  it('should log unexpected errors', () => {
    const error = new Error('Something broke');
    funcs.handleApiError(error, 'testing');
    expect(loggerErrorMock).toHaveBeenCalledWith('An unexpected error occurred while testing:', 'Something broke');
    expect(processExitMock).not.toHaveBeenCalled();
  });
});
