jest.mock('../src/services/logger');

const { parseTag } = require('../src/core/tag-parser');
const logger = require('../src/services/logger');

describe('parseTag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('selection (returns null vs object)', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['a number', 42],
      ['an object', { print: true }],
    ])('returns null for a non-string description (%s)', (_label, value) => {
      expect(parseTag(value)).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(parseTag('')).toBeNull();
    });

    it('returns null when there is no print: tag', () => {
      expect(parseTag('Just a normal event description with no tag.')).toBeNull();
    });

    it('selects the event for a bare tag with all params null', () => {
      expect(parseTag('print:')).toEqual({ leadMinutes: null, copies: null, printMode: null });
    });

    it('finds the tag anywhere in the description', () => {
      expect(parseTag('Bring your racquets.\nprint: 15min\nSee you there.')).toEqual({
        leadMinutes: 15,
        copies: null,
        printMode: null,
      });
    });
  });

  describe('lead time', () => {
    it('parses <n>min', () => {
      expect(parseTag('print: 30min').leadMinutes).toBe(30);
    });

    it('tolerates whitespace and the "minutes" spelling', () => {
      expect(parseTag('print: 45 minutes').leadMinutes).toBe(45);
    });

    it('accepts the boundary values 1 and 1440', () => {
      expect(parseTag('print: 1min').leadMinutes).toBe(1);
      expect(parseTag('print: 1440min').leadMinutes).toBe(1440);
    });

    it('ignores an out-of-range lead time and warns', () => {
      expect(parseTag('print: 9999min').leadMinutes).toBeNull();
      expect(parseTag('print: 0min').leadMinutes).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('lead time out of range'));
    });
  });

  describe('copies', () => {
    it('parses <n>copies and <n>copy', () => {
      expect(parseTag('print: 3copies').copies).toBe(3);
      expect(parseTag('print: 1copy').copies).toBe(1);
    });

    it('tolerates whitespace before the unit', () => {
      expect(parseTag('print: 2 copies').copies).toBe(2);
    });

    it('ignores an out-of-range copy count and warns', () => {
      expect(parseTag('print: 50copies').copies).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('copies out of range'));
    });
  });

  describe('print mode', () => {
    it('parses local', () => {
      expect(parseTag('print: local').printMode).toBe('local');
    });

    it('parses email (case-insensitive)', () => {
      expect(parseTag('PRINT: EMAIL').printMode).toBe('email');
    });

    it('does not match a substring like "emailed"', () => {
      const result = parseTag('print: emailed');
      expect(result.printMode).toBeNull();
    });
  });

  describe('combined and formatting variants', () => {
    it('parses all three params together in any order', () => {
      expect(parseTag('print: email 2copies 30min')).toEqual({
        leadMinutes: 30,
        copies: 2,
        printMode: 'email',
      });
    });

    it('is case-insensitive on the tag keyword', () => {
      expect(parseTag('PRINT: 10min')).toEqual({ leadMinutes: 10, copies: null, printMode: null });
    });

    it('tolerates markdown emphasis around the tag', () => {
      expect(parseTag('**print: 30min 2copies**')).toEqual({
        leadMinutes: 30,
        copies: 2,
        printMode: null,
      });
    });

    it('stops parsing at the end of the line', () => {
      expect(parseTag('print: 15min\n30min 5copies')).toEqual({
        leadMinutes: 15,
        copies: null,
        printMode: null,
      });
    });

    it('accepts "enabled" as a no-op without warning', () => {
      expect(parseTag('print: enabled')).toEqual({ leadMinutes: null, copies: null, printMode: null });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('warns on unrecognized tokens but still selects the event', () => {
      const result = parseTag('print: 5min gibberish');
      expect(result).toEqual({ leadMinutes: 5, copies: null, printMode: null });
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Unrecognized token'));
    });
  });
});
