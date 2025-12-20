/**
 * @fileoverview Menu Builder - System tray context menu construction
 * Builds and updates the tray context menu based on service status
 */

const { Menu, Notification, nativeImage } = require('electron');
const { exec } = require('child_process');
const { checkServiceStatus, startService, stopService, restartService } = require('./service-manager');

/**
 * Build and set the context menu for the system tray
 * @param {Tray} tray - The Electron Tray instance
 * @param {Object} options - Menu building options
 * @param {string} options.currentServiceStatus - Current service status
 * @param {Function} options.getTrayIcon - Function to get tray icon path
 * @param {Function} options.openLogViewer - Function to open log viewer
 * @param {Function} options.openSettings - Function to open settings window
 * @param {Function} options.openDashboard - Function to open dashboard window
 * @param {Function} options.openBackup - Function to open backup window
 * @param {Function} options.updateTrayStatus - Function to update tray status
 * @param {string} options.projectRoot - Project root directory path
 * @param {Function} options.onQuit - Function to call when quitting
 * @returns {void}
 */
function buildContextMenu(tray, options) {
  const {
    currentServiceStatus,
    getTrayIcon,
    openLogViewer,
    openSettings,
    openDashboard,
    openBackup,
    updateTrayStatus,
    projectRoot,
    onQuit
  } = options;

  checkServiceStatus((result) => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Hello Club Event Attendance',
        enabled: false,
        icon: nativeImage.createFromPath(getTrayIcon(currentServiceStatus)).resize({ width: 16, height: 16 })
      },
      { type: 'separator' },
      {
        label: result.running ? 'Status: Running ✓' : 'Status: Stopped ✗',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Dashboard',
        click: openDashboard
      },
      {
        label: 'View Logs',
        click: openLogViewer
      },
      {
        label: 'Settings',
        click: openSettings
      },
      {
        label: 'Backup & Restore',
        click: openBackup
      },
      { type: 'separator' },
      {
        label: 'Check Status Now',
        click: () => {
          updateTrayStatus();
          new Notification({
            title: 'Status Check',
            body: `Service is ${result.running ? 'running' : 'stopped'}`,
            icon: getTrayIcon(currentServiceStatus)
          }).show();
        }
      },
      { type: 'separator' },
      {
        label: 'Test API Connection',
        click: async () => {
          new Notification({
            title: 'Testing API...',
            body: 'Connecting to Hello Club API',
            icon: getTrayIcon('unknown')
          }).show();

          const { testApiConnection } = require('./connection-tests');
          const result = await testApiConnection();

          new Notification({
            title: result.success ? 'API Test Passed' : 'API Test Failed',
            body: result.message,
            icon: getTrayIcon(result.success ? 'running' : 'error')
          }).show();
        }
      },
      {
        label: 'Test Email Connection',
        click: async () => {
          new Notification({
            title: 'Testing Email...',
            body: 'Connecting to SMTP server',
            icon: getTrayIcon('unknown')
          }).show();

          const { testEmailConnection } = require('./connection-tests');
          const result = await testEmailConnection();

          new Notification({
            title: result.success ? 'Email Test Passed' : 'Email Test Failed',
            body: result.message,
            icon: getTrayIcon(result.success ? 'running' : 'error')
          }).show();
        }
      },
      { type: 'separator' },
      {
        label: 'Start Service',
        enabled: result.installed && !result.running,
        click: () => {
          startService((res) => {
            new Notification({
              title: res.success ? 'Service Started' : 'Start Failed',
              body: res.success ? res.message : res.error,
              icon: getTrayIcon(res.success ? 'running' : 'error')
            }).show();
            updateTrayStatus();
          });
        }
      },
      {
        label: 'Stop Service',
        enabled: result.installed && result.running,
        click: () => {
          stopService((res) => {
            new Notification({
              title: res.success ? 'Service Stopped' : 'Stop Failed',
              body: res.success ? res.message : res.error,
              icon: getTrayIcon(res.success ? 'stopped' : 'error')
            }).show();
            updateTrayStatus();
          });
        }
      },
      {
        label: 'Restart Service',
        enabled: result.installed,
        click: () => {
          restartService((res) => {
            new Notification({
              title: res.success ? 'Service Restarted' : 'Restart Failed',
              body: res.success ? res.message : res.error,
              icon: getTrayIcon(res.success ? 'running' : 'error')
            }).show();
            updateTrayStatus();
          });
        }
      },
      { type: 'separator' },
      {
        label: 'Open Services Manager',
        click: () => {
          exec('services.msc');
        }
      },
      {
        label: 'Open Project Folder',
        click: () => {
          exec(`explorer "${projectRoot}"`);
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: onQuit
      }
    ]);

    tray.setContextMenu(contextMenu);
  });
}

module.exports = {
  buildContextMenu
};
