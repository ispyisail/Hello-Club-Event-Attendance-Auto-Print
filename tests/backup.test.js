/**
 * @fileoverview Tests for the backup and restore utility
 * Tests backup creation, restore, listing, deletion, and cleanup
 */

jest.mock('fs');
jest.mock('../src/services/logger');

const fs = require('fs');
const path = require('path');
const logger = require('../src/services/logger');

describe('Backup Module', () => {
  let backup;

  beforeAll(() => {
    backup = require('../src/utils/backup');
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Date for consistent timestamps
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-22T14:30:45Z'));

    // Setup logger mocks
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createBackup', () => {
    it('should create backup successfully with both files', () => {
      fs.existsSync.mockImplementation((filepath) => {
        return filepath.includes('.env') || filepath.includes('config.json') || filepath.includes('backups');
      });
      fs.mkdirSync.mockImplementation(() => {});
      fs.copyFileSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});
      fs.statSync.mockReturnValue({ size: 1024 });

      const result = backup.createBackup('/test/project', 'Test backup');

      expect(result.success).toBe(true);
      expect(result.backupName).toBe('backup_2025-01-22_14-30-45');
      expect(result.filesBackedUp).toEqual(['.env', 'config.json']);
      expect(result.description).toBe('Test backup');

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('backup_2025-01-22_14-30-45'),
        { recursive: true }
      );
      expect(fs.copyFileSync).toHaveBeenCalledTimes(2);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('backup-info.json'),
        expect.any(String)
      );
    });

    it('should handle missing .env file gracefully', () => {
      fs.existsSync.mockImplementation((filepath) => {
        if (filepath.includes('.env')) return false;
        if (filepath.includes('config.json')) return true;
        return filepath.includes('backups');
      });
      fs.mkdirSync.mockImplementation(() => {});
      fs.copyFileSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});
      fs.statSync.mockReturnValue({ size: 512 });

      const result = backup.createBackup('/test/project');

      expect(result.success).toBe(true);
      expect(result.filesBackedUp).toEqual(['config.json']);
      expect(fs.copyFileSync).toHaveBeenCalledTimes(1);
    });

    it('should handle missing config.json file gracefully', () => {
      fs.existsSync.mockImplementation((filepath) => {
        if (filepath.includes('.env')) return true;
        if (filepath.includes('config.json')) return false;
        return filepath.includes('backups');
      });
      fs.mkdirSync.mockImplementation(() => {});
      fs.copyFileSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});
      fs.statSync.mockReturnValue({ size: 256 });

      const result = backup.createBackup('/test/project');

      expect(result.success).toBe(true);
      expect(result.filesBackedUp).toEqual(['.env']);
    });

    it('should create backup directory if it does not exist', () => {
      fs.existsSync.mockImplementation((filepath) => {
        if (filepath.includes('backups') && !filepath.includes('backup_')) {
          return false;
        }
        return true;
      });
      fs.mkdirSync.mockImplementation(() => {});
      fs.copyFileSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});
      fs.statSync.mockReturnValue({ size: 1024 });

      backup.createBackup('/test/project');

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('backups'),
        { recursive: true }
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Created backup directory')
      );
    });

    it('should write metadata file with correct structure', () => {
      fs.existsSync.mockReturnValue(true);
      fs.mkdirSync.mockImplementation(() => {});
      fs.copyFileSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});
      fs.statSync.mockReturnValue({ size: 1024 });

      backup.createBackup('/test/project', 'My description');

      const metadataCall = fs.writeFileSync.mock.calls.find(
        call => call[0].includes('backup-info.json')
      );
      expect(metadataCall).toBeDefined();

      const metadata = JSON.parse(metadataCall[1]);
      expect(metadata.timestamp).toBeDefined();
      expect(metadata.description).toBe('My description');
      expect(metadata.files).toHaveLength(2);
      expect(metadata.files[0].name).toBe('.env');
      expect(metadata.files[0].backedUp).toBe(true);
      expect(metadata.files[0].size).toBe(1024);
    });

    it('should handle backup creation errors', () => {
      fs.existsSync.mockReturnValue(true);
      fs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = backup.createBackup('/test/project');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create backup:',
        expect.any(Error)
      );
    });

    it('should use empty description by default', () => {
      fs.existsSync.mockReturnValue(true);
      fs.mkdirSync.mockImplementation(() => {});
      fs.copyFileSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});
      fs.statSync.mockReturnValue({ size: 1024 });

      const result = backup.createBackup('/test/project');

      expect(result.description).toBe('');
    });
  });

  describe('listBackups', () => {
    it('should list all backups sorted by timestamp', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue([
        'backup_2025-01-20_10-00-00',
        'backup_2025-01-22_14-00-00',
        'backup_2025-01-21_12-00-00',
        'other-file.txt' // Should be filtered out
      ]);

      fs.statSync.mockImplementation((filepath) => {
        if (filepath.includes('backup_')) {
          return {
            isDirectory: () => true,
            mtime: new Date('2025-01-20T10:00:00Z')
          };
        }
        return { isDirectory: () => false };
      });

      // Mock metadata files
      fs.readFileSync.mockReturnValue(JSON.stringify({
        timestamp: '2025-01-22T14:00:00Z',
        description: 'Test backup',
        files: [
          { name: '.env', backedUp: true, size: 1024 },
          { name: 'config.json', backedUp: true, size: 512 }
        ]
      }));

      const backups = backup.listBackups('/test/project');

      expect(backups).toHaveLength(3);
      // Should be sorted newest first
      expect(backups[0].name).toBe('backup_2025-01-22_14-00-00');
      expect(backups[0].description).toBe('Test backup');
      expect(backups[0].files).toHaveLength(2);
    });

    it('should return empty array when backup directory does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      const backups = backup.listBackups('/test/project');

      expect(backups).toEqual([]);
    });

    it('should handle missing metadata gracefully', () => {
      fs.existsSync.mockImplementation((filepath) => {
        // Backup dir exists, but not metadata files
        if (filepath.includes('backup-info.json')) return false;
        return true;
      });
      fs.readdirSync.mockReturnValue(['backup_2025-01-22_10-00-00']);
      fs.statSync.mockImplementation((filepath) => {
        if (filepath.includes('backup_')) {
          return {
            isDirectory: () => true,
            mtime: new Date('2025-01-22T10:00:00Z')
          };
        }
        return {
          isDirectory: () => false,
          size: 1024
        };
      });

      const backups = backup.listBackups('/test/project');

      expect(backups).toHaveLength(1);
      expect(backups[0].timestamp).toBeDefined();
      expect(backups[0].description).toBe('');
    });

    it('should handle corrupted metadata gracefully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['backup_2025-01-22_10-00-00']);
      fs.statSync.mockReturnValue({
        isDirectory: () => true,
        mtime: new Date('2025-01-22T10:00:00Z')
      });
      fs.readFileSync.mockReturnValue('{ invalid json }');

      const backups = backup.listBackups('/test/project');

      expect(backups).toHaveLength(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read backup metadata'),
        expect.any(Error)
      );
    });

    it('should handle read errors gracefully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const backups = backup.listBackups('/test/project');

      expect(backups).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to list backups:',
        expect.any(Error)
      );
    });
  });

  describe('restoreBackup', () => {
    it('should restore backup successfully', () => {
      fs.existsSync.mockImplementation((filepath) => {
        // Backup folder and files exist
        return true;
      });
      fs.copyFileSync.mockImplementation(() => {});
      fs.mkdirSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});
      fs.statSync.mockReturnValue({ size: 1024 });

      const result = backup.restoreBackup(
        '/test/project',
        'backup_2025-01-22_10-00-00',
        { createBackupBeforeRestore: false }
      );

      expect(result.success).toBe(true);
      expect(result.backupName).toBe('backup_2025-01-22_10-00-00');
      expect(result.filesRestored).toEqual(['.env', 'config.json']);
      expect(fs.copyFileSync).toHaveBeenCalledTimes(2);
    });

    it('should create safety backup before restore by default', () => {
      fs.existsSync.mockReturnValue(true);
      fs.mkdirSync.mockImplementation(() => {});
      fs.copyFileSync.mockImplementation(() => {});
      fs.writeFileSync.mockImplementation(() => {});
      fs.statSync.mockReturnValue({ size: 1024 });

      backup.restoreBackup('/test/project', 'backup_2025-01-22_10-00-00');

      // Should create safety backup first (calls mkdirSync for both backups)
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Created safety backup before restore')
      );
    });

    it('should skip safety backup when option is false', () => {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {});

      backup.restoreBackup(
        '/test/project',
        'backup_2025-01-22_10-00-00',
        { createBackupBeforeRestore: false }
      );

      const logCalls = logger.info.mock.calls.map(call => call[0]);
      expect(logCalls.some(msg => msg.includes('safety backup'))).toBe(false);
    });

    it('should handle non-existent backup', () => {
      fs.existsSync.mockReturnValue(false);

      const result = backup.restoreBackup('/test/project', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Backup not found');
    });

    it('should handle backup with no files', () => {
      fs.existsSync.mockImplementation((filepath) => {
        // Backup folder exists but no files in it
        if (filepath.includes('.env') || filepath.includes('config.json')) {
          return false;
        }
        return filepath.includes('backup_');
      });

      const result = backup.restoreBackup(
        '/test/project',
        'backup_2025-01-22_10-00-00',
        { createBackupBeforeRestore: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('No files found in backup to restore');
    });

    it('should handle restore errors', () => {
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {
        throw new Error('Copy failed');
      });

      const result = backup.restoreBackup(
        '/test/project',
        'backup_2025-01-22_10-00-00',
        { createBackupBeforeRestore: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Copy failed');
    });
  });

  describe('deleteBackup', () => {
    it('should delete backup successfully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['.env', 'config.json', 'backup-info.json']);
      fs.unlinkSync.mockImplementation(() => {});
      fs.rmdirSync.mockImplementation(() => {});

      const result = backup.deleteBackup('/test/project', 'backup_2025-01-22_10-00-00');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Backup deleted');
      expect(fs.unlinkSync).toHaveBeenCalledTimes(3);
      expect(fs.rmdirSync).toHaveBeenCalledTimes(1);
    });

    it('should handle non-existent backup', () => {
      fs.existsSync.mockReturnValue(false);

      const result = backup.deleteBackup('/test/project', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Backup not found');
    });

    it('should handle deletion errors', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const result = backup.deleteBackup('/test/project', 'backup_2025-01-22_10-00-00');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Read error');
    });
  });

  describe('cleanupOldBackups', () => {
    it('should keep most recent backups and delete old ones', () => {
      // Mock listBackups by mocking the underlying fs calls
      fs.existsSync.mockImplementation((filepath) => {
        // Backup directories exist
        return true;
      });
      fs.readdirSync.mockImplementation((dirPath) => {
        const pathStr = String(dirPath);
        if (pathStr.endsWith('backups')) {
          // Return list of backup folders
          return [
            'backup_2025-01-22_14-00-00',
            'backup_2025-01-21_14-00-00',
            'backup_2025-01-20_14-00-00',
            'backup_2025-01-19_14-00-00',
            'backup_2025-01-18_14-00-00',
          ];
        }
        // For individual backup folders
        return ['file1.txt', 'file2.txt', 'backup-info.json'];
      });
      fs.statSync.mockImplementation((filepath) => {
        const pathStr = String(filepath);
        if (pathStr.includes('backup_')) {
          return {
            isDirectory: () => pathStr.endsWith('00'), // True for folders
            mtime: new Date('2025-01-22T10:00:00Z'),
            size: 1024
          };
        }
        return {
          isDirectory: () => false,
          size: 1024
        };
      });
      fs.readFileSync.mockReturnValue(JSON.stringify({
        timestamp: '2025-01-22T14:00:00Z',
        description: '',
        files: []
      }));
      fs.unlinkSync.mockImplementation(() => {});
      fs.rmdirSync.mockImplementation(() => {});

      const result = backup.cleanupOldBackups('/test/project', 3);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2); // Should delete 2 oldest
      expect(result.message).toContain('Deleted 2 old backup(s), kept 3 most recent');
    });

    it('should not delete anything when count is within limit', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation((dirPath) => {
        if (String(dirPath).endsWith('backups')) {
          return [
            'backup_2025-01-22_14-00-00',
            'backup_2025-01-21_14-00-00',
          ];
        }
        return [];
      });
      fs.statSync.mockReturnValue({
        isDirectory: () => true,
        mtime: new Date('2025-01-22T10:00:00Z')
      });
      fs.readFileSync.mockReturnValue(JSON.stringify({
        timestamp: '2025-01-22T14:00:00Z',
        description: '',
        files: []
      }));

      const result = backup.cleanupOldBackups('/test/project', 5);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
      expect(result.message).toContain('No cleanup needed');
    });

    it('should handle cleanup errors', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockImplementation(() => {
        throw new Error('List failed');
      });

      const result = backup.cleanupOldBackups('/test/project', 10);

      expect(result.success).toBe(false);
      expect(result.error).toBe('List failed');
    });
  });

  describe('Module exports', () => {
    it('should export all required functions', () => {
      expect(backup.createBackup).toBeDefined();
      expect(backup.listBackups).toBeDefined();
      expect(backup.restoreBackup).toBeDefined();
      expect(backup.deleteBackup).toBeDefined();
      expect(backup.cleanupOldBackups).toBeDefined();
    });
  });
});
