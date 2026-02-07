/**
 * Hello Club Event Attendance - System Tray Application
 *
 * This Electron app provides a system tray interface for monitoring and controlling
 * the Hello Club Event Attendance Windows service.
 *
 * Features:
 * - System tray icon with status indication (green/yellow/red)
 * - Context menu with service controls
 * - Log viewer window
 * - Real-time status monitoring
 * - Desktop notifications
 */

const { app, Tray, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
// child_process exec available via service-manager if needed
const { checkServiceStatus, startService, stopService, restartService } = require('./service-manager');
const { getRecentLogs, watchForProcessedEvents } = require('./log-watcher');
const { buildContextMenu } = require('./menu-builder');
const { sanitizeOutputPath } = require('../src/services/pdf-generator');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

let tray = null;
let logWindow = null;
let settingsWindow = null;
let setupWizardWindow = null;
let dashboardWindow = null;
let backupWindow = null;
let printPreviewWindow = null;
let printPreviewEventId = null; // Track eventId for cleanup
let statusCheckInterval = null;
let logWatchInterval = null;
let currentServiceStatus = 'unknown';

// State object for log watcher
const logWatcherState = {
  lastProcessedEventCount: 0,
};

// Paths
const PROJECT_ROOT = path.join(__dirname, '..');
const ACTIVITY_LOG = path.join(PROJECT_ROOT, 'activity.log');
const ERROR_LOG = path.join(PROJECT_ROOT, 'error.log');
const ICONS_PATH = path.join(__dirname, 'icons');

/**
 * Get the appropriate tray icon based on service status
 */
function getTrayIcon(status) {
  const iconName =
    {
      running: 'icon-green.png',
      stopped: 'icon-red.png',
      error: 'icon-red.png',
      unknown: 'icon-yellow.png',
    }[status] || 'icon-yellow.png';

  return path.join(ICONS_PATH, iconName);
}

/**
 * Update tray icon and tooltip based on service status
 */
function updateTrayStatus() {
  checkServiceStatus((result) => {
    let newStatus = result.status;

    if (result.running) {
      newStatus = 'running';
    } else if (result.installed && !result.running) {
      newStatus = 'stopped';
    } else if (!result.installed) {
      newStatus = 'unknown';
    }

    // Check for recent errors
    const errorLines = getRecentLogs(ERROR_LOG, 10);
    const recentErrors = errorLines.filter((line) => {
      const timestamp = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
      if (timestamp) {
        const logTime = new Date(timestamp[1]);
        const now = new Date();
        const minutesAgo = (now - logTime) / 1000 / 60;
        return minutesAgo < 5; // Errors in last 5 minutes
      }
      return false;
    });

    if (recentErrors.length > 0 && newStatus === 'running') {
      newStatus = 'error';
    }

    // Update icon if status changed
    if (newStatus !== currentServiceStatus) {
      currentServiceStatus = newStatus;
      tray.setImage(getTrayIcon(newStatus));

      const tooltips = {
        running: 'Hello Club Service: Running',
        stopped: 'Hello Club Service: Stopped',
        error: 'Hello Club Service: Running with errors',
        unknown: 'Hello Club Service: Not installed',
        'not-installed': 'Hello Club Service: Not installed',
      };

      tray.setToolTip(tooltips[newStatus] || 'Hello Club Service');
    }

    // Update context menu
    updateContextMenu();

    // Send status to log window if open
    if (logWindow && !logWindow.isDestroyed()) {
      logWindow.webContents.send('status-update', {
        status: newStatus,
        installed: result.installed,
        running: result.running,
      });
    }
  });
}

/**
 * Update the context menu using the menu builder
 */
function updateContextMenu() {
  buildContextMenu(tray, {
    currentServiceStatus,
    getTrayIcon,
    openLogViewer,
    openSettings,
    openDashboard,
    openBackup,
    openPrintPreview,
    updateTrayStatus,
    projectRoot: PROJECT_ROOT,
    onQuit: () => app.quit(),
  });
}

/**
 * Open the log viewer window
 */
function openLogViewer() {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.focus();
    return;
  }

  logWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    title: 'Hello Club Service - Log Viewer',
    icon: path.join(ICONS_PATH, 'icon-green.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  logWindow.loadFile(path.join(__dirname, 'log-viewer.html'));

  logWindow.on('closed', () => {
    logWindow = null;
  });
}

/**
 * Open the settings window
 */
function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Hello Club Service - Settings',
    icon: path.join(ICONS_PATH, 'icon-green.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

/**
 * Open the setup wizard window
 */
function openSetupWizard() {
  if (setupWizardWindow && !setupWizardWindow.isDestroyed()) {
    setupWizardWindow.focus();
    return;
  }

  setupWizardWindow = new BrowserWindow({
    width: 750,
    height: 650,
    title: 'Hello Club - First Time Setup',
    icon: path.join(ICONS_PATH, 'icon-green.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  setupWizardWindow.loadFile(path.join(__dirname, 'setup-wizard.html'));

  setupWizardWindow.on('closed', () => {
    setupWizardWindow = null;
  });
}

/**
 * Open the dashboard window
 */
function openDashboard() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.focus();
    return;
  }

  dashboardWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Hello Club Service - Dashboard',
    icon: path.join(ICONS_PATH, 'icon-green.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'dashboard-preload.js'),
    },
  });

  dashboardWindow.loadFile(path.join(__dirname, 'dashboard.html'));

  dashboardWindow.on('closed', () => {
    dashboardWindow = null;
  });
}

/**
 * Open the backup & restore window
 */
function openBackup() {
  if (backupWindow && !backupWindow.isDestroyed()) {
    backupWindow.focus();
    return;
  }

  backupWindow = new BrowserWindow({
    width: 950,
    height: 700,
    title: 'Hello Club - Backup & Restore',
    icon: path.join(ICONS_PATH, 'icon-green.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  backupWindow.loadFile(path.join(__dirname, 'backup.html'));

  backupWindow.on('closed', () => {
    backupWindow = null;
  });
}

/**
 * Open the print preview window for a specific event
 * @param {string} eventId - The event ID to preview
 */
function openPrintPreview(eventId) {
  if (printPreviewWindow && !printPreviewWindow.isDestroyed()) {
    printPreviewWindow.focus();
    return;
  }

  // Track the eventId for cleanup
  printPreviewEventId = eventId;

  printPreviewWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    title: 'Hello Club - Print Preview',
    icon: path.join(ICONS_PATH, 'icon-green.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'print-preview-preload.js'),
    },
  });

  printPreviewWindow.loadFile(path.join(__dirname, 'print-preview.html'), {
    query: { eventId: eventId },
  });

  printPreviewWindow.on('closed', () => {
    // Clean up temporary preview files when window closes
    if (printPreviewEventId) {
      cleanupPreviewFiles(printPreviewEventId);
    }
    printPreviewWindow = null;
    printPreviewEventId = null;
  });
}

/**
 * Clean up temporary preview PDF files for an event
 * @param {string} eventId - The event ID to clean up
 */
function cleanupPreviewFiles(eventId) {
  try {
    const files = fs.readdirSync(PROJECT_ROOT);
    const previewFiles = files.filter((file) => file.startsWith(`preview-${eventId}-`) && file.endsWith('.pdf'));

    previewFiles.forEach((file) => {
      const filePath = path.join(PROJECT_ROOT, file);
      try {
        fs.unlinkSync(filePath);
      } catch (_err) {
        // Ignore errors - file may be in use
      }
    });
  } catch (_err) {
    // Ignore errors during cleanup
  }
}

/**
 * Clean up all stale preview files (older than 1 hour)
 */
function cleanupStalePreviewFiles() {
  try {
    const files = fs.readdirSync(PROJECT_ROOT);
    const previewFiles = files.filter((file) => file.startsWith('preview-') && file.endsWith('.pdf'));
    const oneHourAgo = Date.now() - 60 * 60 * 1000;

    previewFiles.forEach((file) => {
      const filePath = path.join(PROJECT_ROOT, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs < oneHourAgo) {
          fs.unlinkSync(filePath);
        }
      } catch (_err) {
        // Ignore errors
      }
    });
  } catch (_err) {
    // Ignore errors during cleanup
  }
}

/**
 * Initialize the tray application
 */
function createTray() {
  tray = new Tray(getTrayIcon('unknown'));
  tray.setToolTip('Hello Club Event Attendance');

  updateContextMenu();

  // Update status every 10 seconds
  statusCheckInterval = setInterval(updateTrayStatus, 10000);

  // Watch for processed events every 30 seconds
  logWatchInterval = setInterval(() => {
    watchForProcessedEvents(ACTIVITY_LOG, ICONS_PATH, logWatcherState);
  }, 30000);

  // Initial status check
  updateTrayStatus();
}

// IPC handlers for log viewer
ipcMain.handle('get-activity-log', () => {
  return getRecentLogs(ACTIVITY_LOG, 500);
});

ipcMain.handle('get-error-log', () => {
  return getRecentLogs(ERROR_LOG, 500);
});

ipcMain.handle('get-service-status', async () => {
  return new Promise((resolve) => {
    checkServiceStatus(resolve);
  });
});

ipcMain.handle('start-service', async () => {
  return new Promise((resolve) => {
    startService(resolve);
  });
});

ipcMain.handle('stop-service', async () => {
  return new Promise((resolve) => {
    stopService(resolve);
  });
});

ipcMain.handle('restart-service', async () => {
  return new Promise((resolve) => {
    restartService(resolve);
  });
});

// Connection test handlers
ipcMain.handle('test-api-connection', async () => {
  const { testApiConnection } = require('./connection-tests');
  return await testApiConnection();
});

ipcMain.handle('test-email-connection', async () => {
  const { testEmailConnection } = require('./connection-tests');
  return await testEmailConnection();
});

// Settings handlers
ipcMain.handle('get-env-config', async () => {
  try {
    const envPath = path.join(PROJECT_ROOT, '.env');
    if (!fs.existsSync(envPath)) {
      return { success: true, data: {} };
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const envData = {};

    envContent.split('\n').forEach((line) => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          // Remove surrounding quotes if present
          value = value.replace(/^["']|["']$/g, '');
          envData[key] = value;
        }
      }
    });

    return { success: true, data: envData };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-json-config', async () => {
  try {
    const configPath = path.join(PROJECT_ROOT, 'config.json');
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return { success: true, data: configData };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-env-config', async (event, newConfig) => {
  try {
    const envPath = path.join(PROJECT_ROOT, '.env');
    const backupPath = path.join(PROJECT_ROOT, '.env.backup');
    const tmpPath = path.join(PROJECT_ROOT, '.env.tmp');

    // Create backup if .env exists
    if (fs.existsSync(envPath)) {
      fs.copyFileSync(envPath, backupPath);
    }

    // Build .env content
    let envContent = '# Required for API access\n';
    envContent += `API_KEY=${newConfig.API_KEY || ''}\n`;
    if (newConfig.API_BASE_URL) {
      envContent += `API_BASE_URL=${newConfig.API_BASE_URL}\n`;
    }
    envContent += '\n# Required for Email Printing Mode\n';
    envContent += `PRINTER_EMAIL=${newConfig.PRINTER_EMAIL || ''}\n`;
    envContent += `SMTP_USER=${newConfig.SMTP_USER || ''}\n`;
    // Strip spaces from password (Google App passwords have spaces when copied)
    envContent += `SMTP_PASS=${(newConfig.SMTP_PASS || '').replace(/\s/g, '')}\n`;
    if (newConfig.SMTP_HOST) {
      envContent += `SMTP_HOST=${newConfig.SMTP_HOST}\n`;
    }
    if (newConfig.SMTP_PORT) {
      envContent += `SMTP_PORT=${newConfig.SMTP_PORT}\n`;
    }
    if (newConfig.EMAIL_FROM) {
      envContent += `EMAIL_FROM=${newConfig.EMAIL_FROM}\n`;
    }

    // Write to temp file, then rename (atomic)
    fs.writeFileSync(tmpPath, envContent, 'utf8');
    fs.renameSync(tmpPath, envPath);

    return { success: true, message: 'Environment configuration saved successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-json-config', async (event, newConfig) => {
  try {
    const configPath = path.join(PROJECT_ROOT, 'config.json');
    const backupPath = path.join(PROJECT_ROOT, 'config.json.backup');
    const tmpPath = path.join(PROJECT_ROOT, 'config.json.tmp');

    // Create backup
    if (fs.existsSync(configPath)) {
      fs.copyFileSync(configPath, backupPath);
    }

    // Write to temp file, then rename (atomic)
    fs.writeFileSync(tmpPath, JSON.stringify(newConfig, null, 2), 'utf8');
    fs.renameSync(tmpPath, configPath);

    return { success: true, message: 'Configuration saved successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('validate-json-config', async (event, configData) => {
  try {
    // Import the Joi schema
    const configSchema = require('../src/utils/config-schema');
    const { error } = configSchema.validate(configData);

    if (error) {
      const errors = error.details.map((d) => d.message);
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
});

// Dashboard handlers
ipcMain.handle('get-statistics', async () => {
  try {
    const statisticsPath = path.join(PROJECT_ROOT, 'statistics.json');
    if (!fs.existsSync(statisticsPath)) {
      // Return default empty statistics if file doesn't exist
      return {
        period: 'Last 7 days',
        generated_at: new Date().toISOString(),
        events: { total: 0, byStatus: {}, successRate: '0%' },
        jobs: { total: 0, byStatus: {}, retryRate: '0%' },
        currentStatus: { pending: 0, failed: 0, retrying: 0 },
        recentActivity: [],
      };
    }

    const statsData = JSON.parse(fs.readFileSync(statisticsPath, 'utf8'));
    return statsData;
  } catch (error) {
    console.error('Error reading statistics:', error);
    throw error;
  }
});

ipcMain.handle('open-logs', async () => {
  openLogViewer();
  return { success: true };
});

ipcMain.handle('open-settings', async () => {
  openSettings();
  return { success: true };
});

// Backup/Restore handlers
ipcMain.handle('create-backup', async (event, description) => {
  const { createBackup } = require('../src/utils/backup');
  return createBackup(PROJECT_ROOT, description || '');
});

ipcMain.handle('list-backups', async () => {
  const { listBackups } = require('../src/utils/backup');
  return listBackups(PROJECT_ROOT);
});

ipcMain.handle('restore-backup', async (event, backupName) => {
  const { restoreBackup } = require('../src/utils/backup');
  return restoreBackup(PROJECT_ROOT, backupName);
});

ipcMain.handle('delete-backup', async (event, backupName) => {
  const { deleteBackup } = require('../src/utils/backup');
  return deleteBackup(PROJECT_ROOT, backupName);
});

ipcMain.handle('cleanup-old-backups', async (event, keepCount) => {
  const { cleanupOldBackups } = require('../src/utils/backup');
  return cleanupOldBackups(PROJECT_ROOT, keepCount || 10);
});

// Print preview handlers
ipcMain.handle('generate-print-preview', async (event, eventId) => {
  try {
    // Load required modules
    const { getEventDetails, getAllAttendees } = require('../src/core/api-client');
    const PdfGenerator = require('../src/services/pdf-generator');

    // Load config to get PDF layout settings
    const configPath = path.join(PROJECT_ROOT, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Fetch event details and attendees
    const eventData = await getEventDetails(eventId);
    const attendees = await getAllAttendees(eventId);

    // Generate a unique temporary PDF filename
    const timestamp = Date.now();
    const tempFileName = `preview-${eventId}-${timestamp}.pdf`;
    const tempFilePath = path.join(PROJECT_ROOT, tempFileName);

    // Generate PDF (pass only filename - generator creates in cwd which should be PROJECT_ROOT)
    const originalCwd = process.cwd();
    process.chdir(PROJECT_ROOT);
    const generator = new PdfGenerator(eventData, attendees, config.pdfLayout || {});
    generator.generate(tempFileName);
    process.chdir(originalCwd);

    return {
      success: true,
      pdfPath: tempFilePath,
      event: eventData,
      attendeeCount: attendees.length,
      fileName: tempFileName,
      printMode: config.printMode || 'local',
    };
  } catch (error) {
    const logger = require('../src/services/logger');
    logger.error('Error generating print preview:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate preview',
    };
  }
});

ipcMain.handle('print-preview-pdf', async (event, eventId, printMode, previewPdfPath) => {
  try {
    // Load required modules
    const { getEventDetails } = require('../src/core/api-client');
    const { print } = require('pdf-to-printer');
    const { sendEmailWithAttachment } = require('../src/services/email-service');
    const logger = require('../src/services/logger');

    // Load config
    const configPath = path.join(PROJECT_ROOT, 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Get event details for logging/email subject (cached, fast)
    const eventData = await getEventDetails(eventId);

    // Reuse the preview PDF instead of regenerating
    const outputFileName = config.outputFilename || 'attendees.pdf';
    // Sanitize output path to prevent path traversal
    const outputFilePath = sanitizeOutputPath(outputFileName);

    // Copy the preview PDF to the output location
    if (previewPdfPath && fs.existsSync(previewPdfPath)) {
      fs.copyFileSync(previewPdfPath, outputFilePath);
    } else {
      throw new Error('Preview PDF not found. Please regenerate the preview.');
    }

    // Log file size for monitoring
    const stats = fs.statSync(outputFilePath);
    const fileSizeKB = (stats.size / 1024).toFixed(2);
    logger.info(`✓ PDF copied from preview: ${outputFileName} (${fileSizeKB} KB)`);

    // Print or email based on selected mode
    if (printMode === 'local') {
      logger.info('Printing PDF locally from preview...');
      const msg = await print(outputFilePath);
      logger.info(msg);
    } else if (printMode === 'email') {
      logger.info('Sending PDF to printer via email from preview...');

      // Get email settings from environment variables
      require('dotenv').config({ path: path.join(PROJECT_ROOT, '.env') });
      const PRINTER_EMAIL = process.env.PRINTER_EMAIL;
      const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
      const SMTP_PORT = process.env.SMTP_PORT || 587;
      const SMTP_USER = process.env.SMTP_USER;
      const SMTP_PASS = (process.env.SMTP_PASS || '').replace(/\s/g, '');
      const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;

      const transportOptions = {
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT == 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      };

      const subject = `Print Job: ${eventData.name}`;
      const body = `Attached is the attendee list for the event: ${eventData.name}.`;

      await sendEmailWithAttachment(transportOptions, PRINTER_EMAIL, EMAIL_FROM, subject, body, outputFilePath);
      logger.info(`✓ Email sent to: ${PRINTER_EMAIL}`);
    }

    return { success: true };
  } catch (error) {
    const logger = require('../src/services/logger');
    logger.error('Error printing preview:', error);
    return {
      success: false,
      error: error.message || 'Failed to print',
    };
  }
});

ipcMain.handle('cleanup-preview-pdf', async (event, eventId) => {
  try {
    // Find and delete temporary preview files for this event
    const files = fs.readdirSync(PROJECT_ROOT);
    const previewFiles = files.filter((file) => file.startsWith(`preview-${eventId}-`) && file.endsWith('.pdf'));

    previewFiles.forEach((file) => {
      const filePath = path.join(PROJECT_ROOT, file);
      fs.unlinkSync(filePath);
    });

    return { success: true, deletedCount: previewFiles.length };
  } catch (error) {
    const logger = require('../src/services/logger');
    logger.error('Error cleaning up preview files:', error);
    return { success: false, error: error.message };
  }
});

// Logo upload handler with security validation
ipcMain.handle('upload-logo', async () => {
  const { dialog } = require('electron');

  // Allowed extensions (lowercase)
  const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif'];
  // Maximum file size: 5MB
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  try {
    const result = await dialog.showOpenDialog({
      title: 'Select Logo Image',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif'] }],
      properties: ['openFile'],
    });

    if (result.canceled || !result.filePaths.length) {
      return { success: false, error: 'No file selected' };
    }

    const sourcePath = result.filePaths[0];
    const ext = path.extname(sourcePath).toLowerCase();

    // Validate file extension
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        success: false,
        error: `Invalid file type "${ext}". Only PNG, JPG, JPEG, and GIF files are allowed.`,
      };
    }

    // Validate file size
    const stats = fs.statSync(sourcePath);
    if (stats.size > MAX_FILE_SIZE) {
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      return {
        success: false,
        error: `File too large (${sizeMB}MB). Maximum allowed size is 5MB.`,
      };
    }

    // Validate file is actually readable and not a special file
    if (!stats.isFile()) {
      return { success: false, error: 'Selected path is not a valid file.' };
    }

    // Read first few bytes to verify it's actually an image (magic bytes check)
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(sourcePath, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    // Check magic bytes for common image formats
    const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isJPEG = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isGIF = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;

    if (!isPNG && !isJPEG && !isGIF) {
      return {
        success: false,
        error: 'File does not appear to be a valid image. Please select a PNG, JPG, or GIF file.',
      };
    }

    const logoFileName = `logo${ext}`;
    const destPath = path.join(PROJECT_ROOT, logoFileName);

    // Copy the file to project root
    fs.copyFileSync(sourcePath, destPath);

    return { success: true, logoPath: logoFileName };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// App lifecycle
app.whenReady().then(() => {
  createTray();

  // Clean up any stale preview files from previous sessions
  cleanupStalePreviewFiles();

  // Check if icons exist, show warning if not
  if (!fs.existsSync(ICONS_PATH)) {
    new Notification({
      title: 'Tray App Started',
      body: 'Warning: Icon files not found. Using default icons.',
    }).show();
  }

  // Check if this is first run (no .env file)
  const envPath = path.join(PROJECT_ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    setTimeout(() => {
      openSetupWizard();
      new Notification({
        title: 'Welcome to Hello Club!',
        body: 'Opening setup wizard to help you get started...',
        icon: path.join(ICONS_PATH, 'icon-green.png'),
      }).show();
    }, 1000);
  }
});

app.on('window-all-closed', (e) => {
  // Prevent app from quitting when all windows are closed
  // Keep running in system tray
  e.preventDefault();
});

app.on('before-quit', () => {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
  }
  if (logWatchInterval) {
    clearInterval(logWatchInterval);
  }
});
