# Deployment Guide

Complete deployment guide for Hello Club Event Attendance Auto-Print.

## Overview

This guide covers deploying the application on:

- **Raspberry Pi 5** (Recommended for production)
- **Windows** (Legacy support, using Windows Service)
- **Linux Server** (Generic systemd deployment)

---

## Raspberry Pi 5 Deployment (Recommended)

### Prerequisites

- Raspberry Pi 5 (8GB RAM recommended)
- Raspberry Pi OS Lite 64-bit
- Static IP configured
- SSH access with key-based authentication
- Network connectivity to Hello Club API

### Step 1: System Preparation

Follow the [RASPBERRY-PI-SETUP.md](./RASPBERRY-PI-SETUP.md) guide first to:

- Flash Raspberry Pi OS
- Configure static IP
- Harden SSH security
- Install firewall and fail2ban
- Create service user

### Step 2: Install Node.js

```bash
# Install Node.js 18.x LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should be >= 18.0.0
npm --version
```

### Step 3: Clone Repository

```bash
# Clone to /opt/helloclub/app
sudo mkdir -p /opt/helloclub
sudo chown helloclub:helloclub /opt/helloclub
sudo -u helloclub git clone https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print.git /opt/helloclub/app
cd /opt/helloclub/app
```

### Step 4: Install Dependencies

```bash
# Install as helloclub user
sudo -u helloclub npm install --production

# Install build tools if needed (for native modules)
sudo apt-get install -y build-essential python3
```

### Step 5: Configure Application

```bash
# Create .env file
sudo -u helloclub nano /opt/helloclub/app/.env
```

Add your configuration:

```env
# Hello Club API
API_KEY=your_api_key_here
API_BASE_URL=https://api.helloclub.com

# Printing (Email mode recommended for Pi)
PRINTER_EMAIL=printer@yourdomain.com
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

# Logging
LOG_LEVEL=info
DB_PATH=/opt/helloclub/app/events.db
```

Edit application settings:

```bash
sudo -u helloclub nano /opt/helloclub/app/config.json
```

```json
{
  "preEventQueryMinutes": 5,
  "fetchWindowHours": 24,
  "serviceRunIntervalHours": 1,
  "printMode": "email",
  "outputFilename": "attendees.pdf"
}
```

These are fallback defaults. Select which events to print by adding a `print:` tag to each event's description in Hello Club (see [CONFIGURATION.md](./CONFIGURATION.md#selecting-events-to-print-the-print-tag)).

### Step 6: Test Application

```bash
# Test API connectivity
sudo -u helloclub node src/index.js fetch-events

# Check logs
tail -f activity.log
```

Expected output:

```
info: Configuration validated successfully
info: Fetching events from Hello Club API...
info: Found 3 events in time window
```

### Step 7: Create Systemd Service

```bash
sudo nano /etc/systemd/system/helloclub.service
```

```ini
[Unit]
Description=Hello Club Event Attendance Auto-Print
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=helloclub
Group=helloclub
WorkingDirectory=/opt/helloclub/app
ExecStart=/usr/bin/node /opt/helloclub/app/src/index.js start-service
Restart=always
RestartSec=10
StandardOutput=append:/opt/helloclub/app/activity.log
StandardError=append:/opt/helloclub/app/error.log

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/helloclub/app

# Resource limits
MemoryMax=512M
CPUQuota=50%

[Install]
WantedBy=multi-user.target
```

### Step 8: Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable helloclub

# Start service
sudo systemctl start helloclub

