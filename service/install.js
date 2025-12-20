/**
 * Windows Service Installer
 *
 * This script installs the Hello Club Event Attendance application as a Windows service.
 * The service will:
 * - Start automatically when Windows boots
 * - Restart automatically if it crashes
 * - Run in the background without a console window
 * - Integrate with Windows Service Control Manager
 *
 * IMPORTANT: Must be run with Administrator privileges
 *
 * Usage: node service/install.js
 */

const Service = require('node-windows').Service;
const path = require('path');

// Get the absolute path to the main script
const scriptPath = path.join(__dirname, '..', 'src', 'index.js');

// Create a new service object
const svc = new Service({
  name: 'HelloClubEventAttendance',
  description: 'Automatically fetches and prints Hello Club event attendance lists',
  script: scriptPath,
  scriptOptions: 'start-service',
  nodeOptions: [],
  env: [
    {
      name: 'NODE_ENV',
      value: 'production'
    }
  ],
  workingDirectory: path.join(__dirname, '..'),
  allowServiceLogon: true,
  maxRestarts: 10,
  maxRetries: 5,
  wait: 2,
  grow: 0.5
});

// Listen for the "install" event
svc.on('install', function() {
  console.log('\n✓ Service installed successfully!');
  console.log('  Name: HelloClubEventAttendance');
  console.log('  Status: Installed but not started');
  console.log('\nTo start the service, run:');
  console.log('  net start HelloClubEventAttendance');
  console.log('\nOr use Windows Services Manager (services.msc)');
  console.log('\nThe service will:');
  console.log('  - Start automatically on Windows boot');
  console.log('  - Restart automatically if it crashes');
  console.log('  - Run in the background');
  console.log('\nLogs are located at:');
  console.log('  ' + path.join(__dirname, '..', 'activity.log'));
  console.log('  ' + path.join(__dirname, '..', 'error.log'));

  // Automatically start the service after installation
  svc.start();
});

// Listen for the "start" event
svc.on('start', function() {
  console.log('\n✓ Service started successfully!');
  console.log('\nThe service is now running in the background.');
  console.log('Check activity.log to monitor its status.');
});

// Listen for errors
svc.on('error', function(err) {
  console.error('\n✗ Error installing service:', err);
  console.error('\nMake sure you are running this script as Administrator!');
  console.error('Right-click Command Prompt or PowerShell and select "Run as Administrator"');
  process.exit(1);
});

// Listen for "alreadyinstalled" event
svc.on('alreadyinstalled', function() {
  console.log('\n! Service is already installed.');
  console.log('  To reinstall, first uninstall the service by running:');
  console.log('  node service/uninstall.js');
  process.exit(0);
});

// Check if service already exists
svc.on('invalidinstallation', function() {
  console.log('\n! Invalid installation detected.');
  console.log('  Please uninstall the service first by running:');
  console.log('  node service/uninstall.js');
  process.exit(1);
});

console.log('Installing Hello Club Event Attendance service...');
console.log('Script path:', scriptPath);
console.log('Working directory:', path.join(__dirname, '..'));
console.log('\nThis may take a minute...\n');

// Install the service
svc.install();
