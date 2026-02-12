const {
  validateEvent,
  validateAttendee,
  validateDate,
  validateEventId,
  validatePositiveInteger,
  ensureArray,
  safeString,
  validateEventStatus,
  validateJobStatus,
} = require('../src/utils/validators');

describe('Validators', () => {
  describe('validateEvent', () => {
    it('should validate a proper event object', () => {
      const event = {
        id: 'event123',
        name: 'Test Event',
        startDate: '2026-03-15T10:00:00Z',
        categories: [{ name: 'Category1' }, { name: 'Category2' }],
      };

      const result = validateEvent(event);

      expect(result.id).toBe('event123');
      expect(result.name).toBe('Test Event');
      expect(result.startDate).toBe('2026-03-15T10:00:00Z');
      expect(result.categories).toHaveLength(2);
    });

    it('should throw error for missing id', () => {
      const event = {
        name: 'Test Event',
        startDate: '2026-03-15T10:00:00Z',
      };

      expect(() => validateEvent(event)).toThrow('valid string ID');
    });

    it('should throw error for missing name', () => {
      const event = {
        id: 'event123',
        startDate: '2026-03-15T10:00:00Z',
      };

      expect(() => validateEvent(event)).toThrow('valid string name');
    });

    it('should throw error for invalid startDate', () => {
      const event = {
        id: 'event123',
        name: 'Test Event',
        startDate: 'invalid-date',
      };

      expect(() => validateEvent(event)).toThrow('invalid startDate');
    });

    it('should filter out invalid categories', () => {
      const event = {
        id: 'event123',
        name: 'Test Event',
        startDate: '2026-03-15T10:00:00Z',
        categories: [{ name: 'Valid' }, null, { noName: 'invalid' }, { name: 'Valid2' }],
      };

      const result = validateEvent(event);

      expect(result.categories).toHaveLength(2);
      expect(result.categories[0].name).toBe('Valid');
      expect(result.categories[1].name).toBe('Valid2');
    });

    it('should handle empty categories gracefully', () => {
      const event = {
        id: 'event123',
        name: 'Test Event',
        startDate: '2026-03-15T10:00:00Z',
        categories: [],
      };

      const result = validateEvent(event);

      expect(result.categories).toEqual([]);
    });
  });

  describe('validateAttendee', () => {
    it('should validate a proper attendee object', () => {
      const attendee = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        status: 'confirmed',
        signUpDate: '2026-03-01T10:00:00Z',
        fee: 25,
      };

      const result = validateAttendee(attendee);

      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.fee).toBe(25);
    });

    it('should handle missing optional fields', () => {
      const attendee = {
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = validateAttendee(attendee);

      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(result.email).toBe('');
      expect(result.phone).toBe('');
      expect(result.status).toBe('unknown');
    });

    it('should trim whitespace from strings', () => {
      const attendee = {
        firstName: '  John  ',
        lastName: '  Doe  ',
        email: '  john@example.com  ',
      };

      const result = validateAttendee(attendee);

      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(result.email).toBe('john@example.com');
    });
  });

  describe('validateDate', () => {
    it('should validate a valid date string', () => {
      const date = validateDate('2026-03-15T10:00:00Z');

      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2026);
    });

    it('should validate a Date object', () => {
      const input = new Date('2026-03-15T10:00:00Z');
      const date = validateDate(input);

      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2026);
    });

    it('should throw error for invalid date', () => {
      expect(() => validateDate('invalid-date')).toThrow('not a valid date');
    });

    it('should throw error for unreasonable year', () => {
      expect(() => validateDate('1999-01-01')).toThrow('unreasonable year');
      expect(() => validateDate('2101-01-01')).toThrow('unreasonable year');
    });

    it('should throw error for missing date', () => {
      expect(() => validateDate(null)).toThrow('is required');
    });
  });

  describe('validateEventId', () => {
    it('should validate a proper event ID', () => {
      const id = validateEventId('event123abc');

      expect(id).toBe('event123abc');
    });

    it('should trim whitespace', () => {
      const id = validateEventId('  event123  ');

      expect(id).toBe('event123');
    });

    it('should throw error for empty string', () => {
      expect(() => validateEventId('')).toThrow('non-empty string');
      expect(() => validateEventId('   ')).toThrow('cannot be empty');
    });

    it('should throw error for too long ID', () => {
      const longId = 'a'.repeat(101);
      expect(() => validateEventId(longId)).toThrow('too long');
    });

    it('should throw error for suspicious characters', () => {
      expect(() => validateEventId('event<script>')).toThrow('invalid characters');
      expect(() => validateEventId('event";DROP TABLE')).toThrow('invalid characters');
    });
  });

  describe('validatePositiveInteger', () => {
    it('should validate a positive integer', () => {
      const num = validatePositiveInteger(5, 'test', 1, 10);

      expect(num).toBe(5);
    });

    it('should throw error for non-number', () => {
      expect(() => validatePositiveInteger('abc', 'test')).toThrow('valid number');
    });

    it('should throw error for value below minimum', () => {
      expect(() => validatePositiveInteger(0, 'test', 1, 10)).toThrow('at least 1');
    });

    it('should throw error for value above maximum', () => {
      expect(() => validatePositiveInteger(11, 'test', 1, 10)).toThrow('at most 10');
    });

    it('should parse string numbers', () => {
      const num = validatePositiveInteger('5', 'test', 1, 10);

      expect(num).toBe(5);
    });
  });

  describe('ensureArray', () => {
    it('should return array unchanged', () => {
      const arr = [1, 2, 3];
      const result = ensureArray(arr);

      expect(result).toEqual([1, 2, 3]);
    });

    it('should convert null to empty array', () => {
      const result = ensureArray(null);

      expect(result).toEqual([]);
    });

    it('should convert non-array to empty array', () => {
      const result = ensureArray('not an array');

      expect(result).toEqual([]);
    });
  });

  describe('safeString', () => {
    it('should extract string from object', () => {
      const obj = { name: 'John' };
      const result = safeString(obj, 'name');

      expect(result).toBe('John');
    });

    it('should trim whitespace', () => {
      const obj = { name: '  John  ' };
      const result = safeString(obj, 'name');

      expect(result).toBe('John');
    });

    it('should return default for missing key', () => {
      const obj = { name: 'John' };
      const result = safeString(obj, 'age', 'unknown');

      expect(result).toBe('unknown');
    });

    it('should convert non-string to string', () => {
      const obj = { age: 25 };
      const result = safeString(obj, 'age');

      expect(result).toBe('25');
    });

    it('should handle null object', () => {
      const result = safeString(null, 'name', 'default');

      expect(result).toBe('default');
    });
  });

  describe('validateEventStatus', () => {
    it('should validate valid statuses', () => {
      expect(validateEventStatus('pending')).toBe('pending');
      expect(validateEventStatus('processed')).toBe('processed');
      expect(validateEventStatus('failed')).toBe('failed');
      expect(validateEventStatus('cancelled')).toBe('cancelled');
    });

    it('should normalize case', () => {
      expect(validateEventStatus('PENDING')).toBe('pending');
      expect(validateEventStatus('Processed')).toBe('processed');
    });

    it('should throw error for invalid status', () => {
      expect(() => validateEventStatus('invalid')).toThrow('Invalid status');
    });
  });

  describe('validateJobStatus', () => {
    it('should validate valid job statuses', () => {
      expect(validateJobStatus('pending')).toBe('pending');
      expect(validateJobStatus('completed')).toBe('completed');
      expect(validateJobStatus('failed')).toBe('failed');
      expect(validateJobStatus('retrying')).toBe('retrying');
      expect(validateJobStatus('cancelled')).toBe('cancelled');
    });

    it('should throw error for invalid job status', () => {
      expect(() => validateJobStatus('invalid')).toThrow('Invalid job status');
    });
  });
});
