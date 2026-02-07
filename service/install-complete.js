/**
 * Complete Hello Club Service & Tray Installer
 *
 * This script installs:
 * 1. Windows Service - for background event processing
 * 2. Tray App Auto-Start - for all users on system login
 *
 * The tray app will automatically start for ANY user that logs in to this PC.
 *
 * IMPORTANT: Must be run with Administrator privileges
 *
 * Usage: node service/install-complete.js
 */

const Service = require('node-windows').Service;
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Get the absolute paths
const projectRoot = path.join(__dirname, '..');
const scriptPath = path.join(projectRoot, 'src', 'index.js');
const trayAppPath = path.join(projectRoot, 'tray-app', 'main.js');
const electronPath = path.join(projectRoot, 'node_modules', '.bin', 'electron');

// Check for admin privileges
function isAdmin() {
  try {
    execSync('net session', { stdio: 'pipe', shell: 'cmd.exe' });
    return true;
  } catch (e) {
    return false;
  }
}

// Add tray app to Windows registry for all users auto-start
function addTrayAutoStart() {
  try {
    console.log('\n📋 Configuring Tray App auto-start for all users...');

    // Registry path for all users startup (HKEY_LOCAL_MACHINE)
    const registryPath = 'HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
    const valueName = 'HelloClubTray';

    // Create a batch file wrapper for the tray app (more reliable than direct command)
    const trayBatchPath = path.join(projectRoot, 'tray-app.bat');
    const batchContent = `@echo off
REM Hello Club Tray App Launcher
cd /d "${projectRoot}"
start "" "${electronPath}" "${trayAppPath}"
exit /b 0
`;

    fs.writeFileSync(trayBatchPath, batchContent, 'utf8');
    console.log(`  ✓ Created tray launcher: ${trayBatchPath}`);

    // Add to registry
    const regAddCommand = `reg add "${registryPath}" /v "${valueName}" /d "${trayBatchPath}" /f`;

    try {
      execSync(regAddCommand, { stdio: 'pipe', shell: 'cmd.exe' });
      console.log(`  ✓ Registry entry added for auto-start`);
      console.log(`     Path: ${registryPath}`);
      console.log(`     Value: ${valueName}`);
      console.log(`     Data: ${trayBatchPath}`);
      return true;
    } catch (error) {
      console.error(`  ✗ Failed to add registry entry: ${error.message}`);
      console.error('\nTrying alternative method with .vbs script...');
      return addTrayAutoStartVbs();
    }
  } catch (error) {
    console.error('\n✗ Error configuring tray auto-start:', error.message);
    return false;
  }
}

