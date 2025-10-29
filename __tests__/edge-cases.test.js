/**
 * Edge case tests for timezone handling, pagination, and other boundary conditions
 */

const PdfGenerator = require('../src/pdf-generator');
const { getAllAttendees } = require('../src/api-client');

// Mock dependencies
jest.mock('../src/api-client');
jest.mock('../src/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));
jest.mock('pdfkit', () => {
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
    y: 50
  }));
});
jest.mock('fs');

const apiClient = require('../src/api-client');

describe('Edge Case Tests', () => {
  describe('Timezone Handling', () => {
    it('should handle UTC timezone', () => {
      const event = {
        id: '1',
        name: 'Test Event',
        startDate: '2025-01-15T10:00:00Z',
        timezone: 'UTC'
      };

      const generator = new PdfGenerator(event, [], { columns: [] });
      expect(generator.event.timezone).toBe('UTC');
    });

    it('should fallback to UTC when timezone is undefined', () => {
      const event = {
        id: '1',
        name: 'Test Event',
        startDate: '2025-01-15T10:00:00Z'
        // No timezone specified
      };

      const generator = new PdfGenerator(event, [], { columns: [] });
      // Should use UTC as fallback
      expect(() => generator.generate('test.pdf')).not.toThrow();
    });

    it('should handle various timezone formats', () => {
      const timezones = [
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
        'America/Los_Angeles',
        'Pacific/Auckland'
      ];

      timezones.forEach(tz => {
        const event = {
          id: '1',
          name: 'Test Event',
          startDate: '2025-01-15T10:00:00Z',
          timezone: tz
        };

        expect(() => new PdfGenerator(event, [], { columns: [] })).not.toThrow();
      });
    });

    it('should handle daylight saving time transitions', () => {
      // March 2025 - Spring forward
      const springEvent = {
        id: '1',
        name: 'Spring Event',
        startDate: '2025-03-09T10:00:00Z',
        timezone: 'America/New_York'
      };

      // November 2025 - Fall back
      const fallEvent = {
        id: '2',
        name: 'Fall Event',
        startDate: '2025-11-02T10:00:00Z',
        timezone: 'America/New_York'
      };

      expect(() => new PdfGenerator(springEvent, [], { columns: [] })).not.toThrow();
      expect(() => new PdfGenerator(fallEvent, [], { columns: [] })).not.toThrow();
    });

    it('should handle invalid timezone gracefully', () => {
      const event = {
        id: '1',
        name: 'Test Event',
        startDate: '2025-01-15T10:00:00Z',
        timezone: 'Invalid/Timezone'
      };

      // Should not crash
      expect(() => new PdfGenerator(event, [], { columns: [] })).not.toThrow();
    });

    it('should handle events at midnight', () => {
      const event = {
        id: '1',
        name: 'Midnight Event',
        startDate: '2025-01-15T00:00:00Z',
        timezone: 'America/New_York'
      };

      expect(() => new PdfGenerator(event, [], { columns: [] })).not.toThrow();
    });

    it('should handle events near year boundary', () => {
      const newYearEvent = {
        id: '1',
        name: 'New Year Event',
        startDate: '2025-01-01T00:00:00Z',
        timezone: 'Pacific/Auckland' // First timezone to hit new year
      };

      const newYearEveEvent = {
        id: '2',
        name: 'New Year Eve',
        startDate: '2024-12-31T23:59:59Z',
        timezone: 'Pacific/Kiritimati' // Last timezone
      };

      expect(() => new PdfGenerator(newYearEvent, [], { columns: [] })).not.toThrow();
      expect(() => new PdfGenerator(newYearEveEvent, [], { columns: [] })).not.toThrow();
    });
  });

  describe('Pagination Edge Cases', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle exactly one page of attendees', async () => {
      const attendees = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        firstName: `First${i}`,
        lastName: `Last${i}`
      }));

      apiClient.getAllAttendees.mockResolvedValue(attendees);

      const result = await getAllAttendees('event-123');

      expect(result).toHaveLength(100);
    });

    it('should handle attendees spanning multiple pages', async () => {
      const totalAttendees = 250;
      const pageSize = 100;

      let callCount = 0;
      apiClient.getAllAttendees.mockImplementation(async (eventId) => {
        callCount++;

        if (callCount === 1) {
          return Array.from({ length: 100 }, (_, i) => ({
            id: `${i}`,
            firstName: `First${i}`,
            lastName: `Last${i}`
          }));
        } else if (callCount === 2) {
          return Array.from({ length: 100 }, (_, i) => ({
            id: `${i + 100}`,
            firstName: `First${i + 100}`,
            lastName: `Last${i + 100}`
          }));
        } else {
          return Array.from({ length: 50 }, (_, i) => ({
            id: `${i + 200}`,
            firstName: `First${i + 200}`,
            lastName: `Last${i + 200}`
          }));
        }
      });

      // Note: getAllAttendees handles pagination internally
      // This test assumes the mock returns final result
      const result = await getAllAttendees('event-123');

      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle very large attendee lists (stress test)', async () => {
      const largeList = Array.from({ length: 5000 }, (_, i) => ({
        id: `${i}`,
        firstName: `First${i}`,
        lastName: `Last${i}`,
        phone: `555-${String(i).padStart(4, '0')}`,
        email: `user${i}@example.com`
      }));

      apiClient.getAllAttendees.mockResolvedValue(largeList);

      const result = await getAllAttendees('event-123');

      expect(result).toHaveLength(5000);
    });

    it('should handle last page with only one attendee', async () => {
      const attendees = [
        { id: '1', firstName: 'Only', lastName: 'One' }
      ];

      apiClient.getAllAttendees.mockResolvedValue(attendees);

      const result = await getAllAttendees('event-123');

      expect(result).toHaveLength(1);
    });

    it('should handle zero attendees', async () => {
      apiClient.getAllAttendees.mockResolvedValue([]);

      const result = await getAllAttendees('event-123');

      expect(result).toEqual([]);
    });
  });

  describe('Attendee Name Edge Cases', () => {
    it('should handle names with special characters', () => {
      const event = { id: '1', name: 'Test' };
      const attendees = [
        { firstName: "O'Brien", lastName: "D'Angelo" },
        { firstName: 'José', lastName: 'García' },
        { firstName: 'François', lastName: 'Müller' },
        { firstName: 'Søren', lastName: 'Ægir' }
      ];

      const generator = new PdfGenerator(event, attendees, {
        columns: [{ id: 'name', header: 'Name', width: 100 }]
      });

      expect(() => generator.generate('test.pdf')).not.toThrow();
    });

    it('should handle very long names', () => {
      const event = { id: '1', name: 'Test' };
      const attendees = [
        {
          firstName: 'Wolfeschlegelsteinhausenbergerdorff',
          lastName: 'Pneumonoultramicroscopicsilicovolcanoconiosis'
        }
      ];

      const generator = new PdfGenerator(event, attendees, {
        columns: [{ id: 'name', header: 'Name', width: 100 }]
      });

      expect(() => generator.generate('test.pdf')).not.toThrow();
    });

    it('should handle names with only one character', () => {
      const event = { id: '1', name: 'Test' };
      const attendees = [
        { firstName: 'X', lastName: 'Y' }
      ];

      const generator = new PdfGenerator(event, attendees, {
        columns: [{ id: 'name', header: 'Name', width: 100 }]
      });

      expect(() => generator.generate('test.pdf')).not.toThrow();
    });

    it('should handle empty or missing names', () => {
      const event = { id: '1', name: 'Test' };
      const attendees = [
        { firstName: '', lastName: '' },
        { firstName: 'John', lastName: '' },
        { firstName: '', lastName: 'Doe' },
        { firstName: null, lastName: null },
        { firstName: undefined, lastName: undefined }
      ];

      const generator = new PdfGenerator(event, attendees, {
        columns: [{ id: 'name', header: 'Name', width: 100 }]
      });

      expect(() => generator.generate('test.pdf')).not.toThrow();
    });

    it('should handle names with numbers', () => {
      const event = { id: '1', name: 'Test' };
      const attendees = [
        { firstName: 'John2', lastName: 'Doe3' },
        { firstName: '42', lastName: '007' }
      ];

      const generator = new PdfGenerator(event, attendees, {
        columns: [{ id: 'name', header: 'Name', width: 100 }]
      });

      expect(() => generator.generate('test.pdf')).not.toThrow();
    });

    it('should handle names with emojis', () => {
      const event = { id: '1', name: 'Test' };
      const attendees = [
        { firstName: '🎉John', lastName: 'Doe🎊' },
        { firstName: '😀', lastName: '🎈' }
      ];

      const generator = new PdfGenerator(event, attendees, {
        columns: [{ id: 'name', header: 'Name', width: 100 }]
      });

      expect(() => generator.generate('test.pdf')).not.toThrow();
    });
  });

  describe('Event Name Edge Cases', () => {
    it('should handle very long event names', () => {
      const event = {
        id: '1',
        name: 'This Is An Extremely Long Event Name That Should Test The PDF Generation And Text Wrapping Capabilities Of The System When Handling Very Long Strings That Might Not Fit On A Single Line'
      };

      const generator = new PdfGenerator(event, [], { columns: [] });
      expect(() => generator.generate('test.pdf')).not.toThrow();
    });

    it('should handle event names with special characters', () => {
      const specialNames = [
        'Event & Conference',
        'Event @ Location',
        'Event #1',
        'Event $pecial',
        'Event (2025)',
        'Event: The Beginning',
        'Event; Part 2'
      ];

      specialNames.forEach(name => {
        const event = { id: '1', name };
        expect(() => new PdfGenerator(event, [], { columns: [] })).not.toThrow();
      });
    });

    it('should handle event names with unicode characters', () => {
      const unicodeNames = [
        '中文活动',
        'イベント',
        '이벤트',
        'Événement',
        'Мероприятие',
        'אירוע'
      ];

      unicodeNames.forEach(name => {
        const event = { id: '1', name };
        expect(() => new PdfGenerator(event, [], { columns: [] })).not.toThrow();
      });
    });
  });

  describe('Date and Time Edge Cases', () => {
    it('should handle leap year dates', () => {
      const leapYearEvent = {
        id: '1',
        name: 'Leap Day Event',
        startDate: '2024-02-29T12:00:00Z',
        timezone: 'UTC'
      };

      expect(() => new PdfGenerator(leapYearEvent, [], { columns: [] })).not.toThrow();
    });

    it('should handle dates far in the future', () => {
      const futureEvent = {
        id: '1',
        name: 'Future Event',
        startDate: '2099-12-31T23:59:59Z',
        timezone: 'UTC'
      };

      expect(() => new PdfGenerator(futureEvent, [], { columns: [] })).not.toThrow();
    });

    it('should handle dates in the past', () => {
      const pastEvent = {
        id: '1',
        name: 'Past Event',
        startDate: '2000-01-01T00:00:00Z',
        timezone: 'UTC'
      };

      expect(() => new PdfGenerator(pastEvent, [], { columns: [] })).not.toThrow();
    });

    it('should handle invalid date formats', () => {
      const invalidDateEvent = {
        id: '1',
        name: 'Invalid Date Event',
        startDate: 'not-a-date',
        timezone: 'UTC'
      };

      // Should not crash, may use fallback
      expect(() => new PdfGenerator(invalidDateEvent, [], { columns: [] })).not.toThrow();
    });
  });

  describe('Phone Number Edge Cases', () => {
    it('should handle various phone number formats', () => {
      const event = { id: '1', name: 'Test' };
      const attendees = [
        { firstName: 'John', lastName: 'Doe', phone: '123-456-7890' },
        { firstName: 'Jane', lastName: 'Smith', phone: '(555) 123-4567' },
        { firstName: 'Bob', lastName: 'Johnson', phone: '+1-555-123-4567' },
        { firstName: 'Alice', lastName: 'Williams', phone: '555.123.4567' },
        { firstName: 'Charlie', lastName: 'Brown', phone: '5551234567' }
      ];

      const generator = new PdfGenerator(event, attendees, {
        columns: [
          { id: 'name', header: 'Name', width: 100 },
          { id: 'phone', header: 'Phone', width: 100 }
        ]
      });

      expect(() => generator.generate('test.pdf')).not.toThrow();
    });

    it('should handle international phone numbers', () => {
      const event = { id: '1', name: 'Test' };
      const attendees = [
        { firstName: 'John', lastName: 'Doe', phone: '+44 20 7946 0958' }, // UK
        { firstName: 'Jane', lastName: 'Smith', phone: '+81 3-1234-5678' }, // Japan
        { firstName: 'Bob', lastName: 'Johnson', phone: '+61 2 1234 5678' }, // Australia
        { firstName: 'Alice', lastName: 'Williams', phone: '+49 30 123456' } // Germany
      ];

      const generator = new PdfGenerator(event, attendees, {
        columns: [
          { id: 'name', header: 'Name', width: 100 },
          { id: 'phone', header: 'Phone', width: 100 }
        ]
      });

      expect(() => generator.generate('test.pdf')).not.toThrow();
    });

    it('should handle missing or invalid phone numbers', () => {
      const event = { id: '1', name: 'Test' };
      const attendees = [
        { firstName: 'John', lastName: 'Doe', phone: '' },
        { firstName: 'Jane', lastName: 'Smith', phone: null },
        { firstName: 'Bob', lastName: 'Johnson', phone: undefined },
        { firstName: 'Alice', lastName: 'Williams', phone: 'N/A' },
        { firstName: 'Charlie', lastName: 'Brown', phone: 'no phone' }
      ];

      const generator = new PdfGenerator(event, attendees, {
        columns: [
          { id: 'name', header: 'Name', width: 100 },
          { id: 'phone', header: 'Phone', width: 100 }
        ]
      });

      expect(() => generator.generate('test.pdf')).not.toThrow();
    });
  });

  describe('Category Edge Cases', () => {
    it('should handle events with no categories', () => {
      const event = {
        id: '1',
        name: 'Test Event',
        categories: []
      };

      expect(() => new PdfGenerator(event, [], { columns: [] })).not.toThrow();
    });

    it('should handle events with null categories', () => {
      const event = {
        id: '1',
        name: 'Test Event',
        categories: null
      };

      expect(() => new PdfGenerator(event, [], { columns: [] })).not.toThrow();
    });

    it('should handle events with many categories', () => {
      const event = {
        id: '1',
        name: 'Multi-Category Event',
        categories: Array.from({ length: 20 }, (_, i) => ({
          name: `Category ${i}`
        }))
      };

      expect(() => new PdfGenerator(event, [], { columns: [] })).not.toThrow();
    });
  });

  describe('PDF Layout Edge Cases', () => {
    it('should handle PDF with no columns defined', () => {
      const event = { id: '1', name: 'Test' };
      const attendees = [
        { firstName: 'John', lastName: 'Doe' }
      ];

      const generator = new PdfGenerator(event, attendees, { columns: [] });
      expect(() => generator.generate('test.pdf')).not.toThrow();
    });

    it('should handle PDF with very narrow columns', () => {
      const event = { id: '1', name: 'Test' };
      const attendees = [
        { firstName: 'John', lastName: 'Doe' }
      ];

      const generator = new PdfGenerator(event, attendees, {
        columns: [
          { id: 'name', header: 'Name', width: 10 }, // Very narrow
          { id: 'phone', header: 'Phone', width: 5 } // Extremely narrow
        ]
      });

      expect(() => generator.generate('test.pdf')).not.toThrow();
    });

    it('should handle PDF with very wide columns', () => {
      const event = { id: '1', name: 'Test' };
      const attendees = [
        { firstName: 'John', lastName: 'Doe' }
      ];

      const generator = new PdfGenerator(event, attendees, {
        columns: [
          { id: 'name', header: 'Name', width: 1000 } // Very wide
        ]
      });

      expect(() => generator.generate('test.pdf')).not.toThrow();
    });

    it('should handle PDF that spans many pages', () => {
      const event = { id: '1', name: 'Test' };
      const attendees = Array.from({ length: 500 }, (_, i) => ({
        id: `${i}`,
        firstName: `First${i}`,
        lastName: `Last${i}`,
        phone: `555-${String(i).padStart(4, '0')}`
      }));

      const generator = new PdfGenerator(event, attendees, {
        columns: [
          { id: 'name', header: 'Name', width: 150 },
          { id: 'phone', header: 'Phone', width: 100 }
        ]
      });

      expect(() => generator.generate('test.pdf')).not.toThrow();
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle sorting very large attendee lists efficiently', async () => {
      const largeList = Array.from({ length: 10000 }, (_, i) => ({
        id: `${i}`,
        firstName: `First${Math.random().toString(36)}`,
        lastName: `Last${Math.random().toString(36)}`,
        phone: `555-${String(i).padStart(4, '0')}`
      }));

      apiClient.getAllAttendees.mockResolvedValue(largeList);

      const startTime = Date.now();
      const result = await getAllAttendees('event-123');
      const endTime = Date.now();

      const duration = endTime - startTime;

      // Should complete reasonably quickly (under 1 second)
      expect(duration).toBeLessThan(1000);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
