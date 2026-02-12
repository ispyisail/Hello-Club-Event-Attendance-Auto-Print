const logger = require('../services/logger');

/**
 * Memory monitoring and leak prevention utilities.
 * Tracks memory usage and logs warnings when thresholds are exceeded.
 */

let memoryCheckInterval = null;
const memoryHistory = [];
const MAX_HISTORY = 100; // Keep last 100 memory snapshots

/**
 * Get current memory usage statistics.
 * @returns {Object} Memory usage in MB
 */
function getMemoryUsage() {
  const usage = process.memoryUsage();

  return {
    rss: Math.round(usage.rss / 1024 / 1024), // Resident Set Size (total memory)
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // Total heap allocated
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // Heap actually used
    external: Math.round(usage.external / 1024 / 1024), // External memory (buffers, etc)
    timestamp: Date.now(),
  };
}

/**
 * Check if memory usage exceeds thresholds and log warnings.
 * @param {Object} thresholds - Threshold configuration
 * @param {number} thresholds.heapUsedMB - Warning threshold for heap usage in MB (default: 300)
 * @param {number} thresholds.rssMB - Warning threshold for RSS in MB (default: 400)
 * @returns {Object} Current memory usage and warning status
 */
function checkMemoryUsage(thresholds = {}) {
  const heapUsedThreshold = thresholds.heapUsedMB || 300;
  const rssThreshold = thresholds.rssMB || 400;

  const usage = getMemoryUsage();

  // Add to history (bounded queue)
  memoryHistory.push(usage);
  if (memoryHistory.length > MAX_HISTORY) {
    memoryHistory.shift();
  }

  const warnings = [];

  // Check heap usage
  if (usage.heapUsed > heapUsedThreshold) {
    const warning = `High heap usage: ${usage.heapUsed}MB / ${heapUsedThreshold}MB threshold`;
    warnings.push(warning);
    logger.warn(warning);
  }

  // Check RSS (total memory)
  if (usage.rss > rssThreshold) {
    const warning = `High RSS memory: ${usage.rss}MB / ${rssThreshold}MB threshold`;
    warnings.push(warning);
    logger.warn(warning);
  }

  // Detect memory leaks (steadily increasing memory over time)
  if (memoryHistory.length >= 10) {
    const recent = memoryHistory.slice(-10);
    const increasing = recent.every((snapshot, i) => i === 0 || snapshot.heapUsed >= recent[i - 1].heapUsed);

    if (increasing) {
      const first = recent[0].heapUsed;
      const last = recent[recent.length - 1].heapUsed;
      const increase = last - first;

      if (increase > 50) {
        // 50MB increase over 10 checks
        const warning = `Possible memory leak detected: heap increased by ${increase}MB over last ${recent.length} checks`;
        warnings.push(warning);
        logger.error(warning);
      }
    }
  }

  return {
    usage,
    warnings,
    healthy: warnings.length === 0,
  };
}

/**
 * Start periodic memory monitoring.
 * @param {number} intervalMs - Check interval in milliseconds (default: 5 minutes)
 * @param {Object} thresholds - Memory thresholds
 */
function startMemoryMonitoring(intervalMs = 300000, thresholds = {}) {
  if (memoryCheckInterval) {
    logger.warn('Memory monitoring already started');
    return;
  }

  logger.info(`Starting memory monitoring (interval: ${intervalMs / 1000}s)`);

  // Initial check
  checkMemoryUsage(thresholds);

  // Periodic checks
  memoryCheckInterval = setInterval(() => {
    checkMemoryUsage(thresholds);
  }, intervalMs);

  // Prevent interval from keeping process alive
  memoryCheckInterval.unref();
}

/**
 * Stop periodic memory monitoring.
 */
function stopMemoryMonitoring() {
  if (memoryCheckInterval) {
    clearInterval(memoryCheckInterval);
    memoryCheckInterval = null;
    logger.info('Memory monitoring stopped');
  }
}

/**
 * Force garbage collection if available (requires --expose-gc flag).
 * @returns {boolean} True if GC was triggered
 */
function forceGarbageCollection() {
  if (global.gc) {
    logger.info('Forcing garbage collection...');
    global.gc();
    return true;
  } else {
    logger.warn('Garbage collection not available (run with --expose-gc to enable)');
    return false;
  }
}

/**
 * Get memory usage statistics over time.
 * @returns {Object} Memory statistics
 */
function getMemoryStats() {
  if (memoryHistory.length === 0) {
    return null;
  }

  const heapUsedValues = memoryHistory.map((h) => h.heapUsed);
  const rssValues = memoryHistory.map((h) => h.rss);

  return {
    current: getMemoryUsage(),
    history: {
      samples: memoryHistory.length,
      timeRange: {
        start: memoryHistory[0].timestamp,
        end: memoryHistory[memoryHistory.length - 1].timestamp,
      },
      heapUsed: {
        min: Math.min(...heapUsedValues),
        max: Math.max(...heapUsedValues),
        avg: Math.round(heapUsedValues.reduce((a, b) => a + b, 0) / heapUsedValues.length),
      },
      rss: {
        min: Math.min(...rssValues),
        max: Math.max(...rssValues),
        avg: Math.round(rssValues.reduce((a, b) => a + b, 0) / rssValues.length),
      },
    },
  };
}

/**
 * Clear memory history (useful for tests).
 */
function clearHistory() {
  memoryHistory.length = 0;
}

module.exports = {
  getMemoryUsage,
  checkMemoryUsage,
  startMemoryMonitoring,
  stopMemoryMonitoring,
  forceGarbageCollection,
  getMemoryStats,
  clearHistory,
};
