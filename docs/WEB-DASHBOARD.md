# Web Dashboard Guide

## Overview

The Hello Club Event Attendance system includes a modern web dashboard for monitoring and managing the service remotely. Built with Express.js and WebSockets, it provides real-time log streaming, service control, and configuration management.

## Features

### 🔐 Security

- Basic authentication with configurable credentials
- Token-based session management
- HTTPS recommended for production

### 📊 Monitoring

- **Real-time Log Streaming** - WebSocket-based live log viewer
- **Service Status** - Health check with 60-second refresh
- **Statistics Dashboard** - Events processed, success rates, trends
- **Activity History** - Last 200 log lines on demand

### 🎛️ Service Control

- Start/Stop/Restart the systemd service
- Requires passwordless sudo for the dashboard user

### ⚙️ Configuration Management

- Edit `.env` and `config.json` via web interface
- Real-time validation
- Automatic backups before changes

### 🔌 Connection Testing

- Test Hello Club API connectivity
- Test SMTP email configuration
- Test local printer connection (CUPS)

### 💾 Backup & Restore

- Create configuration backups with descriptions
- List all available backups
- One-click restore functionality

## Installation

### Prerequisites

```bash
# Raspberry Pi with Node.js 18+ installed
node --version  # Should be >= 18.0.0
```

### Setup

The web dashboard is included in the main application. No separate installation needed.

```bash
cd /opt/helloclub/app
npm install  # Installs dashboard dependencies
```

### Configuration

Add to your `.env` file:

```env
# Dashboard Settings
DASHBOARD_PORT=3000
DASHBOARD_USER=admin
DASHBOARD_PASS=your_secure_password_here
```

**Security Notes:**

- Change the default password immediately
- Use a strong password (16+ characters)
- Consider using HTTPS with a reverse proxy (nginx/Caddy)
- Never expose the dashboard directly to the internet without HTTPS

## Running the Dashboard

### Development Mode

```bash
# Run standalone (for testing)
node web-dashboard/server.js
```

### Production Mode (Systemd)

The dashboard is integrated into the main service. It starts automatically when the service starts.

```bash
# Service runs both the scheduler AND the dashboard
sudo systemctl start helloclub
```

Access at: `http://helloclub-pi.local:3000`

## Usage Guide

### Accessing the Dashboard

