# Hello Club Event Attendance Auto-Print

> Automated Windows service for printing Hello Club event attendance lists with system tray monitoring

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/tests-20%20passing-success)](./tests)

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

Hello Club Event Attendance Auto-Print is a professional Windows application that automatically fetches, monitors, and prints attendee lists for upcoming Hello Club events. It runs as a Windows Service in the background and provides a system tray interface for easy monitoring and control.

### How It Works

The application uses a smart two-stage process:

1. **Event Discovery** - Periodically scans the Hello Club API for upcoming events
2. **Just-in-Time Processing** - Fetches the latest attendee list moments before an event starts
3. **Automatic Printing** - Generates a professional PDF and prints it (locally or via email)

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    System Tray App                      │
│              (Electron-based Monitor)                   │
│  • Visual status indicator (green/yellow/red)           │
│  • Service control (start/stop/restart)                 │
│  • Log viewer & notifications                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Windows Service                        │
│            (Always-Running Background)                  │
│  • Fetches events every N hours                         │
│  • Schedules processing for each event                  │
│  • Auto-restarts on failure                             │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   [Hello Club]  [SQLite DB]  [Printer]
      API        (Event Queue)  (Local/Email)
```

## ✨ Features

### Core Features
- ✅ **Automated Event Fetching** - Scans for upcoming events within configurable time windows
- ✅ **Smart Scheduling** - Processes events at optimal times to capture last-minute sign-ups
- ✅ **Professional PDFs** - Generates clean, printable attendee lists with custom layouts
- ✅ **Flexible Printing** - Print locally or send via email to network printers
- ✅ **Category Filtering** - Only process events from specified categories

### Windows Service Features
- ✅ **Always Running** - Starts automatically with Windows
- ✅ **Self-Healing** - Automatically restarts if it crashes
- ✅ **Background Operation** - Runs without user interaction
- ✅ **Production Ready** - Built with `node-windows` for reliability

### System Tray Features
- 🟢 **Visual Status** - Color-coded icon (Green=Running, Red=Stopped, Yellow=Warning)
- 📊 **Real-time Monitoring** - Shows service status and recent activity
- 📝 **Log Viewer** - Browse activity and error logs in a clean interface
- 🔔 **Notifications** - Desktop alerts when events are processed
- 🎛️ **Service Control** - Start, stop, and restart the service from the tray
- ⚙️ **Settings GUI** - Edit configuration and credentials without touching files
- 🔌 **Connection Tests** - Test API and Email connections with one click

### Developer Features
- ✅ **Comprehensive Tests** - 20+ unit tests with Jest
- ✅ **Type Safety** - Joi schema validation for all configuration
- ✅ **Error Handling** - Robust error handling with detailed logging
- ✅ **Modular Architecture** - Clean separation of concerns
- ✅ **Well Documented** - Extensive JSDoc comments

## 🚀 Quick Start

### For End Users (Recommended)

**Download and run the installer** - The easiest way to get started:

1. Download `HelloClubEventAttendance-Setup-1.1.0.exe` from the [Releases](https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/releases) page
2. Run the installer (**No administrator rights required!**)
   - Installs to your user folder (`%LOCALAPPDATA%\Hello Club Event Attendance`)
   - Administrator privileges only needed if you want the optional Windows service
3. Follow the friendly setup wizard:
   - Enter your Hello Club API key
   - Configure email printing (optional)
   - Optionally install Windows service (requires admin, unchecked by default)
4. The installer automatically:
   - Installs Node.js dependencies
   - Creates your configuration file
   - Launches the tray monitor

**That's it!** The tray icon will appear in your taskbar. Right-click it to:
- View logs and status
- Edit settings
- Test API and Email connections
- Control the service (if installed)

### For Developers

If you want to run from source or contribute:

```bash
# 1. Clone the repository
git clone https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print.git
cd Hello-Club-Event-Attendance-Auto-Print

# 2. Install dependencies
npm install

# 3. Configure your API key
copy .env.example .env
# Edit .env and add your API_KEY

# 4. Install the Windows Service (requires admin)
npm run service:install

