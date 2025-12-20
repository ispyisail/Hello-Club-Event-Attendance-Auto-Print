/**
 * Migration 001: Initial Schema
 * Creates the events and scheduled_jobs tables with indexes
 */

module.exports = {
  /**
   * Apply migration
   * @param {import('better-sqlite3').Database} db - Database instance
   */
  up(db) {
    // Create events table
    db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        startDate TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
      )
    `);

    // Create scheduled_jobs table for persistent job tracking
    db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        event_name TEXT NOT NULL,
        scheduled_time TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (event_id) REFERENCES events(id)
      )
    `);

    // Create indexes for better query performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_event_id
        ON scheduled_jobs(event_id)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status
        ON scheduled_jobs(status)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_scheduled_time
        ON scheduled_jobs(scheduled_time)
    `);
  },

  /**
   * Rollback migration (optional)
   * @param {import('better-sqlite3').Database} db - Database instance
   */
  down(db) {
    db.exec('DROP INDEX IF EXISTS idx_scheduled_jobs_scheduled_time');
    db.exec('DROP INDEX IF EXISTS idx_scheduled_jobs_status');
    db.exec('DROP INDEX IF EXISTS idx_scheduled_jobs_event_id');
    db.exec('DROP TABLE IF EXISTS scheduled_jobs');
    db.exec('DROP TABLE IF EXISTS events');
  }
};
