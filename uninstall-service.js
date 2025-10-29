/**
 * @fileoverview Windows Service Uninstaller for Hello Club Event Attendance Auto-Print
 * This script removes the Windows service installation.
 *
 * Usage: Run as Administrator
 *   node uninstall-service.js
 *   OR double-click "Uninstall Service.bat"
 */

const Service = require('node-windows').Service;
const path = require('path');

// Validate that we're running on Windows
if (process.platform !== 'win32') {
  console.error('Error: This script is only for Windows systems.');
  process.exit(1);
}

console.log('='.repeat(80));
console.log('Hello Club - Windows Service Uninstaller');
console.log('='.repeat(80));

// Create a new service object (must match install-service.js)
const svc = new Service({
  name: 'HelloClubAttendance',
  script: path.join(__dirname, 'src', 'index.js')
});

// Listen for the "uninstall" event
svc.on('uninstall', function() {
  console.log('\n' + '='.repeat(80));
  console.log('✓ Service uninstalled successfully!');
  console.log('='.repeat(80));
  console.log('\nThe HelloClubAttendance service has been removed.');
  console.log('It will no longer start automatically with Windows.');
  console.log('\nNote: Application logs and data files have been preserved:');
  console.log('  - events.db');
  console.log('  - activity.log');
  console.log('  - error.log');
  console.log('  - status.json');
  console.log('  - backups/');
  console.log('\nYou can still run the application manually:');
  console.log('  node src/index.js start-service');
  console.log('\nPress any key to exit...');
  console.log('='.repeat(80) + '\n');
});

// Listen for the "alreadyuninstalled" event
svc.on('alreadyuninstalled', function() {
  console.error('\n✗ Service is not installed.');
  console.error('Nothing to uninstall.');
  process.exit(1);
});

// Listen for the "stop" event
svc.on('stop', function() {
  console.log('✓ Service stopped.');
  console.log('Uninstalling service...\n');
});

// Listen for errors
svc.on('error', function(err) {
  console.error('\n✗ Error uninstalling service:', err.message);
  console.error('\nPlease ensure you are running this script as Administrator.');
  console.error('Right-click Command Prompt or PowerShell and select "Run as Administrator"');
  process.exit(1);
});

console.log('\nChecking administrator privileges...');
console.log('Service name: HelloClubAttendance');
console.log('\nUninstalling service...\n');

// Uninstall the service
svc.uninstall();
