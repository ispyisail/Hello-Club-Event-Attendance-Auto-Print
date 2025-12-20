# System Tray Application - User Guide

## Overview

The Hello Club System Tray Application provides an easy-to-use interface for monitoring and controlling your event attendance service. It sits quietly in your Windows system tray (near the clock) and gives you instant visibility into the service status.

## What You Get

### At-a-Glance Status
The tray icon changes color to show service status:

| Icon Color | Meaning |
|------------|---------|
| 🟢 **Green** | Service is running normally |
| 🟡 **Yellow** | Service status unknown or not installed |
| 🔴 **Red** | Service is stopped or has errors |

### Quick Access Menu
Right-click the tray icon to see:
- Current service status
- View logs button
- Start/Stop/Restart controls
- Quick links to Services Manager and project folder

### Professional Log Viewer
Double-click or select "View Logs" to see:
- **Activity Log** - Everything the service is doing
- **Error Log** - Problems that need attention
- **Real-time updates** - Refreshes automatically
- **Service controls** - Start, stop, restart buttons

### Smart Notifications
Get desktop notifications when:
- Events are processed successfully
- Service starts or stops
- Errors are detected

## Getting Started

### Step 1: Install the Service First

Before using the tray app, install the Windows service:

```bash
# Run PowerShell as Administrator
npm run service:install
```

Wait for the confirmation message.

### Step 2: Launch the Tray App

```bash
npm run tray
```

The tray icon will appear in your system tray (bottom-right, near the clock).

**Tip:** You may need to click the up arrow (^) in the system tray to see hidden icons.

### Step 3: Check the Status

Right-click the tray icon. You should see:
- "Status: Running ✓" if the service is working
- A green icon indicating healthy status

## Daily Usage

### Viewing Logs

**Method 1: Context Menu**
1. Right-click the tray icon
2. Click "View Logs"

**Method 2: Double-click** (if configured)
- Double-click the tray icon

The log viewer window opens with:
- **Activity Log** tab - All service activity
- **Error Log** tab - Only errors and warnings

### Understanding the Logs

**Activity Log Format:**
```
2025-12-19 20:42:36 info: Service started successfully
2025-12-19 20:42:37 info: Found 3 pending events to schedule
2025-12-19 21:00:00 info: Service heartbeat: Running normally. 3 event(s) scheduled
```

**What to look for:**
- ✓ "Service heartbeat" every 15 minutes = service is alive
- ✓ "marked as processed" = event was handled successfully
- ⚠ "No events found" = nothing to process (normal)
- ✗ "Error" or "Failed" = problem that needs attention

### Controlling the Service

**Starting a Stopped Service:**
1. Right-click tray icon
2. Click "Start Service"
3. Wait for notification
4. Icon turns green

**Stopping the Service:**
1. Right-click tray icon
2. Click "Stop Service"
3. Wait for notification
4. Icon turns red

**Restarting (after config changes):**
1. Right-click tray icon
2. Click "Restart Service"
3. Wait for notification
4. Icon briefly turns red, then green

### Checking Service Status

**Quick Check:**
- Look at tray icon color
- Green = good, Red = stopped, Yellow = check needed

**Detailed Check:**
1. Right-click tray icon
2. Click "Check Status Now"
3. Get instant notification with status

**Full Details:**
1. Click "View Logs"
2. Look at top-right status badge
3. Check recent log entries

## Setting Up Auto-Start

Make the tray app start automatically when Windows boots.

### Option 1: Startup Folder (Easiest)

1. **Build the executable:**
   ```bash
   npm run tray:build
   ```

2. **Find the built file:**
   - Look in `dist/` folder
   - File named something like "Hello Club Service Monitor.exe"

3. **Create a shortcut:**
   - Right-click the .exe file
   - Click "Create shortcut"

4. **Add to Startup:**
   - Press `Win + R`
   - Type: `shell:startup`
   - Press Enter
   - Copy your shortcut to this folder

5. **Test it:**
   - Restart Windows
   - Check system tray for the icon

### Option 2: Task Scheduler (Advanced)

For more control over when/how the app starts:

1. Press `Win + R`, type `taskschd.msc`, press Enter

2. Click "Create Basic Task"

3. **Name:** "Hello Club Tray Monitor"

4. **Trigger:** "When I log on"

5. **Action:** "Start a program"

6. **Program/script:**
   ```
   C:\Program Files\nodejs\node.exe
   ```

7. **Arguments:**
   ```
   run tray
   ```

8. **Start in:**
   ```
   C:\Projects\Hello-Club-Event-Attendance-Auto-Print
   ```

9. Click "Finish"

10. Test by logging off and back on

## Common Scenarios

### Scenario 1: Service Won't Start

**Symptom:** Red icon, "Start Service" button doesn't work

**Check:**
1. Click "View Logs"
2. Look at Error Log tab
3. Common issues:
   - Missing API key in .env file
   - Invalid config.json format
   - Port already in use

**Fix:**
1. Click "Open Project Folder"
2. Fix the configuration issue
3. Click "Restart Service"

### Scenario 2: No Events Being Processed

**Symptom:** Service running (green), but no events in logs

**Check:**
1. View Activity Log
2. Look for "No upcoming events" message

**Reasons:**
- No events scheduled in the next 24 hours (normal)
- Category filter too restrictive (check config.json)
- API issues (check Error Log)

