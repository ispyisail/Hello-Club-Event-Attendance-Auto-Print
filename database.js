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

      // Ensure the 'events' table exists.
      db.exec(`CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        startDate TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
      )`);

      logger.info('Connected to the SQLite database and table is ready.');

      // Gracefully close the connection on exit
      process.on('exit', () => db.close());
      process.on('SIGHUP', () => process.exit(128 + 1));
      process.on('SIGINT', () => process.exit(128 + 2));
      process.on('SIGTERM', () => process.exit(128 + 15));

    } catch (err) {
      logger.error('Failed to open or initialize the database:', err.message);
      // Re-throw the error to be handled by the calling function.
      throw err;
    }
  }
  return db;
};

module.exports = { getDb };
