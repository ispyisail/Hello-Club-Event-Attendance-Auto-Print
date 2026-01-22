/**
 * @fileoverview Tests for the in-memory cache module
 * Tests TTL expiration, stale data fallback, eviction, and cache statistics
 */

jest.mock('../src/services/logger');

describe('SimpleCache', () => {
  let cache;
  let logger;

  beforeEach(() => {
    // Clear module cache to get a fresh instance
    jest.resetModules();
    jest.clearAllMocks();

    // Mock Date.now for time-based tests
    jest.useFakeTimers();

    // Setup logger mock
    logger = require('../src/services/logger');
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.debug = jest.fn();
    logger.error = jest.fn();

    // Require fresh cache instance
    cache = require('../src/utils/cache');

    // Clear the cache before each test
    cache.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('set and get', () => {
    it('should store and retrieve a value', () => {
      cache.set('testKey', 'testValue', 60);

      const result = cache.get('testKey');

      expect(result).toBe('testValue');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cache set: testKey')
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cache hit: testKey')
      );
    });

    it('should store complex objects', () => {
      const complexData = {
        id: 123,
        name: 'Test Event',
        attendees: [
          { name: 'John Doe', email: 'john@example.com' },
          { name: 'Jane Smith', email: 'jane@example.com' }
        ]
      };

      cache.set('eventData', complexData, 120);
      const result = cache.get('eventData');

      expect(result).toEqual(complexData);
    });

    it('should return null for non-existent key', () => {
      const result = cache.get('nonExistentKey');
      expect(result).toBeNull();
    });

    it('should use default TTL values when not provided', () => {
      cache.set('defaultTTL', 'value');

      // Default TTL is 300s (5 minutes), advance by 4 minutes
      jest.advanceTimersByTime(4 * 60 * 1000);

      expect(cache.get('defaultTTL')).toBe('value');

      // Advance past default TTL
      jest.advanceTimersByTime(2 * 60 * 1000);

      expect(cache.get('defaultTTL')).toBeNull();
    });
  });

  describe('TTL expiration', () => {
    it('should expire cached value after TTL', () => {
      cache.set('expireTest', 'value', 60); // 60 seconds TTL

      // Before expiration
      expect(cache.get('expireTest')).toBe('value');

      // Advance time past TTL
      jest.advanceTimersByTime(61 * 1000);

      expect(cache.get('expireTest')).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cache expired: expireTest')
      );
    });

    it('should not expire before TTL', () => {
      cache.set('noExpire', 'value', 120); // 2 minutes TTL

      // Advance to just before expiration
      jest.advanceTimersByTime(119 * 1000);

      expect(cache.get('noExpire')).toBe('value');
    });
  });

  describe('getStale', () => {
    it('should return fresh data when not expired', () => {
      cache.set('staleTest', 'value', 60, 600);

      const result = cache.getStale('staleTest');

      expect(result).toBe('value');
    });

    it('should return stale data after TTL but within stale window', () => {
      cache.set('staleTest', 'value', 60, 600); // TTL: 60s, Stale: 600s

      // Advance past regular TTL but within stale window
      jest.advanceTimersByTime(120 * 1000); // 2 minutes

      // Regular get should return null
      expect(cache.get('staleTest')).toBeNull();

      // getStale should still return the value
      const result = cache.getStale('staleTest');
      expect(result).toBe('value');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Using stale cache data: staleTest')
      );
    });

    it('should return null after stale window expires', () => {
      cache.set('staleExpire', 'value', 60, 600); // TTL: 60s, Stale: 600s

      // Advance past both TTL and stale window
      jest.advanceTimersByTime((60 + 600 + 1) * 1000);

      const result = cache.getStale('staleExpire');

      expect(result).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Stale cache expired: staleExpire')
      );
    });

    it('should delete entry after stale window expires', () => {
      cache.set('deleteTest', 'value', 60, 600);

      // Advance past stale window
      jest.advanceTimersByTime((60 + 600 + 1) * 1000);

      cache.getStale('deleteTest');

      // Verify entry was deleted
      const stats = cache.getStats();
      expect(stats.total).toBe(0);
    });

    it('should return null for non-existent key', () => {
      const result = cache.getStale('nonExistent');
      expect(result).toBeNull();
    });
  });

  describe('Cache eviction', () => {
    it('should evict oldest entry when MAX_CACHE_SIZE reached', () => {
      // Note: MAX_CACHE_SIZE is 1000 in the source
      // We'll simulate adding entries up to the limit

      // Add entries up to limit
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, `value${i}`, 60);
      }

      // Clear the mock to see only the eviction log
      jest.clearAllMocks();

      // Add one more to trigger eviction
      cache.set('newKey', 'newValue', 60);

      // Should have evicted key0 (oldest)
      expect(cache.get('key0')).toBeNull();
      expect(cache.get('newKey')).toBe('newValue');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cache evicted oldest entry: key0')
      );
    });

    it('should maintain FIFO eviction order', () => {
      // Fill to capacity
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, `value${i}`, 60);
      }

      // Add 5 more entries
      cache.set('new1', 'value1', 60);
      cache.set('new2', 'value2', 60);
      cache.set('new3', 'value3', 60);

      // First 3 entries should be evicted
      expect(cache.get('key0')).toBeNull();
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();

      // Later entries and new ones should exist
      expect(cache.get('key999')).toBe('value999');
      expect(cache.get('new1')).toBe('value1');
      expect(cache.get('new3')).toBe('value3');
    });
  });

  describe('has', () => {
    it('should return true for existing non-expired key', () => {
      cache.set('existingKey', 'value', 60);
      expect(cache.has('existingKey')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(cache.has('nonExistentKey')).toBe(false);
    });

    it('should return false for expired key', () => {
      cache.set('expiredKey', 'value', 60);

      jest.advanceTimersByTime(61 * 1000);

      expect(cache.has('expiredKey')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete an existing key', () => {
      cache.set('deleteMe', 'value', 60);

      const deleted = cache.delete('deleteMe');

      expect(deleted).toBe(true);
      expect(cache.get('deleteMe')).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cache deleted: deleteMe')
      );
    });

    it('should return false when deleting non-existent key', () => {
      const deleted = cache.delete('nonExistent');
      expect(deleted).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all cached items', () => {
      cache.set('key1', 'value1', 60);
      cache.set('key2', 'value2', 60);
      cache.set('key3', 'value3', 60);

      cache.clear();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cache cleared: 3 items removed')
      );
    });

    it('should work on empty cache', () => {
      cache.clear();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cache cleared: 0 items removed')
      );
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries including stale data', () => {
      cache.set('expire1', 'value1', 60, 120);
      cache.set('expire2', 'value2', 60, 120);
      cache.set('valid', 'value3', 300, 600);

      // Advance past stale window for first two
      jest.advanceTimersByTime((60 + 120 + 1) * 1000);

      cache.cleanup();

      expect(cache.get('expire1')).toBeNull();
      expect(cache.get('expire2')).toBeNull();
      expect(cache.get('valid')).toBe('value3');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cache cleanup: 2 expired items removed')
      );
    });

    it('should not log when no items need cleanup', () => {
      cache.set('valid1', 'value1', 300);
      cache.set('valid2', 'value2', 300);

      jest.clearAllMocks();
      cache.cleanup();

      // Should not log when cleaned is 0
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Cache cleanup:')
      );
    });

    it('should handle old cache entries without staleExpiresAt', () => {
      // Manually create entry without staleExpiresAt (legacy format)
      const cacheInstance = cache;
      const cacheMap = cacheInstance.cache;

      cacheMap.set('legacyEntry', {
        value: 'legacyValue',
        expiresAt: Date.now() - 1000, // Already expired
        createdAt: Date.now() - 10000
        // No staleExpiresAt
      });

      cache.cleanup();

      expect(cache.get('legacyEntry')).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return accurate cache statistics', () => {
      cache.set('valid1', 'value1', 300);
      cache.set('valid2', 'value2', 300);
      cache.set('expired1', 'value3', 60);

      // Expire one entry
      jest.advanceTimersByTime(61 * 1000);

      const stats = cache.getStats();

      expect(stats.total).toBe(3);
      expect(stats.maxSize).toBe(1000);
      expect(stats.valid).toBe(2);
      expect(stats.expired).toBe(1);
      expect(stats.utilizationPercent).toBe(0); // 3/1000 rounds to 0%
    });

    it('should calculate utilization percentage correctly', () => {
      // Add 500 entries (50% capacity)
      for (let i = 0; i < 500; i++) {
        cache.set(`key${i}`, `value${i}`, 300);
      }

      const stats = cache.getStats();

      expect(stats.total).toBe(500);
      expect(stats.utilizationPercent).toBe(50);
    });

    it('should return empty stats for empty cache', () => {
      const stats = cache.getStats();

      expect(stats.total).toBe(0);
      expect(stats.valid).toBe(0);
      expect(stats.expired).toBe(0);
      expect(stats.utilizationPercent).toBe(0);
    });
  });

  describe('Concurrent access patterns', () => {
    it('should handle rapid successive sets for same key', () => {
      cache.set('rapidKey', 'value1', 60);
      cache.set('rapidKey', 'value2', 60);
      cache.set('rapidKey', 'value3', 60);

      expect(cache.get('rapidKey')).toBe('value3');
    });

    it('should handle multiple keys being set and retrieved', () => {
      const operations = [];

      for (let i = 0; i < 100; i++) {
        operations.push({ key: `key${i}`, value: `value${i}` });
      }

      // Set all
      operations.forEach(op => cache.set(op.key, op.value, 60));

      // Retrieve all
      operations.forEach(op => {
        expect(cache.get(op.key)).toBe(op.value);
      });
    });
  });
});
