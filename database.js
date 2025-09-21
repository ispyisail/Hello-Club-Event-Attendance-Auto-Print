const sqlite3 = require('sqlite3').verbose();
const logger = require('./logger');

const db = new sqlite3.Database('./events.db', (err) => {
  if (err) {
    logger.error('Error opening database', err.message);
    throw err;
  }
  logger.info('Connected to the SQLite database.');
});

const setupDatabase = () => {
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    startDate TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
  )`, (err) => {
    if (err) {
      logger.error('Error creating table', err.message);
    } else {
      logger.info('Table "events" is ready.');
    }
  });
};

setupDatabase();

module.exports = db;
