/**
 * @fileoverview Log Watcher - Log file monitoring and event tracking
 * Provides functions for reading logs and watching for processed events
 */

const fs = require('fs');
const { Notification } = require('electron');
const path = require('path');

/**
 * Get recent log entries from a log file
 * @param {string} logFile - Path to the log file
 * @param {number} lines - Number of recent lines to retrieve (default: 50)
 * @returns {string[]} Array of log lines
 */
function getRecentLogs(logFile, lines = 50) {
  try {
    if (!fs.existsSync(logFile)) {
      return [];
    }

    const content = fs.readFileSync(logFile, 'utf8');
    const allLines = content.trim().split('\n');
    return allLines.slice(-lines);
  } catch (error) {
    console.error('Error reading log file:', error);
    return [];
  }
}

/**
 * Show a notification with appropriate icon and formatting
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {string} type - Type: 'success', 'error', 'warning', 'info'
 * @param {string} iconsPath - Path to icon directory
 */
function showNotification(title, body, type, iconsPath) {
  if (!Notification.isSupported()) {
    return;
  }

  const iconMap = {
    'success': path.join(iconsPath, 'icon-green.png'),
    'error': path.join(iconsPath, 'icon-red.png'),
    'warning': path.join(iconsPath, 'icon-yellow.png'),
    'info': path.join(iconsPath, 'icon-yellow.png')
  };

  new Notification({
    title,
    body,
    icon: iconMap[type] || iconMap['info'],
    timeoutType: 'default'
  }).show();
}

/**
 * Watch for new events being processed and errors
 * @param {string} activityLogPath - Path to the activity log file
 * @param {string} iconsPath - Path to icon directory for notifications
 * @param {Object} state - State object containing lastProcessedEventCount
 * @returns {void}
 */
function watchForProcessedEvents(activityLogPath, iconsPath, state) {
  const activityLines = getRecentLogs(activityLogPath, 100);

  // Count "marked as processed" messages
  const processedCount = activityLines.filter(line =>
    line.includes('marked as processed')
  ).length;

  if (processedCount > state.lastProcessedEventCount) {
    const newEvents = processedCount - state.lastProcessedEventCount;
    state.lastProcessedEventCount = processedCount;

    // Extract event names from log lines
    const eventNames = activityLines
      .filter(line => line.includes('marked as processed'))
      .slice(-newEvents)
      .map(line => {
        const match = line.match(/Event "(.*?)" \(ID:/);
        return match ? match[1] : 'Unknown Event';
      })
      .slice(0, 3) // Show max 3 event names
      .join('\n');

    const body = eventNames || `${newEvents} event(s) processed successfully`;
    showNotification(
      `✓ ${newEvents} Event${newEvents > 1 ? 's' : ''} Processed`,
      body,
      'success',
      iconsPath
    );
  }
}

module.exports = {
  getRecentLogs,
  watchForProcessedEvents
};
