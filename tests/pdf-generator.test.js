const PdfGenerator = require('../src/services/pdf-generator');

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
    it('should format name as "First Last"', () => {
      const attendee = { firstName: 'John', lastName: 'Doe' };
      // Accessing the "private" method for unit testing
      const result = generator['_getAttendeeValue'](attendee, 'name');
      expect(result).toBe('John Doe');
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

    it('should correctly format a signUpDate of 0 (Unix epoch)', () => {
      const attendee = { signUpDate: 0 };
      const result = generator['_getAttendeeValue'](attendee, 'signUpDate');
      const expectedDate = new Date(0).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      expect(result).toBe(expectedDate); // Should be '01 Jan 1970'
    });

    it('should return fee for an attendee with fee', () => {
      const attendee = { hasFee: true, rule: { fee: 15.5 } };
      const result = generator['_getAttendeeValue'](attendee, 'fee');
      expect(result).toBe('$15.50');
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

    it('should handle a string fee gracefully', () => {
      const attendee = { hasFee: true, rule: { fee: '15.5' } };
      const result = generator['_getAttendeeValue'](attendee, 'fee');
      expect(result).toBe('$15.50');
    });

    it('should return "Membership" for membership rules', () => {
      const attendee = { rule: { name: 'Annual Membership' } };
      const result = generator['_getAttendeeValue'](attendee, 'fee');
      expect(result).toBe('Membership');
    });

    it('should return empty string for unknown column id', () => {
      const attendee = { someField: 'test' };
      const result = generator['_getAttendeeValue'](attendee, 'unknownColumn');
      expect(result).toBe('');
    });

    it('should return field value for custom column id', () => {
      const attendee = { customField: 'Custom Value' };
      const result = generator['_getAttendeeValue'](attendee, 'customField');
      expect(result).toBe('Custom Value');
    });
  });

  describe('Constructor', () => {
    it('should create instance with event, attendees, and layout', () => {
      const event = { name: 'Test Event', startDate: '2025-01-15T10:00:00Z' };
      const attendees = [{ firstName: 'John', lastName: 'Doe' }];
      const layout = { fontSize: 10, columns: [] };

      const gen = new PdfGenerator(event, attendees, layout);

      expect(gen.event).toBe(event);
      expect(gen.attendees).toBe(attendees);
      expect(gen.layout).toBe(layout);
      expect(gen.doc).toBeDefined();
      expect(gen.row_height).toBe(28);
      expect(gen.checkboxSize).toBe(16);
    });
  });

  describe('generate', () => {
    it('should generate PDF with valid filename', () => {
      const fs = require('fs');
      const event = {
        name: 'Test Event',
        startDate: '2025-01-15T10:00:00Z',
        endDate: '2025-01-15T12:00:00Z',
        timezone: 'UTC',
      };
      const attendees = [{ firstName: 'John', lastName: 'Doe', phone: '123-456-7890' }];
      const layout = {
        fontSize: 10,
        columns: [{ id: 'name', header: 'Name', width: 150 }],
      };

      const gen = new PdfGenerator(event, attendees, layout);

      // Mock createWriteStream
      const mockStream = { write: jest.fn(), end: jest.fn() };
      fs.createWriteStream.mockReturnValue(mockStream);

      gen.generate('test-output.pdf');

      // Verify file stream was created
      expect(fs.createWriteStream).toHaveBeenCalled();
      expect(gen.doc.pipe).toHaveBeenCalledWith(mockStream);
      expect(gen.doc.end).toHaveBeenCalled();
    });

    it('should reject filename with path traversal', () => {
      const event = { name: 'Test Event' };
      const gen = new PdfGenerator(event, [], { columns: [] });

      expect(() => gen.generate('../../../etc/passwd.pdf')).toThrow(/Invalid output filename.*traversal sequences/i);
    });

    it('should reject filename with directory separators', () => {
      const event = { name: 'Test Event' };
      const gen = new PdfGenerator(event, [], { columns: [] });

      expect(() => gen.generate('subdir/output.pdf')).toThrow(/Invalid output filename.*directory paths/i);
    });

    it('should reject filename without .pdf extension', () => {
      const event = { name: 'Test Event' };
      const gen = new PdfGenerator(event, [], { columns: [] });

      expect(() => gen.generate('output.txt')).toThrow(/Invalid output filename.*\.pdf extension/i);
    });
  });

  describe('_getFeeColor', () => {
    it('should return teal for membership', () => {
      const attendee = { rule: { name: 'Annual Membership' } };
      const result = generator['_getFeeColor'](attendee);
      expect(result).toBe('#008080');
    });

    it('should return teal for paid fees', () => {
      const attendee = { hasFee: true, isPaid: true, rule: { fee: 30 } };
      const result = generator['_getFeeColor'](attendee);
      expect(result).toBe('#008080');
    });

    it('should return red for unpaid fees', () => {
      const attendee = { hasFee: true, isPaid: false, rule: { fee: 30 } };
      const result = generator['_getFeeColor'](attendee);
      expect(result).toBe('#DC143C');
    });

    it('should return black for no fee', () => {
      const attendee = { hasFee: false };
      const result = generator['_getFeeColor'](attendee);
      expect(result).toBe('black');
    });
  });

  describe('_generateTableRow', () => {
    it('should generate row with attendee data', () => {
      const event = { name: 'Test Event' };
      const attendee = {
        firstName: 'Jane',
        lastName: 'Smith',
        isPaid: true,
      };
      const layout = {
        columns: [
          { id: 'name', header: 'Name', width: 150 },
          { id: 'status', header: 'Status', width: 80 },
        ],
      };

      const gen = new PdfGenerator(event, [attendee], layout);
      gen._generateTableRow(attendee, 100);

      // Verify rect (checkbox) was drawn
      expect(gen.doc.rect).toHaveBeenCalledWith(50, 101, 16, 16);
      expect(gen.doc.stroke).toHaveBeenCalled();

      // Verify text was written (name, phone, signUpDate, fee)
      expect(gen.doc.text).toHaveBeenCalled();
    });

    it('should use color coding for fee column', () => {
      const event = { name: 'Test Event' };
      const layout = { columns: [] };
      const gen = new PdfGenerator(event, [], layout);

      // Test unpaid fee (red)
      const unpaidAttendee = { firstName: 'John', lastName: 'Doe', hasFee: true, isPaid: false, rule: { fee: 30 } };
      gen._generateTableRow(unpaidAttendee, 100);
      expect(gen.doc.fillColor).toHaveBeenCalledWith('#DC143C');

      // Test paid fee (teal)
      gen.doc.fillColor.mockClear();
      const paidAttendee = { firstName: 'Jane', lastName: 'Smith', hasFee: true, isPaid: true, rule: { fee: 30 } };
      gen._generateTableRow(paidAttendee, 100);
      expect(gen.doc.fillColor).toHaveBeenCalledWith('#008080');

      // Test membership (teal)
      gen.doc.fillColor.mockClear();
      const memberAttendee = { firstName: 'Bob', lastName: 'Wilson', rule: { name: 'Membership' } };
      gen._generateTableRow(memberAttendee, 100);
      expect(gen.doc.fillColor).toHaveBeenCalledWith('#008080');
    });
  });

  describe('_generateHeader', () => {
    it('should generate header without logo if not provided', () => {
      const event = {
        name: 'Summer Festival',
        startDate: '2025-07-15T14:00:00Z',
        endDate: '2025-07-15T18:00:00Z',
        timezone: 'America/New_York',
      };
      const layout = { fontSize: 10 };

      const gen = new PdfGenerator(event, [], layout);
      gen._generateHeader();

      // Verify header text was written (event name and timestamp)
      expect(gen.doc.text).toHaveBeenCalledWith('Summer Festival', 50, 50, expect.objectContaining({ align: 'left' }));
      // Check that timestamp text was also written (contains "Attendees as of")
      const textCalls = gen.doc.text.mock.calls;
      const hasTimestamp = textCalls.some((call) => call[0].includes('Attendees as of'));
      expect(hasTimestamp).toBe(true);
    });

    it('should generate header with logo if file exists', () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);

      const event = {
        name: 'Test Event',
        startDate: '2025-01-15T10:00:00Z',
        endDate: '2025-01-15T12:00:00Z',
        timezone: 'UTC',
      };
      const layout = { fontSize: 10, logo: '/path/to/logo.png' };

      const gen = new PdfGenerator(event, [], layout);
      gen._generateHeader();

      // Verify logo was added on the right side
      expect(gen.doc.image).toHaveBeenCalledWith(
        '/path/to/logo.png',
        425,
        50,
        expect.objectContaining({
          fit: [120, 80],
          align: 'right',
        })
      );
    });
  });

  describe('_generateTableHeader', () => {
    it('should generate table header with fixed columns', () => {
      const event = { name: 'Test Event' };
      const layout = { columns: [] }; // Layout columns are no longer used

      const gen = new PdfGenerator(event, [], layout);
      gen._generateTableHeader();

      // Verify header text for fixed columns (Name, Phone, Signed up, Fee)
      expect(gen.doc.text).toHaveBeenCalledWith('Name', expect.any(Number), expect.any(Number), expect.any(Object));
      expect(gen.doc.text).toHaveBeenCalledWith('Phone', expect.any(Number), expect.any(Number), expect.any(Object));
      expect(gen.doc.text).toHaveBeenCalledWith(
        'Signed up',
        expect.any(Number),
        expect.any(Number),
        expect.any(Object)
      );
      expect(gen.doc.text).toHaveBeenCalledWith('Fee', expect.any(Number), expect.any(Number), expect.any(Object));
    });
  });
});