**Verify:**
1. Log in to Hello Club website
2. Check if events are actually scheduled
3. Verify event categories match your config

### Scenario 3: Service Keeps Crashing

**Symptom:** Icon alternates between green and red

**Check:**
1. View Error Log
2. Look for repeating errors

**Fix:**
1. Click "Stop Service"
2. Fix the underlying issue (usually config)
3. Click "Start Service"

### Scenario 4: Tray Icon Missing

**Symptom:** Can't find the icon in system tray

**Check:**
1. Click the up arrow (^) in system tray
2. Icon might be hidden

**Fix:**
1. Drag icon to always-visible area
2. Or: Right-click taskbar → Taskbar settings → Select which icons appear

## Tips & Tricks

### Keep Logs Clean

The log viewer's "Clear Display" button only clears the window, not the files. To actually clear old logs:

```bash
# In project directory
del activity.log error.log
```

Then restart the service to create fresh logs.

### Monitor Remotely

If you need to check service status from another computer:
1. Access the project folder via network share
2. Open the log files in a text editor
3. Look for recent "Service heartbeat" messages

### Quick Restart

If you make configuration changes:
1. Right-click tray icon
2. Click "Restart Service"
3. Wait for green icon

No need to uninstall/reinstall the service!

### Troubleshooting with Logs

When reporting issues or debugging:
1. Click "View Logs"
2. Select all log text (Ctrl+A in browser console)
3. Copy and save to a file
4. Share with support or review yourself

## Advanced Features

### Custom Notifications

The app automatically notifies you when events are processed. To adjust the frequency:

Edit `tray-app/main.js`, line ~276:
```javascript
logWatchInterval = setInterval(watchForProcessedEvents, 30000); // 30 seconds
```

Change 30000 to desired milliseconds.

### Change Status Check Rate

Default is every 10 seconds. To adjust:

Edit `tray-app/main.js`, line ~273:
```javascript
statusCheckInterval = setInterval(updateTrayStatus, 10000); // 10 seconds
```

### Custom Icons

Replace files in `tray-app/icons/`:
- Format: PNG, 16x16 pixels
- Names: icon-green.png, icon-red.png, icon-yellow.png

Or regenerate defaults:
```bash
node tray-app/create-icons.js
```

## Keyboard Shortcuts

When log viewer is open:
- `Ctrl + R` or `F5` - Refresh logs
- `Ctrl + W` - Close window

## Limitations

- Service control requires Administrator privileges
- Log viewer shows last 500 lines per log
- Status updates every 10 seconds (not instant)
- Notification limit: Windows may throttle if too many

## Uninstalling

To remove the tray app:

1. **Stop the app:**
   - Right-click tray icon
   - Click "Quit"

2. **Remove from Startup** (if configured):
   - Press `Win + R`, type `shell:startup`
   - Delete the shortcut

3. **Remove files** (optional):
   - Delete `tray-app/` folder

The Windows service runs independently of the tray app. To uninstall the service:
```bash
npm run service:uninstall
```

## Complete Workflow Example

Here's a typical day with the tray app:

**Morning:**
1. Windows boots → Tray app starts automatically
2. Green icon appears → Service is running
3. Notification: "Events Processed: 2 event(s)"

**Mid-day:**
1. Need to update config.json
2. Right-click tray → Click "Stop Service"
3. Edit config.json in project folder
4. Right-click tray → Click "Start Service"
5. Green icon returns

**Evening:**
1. Click "View Logs" to review the day
2. See all events processed successfully
3. No errors in Error Log tab
4. Everything working perfectly

**Night:**
1. Tray app keeps monitoring
2. Service processes any evening events
3. You get notified if something needs attention

## Quick Reference Card

```
┌───────────────────────────────────────────────────┐
│         TRAY APP QUICK REFERENCE                  │
├───────────────────────────────────────────────────┤
│ Launch:          npm run tray                     │
│ Build .exe:      npm run tray:build               │
│                                                   │
│ RIGHT-CLICK MENU:                                 │
│   View Logs      → Open log viewer window        │
│   Check Status   → Instant status notification    │
│   Start Service  → Start stopped service          │
│   Stop Service   → Stop running service           │
│   Restart        → Restart service                │
│                                                   │
│ ICON COLORS:                                      │
│   🟢 Green       → Running normally               │
│   🟡 Yellow      → Unknown/Not installed          │
│   🔴 Red         → Stopped or error               │
│                                                   │
│ LOG VIEWER:                                       │
│   Activity Tab   → All service activity           │
│   Error Tab      → Problems only                  │
│   Refresh        → Update logs now                │
│   Auto-scroll    → Checkbox to follow new logs    │
└───────────────────────────────────────────────────┘
```

## Getting Help

If something isn't working:

1. **Check the icon color** - Red = service stopped
2. **View the logs** - Errors will show in Error Log tab
3. **Check service status** - Run `npm run service:status`
4. **Review documentation** - See tray-app/README.md

## Summary

The tray app gives you complete visibility and control over your Hello Club Event Attendance service. With color-coded status, one-click controls, and comprehensive logs, you'll always know exactly what's happening with your event processing.

**Remember:**
- Green icon = Happy service
- Check logs regularly
- Restart service after config changes
- Set up auto-start for convenience

Enjoy your hands-free event management!
