/**
 * Migration 002: Add Database Indexes
 * Adds indexes to events and scheduled_jobs tables for better query performance
 */

module.exports = {
  /**
   * Apply migration
   * @param {import('better-sqlite3').Database} db - Database instance
   */
  up(db) {
    // Events table indexes
    // Index on status for filtering pending/processed/failed events
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_status
        ON events(status)
    `);

    // Index on startDate for date range queries
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_startdate
        ON events(startDate)
    `);

    // Composite index for cleanup queries (status + startDate)
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_status_startdate
        ON events(status, startDate)
    `);

    // Scheduled_jobs table indexes
    // Index on status for filtering by job status
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status
        ON scheduled_jobs(status)
    `);

    // Index on event_id for lookups by event
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_event_id
        ON scheduled_jobs(event_id)
    `);

    // Index on scheduled_time for time-based queries
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_scheduled_time
        ON scheduled_jobs(scheduled_time)
    `);
  },

  /**
   * Rollback migration
   * @param {import('better-sqlite3').Database} db - Database instance
   */
  down(db) {
    // Drop scheduled_jobs indexes
    db.exec('DROP INDEX IF EXISTS idx_scheduled_jobs_scheduled_time');
    db.exec('DROP INDEX IF EXISTS idx_scheduled_jobs_event_id');
    db.exec('DROP INDEX IF EXISTS idx_scheduled_jobs_status');

    // Drop events indexes
    db.exec('DROP INDEX IF EXISTS idx_events_status_startdate');
    db.exec('DROP INDEX IF EXISTS idx_events_startdate');
    db.exec('DROP INDEX IF EXISTS idx_events_status');
  }
};
