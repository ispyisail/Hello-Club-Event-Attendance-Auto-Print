const Database = require('better-sqlite3');
const logger = require('../services/logger');
const { runMigrations } = require('./migrations');

let db;

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
      db = new Database('./events.db', { verbose: logger.info });

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

module.exports = { getDb, cleanupOldEvents };
