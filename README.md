# Hello Club Event Attendance Auto-Print

> Automated Raspberry Pi service for printing Hello Club event attendance lists with web dashboard monitoring

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-118%20passing-success)](./tests)
[![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi%205-c51a4a)](https://www.raspberrypi.com/)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Documentation](#documentation)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## 🎯 Overview

Hello Club Event Attendance Auto-Print is a professional Raspberry Pi service that automatically fetches, monitors, and prints attendee lists for upcoming Hello Club events. It runs as a systemd service in the background and provides a modern web dashboard for remote monitoring and control.

### How It Works

The application uses a smart two-stage process:

1. **Event Discovery** - Periodically scans the Hello Club API for upcoming events
2. **Just-in-Time Processing** - Fetches the latest attendee list moments before an event starts
3. **Automatic Printing** - Generates a professional PDF and prints it (locally or via email)

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Web Dashboard                          │
│             (Express + WebSocket)                       │
│  • Real-time log streaming                              │
│  • Service control (start/stop/restart)                 │
│  • Configuration editor                                 │
│  • Connection tests & statistics                        │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/WS (Port 3000)
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  systemd Service                        │
│            (Always-Running Background)                  │
│  • Fetches events every N hours                         │
│  • Schedules processing for each event                  │
│  • Auto-restarts on failure                             │
│  • Health monitoring & statistics                       │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   [Hello Club]  [SQLite DB]  [Printer]
      API        (Event Queue)  (CUPS/Email)
```

## ✨ Features

### Core Features

- ✅ **Automated Event Fetching** - Scans for upcoming events within configurable time windows
- ✅ **Smart Scheduling** - Processes events at optimal times to capture last-minute sign-ups
- ✅ **Professional PDFs** - Generates clean, printable attendee lists with custom layouts
- ✅ **Flexible Printing** - Print locally or send via email to network printers
- ✅ **Category Filtering** - Only process events from specified categories

### Raspberry Pi Service Features

- ✅ **Always Running** - Starts automatically with Raspberry Pi via systemd
- ✅ **Self-Healing** - Automatically restarts if it crashes
- ✅ **Background Operation** - Runs headless without user interaction
- ✅ **Production Ready** - Battle-tested systemd service management
- ✅ **Low Power** - Energy-efficient 24/7 operation

### Web Dashboard Features

- 🌐 **Remote Access** - Monitor from any device on your network
- 📊 **Real-time Monitoring** - Live log streaming via WebSocket
- 📝 **Log Viewer** - Browse activity and error logs with auto-scroll
- 📈 **Statistics** - Events processed, success rates, and trends
- 🎛️ **Service Control** - Start, stop, and restart the service remotely
- ⚙️ **Settings Editor** - Edit configuration and credentials via web UI
- 🔌 **Connection Tests** - Test API, Email, and Printer with one click
- 💾 **Backup Management** - Create and restore configuration backups

### Developer Features

- ✅ **Comprehensive Tests** - 118 unit tests with Jest
- ✅ **Type Safety** - Joi schema validation for all configuration
- ✅ **Error Handling** - Robust error handling with detailed logging
- ✅ **Modular Architecture** - Clean separation of concerns
- ✅ **Well Documented** - Extensive JSDoc comments

## 🚀 Quick Start

### For End Users (Recommended)

**Raspberry Pi Deployment** - The recommended way to run in production:

1. Get a **Raspberry Pi 5** with 8GB RAM (see [hardware list](./docs/RASPBERRY-PI-SETUP.md#hardware-shopping-list))
2. Follow the [Raspberry Pi Setup Guide](./docs/RASPBERRY-PI-SETUP.md):
   - Flash Raspberry Pi OS Lite 64-bit
   - Configure static IP and SSH
   - Run the automated setup script
3. Access the **Web Dashboard** at `http://helloclub-pi.local:3000`
4. Configure your settings via the dashboard:
   - Enter your Hello Club API key
   - Configure email printing
   - Set event categories

**That's it!** The service runs 24/7 in the background. Use the web dashboard to:

- View real-time logs
- Monitor service status
- Edit configuration
- Test API and Email connections
- Control the service (start/stop/restart)

### For Developers

If you want to run from source or contribute:

```bash
# 1. Clone the repository
git clone https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print.git
cd Hello-Club-Event-Attendance-Auto-Print

# 2. Install dependencies
npm install

# 3. Configure your API key
cp .env.example .env
# Edit .env and add your API_KEY

# 4. Run the service (foreground)
npm start

# 5. Or run with web dashboard
npm run dashboard  # In separate terminal
npm start          # Main service
```

## 📦 Installation

### Detailed Installation Steps

#### 1. System Requirements

- **Hardware**: Raspberry Pi 5 (8GB recommended) or any Linux server
- **Operating System**: Raspberry Pi OS Lite 64-bit (Debian/Ubuntu also supported)
- **Node.js**: Version 18.0.0 or higher
- **Network**: Ethernet connection recommended for reliability

#### 2. Install Dependencies

```bash
npm install
```

This installs all required packages including:

- `node-windows` - Windows service management
- `electron` - System tray application
- `better-sqlite3` - Local database
- `pdfkit` - PDF generation
- `winston` - Logging
- And more...

#### 3. Configure the Application

**Create `.env` file:**

```bash
# Copy the example
copy .env.example .env
```

Edit `.env` and add your credentials:

```env
# Required: Your Hello Club API key
API_KEY=your_api_key_here

# Optional: For email printing mode
PRINTER_EMAIL=printer@yourdomain.com
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

**Edit `config.json`:**

```json
{
  "categories": ["NBA - Junior Events", "Your Category"],
  "preEventQueryMinutes": 5,
  "fetchWindowHours": 24,
  "serviceRunIntervalHours": 1,
  "printMode": "local",
  "outputFilename": "attendees.pdf",
  "pdfLayout": {
    "fontSize": 10,
    "columns": [
      { "id": "name", "header": "Name", "width": 140 },
      { "id": "phone", "header": "Phone", "width": 100 },
      { "id": "signUpDate", "header": "Signed up", "width": 100 },
      { "id": "fee", "header": "Fee", "width": 60 },
      { "id": "status", "header": "Status", "width": 90 }
    ]
  }
}
```

#### 4. Install as systemd Service

Create and enable the systemd service:

```bash
# Create service file
sudo nano /etc/systemd/system/helloclub.service

# Copy the service configuration from setup/helloclub.service
# Then enable and start:
sudo systemctl daemon-reload
sudo systemctl enable helloclub
sudo systemctl start helloclub
```

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for the complete systemd service configuration.

#### 5. Access the Web Dashboard

Open a browser and navigate to:

```
http://helloclub-pi.local:3000
```

Or use the Pi's IP address: `http://192.168.1.XX:3000`

Login with the credentials from your `.env` file.

### Using the Installer (Recommended for End Users)

The installer provides a professional, guided setup experience with a modern wizard:

#### What You Get:

**🎨 Modern Setup Wizard:**

- Friendly welcome screen with prerequisites checklist
- Node.js detection and guidance
- Step-by-step API configuration with helpful hints
- Optional email printing setup with Gmail-specific tips
- Smart validation (checks API key format)
- Real-time progress with emoji indicators
- **No admin required** for standard installation

**⚙️ Automatic Setup:**

1. Installs all files to `%LOCALAPPDATA%\Hello Club Event Attendance` (your user folder)
2. Runs `npm install` for you (3-5 minutes)
3. Creates `.env` file from your input
4. **Optionally** installs and starts the Windows service (requires admin, unchecked by default)
5. Creates Start Menu and Desktop shortcuts
6. Launches the tray monitor

**📦 What's Included:**

- System tray monitor (always included)
- Windows service (optional, requires admin)
- All dependencies
- Complete documentation
- Automatic updates support

**🔑 Installation Modes:**

- **Standard (No Admin)**: Tray monitor runs when you're logged in
- **With Service (Admin)**: Background operation even when logged out

#### To Build Your Own Installer:

```bash
cd installer
build-installer.bat
```

The installer will be created in `dist/HelloClubEventAttendance-Setup-1.1.0.exe` (2MB)

### Upgrading from Previous Versions

**If you installed version 1.0.x or earlier:**

Previous versions installed to `C:\Program Files\Hello Club Event Attendance` and required administrator rights. Starting with version 1.1.0:

- **New installations** use `%LOCALAPPDATA%\Hello Club Event Attendance` (no admin needed)
- **Existing installations** continue to work from their current location
- **To migrate**:
  1. Uninstall the old version (keeps your .env and config.json)
  2. Install the new version
  3. Copy your .env and config.json from the old location if needed

Your data and configuration are preserved during upgrades.

## ⚙️ Configuration

### Easy Configuration Options

**For End Users:** Use the **Settings GUI** in the tray app - no file editing needed!

**For Developers:** Edit configuration files manually or use the Settings GUI.

### Configuration Files

The application uses two configuration files:

1. **`.env`** - Secrets and credentials (never commit this! Already in .gitignore)
2. **`config.json`** - Application settings (safe to commit - no secrets)

**Note:** When using the installer, it creates your `.env` file during setup. The Settings GUI allows you to edit both files safely with automatic backups.

### Environment Variables (`.env`)

| Variable        | Required       | Description                                  | Default             |
| --------------- | -------------- | -------------------------------------------- | ------------------- |
| `API_KEY`       | ✅ Yes         | Hello Club API authentication key            | -                   |
| `PRINTER_EMAIL` | For email mode | Email address of network printer             | -                   |
| `SMTP_USER`     | For email mode | SMTP username (e.g., Gmail address)          | -                   |
| `SMTP_PASS`     | For email mode | SMTP password or app-specific password       | -                   |
| `SMTP_HOST`     | For email mode | SMTP server hostname                         | `smtp.gmail.com`    |
| `SMTP_PORT`     | For email mode | SMTP server port                             | `587`               |
| `EMAIL_FROM`    | For email mode | Sender email address                         | Same as `SMTP_USER` |
| `LOG_LEVEL`     | No             | Logging verbosity (error, warn, info, debug) | `info`              |
| `DB_PATH`       | No             | Path to SQLite database file                 | `./events.db`       |

### Application Settings (`config.json`)

See [CONFIGURATION.md](./docs/CONFIGURATION.md) for detailed configuration documentation.

### Webhook Configuration (Optional)

Enable webhook notifications to receive real-time updates when events are processed. Add the following to your `config.json`:

```json
{
  "webhook": {
    "enabled": true,
    "url": "https://your-server.com/webhook",
    "timeoutMs": 10000,
    "maxRetries": 2,
    "retryDelayMs": 2000
  }
}
```

**Webhook Events:**

| Event                   | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `event.processed`       | Event successfully processed with attendee count |
| `event.failed`          | Event processing failed with error message       |
| `job.retry`             | Job is being retried (includes retry count)      |
| `job.permanent_failure` | Job failed after all retries exhausted           |
| `service.started`       | Service has started with configuration info      |

**Example Payload:**

```json
{
  "event": "event.processed",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "data": {
    "eventId": "abc123",
    "eventName": "Basketball Practice",
    "attendeeCount": 15
  }
}
```

## 📖 Usage

### Web Dashboard Interface

The web dashboard provides comprehensive remote management:

**Access:** `http://helloclub-pi.local:3000`

**Main Features:**

- 📊 **Dashboard Home** - Service status, statistics, and recent activity
- 📝 **Live Logs** - Real-time log streaming with auto-scroll
- 🎛️ **Service Control** - Start/Stop/Restart the systemd service
- ⚙️ **Configuration Editor** - Edit .env and config.json via web UI
- 🔌 **Connection Tests** - Test API, Email, and Printer connectivity
- 💾 **Backup Manager** - Create and restore configuration backups
- 📈 **Statistics** - Events processed, success rates, and trends

**Service Status Indicators:**

- 🟢 **Running** - Service active and healthy
- 🔴 **Stopped** - Service not running
- 🟡 **Starting** - Service initialization in progress

### New Features Guide

**⚙️ Settings GUI:**
After installation, you can edit all configuration without touching files:

1. Right-click tray icon → **Settings**
2. **Environment Variables Tab:**
   - Edit API key and SMTP credentials
   - Password fields with show/hide toggle
   - Real-time validation
3. **Configuration Tab:**
   - Manage event categories (add/remove)
   - Adjust timing settings
   - Change print mode (local/email)
   - Edit PDF layout
4. Click **Save** - automatic backups created
5. Restart service to apply changes

**🔌 Connection Tests:**
Verify your configuration before processing events:

- **Test API Connection:**
  - Click to test Hello Club API
  - Shows response time and success/failure
  - Validates API key format
  - Provides troubleshooting hints

- **Test Email Connection:**
  - Click to verify SMTP settings
  - Tests connection without sending email
  - Detects common Gmail/authentication issues
  - Confirms printer email is configured

### Command Line Interface

You can also run the application from the command line:

```bash
# Fetch events once (manual run)
node src/index.js fetch-events

# Process pending events once
node src/index.js process-schedule

# Run as continuous service (foreground)
node src/index.js start-service

# View help
node src/index.js --help
```

### Service Management (systemd)

```bash
# Check service status
sudo systemctl status helloclub

# Start service
sudo systemctl start helloclub

# Stop service
sudo systemctl stop helloclub

# Restart service
sudo systemctl restart helloclub

# View logs
journalctl -u helloclub -f

# Enable auto-start on boot
sudo systemctl enable helloclub
```

### Log Files

Logs are written to the project directory (`/opt/helloclub/app/`):

- **`activity.log`** - Normal operations, events processed
- **`error.log`** - Errors and warnings only

View logs via:

- **Web Dashboard** → "Live Logs" (real-time streaming)
- **Terminal**: `tail -f /opt/helloclub/app/activity.log`
- **systemd**: `journalctl -u helloclub -f`
- **SSH**: Any text editor (nano, vim, cat)

## 📚 Documentation

### User Guides

| Document                                                  | Description                           |
| --------------------------------------------------------- | ------------------------------------- |
| [CONFIGURATION.md](./docs/CONFIGURATION.md)               | Detailed configuration guide          |
| [INSTALLER-USER-GUIDE.md](./docs/INSTALLER-USER-GUIDE.md) | Installer creation guide              |
| [TRAY-APP-GUIDE.md](./docs/TRAY-APP-GUIDE.md)             | System tray application guide         |
| [WEB-DASHBOARD.md](./docs/WEB-DASHBOARD.md)               | Web dashboard usage and API reference |
| [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)           | Common issues and solutions           |

### Deployment Guides

| Document                                              | Description                                  |
| ----------------------------------------------------- | -------------------------------------------- |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md)                 | Complete deployment guide (Pi/Windows/Linux) |
| [RASPBERRY-PI-SETUP.md](./docs/RASPBERRY-PI-SETUP.md) | Raspberry Pi 5 setup and hardening           |
| [legacy/](./docs/legacy/)                             | Archived Windows documentation               |

