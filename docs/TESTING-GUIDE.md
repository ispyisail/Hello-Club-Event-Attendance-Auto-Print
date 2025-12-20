# Testing Guide - Hello Club Event Attendance

## Complete Testing Checklist

This guide covers all testing scenarios from basic functionality to full installer testing.

---

## Prerequisites for Testing

### Required
- [x] Windows 10 or 11
- [x] Node.js installed (14.x or later)
- [x] Valid Hello Club API key
- [x] Administrator privileges

### Recommended
- [x] Clean Windows VM for installer testing
- [x] Test printer or email account
- [x] Hello Club account with test events

---

## Level 1: Core Application Testing

### Test 1.1: Dependencies Installation

**Purpose:** Verify all packages install correctly

```bash
cd C:\Projects\Hello-Club-Event-Attendance-Auto-Print
npm install
```

**Expected Result:**
- ✓ No errors during installation
- ✓ `node_modules` folder created
- ✓ ~500 packages installed
- ⏱️ Takes 2-5 minutes

**Common Issues:**
- ❌ "npm not found" → Install Node.js
- ❌ "EACCES permission denied" → Run as Administrator

---

### Test 1.2: Configuration Setup

**Purpose:** Verify configuration files are valid

**Step 1: Create .env file**
```bash
# Copy example
copy .env.example .env

# Edit .env in notepad
notepad .env
```

**Add your credentials:**
```
API_KEY=your_actual_api_key_here
PRINTER_EMAIL=your_printer@print.epsonconnect.com
SMTP_USER=your.email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=your.email@gmail.com
```

**Step 2: Verify config.json**
```bash
notepad config.json
```

**Check:**
- ✓ Valid JSON syntax (no trailing commas)
- ✓ Categories match your Hello Club events
- ✓ Reasonable time intervals

**Test with Node.js:**
```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('config.json')))"
```

**Expected:** No errors, config printed

---

### Test 1.3: Database Initialization

**Purpose:** Verify SQLite database can be created

```bash
node -e "const {getDb} = require('./src/database'); getDb(); console.log('Database OK')"
```

**Expected Result:**
- ✓ "Database OK" printed
- ✓ `events.db` file created
- ✓ No errors

**Verify database:**
```bash
# Check file exists
dir events.db
```

---

### Test 1.4: API Connection

**Purpose:** Test Hello Club API connectivity

**Create test script** `test-api.js`:
```javascript
require('dotenv').config();
const { getUpcomingEvents } = require('./src/api-client');

(async () => {
  try {
    console.log('Testing API connection...');
    const events = await getUpcomingEvents(24);
    console.log(`✓ Success! Found ${events.length} events`);
    if (events.length > 0) {
      console.log('First event:', events[0].name);
    }
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
})();
```

**Run test:**
```bash
node test-api.js
```

**Expected Result:**
- ✓ "Success! Found X events"
- ✓ No 401 (unauthorized) errors
- ✓ No 429 (rate limit) errors

**Common Issues:**
- ❌ "401 Unauthorized" → Check API_KEY in .env
- ❌ "429 Rate Limit" → Wait a minute and retry
- ❌ "ENOTFOUND" → Check internet connection

---

### Test 1.5: Manual Fetch Events

**Purpose:** Test event fetching command

```bash
node src/index.js fetch-events
```

**Expected Result:**
```
info: Executing command: fetch-events
info: Found X upcoming events in the next 24 hours
info: Successfully stored X new events in the database
```

**Verify:**
```bash
# Check activity.log
type activity.log
```

Should show event fetching activity with no errors.

---

### Test 1.6: Manual Process Schedule

**Purpose:** Test event processing command

**First, add a test event to database:**
```bash
node -e "const db = require('./src/database').getDb(); db.prepare(\"INSERT INTO events (id, name, startDate, status) VALUES ('test-1', 'Test Event', datetime('now', '+10 minutes'), 'pending')\").run(); console.log('Test event added')"
```

**Then process:**
```bash
node src/index.js process-schedule
```

**Expected Result:**
- ✓ Finds the test event
- ✓ Attempts to fetch attendees
- ✓ Generates PDF (if attendees exist)
- ✓ Marks event as processed

**Check logs:**
```bash
type activity.log | findstr "Test Event"
```

---

### Test 1.7: Service Mode (Short Run)

**Purpose:** Test service runs without errors

```bash
# Run for 30 seconds
timeout 30 npm start
```

