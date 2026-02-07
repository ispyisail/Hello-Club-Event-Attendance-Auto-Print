# Hello Club Event Attendance - Installation Guide

This guide explains how to install the Hello Club Event Attendance service and configure automatic tray app startup for all users.

## What Gets Installed

The complete installer will set up:

1. **Windows Service** (`HelloClubEventAttendance`)
   - Runs continuously in the background
   - Automatically starts on Windows boot
   - Restarts automatically if it crashes
   - Processes events and generates PDFs

2. **Tray App Auto-Start**
   - Automatically starts when **any user** logs in
   - Runs in the logged-in user's context
   - Provides system tray interface for monitoring
   - Can be used to test connections, view logs, adjust settings

## Installation Methods

### Method 1: PowerShell (Recommended)

1. **Right-click** `service/install.ps1`
2. Select **"Run with PowerShell"**
3. When prompted, confirm to run with elevated privileges
4. Follow the on-screen prompts
5. Restart Windows to complete setup

**Or from command line (as Administrator):**

```powershell
powershell -ExecutionPolicy Bypass -File service/install.ps1
```

### Method 2: Batch File

1. **Right-click** `service/install.bat`
2. Select **"Run as Administrator"**
3. Follow the on-screen prompts
4. Restart Windows to complete setup

**Or from command prompt (as Administrator):**

```cmd
service\install.bat
```

### Method 3: npm (Command Line)

1. Open Command Prompt **as Administrator**
2. Navigate to project directory
3. Run:
   ```bash
   npm run service:install
   ```

## What Happens During Installation

1. **Privilege Check** - Verifies Administrator rights
2. **Service Installation** - Installs `HelloClubEventAttendance` Windows service
3. **Service Start** - Starts the service immediately
4. **Tray Auto-Start** - Configures Windows registry to start tray app on user login
5. **Verification** - Confirms all components are in place

## Post-Installation

### First Time Setup

After installation:

1. **Restart Windows** to complete setup
2. When you log in, the tray app should automatically appear in the system tray
3. **Right-click** the tray icon to access menu
4. Go to **Settings** and configure:
   - Hello Club API Key
   - SMTP Email settings (if using email mode)
   - Print preferences
5. **Test API Connection** to verify configuration

### Verify Installation

Check that everything installed correctly:

```bash
# View service status
npm run service:status

# View activity logs
cat activity.log

# View error logs
cat error.log
```

Or use Windows Services Manager:

- Press `Windows + R`
- Type `services.msc`
- Look for "HelloClubEventAttendance"

## Auto-Start Behavior

### How It Works

The tray app auto-start is configured in the Windows Registry:

- **Location**: `HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\Run`
- **Name**: `HelloClubTray`
- **Value**: Path to `tray-app.bat` launcher

This registry entry applies to **all users** on the system.

### Each User Login

When **any user** logs in:

1. Windows reads the Run registry key
2. Executes `tray-app.bat`
3. Tray app starts in the logged-in user's context
4. System tray icon appears

### Service vs. Tray App

| Aspect          | Service                | Tray App         |
| --------------- | ---------------------- | ---------------- |
| **Runs as**     | System/Service Account | Logged-in User   |
| **Starts on**   | Windows boot           | User login       |
| **Purpose**     | Background processing  | UI & monitoring  |
| **Visibility**  | None (background)      | System tray icon |
| **User config** | Via tray app settings  | Settings window  |

## Troubleshooting

### Service Won't Install

**Error**: "Access Denied"

- **Solution**: Run installer as Administrator
- Right-click installer and select "Run as Administrator"

**Error**: "Service already installed"

- **Solution**: Uninstall first, then reinstall
  ```bash
  npm run service:uninstall
  npm run service:install
  ```

### Tray App Doesn't Auto-Start

**Issue**: Tray app doesn't appear after login

- **Solution**: Restart Windows (required after first installation)
- Check registry manually: `regedit` → navigate to `HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\Run`
- Look for `HelloClubTray` entry

**Not working for all users?**

- Make sure installation was done with Administrator rights
- Verify `tray-app.bat` file exists in project root
- Check that the path in registry is correct (should point to `tray-app.bat`)

### Service Won't Start

**Check logs**:

```bash
cat activity.log
cat error.log
```

**Common causes**:

- Missing `.env` file - Create it with required settings
- Missing `node_modules` - Run `npm install`
- Permission issues - Reinstall with Administrator privileges

### Tray App Crashes

- Check `error.log` for details
- Ensure all configuration is valid in Settings
- Restart the tray app manually

## Uninstallation

To completely remove the service and auto-start:

```bash
# Uninstall service
npm run service:uninstall

# Remove tray auto-start registry entry
# Option 1: Open regedit and delete the "HelloClubTray" entry
# Option 2: Use this command (in elevated PowerShell):
# reg delete "HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\Run" /v HelloClubTray /f

# Delete tray launcher batch file
del tray-app.bat
```

## Management Commands

After installation, use these commands to manage the service:

```bash
# Check service status
npm run service:status

# View activity log
npm run logs  # if available

# Start service (if stopped)
net start HelloClubEventAttendance

# Stop service
net stop HelloClubEventAttendance

# Restart service
net stop HelloClubEventAttendance && net start HelloClubEventAttendance

# Uninstall service
npm run service:uninstall
```

## Registry Entries

The installer creates/modifies these Windows Registry entries:

### Service Entry

- **Path**: `HKEY_LOCAL_MACHINE\System\CurrentControlSet\Services\HelloClubEventAttendance`
- **Purpose**: Windows service definition
- **Removed by**: `npm run service:uninstall`

### Auto-Start Entry

- **Path**: `HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\Run`
- **Name**: `HelloClubTray`
- **Value**: `C:\...\tray-app.bat`
- **Purpose**: Start tray app on user login
- **Removed by**: Manual deletion or uninstall script

## Support

If you encounter issues:

1. **Check logs**: Review `activity.log` and `error.log`
2. **Run diagnostic**: Open tray app → Right-click icon → View Logs
3. **Test connections**: Tray menu → Test API Connection / Test Email Connection
4. **Review settings**: Tray menu → Settings

## Notes

- Service runs with elevated privileges
- Tray app runs with user privileges (safe mode)
- Both operate independently
- Service can run without tray app visible
- Configuration is shared between service and tray app
- Works with Windows 7, 8, 10, 11, and Server editions
