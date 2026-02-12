# Service Robustness Improvements

This document outlines improvements made to ensure 24/7 stable operation.

## 🛡️ What Was Added

### 1. **Enhanced Systemd Configuration**

- **Restart rate limiting**: Prevents infinite restart loops
- **Watchdog timer**: Detects frozen (not just crashed) service
- **Resource limits**: Prevents memory/CPU runaways
- **Security hardening**: Restricted file system access

### 2. **Systemd Watchdog Integration**

- Service sends "I'm alive" signals every 60 seconds
- If signal missed for 2 minutes, systemd auto-restarts
- Detects hung processes that aren't consuming CPU

### 3. **External Health Monitoring**

- Bash script checks service every 5 minutes
- Validates health file is recent
- Auto-restarts if frozen or unhealthy
- Optional email alerts

### 4. **Bug Fixes**

- **Fixed crash recovery bug**: Jobs now properly reschedule after restart
- **Added grace period**: Events within 1 hour of start still process
- **Past-due handling**: Old events marked as failed instead of stuck

## 📋 Installation Instructions

### Step 1: Update Systemd Service

```bash
# Copy new configuration
sudo cp /tmp/helloclub-robust.service /etc/systemd/system/helloclub.service

# Reload systemd
sudo systemctl daemon-reload

# Restart service with new config
sudo systemctl restart helloclub

# Verify it's running
sudo systemctl status helloclub
```

### Step 2: Set Up External Monitoring (Recommended)

Add to cron to check every 5 minutes:

```bash
# Edit crontab
crontab -e

# Add this line (checks every 5 minutes):
*/5 * * * * /home/user/Hello-Club-Event-Attendance-Auto-Print/scripts/monitor-service.sh
```

### Step 3: Enable Email Alerts (Optional)

```bash
# Install mail utility if not present
sudo apt-get install mailutils

# Set email in environment
export ALERT_EMAIL="your@email.com"

# Or add to cron directly:
*/5 * * * * ALERT_EMAIL="your@email.com" /home/user/Hello-Club-Event-Attendance-Auto-Print/scripts/monitor-service.sh
```

### Step 4: Enable Webhook Notifications (Optional)

Edit `config.json`:

```json
{
  "webhook": {
    "enabled": true,
    "url": "https://your-webhook-url.com/endpoint",
    "timeoutMs": 10000,
    "maxRetries": 2,
    "retryDelayMs": 2000
  }
}
```

Popular webhook services:

- **Discord**: Create webhook in channel settings
- **Slack**: Create incoming webhook in app settings
- **Microsoft Teams**: Create incoming webhook in channel
- **ntfy.sh**: Free, no signup: `https://ntfy.sh/your-unique-topic`

## 🔍 Monitoring & Logs

### Check Service Status

```bash
# Current status
sudo systemctl status helloclub

# Live logs
journalctl -u helloclub -f

# Recent errors
journalctl -u helloclub -p err --since "1 hour ago"
```

### Check Health File

```bash
cat service-health.json | jq
```

### Check Monitor Logs

```bash
tail -f monitor.log
```

## 📊 Resource Limits

The new configuration sets:

- **Max Memory**: 512MB (hard limit)
- **High Memory**: 384MB (warning threshold)
- **CPU Quota**: 50% of one core

These can be adjusted in `/etc/systemd/system/helloclub.service`:

```ini
MemoryMax=512M        # Increase if needed
MemoryHigh=384M       # 75% of MemoryMax
CPUQuota=50%          # Increase for faster processing
```

## 🚨 Troubleshooting

### Service Won't Start After Update

```bash
# Check for syntax errors
sudo systemctl daemon-reload
sudo journalctl -u helloclub -n 50

# Revert to backup if needed
sudo cp /etc/systemd/system/helloclub.service.backup /etc/systemd/system/helloclub.service
sudo systemctl daemon-reload
sudo systemctl restart helloclub
```

### Watchdog Timeout Causing Restarts

Increase timeout in `/etc/systemd/system/helloclub.service`:

```ini
WatchdogSec=300  # Increase to 5 minutes
```

### Memory Limit Too Low

Check actual usage:

```bash
systemctl status helloclub | grep Memory
```

Increase if needed:

```bash
sudo systemctl edit helloclub

# Add:
[Service]
MemoryMax=1G
MemoryHigh=768M
```

## ✅ Testing the Setup

### Test 1: Service Auto-Restart

```bash
# Kill the service process
sudo pkill -9 -f "node src/index.js"

# Watch it restart automatically
watch -n 1 "systemctl status helloclub"
```

### Test 2: Watchdog Detection

```bash
# Simulate a hang by stopping Node.js (SIGSTOP)
sudo pkill -STOP -f "node src/index.js"

# Wait 2 minutes - systemd should detect and restart
# Resume if needed:
sudo pkill -CONT -f "node src/index.js"
```

### Test 3: External Monitor

```bash
# Run manually to test
/home/user/Hello-Club-Event-Attendance-Auto-Print/scripts/monitor-service.sh

# Check log output
tail monitor.log
```

### Test 4: Crash Recovery

```bash
# Stop service
sudo systemctl stop helloclub

# Start and watch logs
sudo systemctl start helloclub
journalctl -u helloclub -f | grep -i "recover"
```

## 📈 Expected Behavior

### Normal Operation

- Service runs continuously 24/7
- Watchdog notifications every ~60 seconds
- Health checks every 60 seconds
- Monitor script checks every 5 minutes
- Scheduler runs every 1 hour
- Heartbeat logs every 15 minutes

### After Crash/Restart

- Service auto-restarts within 10 seconds
- Jobs recovered from database
- Pending jobs rescheduled
- Within grace period: process immediately
- Beyond grace period: mark as failed

### Resource Usage (Expected)

- **Memory**: 50-150MB normally
- **CPU**: <5% normally, spikes during PDF generation
- **Disk I/O**: Minimal except during backup

## 🔐 Security Improvements

The new configuration includes:

- `NoNewPrivileges=true`: Can't gain privileges
- `PrivateTmp=true`: Isolated /tmp directory
- `ProtectSystem=strict`: Read-only system files
- `ProtectHome=read-only`: Limited home access
- `ReadWritePaths`: Only project directory writable

## 🎯 Next Steps (Optional Enhancements)

1. **Set up remote monitoring**: Use services like UptimeRobot, Pingdom
2. **Add metrics collection**: Prometheus + Grafana for dashboards
3. **Implement circuit breaker**: Pause API calls if Hello Club is down
4. **Add backup scheduler**: Secondary service as failover
5. **Set up alerting**: PagerDuty, Opsgenie for critical alerts

## 📞 Support

If issues persist after these improvements:

1. Check logs: `journalctl -u helloclub -n 100`
2. Check health: `cat service-health.json | jq`
3. Check monitor: `cat monitor.log | tail -n 50`
4. Review the crash recovery fix commit for details
