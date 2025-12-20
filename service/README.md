# Windows Service Management

This directory contains scripts to install, uninstall, and manage the Hello Club Event Attendance application as a Windows service.

## Prerequisites

- **Administrator privileges** are required for all service operations
- Node.js must be installed on the system
- The application must be properly configured (`.env` file with API keys)

## Quick Start

### Installing as a Windows Service

**Option 1: Using npm (Recommended)**
```bash
# Run PowerShell or Command Prompt as Administrator
npm run service:install
```

**Option 2: Direct script execution**
```bash
# Run PowerShell or Command Prompt as Administrator
node service/install.js
```

The installer will:
- Install the service with the name "HelloClubEventAttendance"
- Configure it to start automatically on Windows boot
- Start the service immediately
- Set up automatic restart on crashes

### Checking Service Status

```bash
npm run service:status
```

This will show:
- Whether the service is installed and running
- Recent activity logs (last 20 lines)
- Recent error logs (if any)
- Service management commands

### Uninstalling the Service

```bash
# Run as Administrator
npm run service:uninstall
```

## Service Management Commands

Once installed, you can manage the service using Windows commands:

### Start the Service
```bash
net start HelloClubEventAttendance
```

### Stop the Service
```bash
net stop HelloClubEventAttendance
```

### Restart the Service
```bash
net stop HelloClubEventAttendance && net start HelloClubEventAttendance
```

### View Service in Windows Services Manager
```bash
services.msc
```
Look for "HelloClubEventAttendance" in the list.

## Service Configuration

The service is configured with the following settings:

| Setting | Value | Description |
|---------|-------|-------------|
| **Name** | HelloClubEventAttendance | Service identifier |
| **Display Name** | Hello Club Event Attendance | Name shown in Services Manager |
| **Start Type** | Automatic | Starts on Windows boot |
| **Max Restarts** | 10 | Maximum restart attempts on failure |
| **Restart Delay** | 2 seconds | Initial wait before restart |
| **Working Directory** | Project root | Where the service runs from |
| **Environment** | NODE_ENV=production | Production mode (no console logging) |

## Troubleshooting

### "Access Denied" Error
**Problem**: You don't have administrator privileges.

**Solution**: Right-click PowerShell/Command Prompt and select "Run as Administrator"

### Service Won't Start
**Problem**: Missing configuration or environment variables.

**Solution**:
1. Check that `.env` file exists with API_KEY
2. Run `npm run service:status` to see error logs
3. Check `error.log` in the project root

### Service Keeps Crashing
**Problem**: Application errors causing continuous restarts.

**Solution**:
1. Stop the service: `net stop HelloClubEventAttendance`
2. Check `error.log` for error details
3. Fix the configuration issue
4. Restart the service: `net start HelloClubEventAttendance`

### Can't Uninstall Service
**Problem**: Service is running or locked.

**Solution**:
1. Stop the service first: `net stop HelloClubEventAttendance`
2. Wait 10 seconds
3. Run uninstall script again

## Log Files

The service writes to the same log files as manual execution:

- **activity.log** - All service activity and status messages
- **error.log** - Error messages only

Both files are located in the project root directory and automatically rotate when they reach 5MB.

## Auto-Restart Behavior

The service is configured to automatically restart if:
- The application crashes due to an unhandled error
- Node.js process terminates unexpectedly
- System resources become available after shortage

**Restart Policy:**
- **Initial delay**: 2 seconds
- **Backoff multiplier**: 0.5 (grows slightly on each retry)
- **Maximum attempts**: 10 restarts
- **After max attempts**: Service stops and must be manually restarted

## Updating the Application

To update the application code while the service is installed:

1. Stop the service:
   ```bash
   net stop HelloClubEventAttendance
   ```

2. Update your code (git pull, edit files, etc.)

3. Start the service:
   ```bash
   net start HelloClubEventAttendance
   ```

**Note**: You do NOT need to uninstall/reinstall the service for code updates.

## Monitoring the Service

### Real-time Log Monitoring

**PowerShell:**
```powershell
Get-Content activity.log -Wait -Tail 20
```

**Command Prompt:**
```bash
powershell -command "Get-Content activity.log -Wait -Tail 20"
```

### Scheduled Status Checks

The service logs a heartbeat message every 15 minutes showing:
- That it's running normally
- Number of events currently scheduled

Look for lines like:
```
2025-12-19 20:42:36 info: Service heartbeat: Running normally. 3 event(s) scheduled for processing.
```

## Integration with Windows Event Viewer

The service integrates with Windows Event Log. To view service events:

1. Open Event Viewer: `eventvwr.msc`
2. Navigate to: Windows Logs → Application
3. Look for events from source "HelloClubEventAttendance"

## Next Steps

After installing as a Windows service, consider:
1. Creating a system tray application for easy monitoring
2. Setting up email alerts for errors
3. Creating a desktop shortcut to the status checker
4. Configuring backup schedules for the database

For more information, see the main README.md in the project root.
