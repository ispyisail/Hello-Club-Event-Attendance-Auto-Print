# Building the Installer

This guide explains how to build the Windows installer for Hello Club Event Attendance.

## Quick Start

### Option 1: Using npm (Recommended)

```bash
npm run build:installer
```

This will:
- ✅ Run all tests
- ✅ Sync version from package.json
- ✅ Compile installer with Inno Setup
- ✅ Verify the output

### Option 2: Using the batch file (Windows)

Double-click `build-installer.bat` or run:

```cmd
build-installer.bat
```

### Option 3: Skip tests (faster, not recommended)

```bash
npm run build:installer:skip-tests
```

## Prerequisites

### Required Software

1. **Node.js 16+**
   - Download: https://nodejs.org/

2. **Inno Setup 6.x**
   - Download: https://jrsoftware.org/isdl.php
   - Install to default location: `C:\Program Files (x86)\Inno Setup 6\`

3. **Git** (for version tagging)
   - Download: https://git-scm.com/

### Install Dependencies

```bash
npm install
```

## Build Process

The automated build script (`scripts/build-installer.js`) performs these steps:

### Step 1: Pre-flight Checks
- Verifies `package.json` exists
- Verifies `installer/setup.iss` exists
- Creates `dist/` directory if needed

### Step 2: Locate Inno Setup
- Searches common installation paths
- Exits with error if not found

### Step 3: Read Version
- Reads version from `package.json`
- Example: `1.0.0`

### Step 4: Update setup.iss
- Updates `#define MyAppVersion` line
- Ensures installer version matches package version

### Step 5: Run Tests
- Executes full test suite
- Ensures code quality before building
- Can be skipped with `--skip-tests` flag

### Step 6: Compile Installer
- Runs Inno Setup compiler
- Compiles `installer/setup.iss`
- Outputs to `dist/HelloClubEventAttendance-Setup-{version}.exe`

### Step 7: Verify Output
- Checks file exists
- Verifies file size (warns if < 100KB)
- Reports final file size

## Output

The installer will be created at:

```
dist/HelloClubEventAttendance-Setup-1.0.0.exe
```

File size: Typically 150-200 MB (includes Node.js dependencies)

## Automated Builds (GitHub Actions)

### Trigger Builds Automatically

The installer is built automatically on GitHub Actions when you:

1. **Push a version tag:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Use npm version commands:**
   ```bash
   npm version patch  # 1.0.0 → 1.0.1
   npm version minor  # 1.0.0 → 1.1.0
   npm version major  # 1.0.0 → 2.0.0
   ```

3. **Manual trigger:**
   - Go to GitHub Actions tab
   - Select "Build Installer" workflow
   - Click "Run workflow"

### GitHub Release

When you push a tag, GitHub Actions will:
1. Build the installer
2. Run all tests
3. Create a GitHub Release
4. Attach the installer to the release

## Version Management

### Updating the Version

1. **Update package.json version:**
   ```bash
   npm version patch  # or minor, or major
   ```

2. **Build installer:**
   ```bash
   npm run build:installer
   ```

The version in `setup.iss` will be automatically updated to match `package.json`.

### Version Rules

- Follow [Semantic Versioning](https://semver.org/)
- Format: `MAJOR.MINOR.PATCH`
- Example: `1.2.3`
  - `1` = Major version (breaking changes)
  - `2` = Minor version (new features)
  - `3` = Patch version (bug fixes)

## Troubleshooting

### "Inno Setup not found"

**Problem:** The build script can't find Inno Setup compiler.

**Solution:**
1. Install Inno Setup 6.x from https://jrsoftware.org/isdl.php
2. Use default installation path
3. If installed elsewhere, add to PATH or update `ISCC_PATHS` in `scripts/build-installer.js`

### "Tests failed"

**Problem:** Test suite failed, preventing build.

**Solution:**
1. Fix failing tests first (recommended)
2. Or skip tests: `npm run build:installer:skip-tests` (not recommended)

### "Installer too small"

**Problem:** Output file is < 100KB.

**Cause:** Build likely failed but didn't error.

**Solution:**
1. Check Inno Setup output for errors
2. Verify all files are included in `[Files]` section
3. Check `installer/setup.iss` for syntax errors

### "Permission denied"

**Problem:** Can't write to `dist/` folder.

**Solution:**
1. Run Command Prompt as Administrator
2. Check folder permissions
3. Close any programs using files in `dist/`

## Manual Build (Advanced)

If you need to build manually without the script:

1. **Update version in setup.iss:**
   ```iss
   #define MyAppVersion "1.0.0"
   ```

2. **Open Inno Setup Compiler**

3. **File → Open:** Select `installer/setup.iss`

4. **Build → Compile** (or press F9)

5. **Check output:** `dist/HelloClubEventAttendance-Setup-1.0.0.exe`

## Testing the Installer

Before distributing:

1. **Test on clean Windows VM:**
   - Windows 10 or 11
   - No Node.js installed
   - No previous installation

2. **Verify installation:**
   - Installer runs without errors
   - Dependencies install correctly
   - Service installs and starts
   - Tray app launches
   - Settings can be configured

3. **Test uninstallation:**
   - Uninstaller runs cleanly
   - Service is stopped and removed
   - Files are removed
   - No registry errors

## Distribution

### File Naming

Installers follow this pattern:
```
HelloClubEventAttendance-Setup-{version}.exe
```

Examples:
- `HelloClubEventAttendance-Setup-1.0.0.exe`
- `HelloClubEventAttendance-Setup-1.2.3.exe`

### Checksums

Generate checksums for distribution:

```bash
# SHA256
certutil -hashfile dist/HelloClubEventAttendance-Setup-1.0.0.exe SHA256

# MD5 (legacy)
certutil -hashfile dist/HelloClubEventAttendance-Setup-1.0.0.exe MD5
```

### Code Signing (Optional)

For production releases, consider code signing:

1. Obtain a code signing certificate
2. Use `signtool.exe` to sign the installer
3. Prevents "Unknown Publisher" warnings

## CI/CD Integration

### GitHub Actions Workflow

See `.github/workflows/build-installer.yml` for the automated build configuration.

### Local CI Testing

Test the GitHub Actions workflow locally with [act](https://github.com/nektos/act):

```bash
# Install act
choco install act-cli

# Run workflow locally
act -j build-installer
```

## Best Practices

1. ✅ **Always run tests** before building for release
2. ✅ **Test installer** on clean VM before distributing
3. ✅ **Version consistently** - keep package.json as source of truth
4. ✅ **Tag releases** in git for traceability
5. ✅ **Generate checksums** for distributed installers
6. ✅ **Document changes** in CHANGELOG.md
7. ✅ **Create GitHub releases** with release notes

## Related Documentation

- [Installer User Guide](INSTALLER-USER-GUIDE.md) - End-user installation instructions
- [Release Process](../RELEASE-QUICK-REF.md) - Complete release workflow
- [Contributing](../DEVELOPMENT.md) - Development guidelines