**Expected Output:**
```
info: Executing command: start-service
info: Service starting...
info: Configuration validated successfully:
info:   - Service run interval: 1 hour(s)
info:   - Fetch window: 24 hour(s)
info:   - Pre-event query window: 5 minute(s)
info:   - Print mode: email
info: Service started successfully
info: Scheduler loop started...
info: Next scheduler run in 1 hour(s)
```

**After 30 seconds, check logs:**
```bash
type activity.log
```

**Verify:**
- ✓ No "undefined" values
- ✓ No infinite loops
- ✓ Proper interval scheduled
- ✓ Heartbeat message (if ran long enough)

---

## Level 2: Windows Service Testing

### Test 2.1: Service Installation

**Purpose:** Install and verify Windows service

**Step 1: Install**
```bash
# Run PowerShell as Administrator
npm run service:install
```

**Expected Output:**
```
Installing Hello Club Event Attendance service...
✓ Service installed successfully!
  Name: HelloClubEventAttendance
  Status: Installed but not started

✓ Service started successfully!
```

**Step 2: Verify in Services Manager**
```bash
# Open Services
services.msc
```

**Find "HelloClubEventAttendance" and check:**
- ✓ Status: Running
- ✓ Startup Type: Automatic
- ✓ Log On As: Local System

**Step 3: Check Service Status**
```bash
npm run service:status
```

**Expected:**
```
✓ SERVICE INSTALLED
Service Name: HelloClubEventAttendance
Status: ✓ RUNNING
Start Type: AUTO_START
```

---

### Test 2.2: Service Logs

**Purpose:** Verify service is logging activity

**Wait 2 minutes, then check logs:**
```bash
type activity.log
```

**Should see:**
- ✓ "Service started successfully"
- ✓ "Scheduler loop started"
- ✓ "Scheduler loop finished"
- ✓ Timestamp matches current time

**Check for errors:**
```bash
type error.log
```

**Should be:**
- ✓ Empty or minimal errors
- ❌ No repeated errors
- ❌ No "undefined" errors

---

### Test 2.3: Service Controls

**Purpose:** Test service can be controlled

**Test Stop:**
```bash
net stop HelloClubEventAttendance
```

**Expected:**
```
The HelloClubEventAttendance service is stopping.
The HelloClubEventAttendance service was stopped successfully.
```

**Verify:**
```bash
sc query HelloClubEventAttendance
```

Should show: `STATE: STOPPED`

**Test Start:**
```bash
net start HelloClubEventAttendance
```

**Expected:**
```
The HelloClubEventAttendance service is starting.
The HelloClubEventAttendance service was started successfully.
```

**Verify:**
```bash
sc query HelloClubEventAttendance
```

Should show: `STATE: RUNNING`

---

### Test 2.4: Service Auto-Restart

**Purpose:** Verify service restarts on crashes

**Simulate crash:**
```bash
# Kill the Node process running the service
taskkill /F /FI "WINDOWTITLE eq HelloClubEventAttendance"
```

**Wait 10 seconds, then check:**
```bash
sc query HelloClubEventAttendance
```

**Expected:**
- ✓ Status should be RUNNING again
- ✓ Service auto-restarted

**Check logs:**
```bash
type activity.log | findstr "Service starting"
```

Should show multiple "Service starting" entries if restart occurred.

---

### Test 2.5: Service Survives Reboot

**Purpose:** Verify service starts on boot

**Step 1: Ensure service is set to auto-start**
```bash
sc qc HelloClubEventAttendance
```

Look for: `START_TYPE: AUTO_START`

**Step 2: Restart computer**
```bash
shutdown /r /t 0
```

**Step 3: After reboot, check service**
```bash
sc query HelloClubEventAttendance
```

**Expected:**
- ✓ State: RUNNING
- ✓ Started automatically without user action

---

## Level 3: Tray Application Testing

### Test 3.1: Tray App Launch

**Purpose:** Verify tray app starts without errors

```bash
npm run tray
```

**Expected:**
- ✓ Tray icon appears in system tray (bottom-right)
- ✓ No error messages in console
- ✓ Icon is green (if service running)

**If icon not visible:**
- Click the up arrow (^) in system tray
- Look in hidden icons section

---

### Test 3.2: Tray Icon Status

**Purpose:** Verify icon reflects service status

**Test 1: Service Running**
```bash
net start HelloClubEventAttendance
```

