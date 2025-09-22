const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const logger = require('./logger');

// This variable will hold the database connection promise.
// It's a "singleton" in the sense that we'll only open the connection once.
let dbPromise = null;

const openDb = async () => {
  if (dbPromise) {
    return dbPromise;
  }

  // The promise is stored, so subsequent calls to openDb will return the same promise.
  dbPromise = open({
    filename: './events.db',
    driver: sqlite3.Database
  });

  const db = await dbPromise;

  // We still use the simple "CREATE TABLE IF NOT EXISTS" approach.
  // This is robust and simple for this application's needs.
  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      startDate TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    )`);
    logger.info('Connected to the SQLite database and table is ready.');
  } catch (err) {
    logger.error('Error creating table', err.message);
    throw err;
  }

  return db;
};

module.exports = { openDb };
