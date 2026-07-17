# Hello Club Event Attendance Auto-Print

> Automated Raspberry Pi service for printing Hello Club event attendance lists, driven by `print:` tags in event descriptions

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-209%20passing-success)](./tests)
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

Hello Club Event Attendance Auto-Print is a Raspberry Pi service that automatically fetches and prints attendee lists for upcoming Hello Club events. It runs as a headless systemd service in the background. You choose which events to print by adding a `print:` tag to the event's description in Hello Club — no per-event configuration on the Pi.

### How It Works

The application uses a smart two-stage process:

1. **Event Discovery** - Periodically scans the Hello Club API for upcoming events and keeps those whose description contains a `print:` tag
2. **Just-in-Time Processing** - Fetches the latest attendee list moments before an event starts (lead time set by the tag or config default)
3. **Automatic Printing** - Generates a professional PDF and prints it (locally or via email, per the tag or config default)

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  systemd Service                        │
│            (Always-Running Background)                  │
│  • Fetches events every N hours                         │
│  • Selects events tagged `print:` in their description  │
│  • Schedules processing for each event                  │
│  • Auto-restarts on failure                             │
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
- ✅ **Tag-Based Selection** - Print only the events you tag with `print:` in their Hello Club description
- ✅ **Per-Event Overrides** - Set lead time, copies, and print mode per event via the tag
- ✅ **Smart Scheduling** - Processes events at optimal times to capture last-minute sign-ups
- ✅ **Professional PDFs** - Generates clean, printable attendee lists with custom layouts
- ✅ **Flexible Printing** - Print locally or send via email to network printers

### Raspberry Pi Service Features

- ✅ **Always Running** - Starts automatically with Raspberry Pi via systemd
- ✅ **Self-Healing** - Automatically restarts if it crashes
- ✅ **Background Operation** - Runs headless without user interaction
- ✅ **Production Ready** - Battle-tested systemd service management
- ✅ **Low Power** - Energy-efficient 24/7 operation

### Developer Features

