/**
 * @fileoverview Service Manager - Windows service control
 * Provides functions for checking, starting, stopping, and restarting the Hello Club Windows service
 */

const { exec } = require('child_process');

const SERVICE_NAME = 'HelloClubEventAttendance';

/**
 * Check the Windows service status
 * @param {Function} callback - Callback with status result
 * @returns {void}
 */
function checkServiceStatus(callback) {
  exec(`sc query "${SERVICE_NAME}"`, (error, stdout, stderr) => {
    if (error) {
      if (stdout.includes('does not exist')) {
        callback({ installed: false, running: false, status: 'not-installed' });
      } else {
        callback({ installed: false, running: false, status: 'error', error: error.message });
      }
      return;
    }

    const isRunning = stdout.includes('RUNNING');
    const isStopped = stdout.includes('STOPPED');

    if (isRunning) {
      callback({ installed: true, running: true, status: 'running' });
    } else if (isStopped) {
      callback({ installed: true, running: false, status: 'stopped' });
    } else {
      callback({ installed: true, running: false, status: 'unknown' });
    }
  });
}

/**
 * Start the Windows service
 * @param {Function} callback - Callback with operation result
 * @returns {void}
 */
function startService(callback) {
  exec(`net start ${SERVICE_NAME}`, (error, stdout, stderr) => {
    if (error) {
      callback({ success: false, error: stderr || error.message });
    } else {
      callback({ success: true, message: 'Service started successfully' });
    }
  });
}

/**
 * Stop the Windows service
 * @param {Function} callback - Callback with operation result
 * @returns {void}
 */
function stopService(callback) {
  exec(`net stop ${SERVICE_NAME}`, (error, stdout, stderr) => {
    if (error) {
      callback({ success: false, error: stderr || error.message });
    } else {
      callback({ success: true, message: 'Service stopped successfully' });
    }
  });
}

/**
 * Restart the Windows service
 * @param {Function} callback - Callback with operation result
 * @returns {void}
 */
function restartService(callback) {
  stopService((stopResult) => {
    if (!stopResult.success && !stopResult.error.includes('not started')) {
      callback(stopResult);
      return;
    }

    // Wait a moment before starting
    setTimeout(() => {
      startService(callback);
    }, 2000);
  });
}

module.exports = {
  checkServiceStatus,
  startService,
  stopService,
  restartService
};
