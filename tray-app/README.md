# System Tray Application

A lightweight Electron-based system tray application for monitoring and controlling the Hello Club Event Attendance Windows service.

## Features

### Visual Status Indication
- **Green Icon** - Service running normally
- **Yellow Icon** - Service status unknown or not installed
- **Red Icon** - Service stopped or errors detected

### Context Menu
Right-click the tray icon to access:
- **View Logs** - Opens detailed log viewer window
- **Check Status Now** - Immediately checks service status
- **Start Service** - Starts the stopped service
- **Stop Service** - Stops the running service
- **Restart Service** - Restarts the service
- **Open Services Manager** - Opens Windows services.msc
- **Open Project Folder** - Opens project directory in Explorer
- **Quit** - Exits the tray application

### Log Viewer Window
Professional log viewer with:
- **Real-time Updates** - Refreshes every 5 seconds
- **Tabbed Interface** - Separate tabs for Activity and Error logs
- **Syntax Highlighting** - Color-coded log levels (info, error, warn)
- **Service Controls** - Start, stop, restart buttons
- **Auto-scroll** - Automatically scrolls to newest entries
- **Search & Filter** - (future enhancement)

### Desktop Notifications
Automatic notifications for:
- Service status changes
- Events processed successfully
- Service start/stop actions
- Error conditions

### Real-time Monitoring
- Status check every 10 seconds
- Log monitoring every 30 seconds
- Automatic icon updates
- Error detection in recent logs (5-minute window)

## Installation & Usage

### Quick Start

1. **Launch the Tray App:**
   ```bash
   npm run tray
   ```

2. **Look for the icon in your system tray** (bottom-right of taskbar, near clock)

3. **Right-click the icon** to see the menu

4. **Click "View Logs"** to open the log viewer

### Running on Windows Startup

To make the tray app start automatically when Windows boots:

**Option 1: Startup Folder (Recommended)**

1. Build the portable executable:
   ```bash
   npm run tray:build
   ```

2. Find the built file in `dist/` folder

3. Create a shortcut to the .exe

4. Press `Win + R`, type `shell:startup`, press Enter

5. Copy the shortcut to the Startup folder

**Option 2: Manual Shortcut**

1. Create a shortcut with target:
   ```
   "C:\Program Files\nodejs\node.exe" "C:\Projects\Hello-Club-Event-Attendance-Auto-Print\tray-app\main.js"
   ```

2. Place in Startup folder (see Option 1, step 4)

**Option 3: Task Scheduler**

1. Open Task Scheduler (`taskschd.msc`)
2. Create Basic Task
3. Trigger: At log on
4. Action: Start a program
5. Program: Path to npm.cmd
6. Arguments: `run tray`
7. Start in: Project root directory

## Building Standalone Executable

Create a portable .exe file that doesn't require Node.js:

```bash
npm run tray:build
```

The executable will be created in the `dist/` folder.

**Benefits:**
- No Node.js required on target machine
- Single-file portable application
- Can be distributed to other computers
- Professional installer (future enhancement)

## Architecture

### Main Process (`main.js`)
- Creates system tray icon
- Manages context menu
- Checks service status via `sc query`
- Controls service via `net start/stop`
- Monitors log files
- Sends notifications

### Renderer Process (`log-viewer.html`)
- Displays logs in browser window
- Provides service control UI
- Auto-refreshes every 5 seconds
- Communicates with main process via IPC

### Icon Assets (`icons/`)
- `icon-green.png` - Service running
- `icon-yellow.png` - Unknown/warning
- `icon-red.png` - Service stopped/error

## IPC Communication

The app uses Electron's IPC (Inter-Process Communication) for the log viewer:

**From Renderer → Main:**
- `get-activity-log` - Request activity log entries
- `get-error-log` - Request error log entries
- `get-service-status` - Get current service status
- `start-service` - Start the service
- `stop-service` - Stop the service
- `restart-service` - Restart the service

**From Main → Renderer:**
- `status-update` - Service status changed

## Customization

### Change Status Check Interval

