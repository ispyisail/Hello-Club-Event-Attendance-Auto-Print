/**
 * @fileoverview Database Migration System
 * Manages versioned database schema changes with tracking and rollback support
 */

const fs = require('fs');
const path = require('path');
const logger = require('../services/logger');

/**
 * Ensure the migrations tracking table exists
 * @param {import('better-sqlite3').Database} db - Database instance
 */
function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/**
 * Get list of applied migrations
 * @param {import('better-sqlite3').Database} db - Database instance
 * @returns {number[]} Array of applied migration version numbers
 */
function getAppliedMigrations(db) {
  ensureMigrationsTable(db);
  const rows = db.prepare('SELECT version FROM migrations ORDER BY version').all();
  return rows.map(row => row.version);
}

/**
 * Mark a migration as applied
 * @param {import('better-sqlite3').Database} db - Database instance
 * @param {number} version - Migration version number
 * @param {string} name - Migration name
 */
function markMigrationApplied(db, version, name) {
  db.prepare('INSERT INTO migrations (version, name) VALUES (?, ?)').run(version, name);
  logger.info(`Migration ${version} (${name}) applied successfully`);
}

/**
 * Load and execute pending migrations
 * @param {import('better-sqlite3').Database} db - Database instance
 * @param {string} migrationsDir - Directory containing migration files
 * @returns {number} Number of migrations applied
 */
function runMigrations(db, migrationsDir = path.join(__dirname, 'migrations')) {
  ensureMigrationsTable(db);
  const appliedVersions = getAppliedMigrations(db);

  // Check if migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    logger.warn(`Migrations directory not found: ${migrationsDir}`);
    return 0;
  }

  // Read all migration files (format: 001_migration_name.js)
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.js'))
    .sort();

  if (migrationFiles.length === 0) {
    logger.info('No migration files found');
    return 0;
  }

  let appliedCount = 0;

  for (const filename of migrationFiles) {
    // Extract version number from filename (e.g., "001_initial_schema.js" -> 1)
    const match = filename.match(/^(\d+)_(.+)\.js$/);
    if (!match) {
      logger.warn(`Skipping invalid migration filename: ${filename}`);
      continue;
    }

    const version = parseInt(match[1], 10);
    const name = match[2];

    // Skip if already applied
    if (appliedVersions.includes(version)) {
      continue;
    }

    // Load and execute migration
    try {
      logger.info(`Running migration ${version}: ${name}`);
      const migrationPath = path.join(migrationsDir, filename);
      const migration = require(migrationPath);

      // Wrap migration in transaction
      const runInTransaction = db.transaction(() => {
        migration.up(db);
        markMigrationApplied(db, version, name);
      });

      runInTransaction();
      appliedCount++;
    } catch (error) {
      logger.error(`Failed to apply migration ${version} (${name}):`, error);
      throw new Error(`Migration ${version} failed: ${error.message}`);
    }
  }

  if (appliedCount > 0) {
    logger.info(`Applied ${appliedCount} migration(s) successfully`);
  } else {
    logger.info('Database schema is up to date');
  }

  return appliedCount;
}

module.exports = {
  runMigrations,
  getAppliedMigrations,
  ensureMigrationsTable
};
