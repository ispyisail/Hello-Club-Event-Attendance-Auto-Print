/**
 * @fileoverview Simple in-memory cache with TTL (Time To Live)
 * Reduces unnecessary API calls by caching responses temporarily
 */

const logger = require('../services/logger');

// Maximum number of entries to prevent unbounded memory growth
const MAX_CACHE_SIZE = 1000;

class SimpleCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Evict oldest entries if cache is at capacity
   * Uses FIFO (First-In-First-Out) eviction based on Map insertion order
   * @private
   */
  _evictIfNeeded() {
    while (this.cache.size >= MAX_CACHE_SIZE) {
      // Map maintains insertion order, so first key is oldest
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      logger.debug(`Cache evicted oldest entry: ${oldestKey} (size limit: ${MAX_CACHE_SIZE})`);
    }
  }

  /**
   * Store a value in the cache with TTL and optional stale TTL
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttlSeconds - Time to live in seconds
   * @param {number} staleTtlSeconds - Additional time to keep stale data (for graceful degradation)
   */
  set(key, value, ttlSeconds = 300, staleTtlSeconds = 3600) {
    // Evict oldest entries if at capacity (before adding new entry)
    this._evictIfNeeded();

    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;
    const staleExpiresAt = now + (ttlSeconds + staleTtlSeconds) * 1000;

    this.cache.set(key, {
      value,
      expiresAt,
      staleExpiresAt,
      createdAt: now, // Track creation time for debugging/stats
    });

    logger.info(
      `Cache set: ${key} (TTL: ${ttlSeconds}s, Stale TTL: ${staleTtlSeconds}s, Size: ${this.cache.size}/${MAX_CACHE_SIZE})`
    );
  }

  /**
   * Get a value from the cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or null if not found/expired
   */
  get(key) {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      logger.info(`Cache expired: ${key}`);
      return null;
    }

    logger.info(`Cache hit: ${key}`);
    return cached.value;
  }

  /**
   * Get a value from the cache even if it's expired (stale data)
   * Used for graceful degradation when API fails
   * @param {string} key - Cache key
   * @returns {*} Cached value (even if stale) or null if completely expired
   */
  getStale(key) {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Check if stale data has completely expired
    if (cached.staleExpiresAt && Date.now() > cached.staleExpiresAt) {
      this.cache.delete(key);
      logger.info(`Stale cache expired: ${key}`);
      return null;
    }

    logger.warn(`Using stale cache data: ${key} (graceful degradation)`);
    return cached.value;
  }

  /**
   * Check if a key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Clear a specific key from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.info(`Cache deleted: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all cached items
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`Cache cleared: ${size} items removed`);
  }

  /**
   * Remove expired items from cache (including stale data)
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, data] of this.cache.entries()) {
      // Only delete if stale TTL has also expired
      if (data.staleExpiresAt && now > data.staleExpiresAt) {
        this.cache.delete(key);
        cleaned++;
      } else if (!data.staleExpiresAt && now > data.expiresAt) {
        // Fallback for old cache entries without staleExpiresAt
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cache cleanup: ${cleaned} expired items removed`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const now = Date.now();
    let valid = 0;
    let expired = 0;

    for (const data of this.cache.values()) {
      if (now > data.expiresAt) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      total: this.cache.size,
      maxSize: MAX_CACHE_SIZE,
      valid,
      expired,
      utilizationPercent: Math.round((this.cache.size / MAX_CACHE_SIZE) * 100),
    };
  }
}

// Create singleton instance
const cache = new SimpleCache();

// Run cleanup every 5 minutes
setInterval(() => cache.cleanup(), 5 * 60 * 1000);

module.exports = cache;