Edit `main.js`:
```javascript
// Line ~273
statusCheckInterval = setInterval(updateTrayStatus, 10000); // Change 10000 to desired ms
```

### Change Log Refresh Rate

Edit `log-viewer.html`:
```javascript
// Near end of file
refreshInterval = setInterval(loadLogs, 5000); // Change 5000 to desired ms
```

### Change Event Check Frequency

Edit `main.js`:
```javascript
// Line ~276
logWatchInterval = setInterval(watchForProcessedEvents, 30000); // Change 30000 to desired ms
```

### Custom Icons

Replace the icon files in `tray-app/icons/`:
- Format: PNG
- Size: 16x16 pixels (recommended for tray)
- Names: Must be `icon-green.png`, `icon-red.png`, `icon-yellow.png`

To regenerate default icons:
```bash
node tray-app/create-icons.js
```

## Troubleshooting

### Tray Icon Not Appearing

**Cause:** App may have crashed on startup

**Solution:**
1. Run in console to see errors:
   ```bash
   npm run tray
   ```
2. Check for error messages
3. Ensure service scripts are in place

### "Service Not Installed" Message

**Cause:** Windows service not installed yet

**Solution:**
1. Install the service first:
   ```bash
   npm run service:install
   ```
2. Restart tray app

### Log Viewer Shows Empty/Old Logs

**Cause:** Log files don't exist or service hasn't run

**Solution:**
1. Start the service:
   ```bash
   net start HelloClubEventAttendance
   ```
2. Wait a few moments for logs to generate
3. Click "Refresh" in log viewer

### Service Control Buttons Don't Work

**Cause:** Insufficient permissions

**Solution:**
- Service control requires Administrator privileges
- Right-click tray app and "Run as Administrator"
- Or use Windows Services Manager instead

### Multiple Tray Icons Appear

**Cause:** App launched multiple times

**Solution:**
- The app prevents multiple instances
- If you see multiple icons, kill all Electron processes:
  ```bash
  taskkill /IM electron.exe /F
  ```
- Restart the app

## Development

### Project Structure
```
tray-app/
├── main.js              # Main Electron process
├── log-viewer.html      # Log viewer window UI
├── create-icons.js      # Icon generator script
├── icons/               # Tray icon assets
│   ├── icon-green.png
│   ├── icon-red.png
│   └── icon-yellow.png
└── README.md           # This file
```

### Running in Development Mode

```bash
npm run tray
```

Console logs will show status checks and actions.

### Debugging

Enable DevTools in the log viewer by adding to `main.js`:
```javascript
logWindow.webContents.openDevTools();
```

## Keyboard Shortcuts

In the Log Viewer window:
- `Ctrl + R` - Refresh logs
- `Ctrl + W` - Close window
- `F5` - Refresh logs
- `F11` - Toggle fullscreen

## Future Enhancements

Planned features:
- [ ] Log search and filtering
- [ ] Export logs to file
- [ ] Email alerts for errors
- [ ] Custom notification settings
- [ ] Service configuration editor
- [ ] Event statistics dashboard
- [ ] Mini floating widget option
- [ ] Dark/Light theme toggle

## Performance

The tray app is designed to be lightweight:
- **Memory usage:** ~50-100 MB (Electron baseline)
- **CPU usage:** <1% when idle
- **Status checks:** Every 10 seconds
- **Log monitoring:** Every 30 seconds
- **Log refresh (window open):** Every 5 seconds

## Security Notes

The tray app requires certain permissions:
- **File system access** - To read log files
- **Process execution** - To run `sc query` and `net start/stop`
- **Administrator privileges** - Required for service control commands

**Best practices:**
- Only distribute to trusted users
- Review code before building executables
- Keep the app updated
- Don't expose sensitive data in logs

## Support

If the tray app doesn't work:
1. Check that the service is installed
2. Verify log files exist in project root
3. Run `npm run service:status` to check service
4. Check Windows Task Manager for Electron processes
5. Review console output when running `npm run tray`

## License

Same as the main project (MIT)
