# Troubleshooting Guide

> Solutions to common problems and error messages

## Table of Contents

- [Raspberry Pi / Linux Issues](#raspberry-pi--linux-issues)
- [Service Issues](#service-issues)
- [API Errors](#api-errors)
- [Printing Issues](#printing-issues)
- [Configuration Errors](#configuration-errors)
- [Database Issues](#database-issues)
- [Web Dashboard Issues](#web-dashboard-issues)
- [Performance Issues](#performance-issues)
- [Legacy Windows Troubleshooting](#legacy-windows-troubleshooting)
- [Getting More Help](#getting-more-help)

---

## Raspberry Pi / Linux Issues

### Service Won't Start

**Check Service Status**:

```bash
sudo systemctl status helloclub
```

**View Detailed Logs**:

```bash
journalctl -u helloclub -xe
```

**Common Causes**:

#### 1. Invalid API Key

**Error in logs**:

```
API Error: 401 Unauthorized
```

**Solution**:

```bash
# Edit .env file
sudo nano /opt/helloclub/app/.env

# Verify API_KEY is correct
# Restart service
sudo systemctl restart helloclub
```

#### 2. Missing `.env` File

**Error**:

```
Missing required environment variables: API_KEY
```

**Solution**:

```bash
# Create .env from example
cd /opt/helloclub/app
sudo cp .env.example .env
sudo nano .env
# Add your API_KEY
sudo systemctl restart helloclub
```

#### 3. Permission Issues

**Error**:

```
Error: EACCES: permission denied
```

**Solution**:

```bash
# Fix file ownership
sudo chown -R helloclub:helloclub /opt/helloclub/app

# Fix .env permissions
sudo chmod 600 /opt/helloclub/app/.env

# Restart service
sudo systemctl restart helloclub
```

#### 4. Node.js Not Found

**Error**:

```
/usr/bin/env: 'node': No such file or directory
```

**Solution**:

```bash
# Check if Node.js is installed
node --version

# If not installed, install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Update service file if needed
sudo systemctl daemon-reload
sudo systemctl restart helloclub
```

#### 5. Dependencies Not Installed

**Error**:

```
Error: Cannot find module 'express'
```

**Solution**:

```bash
cd /opt/helloclub/app
sudo -u helloclub npm install --production
sudo systemctl restart helloclub
```

---

### Service Crashes Repeatedly

**Check Logs for Root Cause**:

```bash
# View last 50 lines of error log
tail -50 /opt/helloclub/app/error.log

# View systemd journal
journalctl -u helloclub -n 100
```

**Common Causes & Solutions**:

**If API Connection Errors**:

```bash
# Test network connectivity
ping -c 4 api.helloclub.com

# Check firewall
sudo ufw status

# Verify API key
curl -H "Authorization: Bearer YOUR_API_KEY" https://api.helloclub.com/health
```

**If Database Errors**:

```bash
# Check disk space
df -h

# Check database file
ls -lh /opt/helloclub/app/events.db

# If corrupted, backup and recreate
sudo -u helloclub mv /opt/helloclub/app/events.db /opt/helloclub/app/events.db.backup
sudo systemctl restart helloclub
```

**If Memory Errors**:

```bash
# Check memory usage
free -h

# Increase memory limit in service file
sudo nano /etc/systemd/system/helloclub.service
# Change: MemoryMax=1G

sudo systemctl daemon-reload
sudo systemctl restart helloclub
```

---

### Web Dashboard Not Accessible

**Check if Service is Running**:

```bash
sudo systemctl status helloclub
```

**Check if Port is Listening**:

```bash
sudo netstat -tulpn | grep 3000
# Or with ss:
sudo ss -tulpn | grep 3000
```

**Check Firewall**:

```bash
sudo ufw status

# Allow dashboard access from local network
sudo ufw allow from 192.168.1.0/24 to any port 3000
```

**Test Locally**:

```bash
curl http://localhost:3000
```

**Check Dashboard Logs**:

```bash
tail -f /opt/helloclub/app/activity.log | grep dashboard
```

**Common Issues**:

1. **Port Already in Use**:

   ```bash
   # Find process using port 3000
   sudo lsof -i :3000

   # Change port in .env
   sudo nano /opt/helloclub/app/.env
   # Add: DASHBOARD_PORT=3001
   sudo systemctl restart helloclub
   ```

2. **Authentication Failed**:

   ```bash
   # Check credentials in .env
   sudo nano /opt/helloclub/app/.env
   # Verify DASHBOARD_USER and DASHBOARD_PASS
   ```

3. **Network Configuration**:

   ```bash
   # Check Raspberry Pi IP address
   hostname -I

   # Access via IP instead of hostname
   # http://192.168.1.XX:3000
   ```

---

### SSH Connection Issues

**Cannot Connect via SSH**:

```bash
# Check if SSH service is running (on Pi)
sudo systemctl status ssh

# Check SSH is allowed through firewall
sudo ufw allow 22/tcp

# Test connection
ssh pi@helloclub-pi.local
# Or use IP address
ssh pi@192.168.1.XX
```

**Permission Denied (publickey)**:

```bash
# Verify SSH key is in authorized_keys (on Pi)
cat ~/.ssh/authorized_keys

# Re-add SSH key
cat your_public_key.pub | ssh pi@helloclub-pi.local 'cat >> ~/.ssh/authorized_keys'

# Check permissions
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

---

## Service Issues

### Service Status Shows "Failed"

**Diagnose**:

```bash
# Check exit code and error
sudo systemctl status helloclub -l

# View last error messages
journalctl -u helloclub -n 50 --no-pager
```

**Solution**:

```bash
# View full logs
tail -100 /opt/helloclub/app/error.log

# Fix the underlying issue (API key, permissions, etc.)
# Then restart
sudo systemctl restart helloclub
```

---

### Service Starts Then Immediately Stops

**Check for Configuration Errors**:

```bash
# Test running manually
sudo -u helloclub node /opt/helloclub/app/src/index.js start-service
# This will show errors in real-time
```

**Common Causes**:

1. **Invalid config.json**:

   ```bash
   # Validate JSON syntax
   cat /opt/helloclub/app/config.json | jq .
   # If error, fix syntax and restart
   ```

2. **Port Conflict**:

   ```bash
   # Check if another process is using port 3000
   sudo lsof -i :3000
   # Kill the process or change DASHBOARD_PORT
   ```

3. **Database Locked**:
   ```bash
   # Check if database is locked
   sudo lsof /opt/helloclub/app/events.db
   # Kill any processes holding the database
   # Restart service
   ```

---

### No Events Being Processed

**Symptom**: Service runs but no events appear

**Diagnose**:

```bash
# Check if events are being fetched
tail -f /opt/helloclub/app/activity.log | grep "Found.*events"

# Manually fetch events
sudo -u helloclub node /opt/helloclub/app/src/index.js fetch-events

# Check database
sqlite3 /opt/helloclub/app/events.db "SELECT * FROM events;"
```

**Possible Causes**:

1. **Category Filter Too Restrictive**:

   ```bash
   # Check categories in config.json
   cat /opt/helloclub/app/config.json | jq .categories

   # Set to [] to process all categories (testing)
   ```

2. **No Events in Time Window**:

   ```bash
   # Increase fetchWindowHours in config.json
   # Check Hello Club for actual events in the date range
   ```

3. **API Not Returning Events**:
   ```bash
   # Check API key has correct permissions
   # View activity log for API responses
   ```

---

## API Errors

### Error: 401 Unauthorized

**Full Error**:

```
API Error: 401 Unauthorized while fetching upcoming events.
Please check your API_KEY in the .env file.
```

**Solution**:

```bash
# Edit .env file
sudo nano /opt/helloclub/app/.env

# Verify API_KEY is correct (no extra spaces)
# Get new key from Hello Club if expired

# Restart service
sudo systemctl restart helloclub
```

**Test API Key**:

```bash
# Test with curl
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://api.helloclub.com/v1/event?fromDate=2025-01-01"
```

---

### Error: Network Error / No Response

**Error**:

```
Network Error: No response received while fetching upcoming events
```

**Causes & Solutions**:

1. **No Internet Connection**:

   ```bash
   # Test connectivity
   ping -c 4 8.8.8.8
   ping -c 4 api.helloclub.com

   # Check network interface
   ip addr show

   # Restart networking
   sudo systemctl restart networking
   ```

2. **DNS Issues**:

   ```bash
   # Test DNS resolution
   nslookup api.helloclub.com

   # Try alternate DNS (Google DNS)
   echo "nameserver 8.8.8.8" | sudo tee -a /etc/resolv.conf
   ```

3. **Firewall Blocking Requests**:

   ```bash
   # Check outbound rules
   sudo ufw status verbose

   # Allow HTTPS outbound (usually allowed by default)
   sudo ufw allow out 443/tcp
   ```

4. **Hello Club API is Down**:

   ```bash
   # Check API status
   curl -I https://api.helloclub.com

   # Try accessing Hello Club website
   # Wait and retry later
   ```

---

### Error: 429 Too Many Requests

**Error**:

```
API Error: 429 Too Many Requests
```

**Cause**: Hitting API rate limits

**Solution**:

```bash
# Increase serviceRunIntervalHours in config.json
sudo nano /opt/helloclub/app/config.json
# Change to 2 or 3 hours

# Check for duplicate service instances
ps aux | grep node

# Restart service
sudo systemctl restart helloclub
```

---

## Printing Issues

### CUPS Printing: Printer Not Found

**Error**:

```
Failed to print: Printer not found
```

**Solution**:

```bash
# List available printers
lpstat -p -d

# Check CUPS status
sudo systemctl status cups

# Add printer if not listed
# Access CUPS web interface: http://localhost:631
# Or use lpadmin command
```

**Verify Printer Connection**:

```bash
# USB printers
lsusb

# Network printers
lpstat -t

# Test print
echo "Test" | lp -d Brother_HL_L2350DW
```

---

### CUPS Printing: PDF Not Printing

**Diagnose**:

```bash
# Check if PDF was created
ls -lh /opt/helloclub/app/attendees.pdf

# Check CUPS queue
lpq -a

# Check CUPS error log
tail -f /var/log/cups/error_log
```

**Common Issues**:

1. **Printer Offline**:

   ```bash
   # Check printer status
   lpstat -p Brother_HL_L2350DW

   # Enable printer if disabled
   sudo cupsenable Brother_HL_L2350DW

   # Accept jobs
   sudo cupsaccept Brother_HL_L2350DW
   ```

2. **Print Job Stuck**:

   ```bash
   # View print queue
   lpq

   # Cancel all jobs
   cancel -a

   # Restart CUPS
   sudo systemctl restart cups
   ```

3. **Wrong Printer Name**:

   ```bash
   # Check actual printer name
   lpstat -p

   # Update config.json with exact name
   sudo nano /opt/helloclub/app/config.json
   ```

---

### Email Printing: "Failed to send email"

**Common Causes**:

#### 1. Invalid SMTP Credentials

**Error**:

```
Failed to send email: Invalid login
```

**Solution**:

```bash
# Edit .env file
sudo nano /opt/helloclub/app/.env

# For Gmail, use App Password (not account password)
# Verify SMTP_USER and SMTP_PASS
# Restart service
sudo systemctl restart helloclub
```

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

```bash
# Edit .env with correct settings
sudo nano /opt/helloclub/app/.env
```

**Common SMTP Settings**:

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

```bash
# Test SMTP connectivity
telnet smtp.gmail.com 587

# If blocked, allow outbound SMTP
sudo ufw allow out 587/tcp

# Try alternative port (465 for SSL)
# Update SMTP_PORT in .env
```

**Test Email Connection via Dashboard**:

- Access dashboard → Connection Tests → Test Email Connection
- Provides detailed error messages

---

## Configuration Errors

### Error: "Invalid configuration in config.json"

**Example Error**:

```
Invalid configuration in config.json:
  "preEventQueryMinutes" must be greater than or equal to 1
```

**Solution**:

```bash
# Edit config.json
sudo nano /opt/helloclub/app/config.json

# Fix the mentioned field according to error message
# Common requirements:
# - preEventQueryMinutes: Must be ≥ 1
# - fetchWindowHours: Must be ≥ 1
# - printMode: Must be "local" or "email"
# - columns.width: Must be a number

# Restart service
sudo systemctl restart helloclub
```

---

### config.json Syntax Error

**Error**:

```
SyntaxError: Unexpected token } in JSON
```

**Cause**: Invalid JSON syntax

**Solution**:

```bash
# Validate JSON syntax
cat /opt/helloclub/app/config.json | jq .

# If error, shows exactly where the problem is
# Common mistakes:
# - Trailing comma after last item
# - Missing quotes around strings
# - Missing closing bracket

# Restore from backup if needed
sudo cp /opt/helloclub/backups/config_*.tar.gz .
tar -xzf config_*.tar.gz
```

**Validate Online**: https://jsonlint.com/

---

## Database Issues

### Database Locked Error

**Error**:

```
Error: SQLITE_BUSY: database is locked
```

**Cause**: Another process has the database open

**Solution**:

```bash
# Check what's using the database
sudo lsof /opt/helloclub/app/events.db

# If another process is holding it, stop that process
# Or restart the service
sudo systemctl restart helloclub

# If persists, backup and recreate
sudo -u helloclub cp /opt/helloclub/app/events.db /opt/helloclub/app/events.db.backup
sudo -u helloclub rm /opt/helloclub/app/events.db
sudo systemctl restart helloclub
```

---

### Database Corrupted

**Error**:

```
Error: database disk image is malformed
```

**Solution**:

```bash
# Stop service
sudo systemctl stop helloclub

# Backup corrupted database
sudo -u helloclub cp /opt/helloclub/app/events.db /opt/helloclub/app/events.db.corrupt

# Try to recover using sqlite3
sqlite3 /opt/helloclub/app/events.db.corrupt ".dump" | sqlite3 /opt/helloclub/app/events.db.recovered

# If recovery works, use recovered database
sudo -u helloclub mv /opt/helloclub/app/events.db.recovered /opt/helloclub/app/events.db

# If recovery fails, delete and let service recreate
sudo -u helloclub rm /opt/helloclub/app/events.db

# Start service (will recreate database)
sudo systemctl start helloclub
```

**Note**: All pending events will be re-fetched from API

---

### Disk Space Full

**Error**:

```
Error: ENOSPC: no space left on device
```

**Check Disk Space**:

```bash
df -h

# Check largest files/directories
du -h /opt/helloclub/app | sort -h | tail -20
```

**Free Up Space**:

```bash
# Clean old logs
sudo find /opt/helloclub/app -name "*.log" -mtime +30 -delete

# Clean old backups
sudo find /opt/helloclub/backups -name "*.tar.gz" -mtime +90 -delete

# Clean apt cache
sudo apt clean

# Remove old journal logs
sudo journalctl --vacuum-time=30d
```

---

## Web Dashboard Issues

### Cannot Login to Dashboard

**Symptom**: "Invalid credentials" error

**Solution**:

```bash
# Check credentials in .env
sudo cat /opt/helloclub/app/.env | grep DASHBOARD

# Verify DASHBOARD_USER and DASHBOARD_PASS match what you're entering

# If forgotten, reset password
sudo nano /opt/helloclub/app/.env
# Change DASHBOARD_PASS

# Restart service
sudo systemctl restart helloclub
```

---

### Dashboard Shows "Service Stopped" but Service is Running

**Solution**:

```bash
# Check service status
sudo systemctl status helloclub

# Refresh dashboard page (Ctrl+F5)

# Check dashboard logs
tail -f /opt/helloclub/app/activity.log | grep dashboard

# Restart service
sudo systemctl restart helloclub
```

---

### WebSocket Connection Failed (Logs Not Streaming)

**Symptom**: Logs don't update in real-time

**Solution**:

```bash
# Check if WebSocket port is accessible
# WebSocket uses same port as HTTP (3000)

# Check firewall
sudo ufw status

# Check if service is listening
sudo netstat -tulpn | grep 3000

# Try refreshing page
# Try different browser
```

---

### Dashboard Slow or Unresponsive

**Possible Causes**:

1. **Large Log Files**:

   ```bash
   # Check log file sizes
   ls -lh /opt/helloclub/app/*.log

   # Rotate logs
   sudo logrotate -f /etc/logrotate.d/helloclub
   ```

2. **High CPU/Memory Usage**:

   ```bash
   # Check resource usage
   top
   # Press 'P' to sort by CPU
   # Press 'M' to sort by memory

   # If Node.js using too much, restart
   sudo systemctl restart helloclub
   ```

3. **Network Latency**:

   ```bash
   # Test response time
   time curl http://helloclub-pi.local:3000

   # Check Pi's network connection
   ping -c 10 192.168.1.1
   ```

---

## Performance Issues

### Service Using Too Much Memory

**Normal Usage**: 80-200 MB

**High Usage** (>500 MB):

**Diagnose**:

```bash
# Check memory usage
free -h

# Check service memory specifically
sudo systemctl status helloclub | grep Memory

# View detailed process info
top -p $(pgrep -f "helloclub")
```

**Solutions**:

1. **Too Many Scheduled Events**:

   ```bash
   # Check scheduled events
   sqlite3 /opt/helloclub/app/events.db "SELECT COUNT(*) FROM scheduled_jobs;"

   # Reduce fetchWindowHours in config.json
   # Increase serviceRunIntervalHours
   ```

2. **Memory Leak (Rare)**:

   ```bash
   # Restart service
   sudo systemctl restart helloclub

   # Set up automatic restart schedule
   # Add to cron: 0 3 * * * systemctl restart helloclub
   ```

3. **Increase Memory Limit**:

   ```bash
   # Edit service file
   sudo nano /etc/systemd/system/helloclub.service
   # Change: MemoryMax=1G

   sudo systemctl daemon-reload
   sudo systemctl restart helloclub
   ```

---

### Service Using Too Much CPU

**Normal Usage**: <1% idle, 5-20% when processing

**High Usage** (>50% sustained):

**Diagnose**:

```bash
# Monitor CPU usage
top -p $(pgrep -f "helloclub")

# Check for stuck loops in logs
tail -100 /opt/helloclub/app/activity.log
```

**Solutions**:

```bash
# Restart service
sudo systemctl restart helloclub

# Check for issues in error log
tail -100 /opt/helloclub/app/error.log

# If persists, report bug with logs
```

---

### Slow PDF Generation

**Normal**: 2-5 seconds per PDF

**Slow** (>30 seconds):

**Causes & Solutions**:

1. **Very Large Attendee Lists**:
   - Expected for 500+ attendees
   - Check activity log for attendee count

2. **Logo Image Too Large**:

   ```bash
   # Check logo file size
   ls -lh /opt/helloclub/app/logo.png

   # Optimize logo (max 100x50 pixels, <50KB)
   convert logo.png -resize 100x50 logo_optimized.png
   ```

3. **Low Disk Space**:

   ```bash
   df -h
   # Free up space if needed
   ```

4. **SD Card Performance**:
   - Consider using USB SSD for better I/O
   - Use high-endurance SD card

---

## Legacy Windows Troubleshooting

> **Note**: Windows deployment is no longer recommended. For new deployments, use Raspberry Pi. See [RASPBERRY-PI-SETUP.md](./RASPBERRY-PI-SETUP.md).

For Windows-specific troubleshooting (v1.0.x and earlier), see legacy documentation:

- [**Windows Installation Issues**](./legacy/INSTALLER-USER-GUIDE.md#troubleshooting) - npm install errors, Visual Studio Build Tools, Node.js PATH issues
- [**Windows Service Issues**](./legacy/WINDOWS-SERVICE-SETUP.md#troubleshooting) - Service won't start, access denied, port conflicts
- [**Tray App Issues**](./legacy/TRAY-APP-GUIDE.md#troubleshooting) - Icon not showing, status incorrect, log viewer issues
- [**SumatraPDF Printing**](./legacy/WINDOWS-SERVICE-SETUP.md#printing-setup) - Local printing on Windows requires SumatraPDF

### Quick Windows Commands Reference

```bash
# Service management (Windows)
npm run service:status       # Check status
net start HelloClubEventAttendance    # Start
net stop HelloClubEventAttendance     # Stop

# View logs (Windows)
type activity.log
type error.log

# Database query (Windows)
sqlite3 events.db "SELECT * FROM events;"
```

---

## Getting More Help

### Collecting Diagnostic Information

Before requesting help, collect:

1. **System Information**:

   ```bash
   # Platform and versions
   uname -a
   node --version
   npm --version
   cat /etc/os-release
   ```

2. **Service Status**:

   ```bash
   sudo systemctl status helloclub -l
   journalctl -u helloclub -n 100 --no-pager > systemd.log
   ```

3. **Log Files**:

   ```bash
   tail -100 /opt/helloclub/app/activity.log > activity.txt
   tail -100 /opt/helloclub/app/error.log > error.txt
   ```

4. **Configuration** (remove secrets):

   ```bash
   cat /opt/helloclub/app/config.json > config.txt
   # DON'T include .env (contains secrets!)
   ```

5. **Database Info**:
   ```bash
   sqlite3 /opt/helloclub/app/events.db "SELECT COUNT(*) FROM events;" > db-stats.txt
   sqlite3 /opt/helloclub/app/events.db ".schema" >> db-stats.txt
   ```

---

### Where to Get Help

1. **Check Documentation**:
   - [README.md](../README.md)
   - [CONFIGURATION.md](./CONFIGURATION.md)
   - [DEPLOYMENT.md](./DEPLOYMENT.md)

2. **Search Existing Issues**:
   - [GitHub Issues](https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/issues)

3. **Create New Issue**:
   - Include diagnostic information from above
   - Describe what you expected
   - Describe what actually happened
   - Include error messages and logs

4. **Community Discussion**:
   - [GitHub Discussions](https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/discussions)

---

### When Reporting Bugs

**Include**:

- ✅ Platform (Raspberry Pi 5, Ubuntu 22.04, etc.)
- ✅ Node.js version (`node --version`)
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
# Service Management (Linux/Raspberry Pi)
sudo systemctl status helloclub       # Check status
sudo systemctl start helloclub        # Start service
sudo systemctl stop helloclub         # Stop service
sudo systemctl restart helloclub      # Restart service
journalctl -u helloclub -f            # Follow logs

# Testing
sudo -u helloclub node /opt/helloclub/app/src/index.js fetch-events        # Test fetching
sudo -u helloclub node /opt/helloclub/app/src/index.js process-schedule    # Test processing

# Logs
tail -f /opt/helloclub/app/activity.log    # View activity log
tail -f /opt/helloclub/app/error.log       # View error log
journalctl -u helloclub -f                 # View systemd journal

# Database
sqlite3 /opt/helloclub/app/events.db "SELECT * FROM events;"     # View events
sqlite3 /opt/helloclub/app/events.db "SELECT * FROM events WHERE status='pending';"

# Printing
lpstat -p -d                          # List printers
lpq                                    # View print queue
cancel -a                              # Cancel all print jobs

# Network
sudo netstat -tulpn | grep 3000       # Check if dashboard listening
curl http://localhost:3000            # Test dashboard locally
ping api.helloclub.com                # Test API connectivity

# System
df -h                                  # Check disk space
free -h                                # Check memory
top                                    # View resource usage
```

---

**Last Updated**: 2025-02-10

**Platform Focus**: Raspberry Pi 5 / Linux
