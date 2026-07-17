/**
 * Migration 003: Add print-tag columns to events
 * Stores the per-event parameters parsed from the `print:` description tag.
 * All columns are nullable — NULL means "fall back to the config default".
 */

module.exports = {
  /**
   * Apply migration
   * @param {import('better-sqlite3').Database} db - Database instance
   */
  up(db) {
    db.exec('ALTER TABLE events ADD COLUMN leadMinutes INTEGER');
    db.exec('ALTER TABLE events ADD COLUMN copies INTEGER');
    db.exec('ALTER TABLE events ADD COLUMN printMode TEXT');
  },

  /**
   * Rollback migration
   * @param {import('better-sqlite3').Database} db - Database instance
   */
  down(db) {
    db.exec('ALTER TABLE events DROP COLUMN printMode');
    db.exec('ALTER TABLE events DROP COLUMN copies');
    db.exec('ALTER TABLE events DROP COLUMN leadMinutes');
  },
};