### Developer Documentation

| Document                                    | Description                            |
| ------------------------------------------- | -------------------------------------- |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md)   | System design and architecture         |
| [API.md](./docs/API.md)                     | Module and function reference          |
| [DEVELOPMENT.md](./docs/DEVELOPMENT.md)     | Developer setup and contribution guide |
| [TESTING-GUIDE.md](./docs/TESTING-GUIDE.md) | Testing documentation                  |

## 📁 Project Structure

```
hello-club-event-attendance/
├── src/                          # Application source code
│   ├── core/                     # Core business logic
│   │   ├── api-client.js         # Hello Club API integration
│   │   ├── database.js           # SQLite database management
│   │   ├── functions.js          # Event processing logic
│   │   └── service.js            # Service scheduler
│   ├── services/                 # Supporting services
│   │   ├── email-service.js      # SMTP email sending
│   │   ├── logger.js             # Winston logging configuration
│   │   └── pdf-generator.js      # PDF creation
│   ├── utils/                    # Utilities and helpers
│   │   ├── args-parser.js        # CLI argument parsing
│   │   └── config-schema.js      # Configuration validation
│   └── index.js                  # Application entry point
│
├── web-dashboard/                # Express web dashboard
│   ├── server.js                 # Express + WebSocket server
│   ├── connection-tests.js       # API/Email/Print tests
│   ├── middleware/
│   │   └── auth.js               # Authentication middleware
│   ├── routes/
│   │   └── api.js                # REST API endpoints
│   └── public/                   # Frontend assets
│       ├── index.html            # Dashboard UI
│       ├── js/app.js             # Frontend JavaScript
│       └── css/                  # Styling
│
├── setup/                        # Raspberry Pi setup scripts
│   ├── pi-configure.sh           # System hardening script
│   ├── pi-install-app.sh         # Application installation
│   ├── helloclub.service         # systemd service file
│   └── helloclub-dashboard.service # Dashboard service file
│
├── tests/                        # Unit tests (118 tests)
│   ├── api-client.test.js        # API client tests
│   ├── email-service.test.js     # Email service tests
│   ├── functions.test.js         # Core logic tests
│   ├── health-check.test.js      # Health check tests
│   ├── pdf-generator.test.js     # PDF generation tests
│   ├── service.test.js           # Service scheduling tests
│   └── webhook.test.js           # Webhook notification tests
│
├── docs/                         # Documentation
│   ├── RASPBERRY-PI-SETUP.md     # Pi setup guide
│   ├── WEB-DASHBOARD.md          # Dashboard guide
│   ├── DEPLOYMENT.md             # Deployment guide
│   ├── ARCHITECTURE.md           # System architecture
│   ├── API.md                    # API reference
│   ├── legacy/                   # Archived Windows docs
│   └── ...
│
├── backups/                      # Configuration backups (gitignored)
│
├── .env                          # Environment variables (gitignored)
├── .env.example                  # Environment template
├── config.json                   # Application configuration
├── package.json                  # Node.js project manifest
└── README.md                     # This file
```

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run coverage

