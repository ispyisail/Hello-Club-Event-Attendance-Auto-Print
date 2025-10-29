const { applyFilters, passesFilters } = require('../src/event-filters');

// Mock logger
jest.mock('../src/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('Event Filters Module', () => {
  // Sample events for testing
  const sampleEvents = [
    {
      id: '1',
      name: 'Championship Tournament',
      hasFee: true,
      categories: [{ name: 'Sports' }]
    },
    {
      id: '2',
      name: 'Free Community Meetup',
      hasFee: false,
      categories: [{ name: 'Community' }]
    },
    {
      id: '3',
      name: 'Cancelled Workshop',
      hasFee: true,
      categories: [{ name: 'Education' }]
    },
    {
      id: '4',
      name: 'Test Event',
      hasFee: false,
      categories: [{ name: 'Testing' }]
    },
    {
      id: '5',
      name: 'Annual Gala',
      hasFee: true,
      categories: [{ name: 'Social' }]
    }
  ];

  describe('applyFilters', () => {
    it('should return all events when no filters provided', () => {
      const result = applyFilters(sampleEvents, null);
      expect(result).toEqual(sampleEvents);
    });

    it('should return all events when filters object is empty', () => {
      const result = applyFilters(sampleEvents, {});
      expect(result).toEqual(sampleEvents);
    });

    describe('Keyword Filtering', () => {
      it('should exclude events matching excludeKeywords', () => {
        const filters = {
          excludeKeywords: ['cancelled', 'test']
        };

        const result = applyFilters(sampleEvents, filters);

        expect(result).toHaveLength(3);
        expect(result.find(e => e.id === '3')).toBeUndefined(); // Cancelled
        expect(result.find(e => e.id === '4')).toBeUndefined(); // Test
      });

      it('should be case-insensitive for excludeKeywords', () => {
        const filters = {
          excludeKeywords: ['CHAMPIONSHIP']
        };

        const result = applyFilters(sampleEvents, filters);

        expect(result.find(e => e.id === '1')).toBeUndefined();
      });

      it('should include only events matching includeKeywords', () => {
        const filters = {
          includeKeywords: ['tournament', 'gala']
        };

        const result = applyFilters(sampleEvents, filters);

        expect(result).toHaveLength(2);
        expect(result.find(e => e.id === '1')).toBeDefined(); // Tournament
        expect(result.find(e => e.id === '5')).toBeDefined(); // Gala
      });

      it('should be case-insensitive for includeKeywords', () => {
        const filters = {
          includeKeywords: ['MEETUP']
        };

        const result = applyFilters(sampleEvents, filters);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('2');
      });

      it('should apply both include and exclude keywords', () => {
        const filters = {
          includeKeywords: ['tournament', 'workshop'],
          excludeKeywords: ['cancelled']
        };

        const result = applyFilters(sampleEvents, filters);

        // Should include tournament but not cancelled workshop
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('1');
      });

      it('should handle empty keyword arrays', () => {
        const filters = {
          includeKeywords: [],
          excludeKeywords: []
        };

        const result = applyFilters(sampleEvents, filters);
        expect(result).toEqual(sampleEvents);
      });
    });

    describe('Fee Status Filtering', () => {
      it('should filter to only paid events', () => {
        const filters = {
          onlyPaidEvents: true
        };

        const result = applyFilters(sampleEvents, filters);

        expect(result).toHaveLength(3);
        result.forEach(event => {
          expect(event.hasFee).toBe(true);
        });
      });

      it('should filter to only free events', () => {
        const filters = {
          onlyFreeEvents: true
        };

        const result = applyFilters(sampleEvents, filters);

        expect(result).toHaveLength(2);
        result.forEach(event => {
          expect(event.hasFee).toBe(false);
        });
      });

      it('should handle both paid and free filters (free takes precedence)', () => {
        const filters = {
          onlyPaidEvents: true,
          onlyFreeEvents: true
        };

        // This is a conflicting configuration, but should still work
        // Apply paid first, then free - result should be no events
        const result = applyFilters(sampleEvents, filters);

        expect(result).toHaveLength(0);
      });
    });

    describe('Attendee Count Filtering', () => {
      it('should filter by minimum attendees when counts provided', () => {
        const attendeeCounts = {
          '1': 50,
          '2': 10,
          '3': 25,
          '4': 5,
          '5': 100
        };

        const filters = {
          minAttendees: 20
        };

        const result = applyFilters(sampleEvents, filters, attendeeCounts);

        expect(result).toHaveLength(3);
        expect(result.find(e => e.id === '1')).toBeDefined(); // 50
        expect(result.find(e => e.id === '3')).toBeDefined(); // 25
        expect(result.find(e => e.id === '5')).toBeDefined(); // 100
      });

      it('should filter by maximum attendees when counts provided', () => {
        const attendeeCounts = {
          '1': 50,
          '2': 10,
          '3': 25,
          '4': 5,
          '5': 100
        };

        const filters = {
          maxAttendees: 30
        };

        const result = applyFilters(sampleEvents, filters, attendeeCounts);

        expect(result).toHaveLength(3);
        expect(result.find(e => e.id === '2')).toBeDefined(); // 10
        expect(result.find(e => e.id === '3')).toBeDefined(); // 25
        expect(result.find(e => e.id === '4')).toBeDefined(); // 5
      });

      it('should filter by both min and max attendees', () => {
        const attendeeCounts = {
          '1': 50,
          '2': 10,
          '3': 25,
          '4': 5,
          '5': 100
        };

        const filters = {
          minAttendees: 15,
          maxAttendees: 60
        };

        const result = applyFilters(sampleEvents, filters, attendeeCounts);

        expect(result).toHaveLength(2);
        expect(result.find(e => e.id === '1')).toBeDefined(); // 50
        expect(result.find(e => e.id === '3')).toBeDefined(); // 25
      });

      it('should handle events with 0 attendees', () => {
        const attendeeCounts = {
          '1': 0,
          '2': 10,
          '3': 0,
          '4': 5,
          '5': 0
        };

        const filters = {
          minAttendees: 1
        };

        const result = applyFilters(sampleEvents, filters, attendeeCounts);

        expect(result).toHaveLength(2);
        expect(result.find(e => e.id === '2')).toBeDefined();
        expect(result.find(e => e.id === '4')).toBeDefined();
      });

      it('should handle missing attendee count as 0', () => {
        const attendeeCounts = {
          '1': 50,
          // Missing '2', '3', '4', '5'
        };

        const filters = {
          minAttendees: 10
        };

        const result = applyFilters(sampleEvents, filters, attendeeCounts);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('1');
      });
    });

    describe('Combined Filters', () => {
      it('should apply all filter types together', () => {
        const attendeeCounts = {
          '1': 50,
          '2': 10,
          '3': 25,
          '4': 5,
          '5': 100
        };

        const filters = {
          includeKeywords: ['tournament', 'gala', 'meetup'],
          excludeKeywords: ['test'],
          onlyPaidEvents: true,
          minAttendees: 40
        };

        const result = applyFilters(sampleEvents, filters, attendeeCounts);

        // Should match: Championship Tournament (paid, 50 attendees)
        // Should match: Annual Gala (paid, 100 attendees)
        // Excluded: Free Community Meetup (not paid)
        expect(result).toHaveLength(2);
        expect(result.find(e => e.id === '1')).toBeDefined();
        expect(result.find(e => e.id === '5')).toBeDefined();
      });
    });
  });

  describe('passesFilters', () => {
    const event = {
      id: '1',
      name: 'Championship Tournament',
      hasFee: true
    };

    it('should return true when no filters provided', () => {
      expect(passesFilters(event, null)).toBe(true);
    });

    it('should check excludeKeywords', () => {
      const filters = { excludeKeywords: ['cancelled'] };
      expect(passesFilters(event, filters)).toBe(true);

      const filters2 = { excludeKeywords: ['championship'] };
      expect(passesFilters(event, filters2)).toBe(false);
    });

    it('should check includeKeywords', () => {
      const filters = { includeKeywords: ['tournament'] };
      expect(passesFilters(event, filters)).toBe(true);

      const filters2 = { includeKeywords: ['workshop'] };
      expect(passesFilters(event, filters2)).toBe(false);
    });

    it('should check onlyPaidEvents', () => {
      const filters = { onlyPaidEvents: true };
      expect(passesFilters(event, filters)).toBe(true);

      const freeEvent = { ...event, hasFee: false };
      expect(passesFilters(freeEvent, filters)).toBe(false);
    });

    it('should check onlyFreeEvents', () => {
      const filters = { onlyFreeEvents: true };
      expect(passesFilters(event, filters)).toBe(false);

      const freeEvent = { ...event, hasFee: false };
      expect(passesFilters(freeEvent, filters)).toBe(true);
    });

    it('should check minAttendees when count provided', () => {
      const filters = { minAttendees: 10 };
      expect(passesFilters(event, filters, 20)).toBe(true);
      expect(passesFilters(event, filters, 5)).toBe(false);
    });

    it('should check maxAttendees when count provided', () => {
      const filters = { maxAttendees: 50 };
      expect(passesFilters(event, filters, 30)).toBe(true);
      expect(passesFilters(event, filters, 60)).toBe(false);
    });

    it('should return true when attendee count not provided', () => {
      const filters = { minAttendees: 10 };
      // When attendeeCount is null, should return true (filter not applied)
      expect(passesFilters(event, filters, null)).toBe(true);
    });

    it('should handle combined filters', () => {
      const filters = {
        includeKeywords: ['tournament'],
        onlyPaidEvents: true,
        minAttendees: 10
      };

      expect(passesFilters(event, filters, 20)).toBe(true);
      expect(passesFilters(event, filters, 5)).toBe(false);

      const freeEvent = { ...event, hasFee: false };
      expect(passesFilters(freeEvent, filters, 20)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle events with missing name field', () => {
      const events = [{ id: '1', hasFee: true }];
      const filters = { includeKeywords: ['test'] };

      expect(() => applyFilters(events, filters)).toThrow();
    });

    it('should handle undefined hasFee field', () => {
      const events = [{ id: '1', name: 'Test Event' }];
      const filters = { onlyPaidEvents: true };

      const result = applyFilters(events, filters);
      expect(result).toHaveLength(0);
    });

    it('should handle null event name', () => {
      const event = { id: '1', name: null, hasFee: true };
      const filters = { includeKeywords: ['test'] };

      expect(() => passesFilters(event, filters)).toThrow();
    });

    it('should handle very long keyword lists', () => {
      const filters = {
        excludeKeywords: Array.from({ length: 100 }, (_, i) => `keyword${i}`)
      };

      const result = applyFilters(sampleEvents, filters);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle special characters in keywords', () => {
      const events = [
        { id: '1', name: 'Event with $pecial Ch@racters!', hasFee: true }
      ];

      const filters = { includeKeywords: ['$pecial'] };
      const result = applyFilters(events, filters);

      expect(result).toHaveLength(1);
    });

    it('should handle empty events array', () => {
      const result = applyFilters([], { includeKeywords: ['test'] });
      expect(result).toEqual([]);
    });

    it('should not mutate original events array', () => {
      const originalEvents = [...sampleEvents];
      const filters = { excludeKeywords: ['cancelled'] };

      applyFilters(sampleEvents, filters);

      expect(sampleEvents).toEqual(originalEvents);
    });
  });

  describe('Performance', () => {
    it('should handle large event lists efficiently', () => {
      const largeEventList = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}`,
        name: `Event ${i}`,
        hasFee: i % 2 === 0
      }));

      const filters = {
        includeKeywords: ['Event'],
        onlyPaidEvents: true
      };

      const startTime = Date.now();
      const result = applyFilters(largeEventList, filters);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
      expect(result).toHaveLength(500); // Half should be paid
    });
  });
});
