/**
 * @fileoverview Automated backup scheduling with rotation policy.
 * @module backup-scheduler
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const DEFAULT_RETENTION_DAYS = 30;

/**
 * Ensure backup directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info(`Created backup directory: ${BACKUP_DIR}`);
  }
}

/**
 * Create a timestamped backup
 * @param {string} sourceFile - File to backup
 * @returns {string|null} Backup file path or null on failure
 */
function createBackup(sourceFile = 'events.db') {
  ensureBackupDir();

  if (!fs.existsSync(sourceFile)) {
    logger.error(`Source file ${sourceFile} does not exist`);
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `backup-${path.basename(sourceFile, path.extname(sourceFile))}-${timestamp}${path.extname(sourceFile)}`;
  const backupPath = path.join(BACKUP_DIR, backupFileName);

  try {
    fs.copyFileSync(sourceFile, backupPath);

    const stats = fs.statSync(backupPath);
    logger.info(`Backup created: ${backupFileName} (${formatBytes(stats.size)})`);

    return backupPath;
  } catch (error) {
    logger.error(`Failed to create backup: ${error.message}`);
    return null;
  }
}

/**
 * Create backup of all important files
 * @returns {Array<string>} Array of created backup paths
 */
function createFullBackup() {
  const filesToBackup = [
    'events.db',
    'status.json',
    'metrics.json',
    'dead-letter-queue.json',
    'config.json'
  ];

  const backups = [];

  for (const file of filesToBackup) {
    if (fs.existsSync(file)) {
      const backupPath = createBackup(file);
      if (backupPath) {
        backups.push(backupPath);
      }
    }
  }

  logger.info(`Full backup completed: ${backups.length} files backed up`);
  return backups;
}

/**
 * List all backups
 * @returns {Array<Object>} Array of backup file info
 */
function listBackups() {
  ensureBackupDir();

  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const backups = files
      .filter(file => file.startsWith('backup-'))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
          created: stats.birthtime,
          age: getAge(stats.birthtime)
        };
      })
      .sort((a, b) => b.created - a.created);

    return backups;
  } catch (error) {
    logger.error(`Failed to list backups: ${error.message}`);
    return [];
  }
}

/**
 * Remove backups older than retention period
 * @param {number} retentionDays - Keep backups newer than this many days
 * @returns {number} Number of backups removed
 */
function rotateBackups(retentionDays = DEFAULT_RETENTION_DAYS) {
  const backups = listBackups();
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  let removedCount = 0;

  for (const backup of backups) {
    if (backup.created < cutoffDate) {
      try {
        fs.unlinkSync(backup.path);
        logger.info(`Removed old backup: ${backup.name} (${backup.age} days old)`);
        removedCount++;
      } catch (error) {
        logger.error(`Failed to remove backup ${backup.name}: ${error.message}`);
      }
    }
  }

  if (removedCount > 0) {
    logger.info(`Backup rotation completed: ${removedCount} old backups removed`);
  }

  return removedCount;
}

/**
 * Get backup statistics
 * @returns {Object} Backup statistics
 */
function getBackupStats() {
  const backups = listBackups();

  if (backups.length === 0) {
    return {
      count: 0,
      totalSize: 0,
      totalSizeFormatted: '0 B',
      oldest: null,
      newest: null
    };
  }

  const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

  return {
    count: backups.length,
    totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    oldest: backups[backups.length - 1].created,
    newest: backups[0].created,
    byAge: {
      last24h: backups.filter(b => b.age <= 1).length,
      last7days: backups.filter(b => b.age <= 7).length,
      last30days: backups.filter(b => b.age <= 30).length,
      older: backups.filter(b => b.age > 30).length
    }
  };
}

/**
 * Restore from backup
 * @param {string} backupPath - Path to backup file
 * @param {string} targetFile - Target file to restore to
 * @returns {boolean} Whether restore was successful
 */
function restoreFromBackup(backupPath, targetFile) {
  if (!fs.existsSync(backupPath)) {
    logger.error(`Backup file not found: ${backupPath}`);
    return false;
  }

  // Create emergency backup of current file
  if (fs.existsSync(targetFile)) {
    const emergencyBackup = `${targetFile}.emergency-${Date.now()}`;
    try {
      fs.copyFileSync(targetFile, emergencyBackup);
      logger.info(`Created emergency backup: ${emergencyBackup}`);
    } catch (error) {
      logger.error(`Failed to create emergency backup: ${error.message}`);
      return false;
    }
  }

  // Restore from backup
  try {
    fs.copyFileSync(backupPath, targetFile);
    logger.info(`Restored ${targetFile} from ${backupPath}`);
    return true;
  } catch (error) {
    logger.error(`Failed to restore from backup: ${error.message}`);
    return false;
  }
}

/**
 * Schedule automatic backups
 * @param {number} intervalHours - Backup interval in hours
 * @returns {NodeJS.Timeout} Interval ID
 */
function scheduleBackups(intervalHours = 24) {
  logger.info(`Scheduling automatic backups every ${intervalHours} hours`);

  // Create initial backup
  createFullBackup();

  // Schedule periodic backups
  const intervalMs = intervalHours * 60 * 60 * 1000;
  const intervalId = setInterval(() => {
    logger.info('Running scheduled backup...');
    createFullBackup();
    rotateBackups(DEFAULT_RETENTION_DAYS);
  }, intervalMs);

  return intervalId;
}

/**
 * Format bytes to human readable string
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get age of file in days
 * @param {Date} date - File creation date
 * @returns {number} Age in days
 */
function getAge(date) {
  const now = new Date();
  const diffMs = now - date;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Display backup information
 */
function displayBackups() {
  const stats = getBackupStats();

  console.log('='.repeat(80));
  console.log('Backup Statistics');
  console.log('='.repeat(80));
  console.log(`Total Backups: ${stats.count}`);
  console.log(`Total Size: ${stats.totalSizeFormatted}`);

  if (stats.count > 0) {
    console.log(`Newest: ${stats.newest.toISOString()}`);
    console.log(`Oldest: ${stats.oldest.toISOString()}`);
    console.log('');
    console.log('By Age:');
    console.log(`  Last 24 hours: ${stats.byAge.last24h}`);
    console.log(`  Last 7 days: ${stats.byAge.last7days}`);
    console.log(`  Last 30 days: ${stats.byAge.last30days}`);
    console.log(`  Older than 30 days: ${stats.byAge.older}`);
  }

  console.log('');
  console.log('Recent Backups:');
  console.log('');

  const backups = listBackups();
  backups.slice(0, 10).forEach(backup => {
    console.log(`${backup.name}`);
    console.log(`  Size: ${backup.sizeFormatted}`);
    console.log(`  Created: ${backup.created.toISOString()} (${backup.age} days ago)`);
    console.log('');
  });

  console.log('='.repeat(80));
}

module.exports = {
  createBackup,
  createFullBackup,
  listBackups,
  rotateBackups,
  getBackupStats,
  restoreFromBackup,
  scheduleBackups,
  displayBackups,
  BACKUP_DIR
};
