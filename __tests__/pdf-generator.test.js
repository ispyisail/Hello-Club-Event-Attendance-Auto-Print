const PdfGenerator = require('../pdf-generator');

// Mock the entire pdfkit library
jest.mock('pdfkit', () => {
  // Return a constructor that returns a mock doc object
  return jest.fn().mockImplementation(() => ({
    pipe: jest.fn(),
    font: jest.fn().mockReturnThis(),
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    moveDown: jest.fn().mockReturnThis(),
    image: jest.fn().mockReturnThis(),
    rect: jest.fn().mockReturnThis(),
    stroke: jest.fn().mockReturnThis(),
    fillColor: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
    addPage: jest.fn().mockReturnThis(),
    end: jest.fn(),
    page: { height: 842, width: 595, margins: { top: 50, bottom: 50, left: 50, right: 50 } },
    y: 50,
  }));
});

// Mock fs to prevent file system operations during tests
jest.mock('fs');

describe('PdfGenerator', () => {
  let generator;

  // Create a dummy generator instance before each test.
  // The constructor arguments don't matter for testing _getAttendeeValue.
  beforeEach(() => {
    generator = new PdfGenerator({ name: 'Test Event' }, []);
  });

  describe('_getAttendeeValue', () => {
    it('should format name as "Last, First"', () => {
      const attendee = { firstName: 'John', lastName: 'Doe' };
      // Accessing the "private" method for unit testing
      const result = generator['_getAttendeeValue'](attendee, 'name');
      expect(result).toBe('Doe, John');
    });

    it('should return phone number directly', () => {
      const attendee = { phone: '123-456-7890' };
      const result = generator['_getAttendeeValue'](attendee, 'phone');
      expect(result).toBe('123-456-7890');
    });

    it('should format a valid signUpDate', () => {
      const attendee = { signUpDate: '2023-10-26T10:00:00Z' };
      const result = generator['_getAttendeeValue'](attendee, 'signUpDate');
      // toLocaleDateString with en-GB is DD Mmm YYYY
      expect(result).toBe('26 Oct 2023');
    });

    it('should return an empty string for a null signUpDate', () => {
        const attendee = { signUpDate: null };
        const result = generator['_getAttendeeValue'](attendee, 'signUpDate');
        // This is the failing test case
        expect(result).toBe('');
    });

    it('should return fee for an attendee with fee', () => {
        const attendee = { hasFee: true, rule: { fee: 15.5 } };
        const result = generator['_getAttendeeValue'](attendee, 'fee');
        expect(result).toBe('15.50');
    });

    it('should return empty string for fee if not applicable', () => {
        const attendee = { hasFee: false };
        const result = generator['_getAttendeeValue'](attendee, 'fee');
        expect(result).toBe('');
    });

    it('should return "Paid" status for paid attendee', () => {
        const attendee = { isPaid: true };
        const result = generator['_getAttendeeValue'](attendee, 'status');
        expect(result).toBe('Paid');
    });

    it('should return "Owing" status for unpaid attendee with fee', () => {
        const attendee = { isPaid: false, hasFee: true };
        const result = generator['_getAttendeeValue'](attendee, 'status');
        expect(result).toBe('Owing');
    });

    it('should return "No Fee" status for attendee with no fee', () => {
        const attendee = { isPaid: false, hasFee: false };
        const result = generator['_getAttendeeValue'](attendee, 'status');
        expect(result).toBe('No Fee');
    });
  });
});