# 5. Start the tray monitor
npm run tray
```

## 📦 Installation

### Detailed Installation Steps

#### 1. System Requirements

- **Operating System**: Windows 10 or later
- **Node.js**: Version 16.0.0 or higher
- **Build Tools**: Required for native modules
  - Windows: Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/)
  - Or install via npm: `npm install --global windows-build-tools`

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

#### 4. Install as Windows Service (Optional)

**Important**: This step requires Administrator privileges and is **optional**. You can use the tray monitor without the service.

The Windows service provides:
- Automatic start with Windows
- Background operation even when not logged in
- Auto-restart on failure

To install the service:

```bash
# Open PowerShell or Command Prompt as Administrator
npm run service:install
```

The service will be installed as "HelloClubEventAttendance" and set to start automatically with Windows.

**Without the service**: Simply run the tray monitor (`npm run tray`) and it will handle event processing while you're logged in.

#### 5. Start the Tray Monitor

```bash
npm run tray
```

The tray icon will appear in your system tray (bottom-right corner of Windows taskbar).

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

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `API_KEY` | ✅ Yes | Hello Club API authentication key | - |
| `PRINTER_EMAIL` | For email mode | Email address of network printer | - |
| `SMTP_USER` | For email mode | SMTP username (e.g., Gmail address) | - |
| `SMTP_PASS` | For email mode | SMTP password or app-specific password | - |
| `SMTP_HOST` | For email mode | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | For email mode | SMTP server port | `587` |
| `EMAIL_FROM` | For email mode | Sender email address | Same as `SMTP_USER` |

### Application Settings (`config.json`)

See [CONFIGURATION.md](./docs/CONFIGURATION.md) for detailed configuration documentation.

## 📖 Usage

### System Tray Interface

The system tray icon provides quick access to all functionality:

**Icon Colors:**
- 🟢 **Green** - Service running normally
- 🔴 **Red** - Service stopped or error
- 🟡 **Yellow** - Service starting or warning

**Right-click Menu:**
- **View Logs** - Open log viewer window with real-time updates
- **Settings** ⚙️ **NEW!** - Edit configuration via GUI
  - Environment variables (API key, SMTP credentials)
  - Application settings (categories, timing, PDF layout)
  - Automatic validation and backup
- **Test API Connection** 🔌 **NEW!** - Verify Hello Club API connectivity
- **Test Email Connection** 🔌 **NEW!** - Verify SMTP settings
- **Check Status Now** - Force status refresh
- **Start/Stop/Restart Service** - Control the service
- **Open Services Manager** - Windows services.msc
- **Open Project Folder** - Browse application files
- **Quit** - Exit tray application (service continues running)

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
# Fetch events once
node src/index.js fetch-events

# Process pending events once
node src/index.js process-schedule

# Run as continuous service (in console)
node src/index.js start-service

# View help
node src/index.js --help
```

### Service Management

```bash
# Install the service
npm run service:install

# Check service status
npm run service:status

# Uninstall the service
npm run service:uninstall

# Windows services.msc
services.msc
```

### Log Files

Logs are written to the project root:

- **`activity.log`** - Normal operations, events processed
- **`error.log`** - Errors and warnings only

View logs via:
- System tray → "View Logs"
- Open files directly in any text editor
- Command: `npm run logs` (if you add this script)

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design and architecture |
| [API.md](./docs/API.md) | Module and function reference |
| [CONFIGURATION.md](./docs/CONFIGURATION.md) | Detailed configuration guide |
| [DEVELOPMENT.md](./docs/DEVELOPMENT.md) | Developer setup and contribution guide |
| [WINDOWS-SERVICE-SETUP.md](./docs/WINDOWS-SERVICE-SETUP.md) | Windows service installation guide |
| [TRAY-APP-GUIDE.md](./docs/TRAY-APP-GUIDE.md) | System tray application guide |
| [INSTALLER-USER-GUIDE.md](./docs/INSTALLER-USER-GUIDE.md) | Installer creation guide |
| [TESTING-GUIDE.md](./docs/TESTING-GUIDE.md) | Testing documentation |
| [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) | Common issues and solutions |

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
├── service/                      # Windows Service management
│   ├── install.js                # Service installation script
│   ├── uninstall.js              # Service removal script
│   └── status.js                 # Service status checker
│
├── tray-app/                     # Electron system tray app
│   ├── main.js                   # Electron main process
│   ├── log-viewer.html           # Log viewer UI
│   ├── icons/                    # Tray icons
│   └── start-tray.bat            # Tray launcher script
│
├── installer/                    # Inno Setup installer
│   ├── setup.iss                 # Inno Setup script
│   ├── build-installer.bat       # Build automation
│   └── *.bat                     # Helper scripts
│
├── tests/                        # Unit tests
│   ├── functions.test.js         # Core logic tests
│   └── pdf-generator.test.js     # PDF generation tests
│
├── migrations/                   # Database migrations
│   └── 001-initial-schema.sql    # Initial database schema
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── CONFIGURATION.md
│   └── ...
│
├── bin/                          # Generated binaries (gitignored)
│   └── daemon/                   # Windows service daemon files
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
- **20 unit tests** passing
- Core business logic fully tested
- PDF generation tested with mocks
- API client error handling tested

## 🐛 Troubleshooting

### Common Issues

**Service won't start**
- Ensure you installed as Administrator
- Check `error.log` for details
- Verify API_KEY in `.env` is correct

**No events being processed**
- Check category filters in `config.json`
- Verify events exist in the time window
- Run `node src/index.js fetch-events` manually

**Tray icon not showing**
- Check Windows notification area settings
- Restart the tray app: `npm run tray`
- Look for errors in console

**PDF not printing**
- Local mode: Install SumatraPDF on Windows
- Email mode: Verify SMTP credentials in `.env`
- Check `error.log` for printing errors

**401 Unauthorized errors**
- Your API_KEY is invalid or expired
- Get a new key from Hello Club
- Update `.env` and restart service

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