**Check tray icon:**
- ✓ Should be green
- ✓ Hover shows "Hello Club Service: Running"

**Test 2: Service Stopped**
```bash
net stop HelloClubEventAttendance
```

**Wait 10 seconds, then check:**
- ✓ Icon should turn red
- ✓ Hover shows "Hello Club Service: Stopped"

**Test 3: Service Not Installed**
```bash
# Uninstall service temporarily
npm run service:uninstall
```

**Check icon:**
- ✓ Should be yellow
- ✓ Hover shows "Hello Club Service: Not installed"

**Reinstall:**
```bash
npm run service:install
```

---

### Test 3.3: Context Menu

**Purpose:** Test all menu items work

**Right-click tray icon:**

**Test each item:**

| Menu Item | Action | Expected Result |
|-----------|--------|-----------------|
| Status line | Just displays | Shows "Status: Running ✓" or "Stopped ✗" |
| View Logs | Click | Log viewer window opens |
| Check Status Now | Click | Notification appears with status |
| Start Service | Click (when stopped) | Service starts, notification shows |
| Stop Service | Click (when running) | Service stops, notification shows |
| Restart Service | Click | Service restarts, notification shows |
| Open Services Manager | Click | services.msc opens |
| Open Project Folder | Click | Explorer opens to project folder |
| Quit | Click | Tray icon disappears |

---

### Test 3.4: Log Viewer Window

**Purpose:** Test log viewer functionality

**Open log viewer:**
1. Right-click tray icon
2. Click "View Logs"

**Test tabs:**
- ✓ "Activity Log" tab shows activity.log content
- ✓ "Error Log" tab shows error.log content
- ✓ Tabs switch correctly

**Test controls:**
- ✓ "Refresh" button updates logs
- ✓ Status badge shows correct state (Running/Stopped)
- ✓ Service buttons work (Start/Stop/Restart)
- ✓ Auto-scroll checkbox toggles auto-scrolling

**Test auto-refresh:**
1. Keep window open
2. Wait 5 seconds
3. Check if logs update automatically

**Expected:**
- ✓ Logs refresh every 5 seconds
- ✓ New entries appear at bottom
- ✓ Auto-scroll works (if enabled)

---

### Test 3.5: Notifications

**Purpose:** Test desktop notifications appear

**Test 1: Status Check Notification**
1. Right-click tray icon
2. Click "Check Status Now"
3. **Expected:** Notification appears showing service status

**Test 2: Service Control Notifications**
1. Right-click tray icon
2. Click "Stop Service"
3. **Expected:** Notification "Service Stopped"
4. Click "Start Service"
5. **Expected:** Notification "Service Started"

**Test 3: Event Processing Notification**
- Run service with events to process
- When event is processed
- **Expected:** Notification "Events Processed: X event(s)"

---

### Test 3.6: Multiple Instance Prevention

**Purpose:** Verify only one tray app can run

**Test:**
1. Launch tray app: `npm run tray`
2. Try to launch again: `npm run tray`

**Expected:**
- ✓ Second instance quits immediately
- ✓ Only one tray icon visible
- ✓ No error message

---

## Level 4: Integration Testing

### Test 4.1: Full Workflow Test

**Purpose:** Test complete end-to-end functionality

**Setup:**
1. Service is installed and running
2. Tray app is running
3. API credentials are configured

**Steps:**

**1. Fetch Events**
```bash
npm run fetch-events
```

**Expected:**
- Events fetched from API
- Stored in database
- Visible in activity.log

**2. Check Service Scheduled Events**
```bash
npm run service:status
```

**Look for line:**
```
Found X pending events to schedule
```

**3. Monitor in Tray App**
- Open log viewer
- Watch Activity Log tab
- Should see scheduled events

**4. Wait for Event Processing**
- Service will process events at scheduled time
- Or manually trigger:
  ```bash
  node src/index.js process-schedule
  ```

**5. Verify Processing**
Check logs for:
- ✓ "Processing event..."
- ✓ "Successfully created attendees.pdf"
- ✓ "Event marked as processed"

**6. Check Output**
```bash
# PDF should exist
dir attendees.pdf

# Event marked processed in database
node -e "console.log(require('./src/database').getDb().prepare('SELECT * FROM events WHERE status=\"processed\"').all())"
```

---

### Test 4.2: Error Handling Test

**Purpose:** Verify application handles errors gracefully

