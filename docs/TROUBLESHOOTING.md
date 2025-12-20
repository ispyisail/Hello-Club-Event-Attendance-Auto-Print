# Troubleshooting Guide

> Solutions to common problems and error messages

## Table of Contents

- [Installation Issues](#installation-issues)
- [Service Issues](#service-issues)
- [API Errors](#api-errors)
- [Printing Issues](#printing-issues)
- [Configuration Errors](#configuration-errors)
- [Database Issues](#database-issues)
- [Tray App Issues](#tray-app-issues)
- [Performance Issues](#performance-issues)
- [Getting More Help](#getting-more-help)

---

## Installation Issues

### Error: "npm install" Fails with `sqlite3` or `better-sqlite3` Errors

**Symptoms**:
```
Error: Python executable "python" is not available
gyp ERR! build error
```

**Cause**: Missing build tools required for native modules

**Solution**:

**Windows**:
```bash
# Option 1: Install Visual Studio Build Tools
# Download from: https://visualstudio.microsoft.com/downloads/
# Select "Desktop development with C++"

# Option 2: Install via npm (simpler)
npm install --global windows-build-tools
```

**If using Python 3.12+**:
```bash
pip install setuptools
```

---

### Error: "Service Installation Failed" or "Access Denied"

**Symptoms**:
```
Error installing service: Access denied
```

**Cause**: Not running as Administrator

**Solution**:
1. Close the current terminal
2. Right-click Command Prompt or PowerShell
3. Select "Run as Administrator"
4. Run `npm run service:install` again

---

### Error: Node.js Not Found During Installation

**Symptoms**:
```
'node' is not recognized as an internal or external command
```

**Cause**: Node.js not in PATH

**Solution**:
1. Reinstall Node.js
2. During installation, check "Add to PATH"
3. Restart your terminal
4. Verify: `node --version`

---

## Service Issues

### Service Won't Start

**Check Service Status**:
```bash
npm run service:status
```

**Common Causes**:

#### 1. Invalid API Key

**Error in `error.log`**:
```
API Error: 401 Unauthorized
```

**Solution**:
1. Check `.env` file
2. Verify `API_KEY` is correct
3. Get new key from Hello Club if needed
4. Restart service

#### 2. Missing `.env` File

**Error**:
```
Missing required environment variables: API_KEY
```

**Solution**:
```bash
copy .env.example .env
notepad .env
# Add your API_KEY
```

#### 3. Invalid `config.json`

**Error**:
```
Invalid configuration in config.json
```

**Solution**:
1. Check error message for specific field
2. Fix the invalid configuration
3. Restart service

#### 4. Port Already in Use

**Rare, but if you see**:
```
EADDRINUSE: address already in use
```

**Solution**:
- Another instance may be running
- Check Task Manager for node.exe processes
- Kill duplicate processes

---

### Service Starts Then Immediately Stops

**Diagnose**:
```bash
# Check error log
type error.log

# Look for crash reasons
```

**Common Causes**:

1. **Database locked**
   - Another process has `events.db` open
   - Close database tools
   - Restart service

2. **Missing dependencies**
   ```bash
   npm install
   npm run service:install
   ```

3. **Corrupted database**
   ```bash
   # Backup first
   copy events.db events.db.backup
   # Delete and let service recreate
   del events.db
   ```

---

### Service Won't Stop

**Force Stop**:
```bash
# Via services.msc
services.msc
# Find "HelloClubEventAttendance"
# Right-click → Stop

# Or via command line
net stop HelloClubEventAttendance

# Or via Task Manager
taskkill /F /IM node.exe
```

---

### Service Crashes Repeatedly

**Check Logs**:
```bash
type error.log
```

**Look For**:
- API connection errors
- Database errors
- Out of memory errors

**Solutions**:

**If API errors**: Check internet connection

**If database errors**:
```bash
# Delete and recreate database
del events.db
net start HelloClubEventAttendance
```

**If memory errors**:
- Too many scheduled events
- Increase `serviceRunIntervalHours` in config.json
- Reduce `fetchWindowHours`

---

## API Errors

### Error: 401 Unauthorized

**Full Error**:
```
API Error: 401 Unauthorized while fetching upcoming events.
Please check your API_KEY in the .env file.
```

**Solution**:
1. Verify `.env` file exists
2. Check `API_KEY` is correct (no extra spaces)
3. Test key in Hello Club dashboard
4. Generate new key if expired
5. Restart service after fixing

---

### Error: Network Error / No Response

**Error**:
```
Network Error: No response received while fetching upcoming events
```

**Causes**:
- No internet connection
- Hello Club API is down
- Firewall blocking requests
- Proxy issues

**Solutions**:

1. **Check internet**:
   ```bash
   ping api.helloclub.com
   ```

2. **Check firewall**:
   - Allow node.exe through Windows Firewall
   - Check corporate firewall settings

3. **Check proxy**:
   ```bash
   # If behind corporate proxy, set:
   set HTTP_PROXY=http://proxy.company.com:8080
   set HTTPS_PROXY=http://proxy.company.com:8080
   ```

4. **Verify API is up**:
   - Check Hello Club status page
   - Try accessing Hello Club website

---

### Error: 429 Too Many Requests

**Error**:
```
API Error: 429 Too Many Requests
```

**Cause**: Hitting API rate limits

**Solution**:
1. Increase `serviceRunIntervalHours` in config.json
2. Reduce frequency of manual `fetch-events` calls
3. Check for duplicate service instances
4. Wait and retry later

---

## Printing Issues

### Local Printing: "pdf-to-printer" Error

**Error**:
```
Failed to print locally: No suitable PDF printer found
```

**Cause**: SumatraPDF not installed (required on Windows)

**Solution**:
1. Download [SumatraPDF](https://www.sumatrapdfreader.org/download-free-pdf-viewer)
2. Install SumatraPDF
3. Set your printer as Windows default printer
4. Restart service

---

### Local Printing: PDF Not Printing

**Diagnose**:
1. Check if PDF file was created:
   ```bash
   dir attendees.pdf
   ```

2. Try printing manually:
   - Open `attendees.pdf` in SumatraPDF
   - Click Print
   - Does it work?

**If PDF not created**:
- Check `error.log` for PDF generation errors
- Verify attendee data was fetched

**If PDF created but not printing**:
- Check printer is online and has paper
- Check printer is set as Windows default
- Try different printer

---

### Email Printing: "Failed to send email"

**Common Causes**:

#### 1. Invalid SMTP Credentials

**Error**:
```
Failed to send email: Invalid login
```

**Solution**:
- Verify `SMTP_USER` and `SMTP_PASS` in `.env`
- Gmail users: Must use [App Password](https://support.google.com/accounts/answer/185833)
- Not your regular Gmail password!

**Create Gmail App Password**:
1. Enable 2-Factor Authentication
2. Google Account → Security → App Passwords
3. Generate new password for "Mail"
4. Copy 16-character password to `.env`

#### 2. Wrong SMTP Settings

**Error**:
```
Failed to send email: Connection timeout
```

**Solution**:
```env
# Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

# Outlook/Office 365
SMTP_HOST=smtp.office365.com
SMTP_PORT=587

# Yahoo
SMTP_HOST=smtp.mail.yahoo.com
SMTP_PORT=587
```

#### 3. Firewall Blocking SMTP

**Error**:
```
Failed to send email: ETIMEDOUT
```

**Solution**:
- Check corporate firewall
- Try port 465 instead of 587
- Contact IT department

---

## Configuration Errors

### Error: "Invalid configuration in config.json"

**Example Error**:
```
Invalid configuration in config.json:
  "preEventQueryMinutes" must be greater than or equal to 1
```

**Solution**:
1. Open `config.json`
2. Find the mentioned field
3. Fix according to error message
4. Common fixes:
   - `preEventQueryMinutes`: Must be ≥ 1
   - `fetchWindowHours`: Must be ≥ 1
   - `printMode`: Must be "local" or "email"
   - `columns.width`: Must be a number

---

### config.json Syntax Error

**Error**:
```
SyntaxError: Unexpected token } in JSON
```

**Cause**: Invalid JSON syntax

**Common Mistakes**:
- Trailing comma after last item
- Missing quotes around strings
- Missing closing bracket

**Solution**:
1. Use JSON validator: https://jsonlint.com/
2. Copy config.json content
3. Validate and fix errors
4. Save fixed version

**Example Fix**:
```json
// WRONG (trailing comma)
{
  "categories": ["Basketball"],
}

// CORRECT
{
  "categories": ["Basketball"]
}
```

---

## Database Issues

### Database Locked Error

**Error**:
```
Error: SQLITE_BUSY: database is locked
```

**Cause**: Another process has the database open

**Solution**:
1. Close any SQLite database tools
2. Check for duplicate service instances
3. Restart service
4. If persists:
   ```bash
   net stop HelloClubEventAttendance
   del events.db
   net start HelloClubEventAttendance
   ```

---

### Database Corrupted

**Error**:
```
Error: database disk image is malformed
```

**Solution**:
```bash
# Backup current database
copy events.db events.db.corrupt

# Delete corrupted database
del events.db

# Service will recreate on next start
net start HelloClubEventAttendance

# Note: All pending events will be re-fetched
```

---

### Events Not Being Stored

**Symptom**: Database remains empty

**Diagnose**:
```bash
# Check if events exist in database
sqlite3 events.db "SELECT COUNT(*) FROM events;"
```

**Possible Causes**:

1. **Category filter too restrictive**
   - Check `categories` in config.json
   - Set to `[]` to process all categories

2. **No events in time window**
   - Increase `fetchWindowHours`
   - Check Hello Club for actual events

3. **API not returning events**
   - Check `activity.log` for API responses
   - Verify API key has correct permissions

---

## Tray App Issues

### Tray Icon Not Showing

**Solution 1: Check Windows Notification Area**:
1. Right-click taskbar
2. Taskbar settings
3. Select which icons appear on taskbar
4. Enable "Hello Club Service Monitor"

**Solution 2: Restart Tray App**:
```bash
# Close tray app
# Open Task Manager
# End "electron.exe" processes
# Restart tray app
npm run tray
```

**Solution 3: Check for Errors**:
- Look in console where you ran `npm run tray`
- Check for Electron errors

---

### Tray Icon Shows Wrong Status

**Symptom**: Icon is red but service is running

**Solution**:
1. Right-click tray icon
2. Click "Check Status Now"
3. If still wrong, restart tray app

**If Persists**:
```bash
# Restart both tray app and service
net stop HelloClubEventAttendance
# Close tray app
net start HelloClubEventAttendance
npm run tray
```

---

### Log Viewer Window Won't Open

**Solution**:
1. Check `activity.log` and `error.log` exist
2. Try opening logs manually:
   ```bash
   notepad activity.log
   ```
3. Restart tray app
4. Check for JavaScript errors in console

---

## Performance Issues

### Service Using Too Much Memory

**Normal Usage**: 50-150 MB

**High Usage** (>500 MB):

**Causes**:
- Too many scheduled events
- Memory leak (rare)

**Solutions**:
1. Reduce `fetchWindowHours`
2. Increase `serviceRunIntervalHours`
3. Restart service periodically (use Task Scheduler)

---

### Service Using Too Much CPU

**Normal Usage**: <1% when idle, 5-30% when processing

**High Usage** (>50%):

**Causes**:
- Infinite loop (bug)
- Processing very large attendee lists

**Solutions**:
1. Check logs for unusual activity
2. Restart service
3. Report bug with logs if persists

---

### Slow PDF Generation

**Normal**: 2-5 seconds per PDF

**Slow** (>30 seconds):

**Causes**:
- Thousands of attendees
- Logo image is very large
- Disk I/O issues

**Solutions**:
1. Optimize logo image (use PNG, max 100x50 pixels)
2. Check disk space
3. Close other applications

---

## Getting More Help

### Collecting Diagnostic Information

Before requesting help, collect:

1. **Log Files**:
   ```bash
   type activity.log > diagnostic.txt
   type error.log >> diagnostic.txt
   ```

2. **Configuration** (remove secrets):
   ```bash
   type config.json >> diagnostic.txt
   # DON'T include .env (contains secrets!)
   ```

3. **Service Status**:
   ```bash
   npm run service:status >> diagnostic.txt
   ```

4. **System Info**:
   ```bash
   node --version >> diagnostic.txt
   npm --version >> diagnostic.txt
   systeminfo | findstr /C:"OS" >> diagnostic.txt
   ```

### Where to Get Help

1. **Check Documentation**:
   - [README.md](../README.md)
   - [CONFIGURATION.md](./CONFIGURATION.md)
   - [API.md](./API.md)

2. **Search Existing Issues**:
   - [GitHub Issues](https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/issues)

3. **Create New Issue**:
   - Include diagnostic information
   - Describe what you expected
   - Describe what actually happened
   - Include error messages

4. **Community Discussion**:
   - [GitHub Discussions](https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/discussions)

### When Reporting Bugs

**Include**:
- ✅ Operating System and version
- ✅ Node.js version
- ✅ Error messages from logs
- ✅ Steps to reproduce
- ✅ What you expected to happen
- ✅ What actually happened

**Do NOT Include**:
- ❌ Your API key
- ❌ SMTP passwords
- ❌ `.env` file contents
- ❌ Personal information

---

## Quick Reference: Common Commands

```bash
# Service Management
npm run service:install      # Install service (admin)
npm run service:uninstall    # Remove service (admin)
npm run service:status       # Check service status
net start HelloClubEventAttendance    # Start service
net stop HelloClubEventAttendance     # Stop service

# Testing
node src/index.js fetch-events        # Test fetching
node src/index.js process-schedule    # Test processing
npm test                              # Run unit tests

# Logs
type activity.log            # View activity log
type error.log               # View error log

# Database
sqlite3 events.db "SELECT * FROM events;"  # View events
del events.db                              # Reset database

# Tray App
npm run tray                 # Start tray app
npm run tray:build           # Build tray executable
```

---

**Last Updated**: 2024-12-20
