const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script for print preview window
 * Exposes safe IPC methods to the renderer process
 */
contextBridge.exposeInMainWorld('printAPI', {
  /**
   * Generate PDF preview for an event
   * @param {string} eventId - The event ID to preview
   * @returns {Promise<{success: boolean, pdfPath?: string, event?: object, attendeeCount?: number, fileName?: string, printMode?: string, error?: string}>}
   */
  generatePreview: (eventId) => ipcRenderer.invoke('generate-print-preview', eventId),

  /**
   * Print or email the previewed PDF
   * @param {string} eventId - The event ID to print
   * @param {string} printMode - 'local' or 'email'
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  printPreview: (eventId, printMode) => ipcRenderer.invoke('print-preview-pdf', eventId, printMode),

  /**
   * Clean up temporary preview files
   * @param {string} eventId - The event ID to clean up
   * @returns {Promise<{success: boolean}>}
   */
  cleanupPreview: (eventId) => ipcRenderer.invoke('cleanup-preview-pdf', eventId),
});