**Test 1: Invalid API Key**
1. Edit `.env`, set invalid API_KEY
2. Restart service
3. **Expected:**
   - Error in error.log
   - Service continues running
   - No crash

**Test 2: Invalid Config**
1. Edit config.json, add invalid JSON
2. Try to start service
3. **Expected:**
   - Clear error message
   - Service exits cleanly
   - No crash

**Test 3: Missing Database**
1. Delete events.db
2. Service should recreate it automatically
3. **Expected:**
   - Database recreated
   - Tables initialized
   - Service continues

**Restore after tests:**
```bash
# Fix .env
# Fix config.json
npm run service:restart
```

---

### Test 4.3: Restart Reliability

**Purpose:** Verify service handles restarts well

**Test:**
1. Let service run for 10 minutes
2. Restart service:
   ```bash
   npm run service:restart
   ```
3. Check logs for clean shutdown
4. Verify service starts cleanly
5. Repeat 3 times

**Expected:**
- ✓ No errors on shutdown
- ✓ No errors on startup
- ✓ Scheduled events preserved
- ✓ No data loss

---

## Level 5: Installer Testing

### Test 5.1: Build Installer

**Purpose:** Create the installer package

**Prerequisites:**
- Inno Setup 6.x installed
- All code tested and working

**Build:**
```bash
installer\build-installer.bat
```

**Expected:**
- ✓ Build completes without errors
- ✓ File created: `dist\HelloClubEventAttendance-Setup-1.0.0.exe`
- ✓ File size ~150 MB

---

### Test 5.2: Clean VM Installation

**Purpose:** Test installer on fresh Windows install

**Setup VM:**
- OS: Windows 10 or 11 (clean install)
- RAM: 4 GB
- Disk: 20 GB
- Node.js: 14.x or later installed

**Test Installation:**

**Step 1: Copy installer to VM**
```
dist\HelloClubEventAttendance-Setup-1.0.0.exe
```

**Step 2: Run installer**
- Right-click → "Run as Administrator"
- Follow wizard

**Step 3: Configuration wizard**
- Enter test API key
- Enter test email settings
- Complete wizard

**Step 4: Wait for installation**
- Should take 5-7 minutes
- Watch for errors

**Step 5: Verify installation**
After install completes:

```bash
# Check service
sc query HelloClubEventAttendance

# Check files
dir "C:\Program Files\Hello Club Event Attendance"

# Check shortcuts
dir "%ProgramData%\Microsoft\Windows\Start Menu\Programs\Hello Club Event Attendance"
```

**Expected:**
- ✓ Service installed and running
- ✓ All files present
- ✓ Shortcuts created
- ✓ Tray app launched
- ✓ No errors in logs

---

### Test 5.3: Installer Options

**Purpose:** Test different installation options

**Test 1: Minimal Install**
- Uncheck "Install and start Windows service"
- Uncheck "Start on Windows startup"
- Uncheck "Create desktop icon"
- Install

**Expected:**
- ✓ Files installed
- ✓ Service NOT installed
- ✓ No startup entry
- ✓ No desktop icon

**Test 2: Full Install**
- Check all options
- Install

**Expected:**
- ✓ Service installed and running
- ✓ Startup entry created
- ✓ Desktop icon present

---

### Test 5.4: Uninstallation Test

**Purpose:** Verify clean uninstall

**Steps:**
1. Install application fully
2. Let service run for 5 minutes
3. Create some logs and database entries
4. Uninstall from Control Panel:
   - Settings → Apps → Hello Club Event Attendance → Uninstall

**During uninstall:**
- ✓ Service stops
- ✓ Service removed
- ✓ Files deleted
- ✓ Shortcuts removed

**After uninstall, verify:**
```bash
# Service should be gone
sc query HelloClubEventAttendance
# Should error: "does not exist"

# Program Files should be empty or gone
dir "C:\Program Files\Hello Club Event Attendance"
# Should not exist

# Start Menu shortcuts gone
dir "%ProgramData%\Microsoft\Windows\Start Menu\Programs\Hello Club Event Attendance"
# Should not exist
```

**Expected:**
- ✓ Complete removal
- ✓ No leftover files
- ✓ No leftover shortcuts
- ✓ No service remains

---

### Test 5.5: Upgrade Test

**Purpose:** Test installer can upgrade existing installation

**Steps:**
1. Install version 1.0.0
2. Let it run, create some data
3. Build installer with version 1.0.1:
   - Edit installer/setup.iss, change version to 1.0.1
   - Rebuild installer
