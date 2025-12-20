# Windows Service Setup Guide

## Overview

This guide walks you through installing the Hello Club Event Attendance application as a native Windows service. Once installed, the application will run automatically in the background without requiring any user interaction.

## Benefits of Running as a Windows Service

✓ **Automatic Startup** - Starts automatically when Windows boots
✓ **Background Execution** - Runs without a visible console window
✓ **Auto-Restart** - Automatically restarts if it crashes
✓ **Service Integration** - Manageable through Windows Services Manager
✓ **System-Level Reliability** - Runs even when no user is logged in
✓ **Event Log Integration** - Errors logged to Windows Event Viewer

## Prerequisites Checklist

Before installing as a service, ensure:

- [ ] Node.js is installed on the system
- [ ] Application dependencies are installed (`npm install`)
- [ ] `.env` file is configured with your API_KEY
- [ ] Configuration file (`config.json`) is set up correctly
- [ ] Application works correctly when run manually (`npm start`)
- [ ] You have **Administrator privileges**

## Step-by-Step Installation

### Step 1: Verify Application Works

Before installing as a service, test that the application runs correctly:

```bash
npm start
```

Let it run for a minute, then press `Ctrl+C` to stop. Check `activity.log` to ensure it's working:

```bash
type activity.log
```

You should see messages like:
- "Configuration validated successfully"
- "Service started successfully"
- "Scheduler loop finished"

### Step 2: Install as Windows Service

**IMPORTANT**: Open PowerShell or Command Prompt **as Administrator**

Right-click PowerShell and select "Run as Administrator"

Then run:

```bash
cd C:\Projects\Hello-Club-Event-Attendance-Auto-Print
npm run service:install
```

The installer will:
1. Create the Windows service
2. Configure auto-start on boot
3. Start the service immediately
4. Display confirmation messages

**Expected Output:**
```
Installing Hello Club Event Attendance service...
Script path: C:\Projects\Hello-Club-Event-Attendance-Auto-Print\src\index.js
Working directory: C:\Projects\Hello-Club-Event-Attendance-Auto-Print

This may take a minute...

✓ Service installed successfully!
  Name: HelloClubEventAttendance
  Status: Installed but not started

✓ Service started successfully!

The service is now running in the background.
Check activity.log to monitor its status.
```

### Step 3: Verify Service is Running

Check the service status:

```bash
npm run service:status
```

This will show:
- Service installation status
- Current running state
- Recent activity logs
- Recent error logs (if any)
- Available management commands

### Step 4: Verify in Windows Services Manager

1. Press `Win + R`
2. Type `services.msc` and press Enter
3. Scroll down to find "HelloClubEventAttendance"
4. Verify:
   - Status: Running
   - Startup Type: Automatic

## Managing the Service

### Check Status
```bash
npm run service:status
```

### Start Service (if stopped)
```bash
net start HelloClubEventAttendance
```

### Stop Service
```bash
net stop HelloClubEventAttendance
```

### Restart Service
```bash
net stop HelloClubEventAttendance && net start HelloClubEventAttendance
```

### Uninstall Service
```bash
# Run as Administrator
npm run service:uninstall
```

## Monitoring the Service

### View Real-Time Logs

**PowerShell:**
```powershell
Get-Content activity.log -Wait -Tail 20
```

**Command Prompt:**
```bash
type activity.log
```

### Heartbeat Monitoring

The service logs a heartbeat every 15 minutes:
```
2025-12-19 20:42:36 info: Service heartbeat: Running normally. 3 event(s) scheduled for processing.
```

If you don't see heartbeat messages, the service may have stopped.

### Windows Event Viewer

Advanced monitoring through Event Viewer:

1. Press `Win + R`, type `eventvwr.msc`
2. Navigate to: Windows Logs → Application
3. Filter by source: "HelloClubEventAttendance"

## Troubleshooting

### Service Won't Install

**Error: "Access Denied"**
- **Cause**: Not running as Administrator
- **Solution**: Right-click PowerShell/CMD and select "Run as Administrator"

