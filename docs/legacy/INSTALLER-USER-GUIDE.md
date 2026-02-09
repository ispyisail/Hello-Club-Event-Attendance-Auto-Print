# Hello Club Event Attendance - Installation Guide

## For End Users

This guide walks you through installing the Hello Club Event Attendance application on your Windows computer.

## Before You Begin

### Requirements

✓ **Windows 10 or later**
✓ **Administrator privileges** (Only if installing Windows service - optional)
✓ **500 MB free disk space**
✓ **Internet connection** (for downloading dependencies)
✓ **Node.js 14.x or later** - [Download here](https://nodejs.org/)

### What You'll Need

- Your **Hello Club API key** (get this from your Hello Club account)
- **Printer email address** (if using email printing)
- **SMTP credentials** (if using Gmail or other email service)

## Installation Steps

### Step 1: Download the Installer

1. Download the installer file:

   ```
   HelloClubEventAttendance-Setup-1.1.0.exe
   ```

2. Save it to your Downloads folder

3. File size: Approximately 150 MB

### Step 2: Run the Installer

1. **Locate the downloaded file** in your Downloads folder

2. **Double-click the installer to run it**
   - **No administrator rights needed** for standard installation
   - Administrator rights only required if you want to install the Windows service (optional)

3. If prompted by Windows Security:
   - Click "More info"
   - Click "Run anyway"

### Step 3: Welcome Screen

![Installation Wizard](images/welcome.png)

1. Read the welcome message

2. Click **"Next"** to continue

### Step 4: Choose Install Location

![Install Location](images/location.png)

1. **Default location:** `%LOCALAPPDATA%\Hello Club Event Attendance\`
   - Example: `C:\Users\YourName\AppData\Local\Hello Club Event Attendance\`
   - This is a user-level folder that doesn't require administrator rights
   - Each user gets their own installation

2. **To change:** Click "Browse" and select a different folder
   - If you select a folder requiring admin rights (like Program Files), you'll need to run the installer as Administrator

3. Click **"Next"**

### Step 5: Select Installation Options

![Installation Options](images/options.png)

Choose what you want:

- ✓ **Start tray monitor on Windows startup** (Recommended)
  - Tray app will launch automatically when you log in

- ☐ **Install and start Windows service** (Optional, requires Administrator)
  - Service will run in the background automatically
  - **Unchecked by default** - you can use the tray monitor without the service
  - If checked, you'll need administrator privileges

- ☐ **Create desktop icon** (Optional)
  - Adds shortcut to your desktop

4. Click **"Next"**

### Step 6: Enter API Configuration

![API Configuration](images/api-config.png)

**Required:**

- **Hello Club API Key:** Enter your API key from Hello Club

**Optional (for email printing):**

- **Printer Email Address:** Your printer's email address
  - Example: `myprinter@print.epsonconnect.com`

Click **"Next"**

### Step 7: Email Configuration (Optional)

![Email Configuration](images/email-config.png)

If you entered a printer email, configure SMTP:

**For Gmail:**

- **SMTP Username:** your.email@gmail.com
- **SMTP Password:** Your app-specific password\*
- **SMTP Host:** smtp.gmail.com
- **SMTP Port:** 587

**For other providers:**

- Check your email provider's SMTP settings

\*Gmail requires an "App Password" - [Learn how to create one](https://support.google.com/accounts/answer/185833)

Click **"Next"**

### Step 8: Ready to Install

![Ready to Install](images/ready.png)

Review your selections:

- Install location
- Selected options
- Configuration entered

Click **"Install"** to begin installation

### Step 9: Installation Progress

![Installing](images/progress.png)

The installer will:

1. **Copy files** (~30 seconds)
2. **Install dependencies** (3-5 minutes)
   - Downloads Node.js packages
   - Requires internet connection
3. **Configure service** (~30 seconds)
4. **Start service** (~10 seconds)

**Total time:** 5-7 minutes

**Note:** The "Installing dependencies" step may appear to hang - this is normal. Please be patient.

### Step 10: Configuration Complete

![Configuration](images/config.png)

After installation:

1. A configuration wizard may open

2. **If you already entered configuration:**
   - Click "No" to skip
   - Configuration is already saved

3. **To change configuration:**
   - Click "Yes" to reconfigure

### Step 11: Installation Complete!

![Complete](images/complete.png)

Success! The application is now installed.

**Options:**

- ✓ **Launch Tray Monitor** (Recommended)
  - Starts the system tray app immediately

Click **"Finish"**

## After Installation

### Verify Installation

1. **Check the system tray** (bottom-right, near clock)
   - Look for the Hello Club icon
   - Should be **green** if service is running

2. **Right-click the icon**
   - See status and menu options

3. **Click "View Logs"**
   - Opens log viewer window
   - Check for any errors

### Start Menu Shortcuts

Press the Windows key and type "Hello Club" to see:

- **Tray Monitor** - Launch the system tray app
- **View Logs** - View activity logs
- **Service Status** - Check service status
- **Open Project Folder** - Browse installation files

### First Run Checklist

- [ ] Tray icon appears in system tray
- [ ] Icon is green (service running)
- [ ] Open log viewer - no errors
- [ ] Check activity log shows "Service started"
- [ ] Verify configuration in `config.json` (optional)

## Testing the Application

### 1. Check Service Status

**Method A: Tray App**

1. Right-click tray icon
2. Click "Check Status Now"
3. Should show "Service is running"

**Method B: Command Line**

1. Open Start Menu → Type "Service Status"
2. Click "Hello Club Event Attendance - Service Status"
3. Review the output

### 2. View Logs

1. Right-click tray icon
2. Click "View Logs"
3. Check **Activity Log** tab:
   - Should see "Service started successfully"
   - Should see "Scheduler loop finished"
4. Check **Error Log** tab:
   - Should be empty or show "No errors logged"

### 3. Verify Service in Windows

1. Press `Win + R`
2. Type `services.msc` and press Enter
3. Find "HelloClubEventAttendance"
4. Status should be "Running"
5. Startup Type should be "Automatic"

## Common Installation Issues

### Issue: "Node.js not found"

**Problem:** Node.js is not installed

**Solution:**

1. Download Node.js from https://nodejs.org/
2. Install Node.js
3. Restart your computer
4. Run the Hello Club installer again

### Issue: "Dependency installation failed"

**Problem:** No internet connection or npm registry issue

**Solution:**

1. Check your internet connection
2. Installation will continue
3. After installation, open Command Prompt:

   ```
   cd "%LOCALAPPDATA%\Hello Club Event Attendance"
   npm install
   ```

   Or if you have a legacy installation in Program Files:

   ```
   cd "C:\Program Files\Hello Club Event Attendance"
   npm install
   ```

### Issue: "Service won't start"

**Problem:** Configuration error or port conflict

**Solution:**

1. Open installation folder:
   - Start Menu → "Open Project Folder"
2. Check `.env` file contains your API key
3. Check `config.json` for errors
4. Try restarting the service:
   - Right-click tray icon → "Restart Service"

### Issue: "Tray icon missing"

**Problem:** Tray app didn't start or icon is hidden

**Solution:**

1. Click the up arrow (^) in system tray
2. Look for Hello Club icon in hidden icons
3. Drag icon to always-visible area
4. Or launch from Start Menu: "Tray Monitor"

### Issue: "Access Denied" during installation

**Problem:** Not running as Administrator

**Solution:**

1. Right-click the installer
2. Select "Run as Administrator"
3. If prompted, click "Yes"

## Configuring the Application

### Changing API Key

1. Open installation folder:
   - Start Menu → "Hello Club Event Attendance" → "Open Project Folder"

2. Edit `.env` file in Notepad:

   ```
   API_KEY=your_new_api_key_here
   ```

3. Save the file

4. Restart the service:
   - Right-click tray icon → "Restart Service"

### Changing Event Categories

1. Open `config.json` in installation folder

2. Edit the `categories` array:

   ```json
   "categories": ["NBA - Junior Events", "NBA - Senior Events"]
   ```

3. Save the file

4. Restart the service

### Changing Service Interval

1. Open `config.json`

2. Change `serviceRunIntervalHours`:

   ```json
   "serviceRunIntervalHours": 2
   ```

   (Default is 1 hour)

3. Save and restart service

## Uninstalling

### Standard Uninstall

1. **Open Settings**
   - Press `Win + I`
   - Or: Control Panel → Programs → Uninstall a program

2. **Find "Hello Club Event Attendance"**

3. **Click "Uninstall"**

4. **Follow the wizard:**
   - Service will be stopped and removed
   - Files will be deleted
   - Shortcuts will be removed

5. **Optionally keep:**
   - Configuration files (`.env`, `config.json`)
   - Database (`events.db`)
   - Log files

### Complete Removal

To remove everything including configuration:

1. Uninstall using standard method above

2. Delete installation folder (if not automatically removed):

   ```
   %LOCALAPPDATA%\Hello Club Event Attendance\
   ```

   Or for legacy installations:

   ```
   C:\Program Files\Hello Club Event Attendance\
   ```

3. Check Startup folder for shortcuts:
   - Press `Win + R`
   - Type `shell:startup`
   - Delete any Hello Club shortcuts

## Getting Help

### Check Logs

Most problems are visible in the logs:

1. Right-click tray icon → "View Logs"
2. Check Error Log tab
3. Look for recent error messages

### Service Status

Check if the service is running:

1. Press `Win + R`
2. Type `services.msc`
3. Find "HelloClubEventAttendance"
4. Check status

### Documentation

See the following files in the installation folder:

- `README.md` - Application overview
- `WINDOWS-SERVICE-SETUP.md` - Service details
- `TRAY-APP-GUIDE.md` - Tray app usage

### Support Resources

- **Service Status:** Start Menu → "Service Status"
- **View Logs:** Start Menu → "View Logs"
- **Project Folder:** Start Menu → "Open Project Folder"

## Advanced Usage

### Running Without Tray App

The service runs independently:

1. Close/quit tray app
2. Service continues running
3. Relaunch tray app anytime from Start Menu

### Running Without Service

Use the tray app with manual execution:

1. Stop the service:

   ```
   net stop HelloClubEventAttendance
   ```

2. Run manually in a console:

   ```
   cd "%LOCALAPPDATA%\Hello Club Event Attendance"
   npm start
   ```

3. Press Ctrl+C to stop

### Command Line Service Control

As Administrator:

**Start:**

```
net start HelloClubEventAttendance
```

**Stop:**

```
net stop HelloClubEventAttendance
```

**Check Status:**

```
sc query HelloClubEventAttendance
```

## Updates

### Installing Updates

When a new version is released:

1. Download the new installer
2. Run the installer (no need to uninstall)
3. Installer will update files automatically
4. Configuration is preserved
5. Database is preserved

## Quick Reference

```
┌─────────────────────────────────────────────────────┐
│         QUICK REFERENCE CARD                        │
├─────────────────────────────────────────────────────┤
│ INSTALLATION:                                       │
│   • Download installer                              │
│   • Run as Administrator                            │
│   • Enter API key when prompted                     │
│   • Wait 5-7 minutes for completion                 │
│                                                     │
│ SYSTEM TRAY:                                        │
│   • Green icon = Running                            │
│   • Red icon = Stopped                              │
│   • Right-click for menu                            │
│   • View Logs = Opens log viewer                    │
│                                                     │
│ CONFIGURATION:                                      │
│   • API Key: .env file                              │
│   • Settings: config.json                           │
│   • Both in installation folder                     │
│                                                     │
│ GETTING HELP:                                       │
│   • Check Activity Log for status                   │
│   • Check Error Log for problems                    │
│   • See Start Menu shortcuts                        │
└─────────────────────────────────────────────────────┘
```

## Congratulations!

You've successfully installed Hello Club Event Attendance!

The application will now:

- ✓ Monitor for upcoming events automatically
- ✓ Generate and print attendee lists
- ✓ Run in the background 24/7
- ✓ Start automatically on Windows boot

**Enjoy your automated event management!**
