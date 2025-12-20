# Installer Creation Guide

This directory contains everything needed to create a professional Windows installer for the Hello Club Event Attendance application.

## Prerequisites

### 1. Inno Setup Compiler

Download and install Inno Setup (free):
- **Website:** https://jrsoftware.org/isdl.php
- **Version:** 6.x or later
- **Size:** ~2 MB
- **Install location:** Typically `C:\Program Files (x86)\Inno Setup 6\`

### 2. Node.js (Target Machine)

The installer will check for Node.js on the target machine:
- **Required version:** 14.x or later
- **Download:** https://nodejs.org/
- Users must have Node.js installed before running the installer

## Building the Installer

### Quick Build

1. **Open the script in Inno Setup:**
   ```
   Double-click: installer\setup.iss
   ```

2. **Click "Compile"** in the toolbar (or press Ctrl+F9)

3. **Wait for compilation** (takes ~30 seconds)

4. **Find the installer:**
   ```
   Location: dist\HelloClubEventAttendance-Setup-1.0.0.exe
   Size: ~150 MB (includes all dependencies)
   ```

### Command Line Build

For automation or CI/CD:

```batch
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer\setup.iss
```

## What the Installer Does

### During Installation

1. **Pre-Installation Checks**
   - Checks for Node.js installation
   - Warns if Node.js is not found
   - Verifies administrator privileges

2. **File Installation**
   - Copies application files to `Program Files\Hello Club Event Attendance\`
   - Excludes: node_modules, logs, old database files
   - Includes: source code, configuration, documentation

3. **Configuration Wizard**
   - Prompts for Hello Club API key (required)
   - Prompts for printer email (optional)
   - Prompts for SMTP credentials (optional)
   - Creates `.env` file with user input

4. **Dependency Installation**
   - Runs `npm install --production`
   - Installs only required packages (no dev dependencies)
   - May take 3-5 minutes depending on internet speed

5. **Windows Service Setup** (optional task)
   - Installs service using node-windows
   - Configures auto-start on boot
   - Starts the service immediately

6. **Tray App Setup** (optional task)
   - Creates shortcut in Startup folder
   - Tray app launches automatically on boot

7. **Shortcuts Creation**
   - Start Menu folder with multiple shortcuts
   - Desktop shortcut (optional)
   - Quick access to logs and status

### What Users Get

**Start Menu Shortcuts:**
- **Tray Monitor** - Launch the system tray app
- **View Logs** - Open activity log in Notepad
- **Service Status** - Check service status in console
- **Open Project Folder** - Browse installation directory
- **Uninstall** - Remove the application

**Optional:**
- **Desktop Shortcut** - Quick launch tray monitor
- **Startup Entry** - Auto-start tray app on boot

## Installation Options

Users can customize the installation with these options:

| Option | Default | Description |
|--------|---------|-------------|
| **Create desktop icon** | Unchecked | Adds shortcut to desktop |
| **Start on Windows startup** | Checked | Auto-launch tray monitor |
| **Install and start service** | Checked | Set up Windows service |

## Installer Features

### Smart Configuration

The installer includes a built-in configuration wizard that:
- Collects API credentials during installation
- Validates required fields (API key)
- Creates `.env` file automatically
- Offers to open `config.json` for advanced settings

### Error Handling

- **Node.js Missing:** Warns user but allows installation to continue
- **Dependency Failure:** Shows warning with manual fix instructions
- **Service Installation Fails:** User can manually install later

### Clean Uninstallation

When uninstalling:
1. Stops the Windows service
2. Uninstalls the service
3. Removes application files
4. Cleans up logs and database (optional)
5. Removes shortcuts
6. Preserves configuration (optional)

## Customizing the Installer

### Change Application Info

Edit `setup.iss`, lines 8-12:

```pascal
#define MyAppName "Hello Club Event Attendance"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Your Organization"
#define MyAppURL "https://www.example.com/"
```

### Change Install Location

Edit `setup.iss`, line 22:

```pascal
DefaultDirName={autopf}\{#MyAppName}
```

Options:
- `{autopf}` - Program Files (recommended)
- `{localappdata}` - User's AppData folder
- `{userdocs}` - User's Documents folder

### Modify Installation Tasks

Edit the `[Tasks]` section in `setup.iss`:

```pascal
[Tasks]
Name: "desktopicon"; Description: "Create desktop icon"; Flags: unchecked
Name: "startupicon"; Description: "Start on Windows startup"; Flags: checked
Name: "installservice"; Description: "Install Windows service"; Flags: checked
```

Change `Flags`:
- `checked` - Default enabled
- `unchecked` - Default disabled
- `exclusive` - Radio button (only one in group)

### Add Custom Files

Edit the `[Files]` section:

```pascal
Source: "..\your-file.txt"; DestDir: "{app}"; Flags: ignoreversion
```

### Add Custom Shortcuts

Edit the `[Icons]` section:

```pascal
Name: "{group}\Your Shortcut"; Filename: "{app}\your-program.exe"
```

## Testing the Installer

### Test Checklist

Before distributing:

- [ ] Build installer successfully
- [ ] Test on clean Windows 10/11 VM
- [ ] Verify Node.js check works
- [ ] Complete configuration wizard
- [ ] Confirm service installs and starts
- [ ] Verify tray app launches
- [ ] Check all shortcuts work
- [ ] Test uninstallation
- [ ] Verify clean uninstall (no leftover files)

### Test in Virtual Machine

**Recommended Setup:**
- **OS:** Windows 10 or 11 (clean install)
- **RAM:** 4 GB minimum
- **Disk:** 20 GB
- **Software:** Node.js 14.x or later

**Testing Steps:**

1. **Copy installer to VM**
   ```
   HelloClubEventAttendance-Setup-1.0.0.exe
   ```

2. **Run installer**
   - Right-click → Run as Administrator
   - Follow wizard
   - Enter test API credentials

3. **Verify installation**
   - Check Program Files folder
   - Verify service status: `sc query HelloClubEventAttendance`
   - Launch tray app from Start Menu

4. **Test functionality**
   - Check service logs
   - Verify tray icon appears
   - Test service start/stop

5. **Test uninstallation**
   - Uninstall from Control Panel
   - Verify all files removed
   - Check for leftover shortcuts

## Troubleshooting

### Build Errors

**"Cannot open file setup.iss"**
- **Cause:** Wrong directory
- **Fix:** Navigate to project root, ensure `installer\setup.iss` exists

**"Preprocessor error"**
- **Cause:** Syntax error in .iss file
- **Fix:** Check line numbers in error message, verify Pascal syntax

**"Cannot find file"**
- **Cause:** Referenced file doesn't exist
- **Fix:** Verify all Source paths in [Files] section are correct

### Installation Errors

**"Node.js not found"**
- **Cause:** Node.js not installed or not in PATH
- **Fix:** Install Node.js from https://nodejs.org/

**"npm install failed"**
- **Cause:** No internet connection or npm registry issues
- **Fix:** User can run `npm install` manually after installation

**"Service installation failed"**
- **Cause:** Insufficient permissions or port conflicts
- **Fix:** Run installer as Administrator, check logs

### Runtime Errors

**"Service won't start"**
- **Cause:** Configuration errors
- **Fix:** Edit `.env` file, verify API key

**"Tray app crashes"**
- **Cause:** Missing dependencies or Electron issues
- **Fix:** Reinstall or run `npm install` manually

## Distribution

### File Naming

Use semantic versioning:
```
HelloClubEventAttendance-Setup-1.0.0.exe
HelloClubEventAttendance-Setup-1.0.1.exe
HelloClubEventAttendance-Setup-2.0.0.exe
```

### File Size

Expected installer size:
- **Compressed:** ~150 MB
- **Installed:** ~300 MB (with node_modules)

Breakdown:
- Application code: ~5 MB
- Node modules: ~250 MB
- Electron: ~150 MB
- Other: ~10 MB

### Hosting Options

1. **GitHub Releases** (recommended for open source)
   - Upload to repository releases
   - Free hosting
   - Easy versioning

2. **Cloud Storage**
   - Google Drive
   - Dropbox
   - OneDrive

3. **Own Website**
   - Direct download link
   - Professional appearance

### Download Instructions for Users

Provide clear instructions:

```markdown
## Download

1. Download the latest installer:
   [HelloClubEventAttendance-Setup-1.0.0.exe](download-link)

2. Run the installer (requires Administrator)

3. Follow the setup wizard

4. Enter your API credentials when prompted

5. Wait for installation to complete (3-5 minutes)

6. The tray monitor will launch automatically

## Requirements

- Windows 10 or later
- Node.js 14.x or later
- 500 MB free disk space
- Administrator privileges
```

## Updating the Application

### For Users

When a new version is released:

1. **Download new installer**

2. **Run installer** (no need to uninstall old version)

3. **Installer will:**
   - Stop the service
   - Update files
   - Preserve configuration (.env, config.json)
   - Preserve database (events.db)
   - Restart service

4. **Service continues** with new code

### For Developers

To release an update:

1. **Update version** in `setup.iss`:
   ```pascal
   #define MyAppVersion "1.0.1"
   ```

2. **Update version** in `package.json`:
   ```json
   "version": "1.0.1"
   ```

3. **Rebuild installer**

4. **Test thoroughly**

5. **Distribute**

## Advanced Options

### Silent Installation

For corporate deployment:

```batch
HelloClubEventAttendance-Setup-1.0.0.exe /SILENT
```

Or fully silent:

```batch
HelloClubEventAttendance-Setup-1.0.0.exe /VERYSILENT
```

**Note:** Configuration must be done manually after silent install.

### Custom Install Path

```batch
HelloClubEventAttendance-Setup-1.0.0.exe /DIR="C:\MyCustomPath"
```

### Command Line Options

| Option | Description |
|--------|-------------|
| `/SILENT` | Silent mode with progress bar |
| `/VERYSILENT` | Completely silent |
| `/DIR="path"` | Custom install directory |
| `/TASKS="tasks"` | Specify tasks to run |
| `/NORESTART` | Don't restart after install |
| `/LOG="file"` | Create installation log |

Example with multiple options:

```batch
HelloClubEventAttendance-Setup-1.0.0.exe /SILENT /TASKS="startupicon,installservice" /LOG="install.log"
```

## Security Considerations

### Code Signing (Recommended)

For production release:

1. **Obtain code signing certificate**
   - From: DigiCert, Sectigo, etc.
   - Cost: ~$100-500/year

2. **Sign the installer:**
   ```batch
   signtool sign /f certificate.pfx /p password /t http://timestamp.digicert.com HelloClubEventAttendance-Setup-1.0.0.exe
   ```

3. **Benefits:**
   - No "Unknown Publisher" warnings
   - Users trust signed installers
   - Professional appearance

### Antivirus False Positives

Electron apps sometimes trigger false positives. To mitigate:

1. **Submit to antivirus vendors** for whitelisting
2. **Use VirusTotal** to check detection rates
3. **Sign the installer** (reduces false positives)
4. **Document** any known false positives

## Support

For issues with the installer:

1. Check this README
2. Review Inno Setup documentation: https://jrsoftware.org/ishelp/
3. Check project issues on GitHub
4. Test in clean VM environment

## License

Same as main project (MIT)