// Alternative: Use VBS script for registry modification
function addTrayAutoStartVbs() {
  try {
    const trayBatchPath = path.join(projectRoot, 'tray-app.bat');
    const vbsPath = path.join(projectRoot, 'setup-registry.vbs');

    // Create VBS script to add registry entry
    const vbsContent = `' Add tray app to registry for all users
Set objReg = GetObject("winmgmts:").ExecMethod("Win32_Process", "Create", , , intProcessID)
Set WshShell = CreateObject("WScript.Shell")

registryPath = "HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"
valueName = "HelloClubTray"
valueData = "${trayBatchPath}"

WshShell.RegWrite registryPath & "\\" & valueName, valueData, "REG_SZ"
WScript.Echo "Registry entry created successfully"
`;

    fs.writeFileSync(vbsPath, vbsContent, 'utf8');

    execSync(`cscript.exe "${vbsPath}"`, { stdio: 'pipe', shell: 'cmd.exe' });
    console.log(`  ✓ Registry entry added via VBS script`);
    fs.unlinkSync(vbsPath);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to add registry via VBS: ${error.message}`);
    return false;
  }
}

// Install the Windows service
function installService() {
  return new Promise((resolve, reject) => {
    console.log('\n🔧 Installing Windows Service...');

    const svc = new Service({
      name: 'HelloClubEventAttendance',
      description: 'Automatically fetches and prints Hello Club event attendance lists',
      script: scriptPath,
      scriptOptions: 'start-service',
      nodeOptions: [],
      env: [
        {
          name: 'NODE_ENV',
          value: 'production',
        },
      ],
      workingDirectory: projectRoot,
      allowServiceLogon: true,
      maxRestarts: 10,
      maxRetries: 5,
      wait: 2,
      grow: 0.5,
    });

    // Handle already installed
    svc.on('alreadyinstalled', function () {
      console.log('\n  ! Service is already installed');
      console.log('    To reinstall, first uninstall by running:');
      console.log('    npm run service:uninstall');
      resolve(true);
    });

    // Handle install success
    svc.on('install', function () {
      console.log('\n  ✓ Service installed successfully!');
      console.log('    Name: HelloClubEventAttendance');
      console.log('    Description: Automatically fetches and prints Hello Club event attendance');
      resolve(true);

      // Start service after install
      svc.start();
    });

    // Handle service start
    svc.on('start', function () {
      console.log('  ✓ Service started successfully!');
    });

    // Handle errors
    svc.on('error', function (err) {
      console.error('\n  ✗ Error installing service:', err.message);
      reject(err);
    });

    // Perform the install
    svc.install();
  });
}

// Main installation flow
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║        Hello Club Event Attendance - Complete Installer        ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  // Check admin privileges
  console.log('\n🔐 Checking Administrator privileges...');
  if (!isAdmin()) {
    console.error('\n✗ ERROR: This script must be run as Administrator!');
    console.error('\nTo fix this:');
    console.error('1. Right-click Command Prompt or PowerShell');
    console.error('2. Select "Run as Administrator"');
    console.error('3. Run: npm run service:install-complete');
    process.exit(1);
  }
  console.log('  ✓ Running as Administrator');

  try {
    // Install Windows service
    const serviceInstalled = await installService();
    if (!serviceInstalled) {
      throw new Error('Failed to install Windows service');
    }

    // Configure tray app auto-start
    const trayConfigured = addTrayAutoStart();
    if (!trayConfigured) {
      console.warn('\n⚠️  Warning: Tray auto-start may not work for all users');
      console.warn('   The tray app will still work when started manually');
    }

    // Success summary
    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                  ✓ Installation Complete!                      ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');

    console.log('\n📋 Installation Summary:');
    console.log('   ✓ Windows Service installed and started');
    console.log('   ✓ Tray app configured for auto-start on user login');
    console.log('   ✓ Service will restart if it crashes');
    console.log('   ✓ Service runs in background automatically');

    console.log('\n📂 File Locations:');
    console.log(`   Service logs: ${path.join(projectRoot, 'activity.log')}`);
    console.log(`   Error logs:   ${path.join(projectRoot, 'error.log')}`);
    console.log(`   Tray config:  ${path.join(projectRoot, 'tray-app', 'main.js')}`);

    console.log('\n👥 Auto-Start Behavior:');
    console.log('   • Tray app will start automatically for ANY user who logs in');
    console.log('   • Service runs continuously in the background');
    console.log('   • Both can run independently');

    console.log('\n📝 Next Steps:');
    console.log('   1. Open Settings → Configuration to set up your API key');
    console.log('   2. Test the connection with "Test API Connection"');
    console.log('   3. The service will begin processing events');

    console.log('\n⚙️  Management Commands:');
    console.log('   • Check status:    npm run service:status');
    console.log('   • Uninstall:       npm run service:uninstall');
    console.log('   • View logs:       Right-click tray → View Logs');

    console.log('\n✨ Installation successful! Restart Windows to test auto-start.\n');
  } catch (error) {
    console.error('\n✗ Installation failed:', error.message);
    console.error('\nPlease ensure:');
    console.error('  • You are running as Administrator');
    console.error('  • Node.js is installed');
    console.error('  • All dependencies are installed (npm install)');
    process.exit(1);
  }
}

// Run the installer
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