# Check status
sudo systemctl status helloclub
```

### Step 9: Verify

```bash
sudo systemctl status helloclub
journalctl -u helloclub -f
```

### Step 10: Setup Log Rotation

```bash
sudo nano /etc/logrotate.d/helloclub
```

```
/opt/helloclub/app/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    missingok
    copytruncate
}
```

---

## Parallel Test Install (v2 alongside the original)

When migrating an already-deployed instance to the tag-based (v2) version, you can run the new code alongside the original so you can validate it before cutover. Everything stateful is per-directory (`events.db`, `activity.log`/`error.log`, `config.json`), so the two instances stay isolated.

1. **Deploy the new branch to a separate directory** — do not touch `/opt/helloclub`:

   ```bash
   sudo -u helloclub git clone <repo> /opt/helloclub-v2/app
   cd /opt/helloclub-v2/app
   sudo -u helloclub npm install --production
   sudo -u helloclub cp /opt/helloclub/app/.env .env   # then edit (see step 2)
   ```

2. **Point v2 at a test target, not the real printer.** In `/opt/helloclub-v2/app/.env` set `PRINTER_EMAIL` to a **test inbox** and, in `config.json`, `printMode: "email"`. This way v2's output goes to email for inspection and can never double-print a real job.

3. **Install the v2 unit** (already in the repo as `setup/helloclub-v2.service`):

   ```bash
   sudo cp /opt/helloclub-v2/app/setup/helloclub-v2.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now helloclub-v2
   journalctl -u helloclub-v2 -f
   ```

4. **Avoid the one real hazard — double printing.** The original prints events matching its `categories`; v2 prints events with a `print:` tag. An event that is both in a printed category _and_ tagged would print from both. To test safely, create test events in a category **not** in the original's `categories` and add a `print:` tag to their descriptions — only v2 picks them up.

5. **Cutover**, once v2 proves itself: add `print:` tags to the real upcoming events, then

   ```bash
   sudo systemctl disable --now helloclub          # stop the original
   # deploy v2 code into /opt/helloclub/app (or repoint the original unit), then:
   sudo systemctl enable --now helloclub
   ```

   Keep `/opt/helloclub-v2` and its unit until you are confident, then remove them:

   ```bash
   sudo systemctl disable --now helloclub-v2
   sudo rm /etc/systemd/system/helloclub-v2.service
   sudo rm -rf /opt/helloclub-v2
   sudo systemctl daemon-reload
   ```

Two services fetching hourly is far below Hello Club's rate limit, so sharing the API key is fine; optionally stagger their start times.

---

## Windows Deployment (Legacy)

### Prerequisites

- Windows 10/11 or Windows Server 2019+
- Node.js 16+ installed
- Administrator access

### Step 1: Download Installer

Download `HelloClubEventAttendance-Setup-1.1.0.exe` from [Releases](https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/releases).

### Step 2: Run Installer

1. Run installer (no admin required for basic install)
2. Follow setup wizard
3. Enter API key and SMTP credentials
4. Optionally install Windows service (requires admin)
5. Launch tray monitor

### Step 3: Manual Installation (Alternative)

```powershell
# Clone repository
git clone https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print.git
cd Hello-Club-Event-Attendance-Auto-Print

# Install dependencies
npm install

# Create .env file
copy .env.example .env
notepad .env

# Install Windows Service (requires admin PowerShell)
npm run service:install

# Start tray monitor
npm run tray
```

See [WINDOWS-SERVICE-SETUP.md](./WINDOWS-SERVICE-SETUP.md) for detailed Windows instructions.

---

## Generic Linux Server Deployment

### Prerequisites

- Ubuntu 20.04+ or Debian 11+
- Node.js 18+
- systemd
- sudo access

### Installation Steps

```bash
# 1. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential

# 2. Create service user
sudo useradd -r -s /bin/bash -d /opt/helloclub helloclub
sudo mkdir -p /opt/helloclub
sudo chown helloclub:helloclub /opt/helloclub

# 3. Clone and install
sudo -u helloclub git clone <repo-url> /opt/helloclub/app
cd /opt/helloclub/app
sudo -u helloclub npm install --production

# 4. Configure (create .env and edit config.json)
sudo -u helloclub nano /opt/helloclub/app/.env

# 5. Create systemd service (same as Pi instructions above)
sudo nano /etc/systemd/system/helloclub.service

# 6. Enable and start
sudo systemctl daemon-reload
sudo systemctl enable helloclub
sudo systemctl start helloclub
```

---

## Docker Deployment (Experimental)

### Dockerfile

```dockerfile
FROM node:18-alpine

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application
COPY . .

# Create volume for data persistence
VOLUME ["/app/data"]

# Expose dashboard port
EXPOSE 3000

# Run as non-root user
USER node

