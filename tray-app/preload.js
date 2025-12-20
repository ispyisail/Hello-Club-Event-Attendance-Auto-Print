/**
 * Preload script for log viewer window
 *
 * This script runs in a privileged context and exposes a limited set of APIs
 * to the renderer process via the contextBridge. This provides security by
 * preventing the renderer from accessing Node.js APIs directly.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Log fetching
  getActivityLog: () => ipcRenderer.invoke('get-activity-log'),
  getErrorLog: () => ipcRenderer.invoke('get-error-log'),

  // Service status and control
  getServiceStatus: () => ipcRenderer.invoke('get-service-status'),
  startService: () => ipcRenderer.invoke('start-service'),
  stopService: () => ipcRenderer.invoke('stop-service'),
  restartService: () => ipcRenderer.invoke('restart-service'),

  // Connection tests
  testApiConnection: () => ipcRenderer.invoke('test-api-connection'),
  testEmailConnection: () => ipcRenderer.invoke('test-email-connection'),

  // Settings management
  getEnvConfig: () => ipcRenderer.invoke('get-env-config'),
  getJsonConfig: () => ipcRenderer.invoke('get-json-config'),
  saveEnvConfig: (config) => ipcRenderer.invoke('save-env-config', config),
  saveJsonConfig: (config) => ipcRenderer.invoke('save-json-config', config),
  validateJsonConfig: (config) => ipcRenderer.invoke('validate-json-config', config),

  // Event listeners
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (event, status) => callback(status));
  },

  // Backup and restore
  createBackup: (description) => ipcRenderer.invoke('create-backup', description),
  listBackups: () => ipcRenderer.invoke('list-backups'),
  restoreBackup: (backupName) => ipcRenderer.invoke('restore-backup', backupName),
  deleteBackup: (backupName) => ipcRenderer.invoke('delete-backup', backupName),
  cleanupOldBackups: (keepCount) => ipcRenderer.invoke('cleanup-old-backups', keepCount),

  // Logo upload
  uploadLogo: () => ipcRenderer.invoke('upload-logo'),
});
