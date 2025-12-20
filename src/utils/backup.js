/**
 * @fileoverview Configuration Backup and Restore Utility
 * Provides functionality to backup and restore .env and config.json files
 */

const fs = require('fs');
const path = require('path');
const logger = require('../services/logger');

// Backup directory relative to project root
const BACKUP_DIR = 'backups';

/**
 * Ensure the backup directory exists
 * @param {string} projectRoot - Project root directory
 * @returns {string} Full path to backup directory
 */
function ensureBackupDir(projectRoot) {
  const backupPath = path.join(projectRoot, BACKUP_DIR);
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
    logger.info(`Created backup directory: ${backupPath}`);
  }
  return backupPath;
}

/**
 * Generate a timestamp-based backup name
 * @returns {string} Backup name in format: backup_YYYY-MM-DD_HH-MM-SS
 */
function generateBackupName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `backup_${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

/**
 * Create a backup of configuration files
 * @param {string} projectRoot - Project root directory
 * @param {string} description - Optional description for the backup
 * @returns {Object} Backup result with success status and details
 */
function createBackup(projectRoot, description = '') {
  try {
    const backupPath = ensureBackupDir(projectRoot);
    const backupName = generateBackupName();
    const backupFolder = path.join(backupPath, backupName);

    // Create backup folder
    fs.mkdirSync(backupFolder, { recursive: true });

    const backedUpFiles = [];
    const metadata = {
      timestamp: new Date().toISOString(),
      description: description,
      files: []
    };

    // Backup .env file if it exists
    const envPath = path.join(projectRoot, '.env');
    if (fs.existsSync(envPath)) {
      const envBackupPath = path.join(backupFolder, '.env');
      fs.copyFileSync(envPath, envBackupPath);
      backedUpFiles.push('.env');
      metadata.files.push({
        name: '.env',
        size: fs.statSync(envPath).size,
        backedUp: true
      });
    } else {
      metadata.files.push({
        name: '.env',
        backedUp: false,
        reason: 'File does not exist'
      });
    }

    // Backup config.json file
    const configPath = path.join(projectRoot, 'config.json');
    if (fs.existsSync(configPath)) {
      const configBackupPath = path.join(backupFolder, 'config.json');
      fs.copyFileSync(configPath, configBackupPath);
      backedUpFiles.push('config.json');
      metadata.files.push({
        name: 'config.json',
        size: fs.statSync(configPath).size,
        backedUp: true
      });
    } else {
      metadata.files.push({
        name: 'config.json',
        backedUp: false,
        reason: 'File does not exist'
      });
    }

    // Write metadata file
    const metadataPath = path.join(backupFolder, 'backup-info.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    logger.info(`Created backup: ${backupName}`);
    logger.info(`Backed up files: ${backedUpFiles.join(', ')}`);

    return {
      success: true,
      backupName: backupName,
      backupPath: backupFolder,
      filesBackedUp: backedUpFiles,
      timestamp: metadata.timestamp,
      description: description
    };
  } catch (error) {
    logger.error('Failed to create backup:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * List all available backups
 * @param {string} projectRoot - Project root directory
 * @returns {Array} Array of backup objects with details
 */
function listBackups(projectRoot) {
  try {
    const backupPath = path.join(projectRoot, BACKUP_DIR);

    if (!fs.existsSync(backupPath)) {
      return [];
    }

    const backupFolders = fs.readdirSync(backupPath)
      .filter(name => {
        const fullPath = path.join(backupPath, name);
        return fs.statSync(fullPath).isDirectory() && name.startsWith('backup_');
      });

    const backups = backupFolders.map(folderName => {
      const folderPath = path.join(backupPath, folderName);
      const metadataPath = path.join(folderPath, 'backup-info.json');

      let metadata = {
        timestamp: null,
        description: '',
        files: []
      };

      // Try to read metadata
      if (fs.existsSync(metadataPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        } catch (error) {
          logger.warn(`Failed to read backup metadata: ${folderName}`, error);
        }
      }

      // Get folder stats
      const stats = fs.statSync(folderPath);

      // Check which files are present
      const hasEnv = fs.existsSync(path.join(folderPath, '.env'));
      const hasConfig = fs.existsSync(path.join(folderPath, 'config.json'));

      return {
        name: folderName,
        path: folderPath,
        timestamp: metadata.timestamp || stats.mtime.toISOString(),
        description: metadata.description || '',
        files: metadata.files.length > 0 ? metadata.files : [
          { name: '.env', backedUp: hasEnv },
          { name: 'config.json', backedUp: hasConfig }
        ],
        size: calculateFolderSize(folderPath)
      };
    });

    // Sort by timestamp, newest first
    backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return backups;
  } catch (error) {
    logger.error('Failed to list backups:', error);
    return [];
  }
}

/**
 * Calculate total size of a folder
 * @param {string} folderPath - Path to folder
 * @returns {number} Size in bytes
 */
function calculateFolderSize(folderPath) {
  let totalSize = 0;

  try {
    const files = fs.readdirSync(folderPath);

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isFile()) {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    logger.warn(`Failed to calculate folder size: ${folderPath}`, error);
  }

  return totalSize;
}

/**
 * Restore configuration from a backup
 * @param {string} projectRoot - Project root directory
 * @param {string} backupName - Name of the backup to restore
 * @param {Object} options - Restore options
 * @param {boolean} options.createBackupBeforeRestore - Create a backup before restoring
 * @returns {Object} Restore result with success status and details
 */
function restoreBackup(projectRoot, backupName, options = { createBackupBeforeRestore: true }) {
  try {
    const backupFolder = path.join(projectRoot, BACKUP_DIR, backupName);

    if (!fs.existsSync(backupFolder)) {
      throw new Error(`Backup not found: ${backupName}`);
    }

    const restoredFiles = [];

    // Create a backup before restoring (safety measure)
    if (options.createBackupBeforeRestore) {
      const safetyBackup = createBackup(projectRoot, 'Auto-backup before restore');
      if (safetyBackup.success) {
        logger.info(`Created safety backup before restore: ${safetyBackup.backupName}`);
      }
    }

    // Restore .env file if it exists in backup
    const envBackupPath = path.join(backupFolder, '.env');
    if (fs.existsSync(envBackupPath)) {
      const envPath = path.join(projectRoot, '.env');
      fs.copyFileSync(envBackupPath, envPath);
      restoredFiles.push('.env');
      logger.info('Restored .env file');
    }

    // Restore config.json file if it exists in backup
    const configBackupPath = path.join(backupFolder, 'config.json');
    if (fs.existsSync(configBackupPath)) {
      const configPath = path.join(projectRoot, 'config.json');
      fs.copyFileSync(configBackupPath, configPath);
      restoredFiles.push('config.json');
      logger.info('Restored config.json file');
    }

    if (restoredFiles.length === 0) {
      throw new Error('No files found in backup to restore');
    }

    logger.info(`Successfully restored backup: ${backupName}`);

    return {
      success: true,
      backupName: backupName,
      filesRestored: restoredFiles,
      message: `Restored ${restoredFiles.length} file(s) from backup`
    };
  } catch (error) {
    logger.error('Failed to restore backup:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete a backup
 * @param {string} projectRoot - Project root directory
 * @param {string} backupName - Name of the backup to delete
 * @returns {Object} Delete result with success status
 */
function deleteBackup(projectRoot, backupName) {
  try {
    const backupFolder = path.join(projectRoot, BACKUP_DIR, backupName);

    if (!fs.existsSync(backupFolder)) {
      throw new Error(`Backup not found: ${backupName}`);
    }

    // Delete all files in the backup folder
    const files = fs.readdirSync(backupFolder);
    for (const file of files) {
      fs.unlinkSync(path.join(backupFolder, file));
    }

    // Delete the folder itself
    fs.rmdirSync(backupFolder);

    logger.info(`Deleted backup: ${backupName}`);

    return {
      success: true,
      message: `Backup deleted: ${backupName}`
    };
  } catch (error) {
    logger.error('Failed to delete backup:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Clean up old backups, keeping only the most recent ones
 * @param {string} projectRoot - Project root directory
 * @param {number} keepCount - Number of recent backups to keep
 * @returns {Object} Cleanup result with count of deleted backups
 */
function cleanupOldBackups(projectRoot, keepCount = 10) {
  try {
    const backups = listBackups(projectRoot);

    if (backups.length <= keepCount) {
      return {
        success: true,
        deletedCount: 0,
        message: `No cleanup needed. ${backups.length} backup(s) exist, keeping up to ${keepCount}.`
      };
    }

    // Backups are already sorted newest first
    const backupsToDelete = backups.slice(keepCount);

    let deletedCount = 0;
    for (const backup of backupsToDelete) {
      const result = deleteBackup(projectRoot, backup.name);
      if (result.success) {
        deletedCount++;
      }
    }

    logger.info(`Cleaned up ${deletedCount} old backup(s), kept ${keepCount} most recent`);

    return {
      success: true,
      deletedCount: deletedCount,
      message: `Deleted ${deletedCount} old backup(s), kept ${keepCount} most recent`
    };
  } catch (error) {
    logger.error('Failed to cleanup old backups:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  cleanupOldBackups
};