**Error: "Service already installed"**
- **Cause**: Service is already installed
- **Solution**: First uninstall with `npm run service:uninstall`, then reinstall

### Service Won't Start

**Check Event Logs:**
```bash
npm run service:status
```

**Common Issues:**

1. **Missing API Key**
   - Check `.env` file exists and contains `API_KEY=your_key_here`
   - Error log will show: "Missing required environment variables: API_KEY"

2. **Invalid Configuration**
   - Check `config.json` is valid JSON
   - Error log will show: "Invalid configuration in config.json"

3. **Port Already in Use** (if you add HTTP server later)
   - Another process is using the same port
   - Change port in configuration

### Service Keeps Crashing

1. Stop the service:
   ```bash
   net stop HelloClubEventAttendance
   ```

2. Check error log:
   ```bash
   type error.log
   ```

3. Fix the issue (usually configuration or API key)

4. Restart the service:
   ```bash
   net start HelloClubEventAttendance
   ```

### Service Runs But Doesn't Process Events

1. Check `config.json` for correct category filters
2. Verify API key is valid and not expired
3. Check `fetchWindowHours` - events must be within this window
4. Look for API rate limit errors in error.log

## Updating the Application

To update the application code:

1. **Stop the service:**
   ```bash
   net stop HelloClubEventAttendance
   ```

2. **Update your code:**
   ```bash
   git pull
   # or edit files manually
   ```

3. **If dependencies changed:**
   ```bash
   npm install
   ```

4. **Start the service:**
   ```bash
   net start HelloClubEventAttendance
   ```

**Important**: You do NOT need to uninstall/reinstall for code updates!

## Configuration Changes

To change configuration while service is running:

1. Stop the service
2. Edit `config.json` or `.env`
3. Start the service

The service reads configuration on startup, so changes require a restart.

## Service Auto-Restart Behavior

The service automatically restarts if:
- Application crashes (unhandled error)
- Node.js process dies unexpectedly
- System resources become available

**Restart Policy:**
- Initial delay: 2 seconds
- Max attempts: 10 restarts
- Backoff: 0.5x multiplier per retry

After 10 failed restarts, the service stops and requires manual intervention.

## Uninstalling the Service

When you need to remove the service:

1. **Run as Administrator:**
   ```bash
   npm run service:uninstall
   ```

2. **Verify removal:**
   ```bash
   npm run service:status
   ```
   Should show: "SERVICE NOT INSTALLED"

3. **Cleanup (optional):**
   - Delete log files: `del activity.log error.log`
   - Delete database: `del events.db`

## Next Steps

Now that your service is running, consider:

1. **System Tray Application** (Phase 3)
   - Visual status indicator
   - Quick access to logs
   - Service control from tray menu

2. **Installer Package** (Phase 5)
   - MSI installer for easy deployment
   - Automated service setup
   - Desktop shortcuts

3. **Email Alerts** (Optional)
   - Notify you when events are processed
   - Alert on service errors
   - Daily status summary

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│           WINDOWS SERVICE QUICK REFERENCE               │
├─────────────────────────────────────────────────────────┤
│ Install:     npm run service:install                    │
│ Uninstall:   npm run service:uninstall                  │
│ Status:      npm run service:status                     │
│                                                          │
│ Start:       net start HelloClubEventAttendance         │
│ Stop:        net stop HelloClubEventAttendance          │
│ Restart:     net stop HelloClub... && net start ...     │
│                                                          │
│ Logs:        type activity.log                          │
│ Errors:      type error.log                             │
│                                                          │
│ Services:    services.msc                               │
│ Events:      eventvwr.msc                               │
└─────────────────────────────────────────────────────────┘
```

## Support

If you encounter issues:

1. Check `error.log` for error messages
2. Run `npm run service:status` to see current state
3. Review this guide's troubleshooting section
4. Check Windows Event Viewer for system-level errors

---

**Ready to install?** Follow Step 1 above to verify your app works, then proceed to Step 2!