CMD ["node", "src/index.js", "start-service"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  helloclub:
    build: .
    container_name: helloclub-service
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./config.json:/app/config.json:ro
      - ./data:/app/data
      - ./logs:/app
    ports:
      - '3000:3000'
    environment:
      - DB_PATH=/app/data/events.db
      - LOG_LEVEL=info
```

### Running with Docker

```bash
# Build image
docker-compose build

# Start service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop service
docker-compose down
```

---

## Post-Deployment Checklist

### Verification

- [ ] Service starts successfully
- [ ] Dashboard accessible at configured port
- [ ] API connection test passes
- [ ] Email connection test passes (if using email mode)
- [ ] Printer connection test passes (if using local mode)
- [ ] Events are fetched from API
- [ ] Events are scheduled for processing
- [ ] PDF generation works
- [ ] Printing works (email sent or local print)
- [ ] Logs are written to files
- [ ] Service survives reboot
- [ ] Firewall rules are correct

### Monitoring Setup

1. **Check service status regularly:**

   ```bash
   sudo systemctl status helloclub
   ```

2. **Monitor logs:**

   ```bash
   tail -f /opt/helloclub/app/activity.log
   ```

3. **Set up log alerts** (optional):

   ```bash
   # Install logwatch
   sudo apt-get install logwatch

   # Configure email alerts for errors
   ```

4. **Monitor health check file:**

   ```bash
   cat /opt/helloclub/app/service-health.json
   ```

5. **Set up external monitoring** (optional):
   - Use Uptime Kuma, Prometheus, or similar
   - Monitor dashboard HTTP endpoint
   - Alert on service downtime

### Security Hardening

- [ ] Change default dashboard password
- [ ] Use strong passwords (16+ characters)
- [ ] Enable UFW firewall
- [ ] Restrict dashboard access to local network
- [ ] Use HTTPS for dashboard (via reverse proxy)
- [ ] Keep system updated: `sudo apt update && sudo apt upgrade`
- [ ] Review sudo permissions for service user
- [ ] Enable fail2ban for SSH protection
- [ ] Disable password SSH authentication
- [ ] Regular backup configuration files

### Maintenance Tasks

**Daily:**

- Check dashboard for service status
- Review activity logs for errors

**Weekly:**

- Review processed events count
- Check disk space: `df -h`
- Review error logs: `tail -100 error.log`

**Monthly:**

- Update dependencies: `npm audit fix`
- Review and rotate logs
- Test backup restoration
- Review firewall logs
- Update system packages

**Quarterly:**

- Review API key expiration
- Review SMTP credentials
- Test disaster recovery procedure
- Update documentation

---

## Troubleshooting Deployment Issues

### Service Won't Start

```bash
# Check detailed logs
journalctl -u helloclub -xe

# Check file permissions
ls -la /opt/helloclub/app/

# Check Node.js version
node --version

# Test application manually
sudo -u helloclub node /opt/helloclub/app/src/index.js start-service
```

### Dashboard Not Accessible

```bash
# Check if service is running
sudo systemctl status helloclub

# Check if port is listening
sudo netstat -tulpn | grep 3000

# Check firewall
sudo ufw status

# Test locally
curl http://localhost:3000
```

### Database Locked Errors

```bash
# Check if multiple instances are running
ps aux | grep node

# Check database file permissions
ls -la /opt/helloclub/app/events.db

# If corrupted, backup and recreate
mv events.db events.db.bak
# Service will create new database on next start
```

### Memory Issues

```bash
# Check memory usage
free -h

# Check service limits
systemctl show helloclub | grep Memory

# Increase memory limit in service file
sudo nano /etc/systemd/system/helloclub.service
# Change: MemoryMax=1G

sudo systemctl daemon-reload
sudo systemctl restart helloclub
```

---

## Updating the Application

### Update Process

```bash
# 1. Stop service
sudo systemctl stop helloclub

# 2. Backup current version
sudo cp -r /opt/helloclub/app /opt/helloclub/app.backup

# 3. Pull latest code
cd /opt/helloclub/app
sudo -u helloclub git pull

# 4. Update dependencies
sudo -u helloclub npm install --production

# 5. Run database migrations (if any)
sudo -u helloclub node src/core/migrations.js

# 6. Start service
sudo systemctl start helloclub

# 7. Verify
sudo systemctl status helloclub
tail -f activity.log
```

### Rollback Procedure

If update fails:

```bash
# Stop service
sudo systemctl stop helloclub

# Restore backup
sudo rm -rf /opt/helloclub/app
sudo mv /opt/helloclub/app.backup /opt/helloclub/app

# Start service
sudo systemctl start helloclub
```

---

## Disaster Recovery

### Backup Strategy

**What to backup:**

- `.env` file (contains secrets)
- `config.json` (application settings)
- `events.db` (database)
- Logs (optional, for debugging)

**Backup script:**

```bash
#!/bin/bash
# backup-helloclub.sh

BACKUP_DIR="/opt/helloclub/backups"
APP_DIR="/opt/helloclub/app"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

tar -czf "$BACKUP_DIR/helloclub_$DATE.tar.gz" \
  "$APP_DIR/.env" \
  "$APP_DIR/config.json" \
  "$APP_DIR/events.db"

# Keep only last 7 backups
ls -t "$BACKUP_DIR"/helloclub_*.tar.gz | tail -n +8 | xargs rm -f

echo "Backup created: $BACKUP_DIR/helloclub_$DATE.tar.gz"
```

**Schedule daily backups:**

```bash
# Add to crontab
sudo crontab -e

# Run daily at 2 AM
0 2 * * * /opt/helloclub/backup-helloclub.sh
```

### Restoration Procedure

```bash
# 1. Stop service
sudo systemctl stop helloclub

# 2. Extract backup
cd /opt/helloclub
tar -xzf backups/helloclub_20250209_020000.tar.gz

# 3. Set permissions
sudo chown -R helloclub:helloclub /opt/helloclub/app

# 4. Start service
sudo systemctl start helloclub
```

---

## Production Best Practices

1. **Use separate production environment** - Don't test in production
2. **Enable HTTPS** - Use nginx/Caddy reverse proxy
3. **Restrict network access** - Firewall rules for dashboard
4. **Regular backups** - Automated daily backups
5. **Monitor uptime** - External monitoring service
6. **Log rotation** - Prevent disk space issues
7. **Resource limits** - Set memory and CPU limits in systemd
8. **Security updates** - Enable unattended-upgrades
9. **Secrets management** - Never commit .env to git
10. **Documentation** - Keep deployment notes updated

---

**Deployment complete!** Your Hello Club Event Attendance system is now running in production.