- ✅ **Comprehensive Tests** - 209 unit tests with Jest
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
3. Edit `/opt/helloclub/app/.env` with your Hello Club API key and (for email printing) SMTP settings
4. Adjust defaults in `/opt/helloclub/app/config.json` if needed (lead time, print mode, PDF layout)
5. In Hello Club, add a `print:` tag to the description of each event you want printed (see [Selecting events](#selecting-events-to-print))

**That's it!** The service runs 24/7 in the background. Monitor it with:

```bash
sudo systemctl status helloclub
journalctl -u helloclub -f
```

**To upgrade to the latest version:**

```bash
cd /opt/helloclub/app
sudo bash setup/pi-upgrade.sh
```

The upgrade script automatically pulls the latest code, preserves your settings, and restarts services. See the [Raspberry Pi Setup Guide](./docs/RASPBERRY-PI-SETUP.md#upgrading-to-latest-version) for details.

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

# Or run the stages individually
node src/index.js fetch-events        # Fetch + store tagged events once
node src/index.js process-schedule    # Process any due events once
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

- `better-sqlite3` - Local database
- `pdfkit` - PDF generation
- `winston` - Logging
- `axios` - API client
- `nodemailer` - Email service
- `yargs` / `joi` - CLI parsing and config validation
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

**Edit `config.json`** (these are the fallback defaults; each event's `print:` tag can override lead time and print mode):

```json
{
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

#### Selecting events to print

Add a `print:` tag to the **description** of each event you want printed in Hello Club. Only tagged events are printed. The tag is case-insensitive and may appear anywhere in the description:

- `print:` — print using the config.json defaults
- `print: 30min` — fetch and print 30 minutes before the event starts
- `print: 30min 2copies email` — 30-min lead, 2 copies, emailed

Omitted parameters fall back to `config.json`. Removing the tag cancels a pending print. See [CONFIGURATION.md](./docs/CONFIGURATION.md#selecting-events-to-print-the-print-tag) for the full syntax.

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

#### 5. Verify

```bash
sudo systemctl status helloclub
journalctl -u helloclub -f
```

### Legacy Windows Installation

> **⚠️ Note:** Windows deployment is no longer recommended. For new deployments, use Raspberry Pi 5 (see above).

**For Existing Windows Users (v1.0.x):**

If you're currently running on Windows, you can continue using it with manual installation:

1. Clone repository: `git clone https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print.git`
2. Install dependencies: `npm install`
3. Create `.env` file with your credentials
4. Run: `node src/index.js start-service`

**Windows-specific documentation:**

- [Windows Service Setup](./docs/legacy/WINDOWS-SERVICE-SETUP.md)
- [Tray App Guide](./docs/legacy/TRAY-APP-GUIDE.md)
- [Installer User Guide](./docs/legacy/INSTALLER-USER-GUIDE.md)
- [Build Installer](./docs/legacy/BUILD-INSTALLER.md)

**Migration to Raspberry Pi:**

We recommend migrating to Raspberry Pi for:

- ✅ Lower power consumption (~10W vs 100W+)
- ✅ Silent 24/7 operation
- ✅ Better reliability for always-on service
- ✅ Lower cost (~$80 total)
- ✅ Remote management over SSH

See [RASPBERRY-PI-SETUP.md](./docs/RASPBERRY-PI-SETUP.md) for migration guide.

## ⚙️ Configuration

### Configuration Files

The application uses two configuration files:

1. **`.env`** - Secrets and credentials (never commit this! Already in .gitignore)
2. **`config.json`** - Application settings (safe to commit - no secrets)

**Configuration Options:**

- **Machine settings** (API key, SMTP, printer) live in `.env`.
- **Defaults** (lead time, print mode, PDF layout) live in `config.json`.
- **Per-event selection and overrides** live in the event's `print:` description tag in Hello Club.

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

### Monitoring

The service is headless — monitor it through systemd and the logs:

```bash
sudo systemctl status helloclub    # Running state
journalctl -u helloclub -f         # Follow the journal
tail -f activity.log               # Winston activity log (in the app directory)
tail -f error.log                  # Winston error log
```

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

- **Terminal**: `tail -f /opt/helloclub/app/activity.log`
- **systemd**: `journalctl -u helloclub -f`
- **SSH**: Any text editor (nano, vim, cat)

## 📚 Documentation

> **📖 Complete Documentation Index:** See [docs/INDEX.md](./docs/INDEX.md) for organized documentation by role and topic.

### User Guides

| Document                                        | Description                                  |
| ----------------------------------------------- | -------------------------------------------- |
| [CONFIGURATION.md](./docs/CONFIGURATION.md)     | Detailed configuration + `print:` tag syntax |
| [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) | Common issues and solutions                  |

### Deployment Guides

| Document                                              | Description                        |
| ----------------------------------------------------- | ---------------------------------- |
| [RASPBERRY-PI-SETUP.md](./docs/RASPBERRY-PI-SETUP.md) | Raspberry Pi 5 setup and hardening |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md)                 | Production deployment guide        |

### Legacy Documentation

| Document                                    | Description                    |
| ------------------------------------------- | ------------------------------ |
| [legacy/](./docs/legacy/)                   | Archived Windows documentation |
| [legacy/README.md](./docs/legacy/README.md) | Windows platform overview      |

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
│   │   ├── tag-parser.js         # parseTag() — print: description tags
│   │   ├── functions.js          # Event processing logic
│   │   └── service.js            # Service scheduler
│   ├── services/                 # Supporting services
│   │   ├── email-service.js      # SMTP email sending
│   │   ├── cups-printer.js       # Local CUPS printing (lp)
│   │   ├── logger.js             # Winston logging configuration
│   │   └── pdf-generator.js      # PDF creation
│   ├── utils/                    # Utilities and helpers
│   │   ├── args-parser.js        # CLI argument parsing
│   │   └── config-schema.js      # Configuration validation
│   └── index.js                  # Application entry point
│
├── setup/                        # Raspberry Pi setup scripts
│   ├── pi-configure.sh           # System hardening script
│   ├── pi-install-app.sh         # Application installation
│   └── helloclub.service         # systemd service file
│
├── tests/                        # Unit tests (209 tests)
│   ├── api-client.test.js        # API client tests
│   ├── cups-printer.test.js      # Local printing tests
│   ├── email-service.test.js     # Email service tests
│   ├── functions.test.js         # Core logic tests
│   ├── tag-parser.test.js        # print: tag parsing tests
│   ├── pdf-generator.test.js     # PDF generation tests
│   ├── service.test.js           # Service scheduling tests
│   └── webhook.test.js           # Webhook notification tests
│
├── docs/                         # Documentation
│   ├── RASPBERRY-PI-SETUP.md     # Pi setup guide
│   ├── CONFIGURATION.md          # Config + print: tag syntax
│   ├── DEPLOYMENT.md             # Deployment guide
│   ├── ARCHITECTURE.md           # System architecture
│   ├── API.md                    # API reference
│   ├── legacy/                   # Archived Windows docs
│   └── ...
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

- Confirm the target events have a `print:` tag in their Hello Club description
- Verify events exist in the time window
- Remember a description edit can lag up to `serviceRunIntervalHours` + the API cache TTL
- Run manually: `node src/index.js fetch-events`
- Check logs: `tail -f activity.log`

**PDF not printing**

- Email mode: Verify SMTP credentials in `.env`
- Local mode: Check CUPS configuration: `lpstat -p`
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
- [Raspberry Pi Foundation](https://www.raspberrypi.org/) for affordable, reliable hardware
- [Node.js](https://nodejs.org/) and the open-source community
- [PDFKit](https://pdfkit.org/) for PDF generation
- Legacy Windows support: [node-windows](https://github.com/coreybutler/node-windows), [Electron](https://www.electronjs.org/)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/issues)
- **Documentation**: See the `docs/` folder
- **Email**: Check the package.json for contact information

---

**Made with ❤️ for Hello Club users**
