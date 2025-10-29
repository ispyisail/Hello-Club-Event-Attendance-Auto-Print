/**
 * @fileoverview PDF caching to avoid regenerating PDFs for same event.
 * Cache expires after 5 minutes.
 * @module pdf-cache
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true});
    logger.info(`Created PDF cache directory: ${CACHE_DIR}`);
  }
}

/**
 * Generate cache key for event and attendees
 * @param {Object} event - Event object
 * @param {Array} attendees - Attendee list
 * @returns {string} Cache key
 */
function generateCacheKey(event, attendees) {
  const data = JSON.stringify({
    eventId: event.id,
    attendeeCount: attendees.length,
    attendeeHash: crypto.createHash('md5').update(JSON.stringify(attendees)).digest('hex')
  });
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Get cached PDF path
 * @param {string} cacheKey - Cache key
 * @returns {string|null} Path to cached PDF or null
 */
function getCachedPdf(cacheKey) {
  ensureCacheDir();

  const cachePath = path.join(CACHE_DIR, `${cacheKey}.pdf`);
  const metaPath = path.join(CACHE_DIR, `${cacheKey}.meta.json`);

  if (fs.existsSync(cachePath) && fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      const age = Date.now() - meta.timestamp;

      if (age < CACHE_TTL) {
        logger.info(`PDF cache HIT: ${cacheKey} (age: ${Math.round(age / 1000)}s)`);
        return cachePath;
      } else {
        logger.info(`PDF cache EXPIRED: ${cacheKey} (age: ${Math.round(age / 1000)}s)`);
        // Clean up expired cache
        fs.unlinkSync(cachePath);
        fs.unlinkSync(metaPath);
      }
    } catch (error) {
      logger.error(`Failed to read PDF cache metadata: ${error.message}`);
    }
  }

  logger.info(`PDF cache MISS: ${cacheKey}`);
  return null;
}

/**
 * Save PDF to cache
 * @param {string} cacheKey - Cache key
 * @param {string} pdfPath - Path to generated PDF
 */
function savePdfToCache(cacheKey, pdfPath) {
  ensureCacheDir();

  const cachePath = path.join(CACHE_DIR, `${cacheKey}.pdf`);
  const metaPath = path.join(CACHE_DIR, `${cacheKey}.meta.json`);

  try {
    // Copy PDF to cache
    fs.copyFileSync(pdfPath, cachePath);

    // Save metadata
    const meta = {
      timestamp: Date.now(),
      originalPath: pdfPath,
      cacheKey
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

    logger.info(`PDF cached: ${cacheKey}`);
  } catch (error) {
    logger.error(`Failed to cache PDF: ${error.message}`);
  }
}

/**
 * Clean up old cache entries
 * @returns {number} Number of entries removed
 */
function cleanupCache() {
  ensureCacheDir();

  let removedCount = 0;

  try {
    const files = fs.readdirSync(CACHE_DIR);
    const pdfFiles = files.filter(f => f.endsWith('.pdf'));

    for (const file of pdfFiles) {
      const metaFile = file.replace('.pdf', '.meta.json');
      const metaPath = path.join(CACHE_DIR, metaFile);

      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          const age = Date.now() - meta.timestamp;

          if (age > CACHE_TTL) {
            fs.unlinkSync(path.join(CACHE_DIR, file));
            fs.unlinkSync(metaPath);
            removedCount++;
          }
        } catch (error) {
          // Remove corrupted cache entries
          fs.unlinkSync(path.join(CACHE_DIR, file));
          if (fs.existsSync(metaPath)) {
            fs.unlinkSync(metaPath);
          }
          removedCount++;
        }
      }
    }

    if (removedCount > 0) {
      logger.info(`PDF cache cleanup: removed ${removedCount} expired entries`);
    }
  } catch (error) {
    logger.error(`Failed to cleanup PDF cache: ${error.message}`);
  }

  return removedCount;
}

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
function getCacheStats() {
  ensureCacheDir();

  const stats = {
    totalEntries: 0,
    totalSize: 0,
    validEntries: 0,
    expiredEntries: 0
  };

  try {
    const files = fs.readdirSync(CACHE_DIR);
    const pdfFiles = files.filter(f => f.endsWith('.pdf'));

    stats.totalEntries = pdfFiles.length;

    for (const file of pdfFiles) {
      const filePath = path.join(CACHE_DIR, file);
      const fileStats = fs.statSync(filePath);
      stats.totalSize += fileStats.size;

      const metaFile = file.replace('.pdf', '.meta.json');
      const metaPath = path.join(CACHE_DIR, metaFile);

      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          const age = Date.now() - meta.timestamp;

          if (age < CACHE_TTL) {
            stats.validEntries++;
          } else {
            stats.expiredEntries++;
          }
        } catch (error) {
          stats.expiredEntries++;
        }
      }
    }
  } catch (error) {
    logger.error(`Failed to get cache stats: ${error.message}`);
  }

  return stats;
}

/**
 * Clear all cache
 */
function clearCache() {
  ensureCacheDir();

  try {
    const files = fs.readdirSync(CACHE_DIR);
    let removedCount = 0;

    for (const file of files) {
      fs.unlinkSync(path.join(CACHE_DIR, file));
      removedCount++;
    }

    logger.info(`PDF cache cleared: ${removedCount} files removed`);
  } catch (error) {
    logger.error(`Failed to clear cache: ${error.message}`);
  }
}

// Schedule periodic cache cleanup
setInterval(() => {
  cleanupCache();
}, 60 * 1000); // Every minute

module.exports = {
  generateCacheKey,
  getCachedPdf,
  savePdfToCache,
  cleanupCache,
  getCacheStats,
  clearCache,
  CACHE_DIR,
  CACHE_TTL
};
