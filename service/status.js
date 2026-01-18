/**
 * Windows Service Status Checker
 *
 * This script checks the status of the Hello Club Event Attendance Windows service
 * and displays recent log entries.
 *
 * Usage: node service/status.js
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const SERVICE_NAME = 'HelloClubEventAttendance';
const LOG_LINES_TO_SHOW = 20;

console.log('Checking Hello Club Event Attendance Service Status...\n');
console.log('='.repeat(60));

// Check if service is installed and get its status
exec(`sc query "${SERVICE_NAME}"`, (error, stdout, _stderr) => {
  if (error) {
    if (stdout.includes('The specified service does not exist')) {
      console.log('\n✗ SERVICE NOT INSTALLED');
      console.log('\nThe service is not installed on this system.');
      console.log('To install the service, run:');
      console.log('  node service/install.js');
      console.log('\n' + '='.repeat(60));
      return;
    }
    console.error('\n✗ Error checking service status:', error.message);
    return;
  }

  // Parse the service status output
  const isRunning = stdout.includes('RUNNING');
  const isStopped = stdout.includes('STOPPED');
  const isPaused = stdout.includes('PAUSED');

  console.log('\n✓ SERVICE INSTALLED');
  console.log('\nService Name: HelloClubEventAttendance');
  console.log('Display Name: Hello Club Event Attendance');

  if (isRunning) {
    console.log('Status: ✓ RUNNING');
  } else if (isStopped) {
    console.log('Status: ✗ STOPPED');
  } else if (isPaused) {
    console.log('Status: ⚠ PAUSED');
  } else {
    console.log('Status: UNKNOWN');
  }

  // Get detailed service info
  exec(`sc qc "${SERVICE_NAME}"`, (error, configOut) => {
    if (!error && configOut) {
      const startType = configOut.match(/START_TYPE\s+:\s+\d+\s+(\w+)/);
      if (startType && startType[1]) {
        console.log('Start Type:', startType[1]);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('\nRECENT ACTIVITY LOG (last ' + LOG_LINES_TO_SHOW + ' lines):');
    console.log('-'.repeat(60));

    // Read and display recent activity log
    const activityLogPath = path.join(__dirname, '..', 'activity.log');
    try {
      if (fs.existsSync(activityLogPath)) {
        const logContent = fs.readFileSync(activityLogPath, 'utf8');
        const lines = logContent.trim().split('\n');
        const recentLines = lines.slice(-LOG_LINES_TO_SHOW);

        if (recentLines.length > 0) {
          console.log(recentLines.join('\n'));
        } else {
          console.log('(Log file is empty)');
        }
      } else {
        console.log('(No activity log file found)');
      }
    } catch (err) {
      console.log('(Error reading log file)');
    }

    console.log('\n' + '-'.repeat(60));
    console.log('\nRECENT ERROR LOG (last ' + LOG_LINES_TO_SHOW + ' lines):');
    console.log('-'.repeat(60));

    // Read and display recent error log
    const errorLogPath = path.join(__dirname, '..', 'error.log');
    try {
      if (fs.existsSync(errorLogPath)) {
        const logContent = fs.readFileSync(errorLogPath, 'utf8');
        const lines = logContent.trim().split('\n');
        const recentLines = lines.slice(-LOG_LINES_TO_SHOW);

        if (recentLines.length > 0 && recentLines[0] !== '') {
          console.log(recentLines.join('\n'));
        } else {
          console.log('✓ No errors logged');
        }
      } else {
        console.log('(No error log file found)');
      }
    } catch (err) {
      console.log('(Error reading log file)');
    }

    console.log('\n' + '='.repeat(60));
    console.log('\nSERVICE MANAGEMENT COMMANDS:');
    console.log('-'.repeat(60));
    console.log('Start service:   net start HelloClubEventAttendance');
    console.log('Stop service:    net stop HelloClubEventAttendance');
    console.log('Restart service: net stop HelloClubEventAttendance && net start HelloClubEventAttendance');
    console.log('Uninstall:       node service/uninstall.js');
    console.log('\nNote: Service commands require Administrator privileges');
    console.log('='.repeat(60) + '\n');
  });
});