# Run specific test file
npx jest tests/functions.test.js

# Run in watch mode (for development)
npx jest --watch
```

### Test Coverage

Current test coverage:

- **118 unit tests** passing across 7 test suites
- Core business logic fully tested (functions.js, service.js)
- PDF generation tested with mocks
- API client error handling and pagination tested
- Email service error scenarios tested
- Webhook notifications tested
- Health check module tested
- Service scheduling and retry logic tested

## 🐛 Troubleshooting

### Common Issues

**Service won't start**

- Check service status: `sudo systemctl status helloclub`
- View error logs: `journalctl -u helloclub -xe`
- Verify API_KEY in `.env` is correct
- Check file permissions: `/opt/helloclub/app/`

**No events being processed**

- Check category filters in `config.json`
- Verify events exist in the time window
- Run manually: `node src/index.js fetch-events`
- Check logs: `tail -f activity.log`

**Dashboard not accessible**

- Check service is running: `sudo systemctl status helloclub`
- Verify firewall: `sudo ufw status`
- Test locally: `curl http://localhost:3000`
- Check dashboard port in `.env`

**PDF not printing**

- Email mode: Verify SMTP credentials in `.env`
- Local mode: Check CUPS configuration: `lpstat -p`
- Test email: Use dashboard "Test Email Connection"
- Check `error.log` for printing errors

