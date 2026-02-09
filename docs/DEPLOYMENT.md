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

# Dashboard
DASHBOARD_PORT=3000
DASHBOARD_USER=admin
DASHBOARD_PASS=change_this_password

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
  "categories": ["NBA - Junior Events"],
  "preEventQueryMinutes": 5,
  "fetchWindowHours": 24,
  "serviceRunIntervalHours": 1,
  "printMode": "email",
  "outputFilename": "attendees.pdf"
}
```

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

### Step 9: Configure Dashboard Sudo Access

The dashboard needs passwordless sudo for service control:

```bash
sudo visudo -f /etc/sudoers.d/helloclub
```

Add:

```
helloclub ALL=(ALL) NOPASSWD: /usr/bin/systemctl start helloclub
helloclub ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop helloclub
helloclub ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart helloclub
helloclub ALL=(ALL) NOPASSWD: /usr/bin/systemctl status helloclub
```

### Step 10: Access Dashboard

Open browser to: `http://helloclub-pi.local:3000`

Login with credentials from `.env` file.

### Step 11: Configure Firewall

```bash
# Allow dashboard access from local network only
sudo ufw allow from 192.168.1.0/24 to any port 3000

# Verify rules
sudo ufw status
```

### Step 12: Setup Log Rotation

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
