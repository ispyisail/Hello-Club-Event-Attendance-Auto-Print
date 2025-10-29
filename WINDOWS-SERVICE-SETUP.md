# Windows Service Setup Guide

This guide shows you how to run Hello Club Event Attendance Auto-Print as a **Windows service** that starts automatically with Windows.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [GUI Installation (Easy Method)](#gui-installation-easy-method)
- [Command Line Installation](#command-line-installation)
- [Managing the Service](#managing-the-service)
- [Viewing Service Status](#viewing-service-status)
- [Troubleshooting](#troubleshooting)
- [Alternative: NSSM (Advanced)](#alternative-nssm-advanced)

---

## Overview

Running as a Windows service provides:
- ✅ **Auto-start with Windows** - No need to manually start the application
- ✅ **Runs in background** - No console window required
- ✅ **Auto-restart on failure** - Service automatically restarts if it crashes
- ✅ **Windows integration** - Manage via Windows Services GUI
- ✅ **Better logging** - Logs to both application files and Windows Event Log

---

## Prerequisites

Before installing as a service:

1. **Node.js installed** (v16 or higher)
2. **Administrator privileges** (required for service installation)
3. **Configuration complete**:
   - ✅ `.env` file created with `API_KEY`
   - ✅ `config.json` configured
4. **Dependencies installed**:
   ```bash
   npm install
   ```

---

## GUI Installation (Easy Method)

### Step 1: Install node-windows

First, install the Windows service dependency:

```bash
npm install
```

This installs `node-windows` which manages Windows services.

### Step 2: Run the Installer

**Option A: Double-Click (Easiest)**
1. Right-click `Install Service.bat`
2. Select **"Run as administrator"**
3. Follow the prompts

**Option B: Command Line**
1. Open Command Prompt or PowerShell **as Administrator**
   - Press `Win + X`
   - Select "Windows PowerShell (Admin)" or "Command Prompt (Admin)"
2. Navigate to the project folder
3. Run:
   ```bash
   node install-service.js
   ```

### Step 3: Verify Installation

The installer will:
- ✅ Create a Windows service named "HelloClubAttendance"
- ✅ Start the service automatically
- ✅ Configure auto-start on Windows boot
- ✅ Display installation confirmation

You should see:
```
✓ Service installed successfully!
✓ Service started successfully!
```

---

## Managing the Service

### View Service in Windows Services GUI

1. Press `Win + R`
2. Type `services.msc`
3. Press Enter
4. Find **"HelloClubAttendance"** in the list

![Windows Services Screenshot](https://via.placeholder.com/600x200?text=Windows+Services+GUI)

### Start/Stop Service (GUI)

**Using Batch Files:**
- Double-click `Start Dashboard.bat` to view web dashboard
- Double-click `View Logs.bat` to check logs
- Double-click `Uninstall Service.bat` (as admin) to remove service

**Using Windows Services:**
1. Open `services.msc`
2. Find "HelloClubAttendance"
3. Right-click → Start/Stop/Restart

**Using Command Line:**
```cmd
# Start service
net start HelloClubAttendance

# Stop service
net stop HelloClubAttendance

# Restart service
net stop HelloClubAttendance && net start HelloClubAttendance
```

---

## Viewing Service Status

### Web Dashboard (Recommended)

1. **Double-click `Start Dashboard.bat`**
   - OR run: `node src/index.js dashboard`
2. Open browser to: http://localhost:3030
3. View real-time status:
   - Service health
   - Event statistics
   - Pending/processed events
   - System checks

The dashboard auto-refreshes every 30 seconds.

### Log Files

**View Logs via Batch File:**
1. Double-click `View Logs.bat`
2. Select which log to view

**Log Files Location:**
- **Application logs**: `activity.log`
- **Error logs**: `error.log`
- **Status file**: `status.json`
- **Windows service logs**: `C:\ProgramData\HelloClubAttendance\daemon\`

**Tail Logs in Real-Time:**
```powershell
Get-Content activity.log -Tail 50 -Wait
```

### Service Status Check

```bash
# Check service status
sc query HelloClubAttendance

# View detailed service config
sc qc HelloClubAttendance
```

---

## Troubleshooting

### Service Won't Install

**Error: "Access Denied"**
- **Solution**: Run as Administrator
  - Right-click batch file or Command Prompt
  - Select "Run as administrator"

**Error: "config.json not found"**
- **Solution**: Create `config.json` in project root
  - Copy from `config.example.json`

**Error: "Node.js not found"**
- **Solution**: Install Node.js from https://nodejs.org/
- Verify with: `node --version`

### Service Won't Start

**Check Event Viewer:**
1. Press `Win + X` → Event Viewer
2. Windows Logs → Application
3. Look for "HelloClubAttendance" errors

**Common Issues:**
1. **Missing .env file**: Create `.env` with `API_KEY`
2. **Port conflict**: Check if port 3030 is in use (dashboard)
3. **Database locked**: Close any running instances first
4. **Invalid config**: Validate `config.json` syntax

**View Service Error Logs:**
```cmd
type C:\ProgramData\HelloClubAttendance\daemon\HelloClubAttendance.err.log
```

### Service Keeps Crashing

1. **Check error.log**:
   ```cmd
   type error.log
   ```

2. **Test manually first**:
   ```bash
   # Stop service
   net stop HelloClubAttendance

   # Run manually to see errors
   node src/index.js start-service
   ```

3. **Check API credentials**: Verify `API_KEY` in `.env`

### Uninstall and Reinstall

If you need to start fresh:

```bash
# 1. Uninstall (as Administrator)
node uninstall-service.js

# 2. Wait 10 seconds

# 3. Reinstall (as Administrator)
node install-service.js
```

---

## Service Configuration

The service is configured with:

| Setting | Value | Description |
|---------|-------|-------------|
| **Name** | HelloClubAttendance | Service identifier |
| **Display Name** | Hello Club Event Attendance Auto-Print Service | Name shown in Services |
| **Startup Type** | Automatic | Starts with Windows |
| **Max Retries** | 3 | Restart attempts on failure |
| **Retry Interval** | 2 seconds | Wait between restarts |
| **Max Restarts** | 5 | Maximum restart attempts per hour |
| **Working Directory** | Project root | Where service runs |

### Modify Service Configuration

Edit `install-service.js` and change these values:

```javascript
const svc = new Service({
  name: 'HelloClubAttendance',
  description: 'Your custom description',
  // ... other settings
  maxRetries: 3,      // Change retry count
  maxRestarts: 5,     // Change max restarts
  wait: 2,            // Change wait time (seconds)
});
```

Then uninstall and reinstall:
```bash
node uninstall-service.js
node install-service.js
```

---

## Alternative: NSSM (Advanced)

**NSSM (Non-Sucking Service Manager)** is a GUI tool for creating Windows services.

### Why Use NSSM?

- ✅ Pure GUI - no scripting required
- ✅ More configuration options
- ✅ Better error handling
- ✅ File rotation for logs

### NSSM Installation

1. **Download NSSM**:
   - Visit: https://nssm.cc/download
   - Download the latest version
   - Extract to a folder

2. **Install Service with NSSM GUI**:
   ```cmd
   # Open NSSM GUI
   nssm install HelloClubAttendance
   ```

3. **Configure in GUI**:
   - **Application** tab:
     - Path: `C:\Program Files\nodejs\node.exe`
     - Startup directory: `C:\path\to\your\project`
     - Arguments: `src/index.js start-service`

   - **Details** tab:
     - Display name: Hello Club Event Attendance
     - Description: Automatically prints event attendance lists
     - Startup type: Automatic

   - **Log on** tab:
     - Local System account (default)

   - **I/O** tab:
     - Output (stdout): `C:\path\to\project\activity.log`
     - Error (stderr): `C:\path\to\project\error.log`

   - **File rotation** tab:
     - Enable file rotation
     - Rotate files bigger than: 10MB
     - Replace existing file: No (append)

4. **Start Service**:
   ```cmd
   nssm start HelloClubAttendance
   ```

### NSSM Commands

```cmd
# Install
nssm install HelloClubAttendance

# Start
nssm start HelloClubAttendance

# Stop
nssm stop HelloClubAttendance

# Restart
nssm restart HelloClubAttendance

# Edit configuration
nssm edit HelloClubAttendance

# Remove
nssm remove HelloClubAttendance
```

---

## Comparison: node-windows vs NSSM

| Feature | node-windows | NSSM |
|---------|-------------|------|
| **Installation** | Script/Batch file | GUI + CLI |
| **Configuration** | JavaScript code | GUI form |
| **Log Rotation** | Manual | Built-in |
| **Environment Vars** | Via code | Via GUI |
| **User Accounts** | System only | Any user |
| **Ease of Use** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Flexibility** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Recommendation**:
- Use **node-windows** (batch files) for quick setup
- Use **NSSM** for production environments with advanced needs

---

## Monitoring Best Practices

### 1. Set Up Dashboard Auto-Start

Create a scheduled task to open the dashboard on login:

1. Press `Win + R` → `taskschd.msc`
2. Create Basic Task
3. Trigger: At log on
4. Action: Start a program
5. Program: `C:\path\to\project\Start Dashboard.bat`

### 2. Enable Email Alerts

Configure webhooks in `config.json` for notifications:

```json
{
  "webhooks": {
    "onError": "https://hooks.slack.com/...",
    "onSuccess": "https://hooks.slack.com/..."
  }
}
```

### 3. Monitor with Prometheus

Start the metrics server:
```bash
node src/index.js metrics-server
```

Then configure Prometheus to scrape: http://localhost:9090/metrics

---

## Uninstalling the Service

### GUI Method

1. **Double-click `Uninstall Service.bat`** (as Administrator)
2. Follow the prompts
3. Service will be stopped and removed

### Command Line

```bash
# As Administrator
node uninstall-service.js
```

**Note**: Uninstalling preserves your data:
- ✅ Database (events.db)
- ✅ Logs (activity.log, error.log)
- ✅ Backups folder
- ✅ Configuration files (.env, config.json)

---

## FAQ

### Q: Can I run the service under a different user account?

**A**: Yes, using NSSM:
1. `nssm edit HelloClubAttendance`
2. Go to "Log on" tab
3. Select "This account" and enter credentials

### Q: How do I update the application while running as a service?

**A**:
```bash
# 1. Stop service
net stop HelloClubAttendance

# 2. Update code (git pull, npm install, etc.)
git pull
npm install

# 3. Start service
net start HelloClubAttendance
```

### Q: Can I run multiple instances?

**A**: Yes, but you need to:
1. Create separate project folders
2. Use different service names in `install-service.js`
3. Use different ports for dashboard/metrics
4. Install each as a separate service

### Q: How much memory does the service use?

**A**: Typically 50-150MB depending on:
- Number of events
- Database size
- Active features

Monitor via Task Manager or dashboard metrics.

### Q: Does the service work with antivirus software?

**A**: Yes, but you may need to whitelist:
- Node.js executable
- Project folder
- Port 3030 (dashboard)
- Port 9090 (metrics)

---

## Support

If you encounter issues:

1. **Check logs**: `View Logs.bat` or `error.log`
2. **Test manually**: Run `node src/index.js start-service` to see errors
3. **Event Viewer**: Check Windows Application logs
4. **Dashboard**: View health checks at http://localhost:3030

---

## Summary

**Quick Start Checklist:**

- [ ] Install Node.js
- [ ] Create `.env` and `config.json`
- [ ] Run `npm install`
- [ ] Right-click `Install Service.bat` → Run as administrator
- [ ] Verify in `services.msc`
- [ ] Double-click `Start Dashboard.bat` to monitor
- [ ] Check logs with `View Logs.bat`

**Your service is now running 24/7 in the background!** 🚀
