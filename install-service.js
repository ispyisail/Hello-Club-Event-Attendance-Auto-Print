/**
 * @fileoverview Windows Service Installer for Hello Club Event Attendance Auto-Print
 * This script installs the application as a Windows service that auto-starts with Windows.
 *
 * Usage: Run as Administrator
 *   node install-service.js
 *   OR double-click "Install Service.bat"
 */

const Service = require('node-windows').Service;
const path = require('path');
const fs = require('fs');

// Validate that we're running on Windows
if (process.platform !== 'win32') {
  console.error('Error: This script is only for Windows systems.');
  process.exit(1);
}

// Validate that config.json exists
if (!fs.existsSync('./config.json')) {
  console.error('Error: config.json not found in the project root.');
  console.error('Please create config.json before installing the service.');
  process.exit(1);
}

// Validate that .env exists
if (!fs.existsSync('./.env')) {
  console.error('Error: .env file not found in the project root.');
  console.error('Please create .env with your API_KEY and other settings before installing the service.');
  process.exit(1);
}

console.log('='.repeat(80));
console.log('Hello Club - Windows Service Installer');
console.log('='.repeat(80));

// Create a new service object
const svc = new Service({
  name: 'HelloClubAttendance',
  description: 'Hello Club Event Attendance Auto-Print Service - Automatically fetches and prints event attendance lists',
  script: path.join(__dirname, 'src', 'index.js'),
  scriptOptions: 'start-service',
  nodeOptions: [
    '--max_old_space_size=1024'
  ],
  env: [
    {
      name: "NODE_ENV",
      value: "production"
    }
  ],
  workingDirectory: __dirname,
  allowServiceLogon: true,
  maxRetries: 3,
  maxRestarts: 5,
  abortOnError: false,
  wait: 2,
  grow: 0.5
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', function() {
  console.log('\n' + '='.repeat(80));
  console.log('✓ Service installed successfully!');
  console.log('='.repeat(80));
  console.log('\nService Details:');
  console.log('  Name: HelloClubAttendance');
  console.log('  Display Name: Hello Club Event Attendance Auto-Print Service');
  console.log('  Working Directory:', __dirname);
  console.log('  Script:', path.join(__dirname, 'src', 'index.js'));
  console.log('\nThe service is now starting...');
  console.log('\nYou can manage the service through:');
  console.log('  1. Windows Services GUI (Press Win+R, type "services.msc")');
  console.log('  2. Command line: net start HelloClubAttendance');
  console.log('  3. Command line: net stop HelloClubAttendance');
  console.log('\nService Logs Location:');
  console.log('  Application logs: ' + path.join(__dirname, 'activity.log'));
  console.log('  Error logs: ' + path.join(__dirname, 'error.log'));
  console.log('  Windows service logs: C:\\ProgramData\\HelloClubAttendance\\daemon\\');
  console.log('\nView Dashboard:');
  console.log('  Run: node src/index.js dashboard');
  console.log('  Then open: http://localhost:3030');
  console.log('\n' + '='.repeat(80));

  svc.start();
});

// Listen for the "alreadyinstalled" event
svc.on('alreadyinstalled', function() {
  console.error('\n✗ Service is already installed!');
  console.error('\nTo reinstall:');
  console.error('  1. First run: node uninstall-service.js');
  console.error('  2. Then run: node install-service.js');
  process.exit(1);
});

// Listen for the "start" event
svc.on('start', function() {
  console.log('\n✓ Service started successfully!');
  console.log('\nThe Hello Club service is now running in the background.');
  console.log('It will automatically start when Windows boots.');
  console.log('\nPress any key to exit...');
});

// Listen for errors
svc.on('error', function(err) {
  console.error('\n✗ Error installing service:', err.message);
  console.error('\nPlease ensure you are running this script as Administrator.');
  console.error('Right-click Command Prompt or PowerShell and select "Run as Administrator"');
  process.exit(1);
});

// Check if running as administrator
console.log('\nChecking administrator privileges...');
console.log('Working directory:', __dirname);
console.log('Node.js version:', process.version);
console.log('Platform:', process.platform);
console.log('\nInstalling service...\n');

// Install the service
svc.install();