4. Run new installer (don't uninstall first)

**Expected:**
- ✓ Installer detects existing installation
- ✓ Updates files
- ✓ Preserves .env and config.json
- ✓ Preserves database
- ✓ Service continues working
- ✓ No data loss

---

## Test Results Checklist

Use this checklist to track your testing:

### Core Application
- [ ] Dependencies install successfully
- [ ] Configuration files are valid
- [ ] Database initializes correctly
- [ ] API connection works
- [ ] Fetch events command works
- [ ] Process schedule command works
- [ ] Service mode runs without errors
- [ ] No infinite loops
- [ ] Logs are created properly

### Windows Service
- [ ] Service installs successfully
- [ ] Service appears in Services Manager
- [ ] Service starts automatically
- [ ] Service can be stopped
- [ ] Service can be started
- [ ] Service can be restarted
- [ ] Service auto-restarts on crash
- [ ] Service starts on boot
- [ ] Service logs activity
- [ ] Service status command works

### Tray Application
- [ ] Tray app launches
- [ ] Icon appears in system tray
- [ ] Icon color reflects service status
- [ ] Context menu works
- [ ] All menu items function
- [ ] Log viewer opens
- [ ] Log viewer shows correct logs
- [ ] Service controls work from viewer
- [ ] Notifications appear
- [ ] Auto-refresh works
- [ ] Multiple instance prevention works

### Integration
- [ ] Full workflow completes
- [ ] Events are fetched
- [ ] Events are processed
- [ ] PDFs are generated
- [ ] Error handling works
- [ ] Invalid config handled gracefully
- [ ] Service restarts cleanly
- [ ] No data corruption

### Installer
- [ ] Installer builds successfully
- [ ] Installer runs on clean VM
- [ ] Configuration wizard works
- [ ] Dependencies install
- [ ] Service installs via installer
- [ ] Shortcuts are created
- [ ] Tray app auto-starts
- [ ] Uninstallation is clean
- [ ] Upgrade preserves data
- [ ] No leftover files after uninstall

---

## Troubleshooting Failed Tests

### Test Fails: npm install
**Symptoms:** Errors during npm install

**Fixes:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules
rmdir /S /Q node_modules

# Retry
npm install
```

### Test Fails: Service won't start
**Symptoms:** Service shows "Starting" then "Stopped"

**Debug:**
```bash
# Check error log immediately after failure
type error.log

# Common issues:
# - Missing API_KEY in .env
# - Invalid config.json
# - Port conflict
```

### Test Fails: Tray icon doesn't appear
**Symptoms:** No tray icon after launch

**Debug:**
```bash
# Run in console to see errors
npm run tray

# Check for:
# - Electron errors
# - Missing dependencies
# - Icon file missing
```

### Test Fails: Installer build errors
**Symptoms:** Inno Setup compilation fails

**Debug:**
- Check error line number in setup.iss
- Verify all file paths exist
- Check for typos in file names
- Ensure icons folder exists

---

## Automated Testing Script

Create `run-all-tests.bat`:

```batch
@echo off
echo Running comprehensive tests...
echo.

echo [1/8] Testing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 exit /b 1

echo [2/8] Testing configuration...
node -e "JSON.parse(require('fs').readFileSync('config.json'))"
if %ERRORLEVEL% NEQ 0 exit /b 1

echo [3/8] Testing database...
node -e "require('./src/database').getDb(); console.log('OK')"
if %ERRORLEVEL% NEQ 0 exit /b 1

echo [4/8] Testing API connection...
node test-api.js
if %ERRORLEVEL% NEQ 0 exit /b 1

echo [5/8] Testing fetch command...
node src/index.js fetch-events
if %ERRORLEVEL% NEQ 0 exit /b 1

echo [6/8] Testing service mode (30s)...
timeout 30 npm start
if %ERRORLEVEL% NEQ 0 exit /b 1

echo [7/8] Checking logs...
findstr /C:"Service started successfully" activity.log
if %ERRORLEVEL% NEQ 0 exit /b 1

echo [8/8] All tests passed!
echo.
pause
```

---

## Testing Conclusion

After completing all tests, you should have confidence that:

✓ Core application works correctly
✓ Windows service is reliable
✓ Tray application provides good monitoring
✓ Installer creates a working installation
✓ System is production-ready

**Ready to deploy!**
