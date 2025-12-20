#!/usr/bin/env node

/**
 * Automated Installer Build Script
 *
 * This script automates the building of the Inno Setup installer with:
 * - Automatic version syncing from package.json
 * - Pre-build validation (tests, linting)
 * - Inno Setup compiler detection
 * - Build verification
 * - Output file validation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${step} ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Paths
const PROJECT_ROOT = path.join(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');
const SETUP_ISS_PATH = path.join(PROJECT_ROOT, 'installer', 'setup.iss');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

// Inno Setup compiler paths (common locations)
const ISCC_PATHS = [
  'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files (x86)\\Inno Setup 5\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 5\\ISCC.exe',
];

/**
 * Step 1: Pre-flight checks
 */
function preflightChecks() {
  logStep('1️⃣', 'Running pre-flight checks...');

  // Check if package.json exists
  if (!fs.existsSync(PACKAGE_JSON_PATH)) {
    logError('package.json not found');
    process.exit(1);
  }
  logSuccess('package.json found');

  // Check if setup.iss exists
  if (!fs.existsSync(SETUP_ISS_PATH)) {
    logError('installer/setup.iss not found');
    process.exit(1);
  }
  logSuccess('setup.iss found');

  // Create dist directory if it doesn't exist
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
    logSuccess('Created dist/ directory');
  }
}

/**
 * Step 2: Find Inno Setup compiler
 */
function findInnoSetupCompiler() {
  logStep('2️⃣', 'Locating Inno Setup compiler...');

  for (const isccPath of ISCC_PATHS) {
    if (fs.existsSync(isccPath)) {
      logSuccess(`Found Inno Setup: ${isccPath}`);
      return isccPath;
    }
  }

  logError('Inno Setup not found!');
  logInfo('Please install Inno Setup from: https://jrsoftware.org/isdl.php');
  logInfo('After installation, run this script again.');
  process.exit(1);
}

/**
 * Step 3: Get version from package.json
 */
function getVersion() {
  logStep('3️⃣', 'Reading version from package.json...');

  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  const version = packageJson.version;

  if (!version) {
    logError('Version not found in package.json');
    process.exit(1);
  }

  logSuccess(`Version: ${version}`);
  return version;
}

/**
 * Step 4: Update setup.iss with current version
 */
function updateSetupVersion(version) {
  logStep('4️⃣', 'Updating setup.iss version...');

  let setupContent = fs.readFileSync(SETUP_ISS_PATH, 'utf8');

  // Update the version line
  const versionRegex = /#define MyAppVersion ".*"/;
  const newVersionLine = `#define MyAppVersion "${version}"`;

  if (versionRegex.test(setupContent)) {
    setupContent = setupContent.replace(versionRegex, newVersionLine);
    fs.writeFileSync(SETUP_ISS_PATH, setupContent, 'utf8');
    logSuccess(`Updated version to ${version} in setup.iss`);
  } else {
    logError('Could not find version line in setup.iss');
    process.exit(1);
  }
}

/**
 * Step 5: Run tests (optional, can be skipped with --skip-tests)
 */
function runTests(skipTests) {
  if (skipTests) {
    logWarning('Skipping tests (--skip-tests flag provided)');
    return;
  }

  logStep('5️⃣', 'Running tests...');

  try {
    execSync('npm test', {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });
    logSuccess('All tests passed');
  } catch (error) {
    logError('Tests failed! Fix tests before building installer.');
    logInfo('Or use --skip-tests to build anyway (not recommended)');
    process.exit(1);
  }
}

/**
 * Step 6: Compile installer with Inno Setup
 */
function compileInstaller(isccPath, version) {
  logStep('6️⃣', 'Compiling installer with Inno Setup...');

  try {
    const command = `"${isccPath}" "${SETUP_ISS_PATH}"`;
    execSync(command, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
    });
    logSuccess('Installer compiled successfully');
  } catch (error) {
    logError('Installer compilation failed');
    process.exit(1);
  }

  // Verify output file exists
  const expectedOutput = path.join(DIST_DIR, `HelloClubEventAttendance-Setup-${version}.exe`);
  if (!fs.existsSync(expectedOutput)) {
    logError(`Expected installer not found: ${expectedOutput}`);
    process.exit(1);
  }

  return expectedOutput;
}

/**
 * Step 7: Verify installer
 */
function verifyInstaller(installerPath) {
  logStep('7️⃣', 'Verifying installer...');

  const stats = fs.statSync(installerPath);
  const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

  logSuccess(`Installer size: ${fileSizeMB} MB`);

  if (stats.size < 100000) {
    logWarning('Installer seems too small - may be incomplete');
  }

  logSuccess(`Installer created: ${path.basename(installerPath)}`);
}

/**
 * Main build process
 */
function main() {
  const args = process.argv.slice(2);
  const skipTests = args.includes('--skip-tests');

  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║   Hello Club Event Attendance - Installer Build Script    ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝', 'cyan');

  try {
    // Step 1: Pre-flight checks
    preflightChecks();

    // Step 2: Find Inno Setup
    const isccPath = findInnoSetupCompiler();

    // Step 3: Get version
    const version = getVersion();

    // Step 4: Update setup.iss
    updateSetupVersion(version);

    // Step 5: Run tests
    runTests(skipTests);

    // Step 6: Compile installer
    const installerPath = compileInstaller(isccPath, version);

    // Step 7: Verify installer
    verifyInstaller(installerPath);

    // Success summary
    log('\n╔════════════════════════════════════════════════════════════╗', 'green');
    log('║                 BUILD COMPLETED SUCCESSFULLY!              ║', 'green');
    log('╚════════════════════════════════════════════════════════════╝', 'green');
    log('', 'green');
    logSuccess(`Installer: dist/${path.basename(installerPath)}`);
    logInfo(`Size: ${(fs.statSync(installerPath).size / 1024 / 1024).toFixed(2)} MB`);
    logInfo(`Version: ${version}`);
    log('');
    logInfo('Next steps:');
    logInfo('  1. Test the installer on a clean Windows machine');
    logInfo('  2. Create a GitHub release and attach the installer');
    logInfo('  3. Update documentation with new version number');
    log('');

  } catch (error) {
    log('\n╔════════════════════════════════════════════════════════════╗', 'red');
    log('║                    BUILD FAILED!                           ║', 'red');
    log('╚════════════════════════════════════════════════════════════╝', 'red');
    logError(error.message);
    process.exit(1);
  }
}

// Run the build
main();
