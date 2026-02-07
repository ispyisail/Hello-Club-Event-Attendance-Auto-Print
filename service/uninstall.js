/**
 * Windows Service & Tray App Uninstaller
 *
 * This script uninstalls:
 * 1. Windows Service (HelloClubEventAttendance)
 * 2. Tray app auto-start registry entry
 * 3. Tray app launcher batch file
 *
 * IMPORTANT: Must be run with Administrator privileges
 *
 * Usage: node service/uninstall.js
 */

const Service = require('node-windows').Service;
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Get paths
const projectRoot = path.join(__dirname, '..');
const scriptPath = path.join(projectRoot, 'src', 'index.js');
const trayBatchPath = path.join(projectRoot, 'tray-app.bat');

// Check for admin privileges
function isAdmin() {
  try {
    execSync('net session', { stdio: 'pipe', shell: 'cmd.exe' });
    return true;
  } catch (e) {
    return false;
  }
}

// Remove tray auto-start registry entry
function removeTrayAutoStart() {
  try {
    const registryPath = 'HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
    const valueName = 'HelloClubTray';

    console.log('  Removing tray auto-start registry entry...');
    execSync(`reg delete "${registryPath}" /v "${valueName}" /f`, {
      stdio: 'pipe',
      shell: 'cmd.exe',
    });
    console.log('    ✓ Registry entry removed');
    return true;
  } catch (error) {
    console.log('    ℹ️  Registry entry not found (already removed or not set)');
    return true;
  }
}

// Remove tray launcher batch file
function removeTrayBatch() {
  try {
    if (fs.existsSync(trayBatchPath)) {
      console.log('  Removing tray app launcher batch file...');
      fs.unlinkSync(trayBatchPath);
      console.log(`    ✓ Removed: ${trayBatchPath}`);
      return true;
    } else {
      console.log('    ℹ️  Batch file not found (already removed)');
      return true;
    }
  } catch (error) {
    console.error(`    ✗ Failed to remove batch file: ${error.message}`);
    return false;
  }
}

// Create service object
const svc = new Service({
  name: 'HelloClubEventAttendance',
  script: scriptPath,
});

// Listen for the "uninstall" event
svc.on('uninstall', function () {
  console.log('\n✓ Windows Service uninstalled successfully!');
  console.log('  The service has been removed from Windows Service Control Manager.');

  // Clean up tray auto-start
  console.log('\nCleaning up tray app configuration...');
  removeTrayAutoStart();
  removeTrayBatch();

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                  ✓ Uninstallation Complete!                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  console.log('\n📋 Uninstall Summary:');
  console.log('   ✓ Windows Service removed');
  console.log('   ✓ Tray auto-start registry entry removed');
  console.log('   ✓ Tray launcher batch file removed');

  console.log('\n📝 Next Steps:');
  console.log('   • Restart Windows to complete the uninstall');
  console.log('   • Tray app will no longer start automatically');

  console.log('\n🔄 To reinstall:');
  console.log('   npm run service:install');
  console.log('   (or run service/install.bat or service/install.ps1)\n');
});

// Listen for errors
svc.on('error', function (err) {
  console.error('\n✗ Error uninstalling service:', err.message);
  console.error('\nMake sure you are running this script as Administrator!');
  console.error('Right-click Command Prompt or PowerShell and select "Run as Administrator"');
  process.exit(1);
});

// Listen for "alreadyuninstalled" event
svc.on('alreadyuninstalled', function () {
  console.log('\n! Service is not installed.');

  // Still clean up tray config even if service wasn't installed
  console.log('\nCleaning up any remaining tray app configuration...');
  removeTrayAutoStart();
  removeTrayBatch();

  console.log('\n✓ Cleanup complete.\n');
  process.exit(0);
});

// Check admin privileges
if (!isAdmin()) {
  console.error('\n✗ ERROR: This script must be run as Administrator!');
  console.error('\nTo fix this:');
  console.error('1. Right-click Command Prompt or PowerShell');
  console.error('2. Select "Run as Administrator"');
  console.error('3. Run: npm run service:uninstall');
  process.exit(1);
}

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║     Hello Club Event Attendance - Uninstaller Started       ║');
console.log('╚════════════════════════════════════════════════════════════════╝');

console.log('\n🔧 Uninstalling...\n');

// Uninstall the service
svc.uninstall();
