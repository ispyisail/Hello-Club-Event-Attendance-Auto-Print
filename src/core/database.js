const Database = require('better-sqlite3');
const logger = require('../services/logger');
const { runMigrations } = require('./migrations');

let db;
let lastHealthCheck = Date.now();

/**
 * Opens a persistent connection to the SQLite database using better-sqlite3
 * and ensures the schema is up to date using the migration system.
 * This function returns a singleton instance of the database.
 *
 * @returns {import('better-sqlite3').Database} The database connection object.
 */
const getDb = () => {
  if (!db) {
    try {
      // Create database connection (better-sqlite3 is synchronous)
      // Only enable verbose SQL logging in debug mode to avoid log bloat
      const options = {};
      if (process.env.LOG_LEVEL === 'debug') {
        options.verbose = logger.debug;
      }
      db = new Database('./events.db', options);

      // Set pragmas for reliability on Raspberry Pi (slow SD card)
      db.pragma('journal_mode = WAL'); // Concurrent reads during writes, less SD card wear
      db.pragma('busy_timeout = 5000'); // Retry for 5s instead of failing with SQLITE_BUSY
      db.pragma('synchronous = NORMAL'); // Safe with WAL, faster on slow storage
      db.pragma('foreign_keys = ON'); // Defensive integrity
      logger.info('SQLite pragmas set: WAL mode, busy_timeout=5000, synchronous=NORMAL, foreign_keys=ON');

      // Run pending migrations to ensure schema is up to date
      logger.info('Checking for pending database migrations...');
      runMigrations(db);

      logger.info('Connected to the SQLite database and schema is up to date.');
    } catch (err) {
      logger.error('Failed to open or initialize the database:', err.message);
      // Re-throw the error to be handled by the calling function
      throw err;
    }
  }
  return db;
};

/**
 * Clean up old events from the database
 * Removes events older than the specified number of days
 * @param {number} daysToKeep - Number of days to keep (default: 30)
 * @returns {number} Number of events deleted
 */
function cleanupOldEvents(daysToKeep = 30) {
  const db = getDb();
  const logger = require('../services/logger');

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffISO = cutoffDate.toISOString();

    // Delete old events
    const deleteEvents = db.prepare(`
      DELETE FROM events
      WHERE startDate < ?
        AND status IN ('processed', 'failed')
    `);

    const result = deleteEvents.run(cutoffISO);
    const deletedCount = result.changes;

    if (deletedCount > 0) {
      logger.info(`Database cleanup: Deleted ${deletedCount} old event(s) older than ${daysToKeep} days`);
    }

    // Also clean up orphaned scheduled_jobs
    const deleteJobs = db.prepare(`
      DELETE FROM scheduled_jobs
      WHERE event_id NOT IN (SELECT id FROM events)
    `);

    const jobsResult = deleteJobs.run();
    if (jobsResult.changes > 0) {
      logger.info(`Database cleanup: Deleted ${jobsResult.changes} orphaned scheduled job(s)`);
    }

    return deletedCount;
  } catch (error) {
    logger.error('Error during database cleanup:', error);
    return 0;
  }
}

/**
 * Update the status of an event
 * @param {string} eventId - The event ID
 * @param {string} status - The new status ('pending', 'processed', 'failed')
 * @returns {Object} Result object with changes count
 */
function updateEventStatus(eventId, status) {
  const database = getDb();
  const stmt = database.prepare('UPDATE events SET status = ? WHERE id = ?');
  return stmt.run(status, eventId);
}

/**
 * Update the status of a scheduled job
 * @param {string} eventId - The event ID associated with the job
 * @param {string} status - The new status ('scheduled', 'processing', 'completed', 'failed', 'retrying')
 * @param {string|null} errorMessage - Optional error message for failed jobs
 * @returns {Object} Result object with changes count
 */
function updateJobStatus(eventId, status, errorMessage = null) {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE scheduled_jobs
    SET status = ?, error_message = ?, updated_at = datetime('now')
    WHERE event_id = ?
  `);
  return stmt.run(status, errorMessage, eventId);
}

/**
 * Increment the retry count for a scheduled job
 * @param {string} eventId - The event ID associated with the job
 * @returns {Object} Result object with changes count
 */
function incrementJobRetryCount(eventId) {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE scheduled_jobs
    SET retry_count = retry_count + 1, updated_at = datetime('now')
    WHERE event_id = ?
  `);
  return stmt.run(eventId);
}

/**
 * Get information about a scheduled job
 * @param {string} eventId - The event ID to look up
 * @returns {Object|undefined} The job record or undefined if not found
 */
function getJobInfo(eventId) {
  const database = getDb();
  return database.prepare('SELECT * FROM scheduled_jobs WHERE event_id = ?').get(eventId);
}

/**
 * Execute a database operation with retry logic for SQLITE_BUSY errors.
 * Uses exponential backoff to handle concurrent access gracefully.
 * @param {Function} operation - Function that performs the database operation
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @returns {*} Result of the operation
 * @throws {Error} If all retries are exhausted
 */
function withRetry(operation, maxRetries = 3) {
  let lastError;
  let delay = 100; // Start with 100ms

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return operation();
    } catch (error) {
      lastError = error;

      // Check if this is a SQLITE_BUSY error
      const isBusyError = error.code === 'SQLITE_BUSY' || error.message?.includes('SQLITE_BUSY');

      if (!isBusyError || attempt === maxRetries) {
        // Not a busy error or out of retries, throw immediately
        throw error;
      }

      // Log retry attempt
      logger.warn(`Database busy, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);

      // Sleep for delay milliseconds (synchronous sleep for better-sqlite3)
      const start = Date.now();
      while (Date.now() - start < delay) {
        // Busy wait (acceptable for short delays)
      }

      // Exponential backoff
      delay *= 2;
    }
  }

  throw lastError;
}

/**
 * Execute a function within a database transaction with automatic rollback on error.
 * @param {Function} fn - Function to execute within the transaction
 * @returns {*} Result of the function
 * @throws {Error} If transaction fails
 */
function withTransaction(fn) {
  const database = getDb();

  return withRetry(() => {
    const transaction = database.transaction(fn);
    return transaction();
  });
}

/**
 * Check database health and log warnings if issues detected.
 * @returns {Object} Health check result
 */
function checkDatabaseHealth() {
  try {
    const database = getDb();

    // Test basic query
    const result = database.prepare('SELECT 1 as test').get();

    if (result.test !== 1) {
      throw new Error('Database health check query returned unexpected result');
    }

    // Check WAL checkpoint status
    const walInfo = database.pragma('wal_checkpoint(PASSIVE)', { simple: true });

    lastHealthCheck = Date.now();

    return {
      healthy: true,
      lastCheck: lastHealthCheck,
      walCheckpoint: walInfo,
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      healthy: false,
      lastCheck: lastHealthCheck,
      error: error.message,
    };
  }
}

/**
 * Close the database connection gracefully
 * Should be called during shutdown to ensure WAL is checkpointed
 */
function closeDb() {
  if (db) {
    try {
      // Checkpoint WAL before closing
      logger.info('Checkpointing WAL before closing database...');
      db.pragma('wal_checkpoint(TRUNCATE)');

      db.close();
      db = null;
      logger.info('Database connection closed.');
    } catch (err) {
      logger.error('Error closing database:', err.message);
    }
  }
}

module.exports = {
  getDb,
  closeDb,
  cleanupOldEvents,
  updateEventStatus,
  updateJobStatus,
  incrementJobRetryCount,
  getJobInfo,
  withRetry,
  withTransaction,
  checkDatabaseHealth,
};
