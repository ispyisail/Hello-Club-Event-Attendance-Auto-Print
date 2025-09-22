const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const logger = require('./logger');

/**
 * Opens a new connection to the SQLite database and ensures the schema is up to date.
 * Each call to this function will create a new connection. Connections must be
 * manually closed by the caller.
 *
 * @returns {Promise<import('sqlite').Database>} A promise that resolves to the database connection object.
 */
const openDb = async () => {
  try {
    // openDb creates a new database connection each time it is called.
    const db = await open({
      filename: './events.db',
      driver: sqlite3.Database
    });

    // Ensure the 'events' table exists.
    await db.exec(`CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      startDate TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    )`);

    logger.info('Connected to the SQLite database and table is ready.');
    return db;
  } catch (err) {
    logger.error('Failed to open or initialize the database:', err.message);
    // Re-throw the error to be handled by the calling function.
    throw err;
  }
};

module.exports = { openDb };