1. Open a web browser on your network
2. Navigate to `http://helloclub-pi.local:3000` (or use the Pi's IP address)
3. Enter your dashboard credentials
4. Click **Login**

### Dashboard Sections

#### 1. Overview (Home)

- Service status (Running/Stopped)
- Uptime and health metrics
- Quick stats: Events today, total processed, success rate
- Recent activity summary

#### 2. Live Logs

- Real-time log streaming via WebSocket
- Auto-scroll to latest entries
- Color-coded log levels (info, warn, error)
- Shows last 100 lines on connect

#### 3. Service Control

- **Start** - Starts the background service
- **Stop** - Gracefully stops the service
- **Restart** - Restarts the service (useful after config changes)

Status updates every 5 seconds.

#### 4. Configuration Editor

- **Environment Variables** - Edit .env file
- **Application Settings** - Edit config.json
- Syntax validation before save
- Automatic backup created on each save
- Restart reminder after changes

#### 5. Connection Tests

- **Test API** - Verifies Hello Club API key
  - Response time measurement
  - Error details if failed
- **Test Email** - Verifies SMTP settings
  - Connects without sending email
  - Shows authentication status
- **Test Print** - Verifies CUPS printer
  - Lists available printers
  - Shows default printer status

#### 6. Backups

- **Create Backup** - Save current config with description
- **List Backups** - View all available backups with timestamps
- **Restore** - Revert to a previous configuration
- Automatic backup before config changes

### WebSocket Log Streaming

The dashboard uses WebSockets for efficient real-time log streaming.

**Connection:**

```
ws://helloclub-pi.local:3000/ws/logs
```

**Message Format:**

```json
{
  "type": "history",
  "lines": ["2025-02-09 10:30:00 info: Service started", "..."]
}

{
  "type": "lines",
  "lines": ["2025-02-09 10:30:15 info: Processing event..."]
}

{
  "type": "error",
  "message": "Failed to read log file"
}
```

## API Reference

All API endpoints are under `/api` prefix.

### Service Control

```bash
# Get service status
GET /api/service/status
Response: { success: true, data: { running: true, status: "active" } }

# Start service
POST /api/service/start
Response: { success: true }

# Stop service
POST /api/service/stop
Response: { success: true }

# Restart service
POST /api/service/restart
Response: { success: true }
```

### Statistics

```bash
# Get statistics
GET /api/statistics
Response: {
  success: true,
  data: {
    totalEvents: 150,
    successRate: 98.5,
    todayProcessed: 3
  }
}
```

### Logs

```bash
# Get activity log (last N lines)
GET /api/logs/activity?lines=200
Response: {
  success: true,
  data: ["line1", "line2", ...]
}
```

### Configuration

```bash
# Get .env content
GET /api/config/env
Response: { success: true, data: "API_KEY=...\n..." }

# Update .env
PUT /api/config/env
Body: { content: "API_KEY=new_value\n..." }
Response: { success: true }

# Get config.json
GET /api/config/json
Response: { success: true, data: { categories: [...], ... } }

# Update config.json
PUT /api/config/json
Body: { categories: [...], printMode: "email", ... }
Response: { success: true }
```

### Connection Tests

```bash
# Test API connection
POST /api/test/api
Response: { success: true, responseTime: 245, message: "API connection successful" }

# Test email connection
POST /api/test/email
Response: { success: true, message: "SMTP connection successful" }

# Test print connection
POST /api/test/print
Response: { success: true, printers: ["HP_LaserJet"], default: "HP_LaserJet" }
```

### Backup Management

```bash
# List backups
GET /api/backup
Response: {
  success: true,
  data: [
    { name: "backup_20250209_103000.tar.gz", size: 12345, timestamp: "..." }
  ]
}

# Create backup
POST /api/backup
Body: { description: "Before config change" }
Response: { success: true, backup: "backup_20250209_103000.tar.gz" }

# Restore backup
POST /api/backup/:name/restore
Response: { success: true }
```

## Security Best Practices

### 1. Change Default Credentials

```bash
# Edit .env
DASHBOARD_USER=your_custom_username
DASHBOARD_PASS=very_strong_password_here
```

### 2. Use HTTPS with Reverse Proxy

**Example nginx configuration:**

```nginx
server {
    listen 443 ssl;
    server_name helloclub-pi.local;

    ssl_certificate /etc/ssl/certs/dashboard.crt;
    ssl_certificate_key /etc/ssl/private/dashboard.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws/logs {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

### 3. Firewall Rules

```bash
# Allow dashboard only from local network
sudo ufw allow from 192.168.1.0/24 to any port 3000
```

### 4. Restrict Sudo Access

The dashboard needs passwordless sudo for service control. Restrict it to specific commands:

```bash
# Edit sudoers: sudo visudo -f /etc/sudoers.d/helloclub
pi ALL=(ALL) NOPASSWD: /usr/bin/systemctl start helloclub
pi ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop helloclub
pi ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart helloclub
pi ALL=(ALL) NOPASSWD: /usr/bin/systemctl status helloclub
```

## Troubleshooting

### Dashboard Won't Start

**Error: "Cannot find module 'express'"**

```bash
cd /opt/helloclub/app
npm install
```

**Error: "EADDRINUSE" (Port 3000 in use)**

```bash
# Check what's using port 3000
sudo lsof -i :3000

# Change port in .env
DASHBOARD_PORT=3001
```

### Can't Access Dashboard

**Check firewall:**

```bash
sudo ufw status
sudo ufw allow 3000/tcp
```

**Check service is running:**

```bash
sudo systemctl status helloclub
journalctl -u helloclub -f
```

### Authentication Fails

**Check credentials:**

```bash
cat .env | grep DASHBOARD_
```

**Reset credentials:**

```bash
# Edit .env
DASHBOARD_USER=admin
DASHBOARD_PASS=newpassword

# Restart service
sudo systemctl restart helloclub
```

### WebSocket Connection Fails

**Browser console shows WebSocket error:**

- Check that WebSocket endpoint is `/ws/logs`
- Verify no reverse proxy is blocking WebSocket upgrade
- Ensure firewall allows WebSocket connections

**Logs not streaming:**

```bash
# Check activity.log exists and is readable
ls -la /opt/helloclub/app/activity.log
sudo chmod 644 /opt/helloclub/app/activity.log
```

### Service Control Buttons Don't Work

**Check sudo permissions:**

```bash
# Test manually
sudo systemctl status helloclub

# If password prompt appears, configure passwordless sudo
sudo visudo -f /etc/sudoers.d/helloclub
```

## Development

### Running Locally

```bash
# Set environment variables
export DASHBOARD_PORT=3000
export DASHBOARD_USER=admin
export DASHBOARD_PASS=test123

# Run dashboard
node web-dashboard/server.js
```

### File Structure

```
web-dashboard/
├── server.js              # Express server + WebSocket setup
├── connection-tests.js    # API/Email/Print connectivity tests
├── middleware/
│   └── auth.js           # Basic auth middleware
├── routes/
│   └── api.js            # REST API endpoints
└── public/
    ├── index.html        # Dashboard UI
    ├── login.html        # Login page
    ├── styles.css        # Styling
    └── app.js            # Frontend JavaScript
```

### Adding New Features

**Example: Add a new API endpoint**

```javascript
// web-dashboard/routes/api.js
router.get('/my-endpoint', (req, res) => {
  try {
    const data = { message: 'Hello from new endpoint' };
    res.json({ success: true, data });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});
```

**Example: Add a new WebSocket message type**

```javascript
// web-dashboard/server.js
wss.on('connection', (ws) => {
  // ... existing code ...

  // Send custom message
  setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'custom',
          data: { timestamp: Date.now() },
        })
      );
    }
  }, 5000);
});
```

## Performance Notes

- WebSocket connections are efficient (one connection per client)
- Log streaming uses `tail -f` for minimal resource usage
- Static files served with Express's built-in middleware
- No database queries on the dashboard (reads files directly)

## Future Enhancements

Potential features for future versions:

- [ ] Multi-user support with role-based access
- [ ] Dashboard themes (dark mode)
- [ ] Email notifications from dashboard
- [ ] Schedule manual event processing
- [ ] View and edit PDF templates
- [ ] Export statistics as CSV
- [ ] Mobile-responsive design improvements

---

**Ready to use the dashboard?** Access it at `http://helloclub-pi.local:3000` after starting the service!
