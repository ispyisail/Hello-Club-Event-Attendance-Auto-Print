const Database = require('better-sqlite3');
const logger = require('./logger');

let db;

/**
 * Opens a persistent connection to the SQLite database using better-sqlite3
 * and ensures the schema is up to date. This function returns a singleton
 * instance of the database.
 *
 * @returns {import('better-sqlite3').Database} The database connection object.
 */
const getDb = () => {
  if (!db) {
    try {
      // This creates a new database connection. better-sqlite3 is synchronous.
      db = new Database('./events.db', { verbose: logger.info });

      // Enable WAL (Write-Ahead Logging) mode for better concurrency
      // WAL allows readers to access the database while a write is in progress
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL'); // Faster writes with WAL
      db.pragma('cache_size = -64000'); // 64MB cache
      db.pragma('temp_store = MEMORY'); // Use memory for temp tables

      // Ensure the 'events' table exists.
      db.exec(`CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        startDate TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
      )`);

      // Create index for better query performance on the main query
      db.exec(`CREATE INDEX IF NOT EXISTS idx_events_status_start
               ON events(status, startDate)`);

      logger.info('Connected to the SQLite database with WAL mode enabled.');



    } catch (err) {
      logger.error('Failed to open or initialize the database:', err.message);
      // Re-throw the error to be handled by the calling function.
      throw err;
    }
  }
  return db;
};

/**
 * Closes the database connection gracefully.
 */
const closeDb = () => {
  if (db) {
    try {
      db.close();
      logger.info('Database connection closed.');
      db = null;
    } catch (err) {
      logger.error('Failed to close database connection:', err.message);
    }
  }
};

// Register cleanup handlers for graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT signal. Closing database...');
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal. Closing database...');
  closeDb();
  process.exit(0);
});

module.exports = { getDb, closeDb };