**401 Unauthorized errors**

- Your API_KEY is invalid or expired
- Get a new key from Hello Club
- Update `.env` and restart service

**Webhook not receiving notifications**

- Verify `webhook.enabled` is `true` in `config.json`
- Check that the webhook URL is accessible from your server
- Ensure URL uses HTTPS (HTTP localhost URLs are blocked for security)
- Check `error.log` for webhook delivery failures

**Events failing repeatedly**

- Check `error.log` for the specific error message
- Events are retried 3 times with exponential backoff (5min, 10min, 20min)
- After 3 failures, the event is marked as permanently failed
- Use the health check file (`service-health.json`) to monitor failed job counts

**Database errors**

- Ensure the database file (`events.db`) is not locked by another process
- Check disk space availability
- Try deleting `events.db` and restarting (will re-fetch events)

See [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) for more solutions.

## 🤝 Contributing

Contributions are welcome! Please see [DEVELOPMENT.md](./docs/DEVELOPMENT.md) for:

- Development setup
- Code style guidelines
- Testing requirements
- Pull request process

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Hello Club](https://helloclub.com/) for the excellent event management platform
- [node-windows](https://github.com/coreybutler/node-windows) for Windows service integration
- [Electron](https://www.electronjs.org/) for the system tray application
- [PDFKit](https://pdfkit.org/) for PDF generation

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/issues)
- **Documentation**: See the `docs/` folder
- **Email**: Check the package.json for contact information

---

**Made with ❤️ for Hello Club users**
