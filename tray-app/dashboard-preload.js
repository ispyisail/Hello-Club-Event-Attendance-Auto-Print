/**
 * Preload script for dashboard window
 *
 * This script runs in a privileged context and exposes a limited set of APIs
 * to the renderer process via the contextBridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods for the dashboard
contextBridge.exposeInMainWorld('api', {
  // Statistics
  getStatistics: () => ipcRenderer.invoke('get-statistics'),

  // Service status
  getServiceStatus: () => ipcRenderer.invoke('get-service-status'),

  // Quick actions
  openLogs: () => ipcRenderer.invoke('open-logs'),
  openSettings: () => ipcRenderer.invoke('open-settings'),
});
