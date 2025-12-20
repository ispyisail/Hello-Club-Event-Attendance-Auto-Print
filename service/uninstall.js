/**
 * Windows Service Uninstaller
 *
 * This script uninstalls the Hello Club Event Attendance Windows service.
 *
 * IMPORTANT: Must be run with Administrator privileges
 *
 * Usage: node service/uninstall.js
 */

const Service = require('node-windows').Service;
const path = require('path');

// Get the absolute path to the main script
const scriptPath = path.join(__dirname, '..', 'src', 'index.js');

// Create a new service object with the same configuration as install
const svc = new Service({
  name: 'HelloClubEventAttendance',
  script: scriptPath
});

// Listen for the "uninstall" event
svc.on('uninstall', function() {
  console.log('\n✓ Service uninstalled successfully!');
  console.log('  The service has been removed from Windows Service Control Manager.');
  console.log('\nYou can reinstall the service anytime by running:');
  console.log('  node service/install.js');
});

// Listen for errors
svc.on('error', function(err) {
  console.error('\n✗ Error uninstalling service:', err);
  console.error('\nMake sure you are running this script as Administrator!');
  console.error('Right-click Command Prompt or PowerShell and select "Run as Administrator"');
  process.exit(1);
});

// Listen for "alreadyuninstalled" event
svc.on('alreadyuninstalled', function() {
  console.log('\n! Service is not installed.');
  console.log('  Nothing to uninstall.');
  process.exit(0);
});

console.log('Uninstalling Hello Club Event Attendance service...');
console.log('\nThis may take a minute...\n');

// Uninstall the service
svc.uninstall();
