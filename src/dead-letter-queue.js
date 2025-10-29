/**
 * @fileoverview Dead Letter Queue for failed print jobs.
 * Stores failed jobs for manual retry or investigation.
 * @module dead-letter-queue
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DLQ_FILE = path.join(process.cwd(), 'dead-letter-queue.json');
const MAX_QUEUE_SIZE = 1000;

/**
 * Read the dead letter queue from disk
 * @returns {Array<Object>} Dead letter queue entries
 */
function readQueue() {
  try {
    if (fs.existsSync(DLQ_FILE)) {
      const data = fs.readFileSync(DLQ_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error('Failed to read dead letter queue:', error.message);
  }
  return [];
}

/**
 * Write the dead letter queue to disk
 * @param {Array<Object>} queue - Queue entries to write
 */
function writeQueue(queue) {
  try {
    fs.writeFileSync(DLQ_FILE, JSON.stringify(queue, null, 2), 'utf8');
  } catch (error) {
    logger.error('Failed to write dead letter queue:', error.message);
  }
}

/**
 * Add a failed job to the dead letter queue
 * @param {Object} job - Failed job details
 * @param {string} job.type - Job type (e.g., 'print', 'email')
 * @param {Object} job.data - Job data
 * @param {Error} job.error - Error that caused failure
 * @param {number} job.attempts - Number of retry attempts
 */
function addToQueue(job) {
  const queue = readQueue();

  const entry = {
    id: `dlq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    type: job.type,
    data: job.data,
    error: {
      message: job.error?.message || 'Unknown error',
      stack: job.error?.stack || null
    },
    attempts: job.attempts || 0,
    status: 'pending'
  };

  queue.push(entry);

  // Enforce max queue size
  if (queue.length > MAX_QUEUE_SIZE) {
    const removed = queue.shift();
    logger.warn(`Dead letter queue exceeded max size. Removed oldest entry: ${removed.id}`);
  }

  writeQueue(queue);

  logger.warn(
    `Added job to dead letter queue: ${entry.id} (type: ${job.type}, ` +
    `error: ${job.error?.message})`
  );

  return entry.id;
}

/**
 * Get all pending jobs from the queue
 * @param {Object} options - Filter options
 * @returns {Array<Object>} Pending jobs
 */
function getPendingJobs(options = {}) {
  const queue = readQueue();
  const {
    type = null,
    limit = null
  } = options;

  let filtered = queue.filter(entry => entry.status === 'pending');

  if (type) {
    filtered = filtered.filter(entry => entry.type === type);
  }

  if (limit) {
    filtered = filtered.slice(0, limit);
  }

  return filtered;
}

/**
 * Get a specific job by ID
 * @param {string} id - Job ID
 * @returns {Object|null} Job entry or null
 */
function getJob(id) {
  const queue = readQueue();
  return queue.find(entry => entry.id === id) || null;
}

/**
 * Mark a job as retried
 * @param {string} id - Job ID
 * @param {boolean} success - Whether retry was successful
 */
function markAsRetried(id, success) {
  const queue = readQueue();
  const entry = queue.find(e => e.id === id);

  if (entry) {
    entry.status = success ? 'retried-success' : 'retried-failed';
    entry.retriedAt = new Date().toISOString();
    writeQueue(queue);

    logger.info(`Marked DLQ job ${id} as ${entry.status}`);
  }
}

/**
 * Remove a job from the queue
 * @param {string} id - Job ID
 * @returns {boolean} Whether job was removed
 */
function removeJob(id) {
  const queue = readQueue();
  const index = queue.findIndex(e => e.id === id);

  if (index !== -1) {
    queue.splice(index, 1);
    writeQueue(queue);
    logger.info(`Removed job ${id} from dead letter queue`);
    return true;
  }

  return false;
}

/**
 * Retry a failed job
 * @param {string} id - Job ID
 * @param {Function} retryFn - Function to retry the job
 * @returns {Promise<boolean>} Whether retry was successful
 */
async function retryJob(id, retryFn) {
  const job = getJob(id);

  if (!job) {
    logger.error(`Job ${id} not found in dead letter queue`);
    return false;
  }

  try {
    logger.info(`Retrying DLQ job ${id} (type: ${job.type})`);
    await retryFn(job.data);
    markAsRetried(id, true);
    return true;
  } catch (error) {
    logger.error(`Failed to retry DLQ job ${id}:`, error.message);
    markAsRetried(id, false);
    return false;
  }
}

/**
 * Clean up old entries from the queue
 * @param {number} daysOld - Remove entries older than this many days
 * @returns {number} Number of entries removed
 */
function cleanup(daysOld = 30) {
  const queue = readQueue();
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  const beforeCount = queue.length;
  const filtered = queue.filter(entry => {
    const entryDate = new Date(entry.timestamp);
    return entryDate > cutoffDate || entry.status === 'pending';
  });

  const removedCount = beforeCount - filtered.length;

  if (removedCount > 0) {
    writeQueue(filtered);
    logger.info(`Cleaned up ${removedCount} old entries from dead letter queue`);
  }

  return removedCount;
}

/**
 * Get queue statistics
 * @returns {Object} Queue statistics
 */
function getStats() {
  const queue = readQueue();

  const stats = {
    total: queue.length,
    pending: 0,
    retriedSuccess: 0,
    retriedFailed: 0,
    byType: {}
  };

  queue.forEach(entry => {
    // Count by status
    if (entry.status === 'pending') stats.pending++;
    if (entry.status === 'retried-success') stats.retriedSuccess++;
    if (entry.status === 'retried-failed') stats.retriedFailed++;

    // Count by type
    if (!stats.byType[entry.type]) {
      stats.byType[entry.type] = 0;
    }
    stats.byType[entry.type]++;
  });

  return stats;
}

/**
 * Display dead letter queue contents
 */
function displayQueue() {
  const queue = readQueue();
  const stats = getStats();

  console.log('='.repeat(80));
  console.log('Dead Letter Queue');
  console.log('='.repeat(80));
  console.log(`Total Entries: ${stats.total}`);
  console.log(`Pending: ${stats.pending}`);
  console.log(`Retried (Success): ${stats.retriedSuccess}`);
  console.log(`Retried (Failed): ${stats.retriedFailed}`);
  console.log('');
  console.log('By Type:');
  Object.entries(stats.byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  console.log('');

  if (queue.length === 0) {
    console.log('Queue is empty.');
  } else {
    console.log('Recent Entries:');
    console.log('');
    queue.slice(-10).reverse().forEach(entry => {
      console.log(`ID: ${entry.id}`);
      console.log(`  Type: ${entry.type}`);
      console.log(`  Status: ${entry.status}`);
      console.log(`  Timestamp: ${entry.timestamp}`);
      console.log(`  Error: ${entry.error.message}`);
      console.log(`  Attempts: ${entry.attempts}`);
      console.log('');
    });
  }

  console.log('='.repeat(80));
}

/**
 * Clear the entire queue (use with caution!)
 */
function clearQueue() {
  writeQueue([]);
  logger.warn('Dead letter queue cleared');
}

module.exports = {
  addToQueue,
  getPendingJobs,
  getJob,
  markAsRetried,
  removeJob,
  retryJob,
  cleanup,
  getStats,
  displayQueue,
  clearQueue
};
