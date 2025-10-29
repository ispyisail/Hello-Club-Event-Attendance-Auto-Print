# Hello Club - Event Attendance Auto-Print

<div align="center">

**🎯 Enterprise-Grade Event Attendance List Automation**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()

*Automatically fetch, generate, and print event attendance lists from Hello Club API with enterprise-level reliability*

[Features](#-features) • [Quick Start](#-quick-start) • [Installation](#-installation-options) • [Documentation](#-documentation) • [Windows Service](#-windows-service) • [Building .exe](#-standalone-executable)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Quick Start](#-quick-start)
- [Installation Options](#-installation-options)
- [How It Works](#-how-it-works)
- [Configuration](#-configuration)
- [Commands](#-commands)
- [Windows Service](#-windows-service)
- [Standalone Executable](#-standalone-executable)
- [Monitoring & Observability](#-monitoring--observability)
- [Production Features](#-production-features)
- [Documentation](#-documentation)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

Hello Club Event Attendance Auto-Print is a production-ready automation tool that:

- **Fetches** upcoming events from Hello Club API
- **Generates** professional PDF attendance lists
- **Prints** automatically via local printer or email
- **Runs** as a Windows service with auto-start and auto-recovery
- **Monitors** system health with web dashboard and Prometheus metrics
- **Protects** against failures with circuit breakers and retry logic
- **Backs up** data automatically with configurable retention

Perfect for organizations, clubs, and event venues that need reliable, hands-free attendance list printing.

---

## ✨ Features

### 🚀 Core Features

- ✅ **Automated Event Fetching** - Automatically discovers upcoming events within configurable time window
- ✅ **Just-in-Time Processing** - Fetches final attendee list moments before event starts
- ✅ **Smart API Usage** - Two-stage process minimizes API calls while maximizing data freshness
- ✅ **Professional PDFs** - Clean, customizable PDF layouts with event details and attendee lists
- ✅ **Flexible Printing** - Local printer support OR email-to-printer delivery
- ✅ **SQLite Database** - Efficient local storage with WAL mode for better performance
- ✅ **Category Filtering** - Process only specific event categories
- ✅ **Highly Configurable** - Customize everything via config.json and .env

### 🛡️ Enterprise Features

#### **Reliability & Resilience**
- 🔄 **Circuit Breakers** - Automatic failure protection for API, email, printer, webhooks
- 📬 **Dead Letter Queue** - Failed jobs stored for manual retry and investigation
- ♻️ **Retry Logic** - Exponential backoff for transient failures
- 🔐 **Auto-Recovery** - Service restarts automatically on crashes

#### **Security**
- 🔒 **Secrets Masking** - Automatic masking of API keys, passwords, tokens in logs
- 🛡️ **URL Validation** - SSRF attack prevention for webhooks
- 🚫 **XSS Protection** - HTML escaping for web dashboard
- 🔑 **Input Validation** - Comprehensive validation with Joi schemas

#### **Performance**
- ⚡ **PDF Caching** - 5-minute TTL cache prevents redundant generation
- 🗄️ **WAL Mode** - SQLite Write-Ahead Logging for better concurrency
- 📊 **Database Optimization** - Tuned cache sizes and pragma settings
- 🚀 **Connection Pooling** - Efficient resource utilization

#### **Observability**
- 📈 **Prometheus Metrics** - HTTP server exposing standard metrics
- 📊 **Web Dashboard** - Real-time status, events, and health checks
- 📝 **Structured Logging** - Winston logger with file rotation
- 🔍 **Distributed Tracing** - Request ID propagation
- ❤️ **Health Checks** - Component-level status reporting

#### **Data Protection**
- 💾 **Automated Backups** - Scheduled backups with configurable intervals
- 🔄 **Backup Rotation** - Age-based retention (default 30 days)
- 📁 **Multi-File Backup** - Database, config, status, metrics, DLQ
- 🆘 **Emergency Backup** - Before restore operations

### 🎛️ Advanced Features

- 🪝 **Webhook Notifications** - Slack, Discord, or custom webhooks for events
- 🖨️ **Multi-Printer Routing** - Route categories to specific printers
- 🔍 **Advanced Filtering** - Keywords, attendee count, payment status
- 🔥 **Hot-Reload Config** - Update config.json without restart
- 🐳 **Docker Support** - Container-ready with docker-compose
- 🪟 **Windows Service** - Auto-start with Windows, GUI management
- 📦 **Standalone Executable** - No Node.js required for end users

### 🛠️ Developer Features

- ✅ **Comprehensive Tests** - Unit and integration test coverage
- 🔄 **CI/CD Ready** - GitHub Actions workflow included
- 📝 **TypeScript-Ready** - JSDoc comments for IntelliSense
- 🔍 **Linting Support** - ESLint configuration ready
- 📊 **Code Coverage** - Jest coverage reporting
- 🔒 **Security Scanning** - npm audit, Snyk, TruffleHog, Trivy

---

## 🚀 Quick Start

### **Option 1: Node.js** (For Developers)

```bash
# 1. Clone repository
git clone https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print.git
cd Hello-Club-Event-Attendance-Auto-Print

# 2. Install dependencies
npm install

# 3. Configure
cp .env.example .env
# Edit .env and add your API_KEY

cp config.json.example config.json
# Edit config.json to customize settings

# 4. Start service
npm start
```

**✅ You're running!** Check the web dashboard at http://localhost:3030

---

### **Option 2: Windows Service** (For Production)

```cmd
# 1. Install dependencies
npm install

# 2. Configure .env and config.json (see above)

# 3. Install as Windows service (NSSM - Recommended)
Double-click "NSSM - Step 1 - Download NSSM.bat"
Right-click "NSSM - Step 2 - Install Service.bat" → Run as administrator

# OR use node-windows
Right-click "Install Service.bat" → Run as administrator
```

**✅ Service installed!** Auto-starts with Windows, runs in background

See [Windows Service](#-windows-service) for details

---

### **Option 3: Standalone Executable** (For Non-Technical Users)

```cmd
# For developers: Build the executable
Double-click "Build Executable.bat"            # Builds hello-club.exe
Double-click "Build Distribution Package.bat"  # Creates portable package

# For end users: Run the executable
1. Extract HelloClub-Portable.zip
2. Copy .env.example to .env, add API_KEY
3. Copy config.json.example to config.json
4. Double-click "Start Service.bat"
```

**✅ Running without Node.js!** Perfect for distribution

See [Standalone Executable](#-standalone-executable) for details

---

## 📦 Installation Options

Choose the installation method that fits your needs:

| Method | Best For | Requires Node.js | Complexity | Auto-Start |
|--------|----------|------------------|------------|------------|
| **Node.js** | Developers, testing | ✅ Yes | ⭐ Easy | ❌ No |
| **Windows Service (NSSM)** | Production, servers | ✅ Yes | ⭐⭐ Medium | ✅ Yes |
| **Windows Service (node-windows)** | Quick production setup | ✅ Yes | ⭐ Easy | ✅ Yes |
| **Standalone .exe** | End users, distribution | ❌ No | ⭐⭐⭐ Advanced | ⚙️ Optional |
| **Docker** | Containers, cloud | ❌ No | ⭐⭐ Medium | ✅ Yes |

### **Detailed Installation**

#### **Prerequisites**

- **Node.js** v16+ (except for standalone .exe)
- **npm** (comes with Node.js)
- **API Key** from Hello Club
- **Windows 10+**, Linux, or macOS

For building from source:
- **Python 3.x** (for native modules)
- **C++ Compiler** (Windows: Visual Studio, Mac: Xcode, Linux: GCC)

#### **Step-by-Step Installation**

```bash
# 1. Clone the repository
git clone https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print.git
cd Hello-Club-Event-Attendance-Auto-Print

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
```

Edit `.env`:
```env
# Required
API_KEY=your_hello_club_api_key_here

# Optional - API Configuration
API_BASE_URL=https://api.helloclub.com

# Optional - Email Printing (if using printMode: "email")
PRINTER_EMAIL=printer@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=your_email@gmail.com

# Optional - Logging
LOG_TO_CONSOLE=true
NODE_ENV=production
```

```bash
# 4. Set up configuration
cp config.json.example config.json
```

Edit `config.json` (see [Configuration](#-configuration))

```bash
# 5. Test the installation
node src/index.js health-check

# 6. Start the service
npm start
```

---

## ⚙️ How It Works

### **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Hello Club Auto-Print                        │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │                             │
         ┌──────────▼──────────┐      ┌──────────▼──────────┐
         │   fetch-events      │      │  process-schedule   │
         │  (Hourly/Daily)     │      │   (Every minute)    │
         └──────────┬──────────┘      └──────────┬──────────┘
                    │                             │
         ┌──────────▼──────────┐      ┌──────────▼──────────┐
         │  Hello Club API     │      │  SQLite Database    │
         │  ┌──────────────┐   │      │  ┌──────────────┐   │
         │  │ GET /event   │   │      │  │SELECT events │   │
         │  │ GET /attend. │   │      │  │WHERE pending │   │
         │  └──────────────┘   │      │  └──────────────┘   │
         └──────────┬──────────┘      └──────────┬──────────┘
                    │                             │
         ┌──────────▼──────────┐      ┌──────────▼──────────┐
         │  Circuit Breaker    │      │   PDF Generator     │
         │  ┌──────────────┐   │      │  ┌──────────────┐   │
         │  │ API Circuit  │   │      │  │ PDFKit       │   │
         │  └──────────────┘   │      │  └──────────────┘   │
         └──────────┬──────────┘      └──────────┬──────────┘
                    │                             │
         ┌──────────▼──────────┐      ┌──────────▼──────────┐
         │  Store in Database  │      │    PDF Cache        │
         │  events.db (SQLite) │      │  ┌──────────────┐   │
         └─────────────────────┘      │  │ 5-min TTL    │   │
                                      │  └──────────────┘   │
                                      └──────────┬──────────┘
                                                 │
                                      ┌──────────▼──────────┐
                                      │   Print/Email       │
                                      │  ┌──────────────┐   │
                                      │  │Local Printer │   │
                                      │  │  OR Email    │   │
                                      │  └──────────────┘   │
                                      └──────────┬──────────┘
                                                 │
                                      ┌──────────▼──────────┐
                                      │  Circuit Breaker    │
                                      │  ┌──────────────┐   │
                                      │  │Printer/Email │   │
                                      │  └──────────────┘   │
                                      └─────────────────────┘
```

### **Two-Stage Process**

#### **Stage 1: Event Discovery** (`fetch-events`)
- Runs periodically (hourly/daily)
- Queries Hello Club API for upcoming events
- Applies category filters
- Stores events in SQLite database
- **Protected by:** API circuit breaker, rate limiting

#### **Stage 2: Just-in-Time Processing** (`process-schedule`)
- Runs frequently (every minute)
- Checks database for upcoming events
- When event is near (e.g., 60 min before):
  - Fetches latest attendee list
  - Generates PDF (or uses cache)
  - Prints via local printer or email
- **Protected by:** Circuit breakers, DLQ, retry logic

### **Service Mode** (`start-service`)

Combines both stages into one continuous process:
- Runs `fetch-events` on schedule (e.g., every 24 hours)
- Continuously monitors for events to process
- Auto-recovers from failures
- Logs everything to files
- Provides web dashboard for monitoring

---

## 🔧 Configuration

### **Environment Variables** (`.env`)

```env
# ============================================================================
# REQUIRED
# ============================================================================

# Your Hello Club API key (REQUIRED)
API_KEY=your_api_key_here

# ============================================================================
# OPTIONAL - API Configuration
# ============================================================================

# API base URL (default: https://api.helloclub.com)
# API_BASE_URL=https://api.helloclub.com

# ============================================================================
# OPTIONAL - Email Printing Configuration
# Only needed if printMode is set to "email" in config.json
# ============================================================================

# Printer's email address
PRINTER_EMAIL=printer@example.com

# SMTP server settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here

# Email "from" address
EMAIL_FROM=your_email@gmail.com

# ============================================================================
# OPTIONAL - Logging Configuration
# ============================================================================

# Enable console logging in production (default: false)
LOG_TO_CONSOLE=true

# Environment (development or production)
NODE_ENV=production
```

### **Application Configuration** (`config.json`)

```jsonc
{
  // ========================================================================
  // Event Filtering
  // ========================================================================

  // Event categories to process (empty array = all categories)
  "categories": ["Sports", "Social"],

  // ========================================================================
  // Timing Configuration
  // ========================================================================

  // How far ahead to fetch events (in hours)
  // Default: 168 hours (7 days)
  "fetchWindowHours": 168,

  // How many minutes before event to fetch attendees and print
  // Default: 60 minutes
  "preEventQueryMinutes": 60,

  // How often to fetch new events (in hours)
  // Only used in service mode
  // Default: 24 hours
  "serviceRunIntervalHours": 24,

  // ========================================================================
  // Printing Configuration
  // ========================================================================

  // Print mode: "local" or "email"
  "printMode": "local",

  // PDF filename (default: "attendance.pdf")
  "outputFilename": "attendance.pdf",

  // PDF layout customization
  "pdfLayout": {
    "title": "Event Attendance List",
    "fontSize": 10,
    "margin": 50,
    "headerColor": "#333333"
  },

  // ========================================================================
  // Multi-Printer Routing (Optional)
  // Route specific event categories to specific printers
  // ========================================================================

  "printers": {
    "Sports": {
      "type": "local",
      "name": "HP_LaserJet_Sports"
    },
    "Social": {
      "type": "email",
      "email": "social-printer@example.com"
    }
  },

  // ========================================================================
  // Advanced Filtering (Optional)
  // ========================================================================

  "filters": {
    // Keyword filtering
    "keywords": {
      "include": ["tournament", "championship"],
      "exclude": ["cancelled", "postponed"]
    },

    // Attendee count filtering
    "attendeeCount": {
      "min": 5,
      "max": 100
    },

    // Payment status filtering
    "paymentStatus": ["paid", "pending"]
  },

  // ========================================================================
  // Webhook Notifications (Optional)
  // ========================================================================

  "webhooks": {
    // Fired when event is processed successfully
    "onSuccess": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",

    // Fired when an error occurs
    "onError": "https://hooks.slack.com/services/YOUR/ERROR/URL",

    // Fired when service starts
    "onStart": "https://hooks.slack.com/services/YOUR/START/URL",

    // Fired on health warnings
    "onWarning": "https://hooks.slack.com/services/YOUR/WARNING/URL"
  },

  // ========================================================================
  // Configuration Hot-Reload (Optional)
  // ========================================================================

  // Watch config.json for changes and reload without restart
  "watchConfig": true
}
```

### **Example Configurations**

#### **Minimal Configuration**
```json
{
  "categories": [],
  "fetchWindowHours": 168,
  "preEventQueryMinutes": 60,
  "printMode": "local",
  "serviceRunIntervalHours": 24
}
```

#### **Email Printing**
```json
{
  "categories": [],
  "fetchWindowHours": 168,
  "preEventQueryMinutes": 60,
  "printMode": "email",
  "serviceRunIntervalHours": 24
}
```

Also set in `.env`:
```env
PRINTER_EMAIL=printer@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

#### **Multi-Printer with Webhooks**
```json
{
  "categories": ["Sports", "Social", "Arts"],
  "fetchWindowHours": 168,
  "preEventQueryMinutes": 60,
  "printMode": "local",
  "serviceRunIntervalHours": 24,
  "printers": {
    "Sports": {
      "type": "local",
      "name": "Sports_Printer"
    },
    "Social": {
      "type": "local",
      "name": "Social_Printer"
    },
    "Arts": {
      "type": "email",
      "email": "arts-printer@example.com"
    }
  },
  "webhooks": {
    "onSuccess": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
    "onError": "https://hooks.slack.com/services/YOUR/ERROR/URL"
  }
}
```

---

## 💻 Commands

### **Service Management**

```bash
# Start as continuous service (recommended)
node src/index.js start-service
# OR
npm start

# Start web dashboard (monitoring GUI)
node src/index.js dashboard [--port 3030]
```

### **Manual Operations**

```bash
# Fetch upcoming events from API
node src/index.js fetch-events

# Process events that are due for printing
node src/index.js process-schedule

# Preview a specific event
node src/index.js preview-event <eventId>
```

### **Database Management**

```bash
# List events in database
node src/index.js list-events [--status all|pending|processed] [--limit 50]

# Clean up old processed events
node src/index.js cleanup [--days 30] [--dry-run]

# Backup database
node src/index.js backup [path]

# Restore database from backup
node src/index.js restore <path>
```

### **Testing & Diagnostics**

```bash
# Health check (checks all components)
node src/index.js health-check

# Test email configuration
node src/index.js test-email [recipient]

# Test local printer
node src/index.js test-printer [printer-name]

# View API statistics
node src/index.js api-stats [--minutes 60]
```

### **Monitoring & Metrics**

```bash
# Start Prometheus metrics server
node src/index.js metrics-server [--port 9090]

# View application metrics
node src/index.js metrics

# Reset metrics
node src/index.js metrics-reset

# View/manage circuit breakers
node src/index.js circuit-breaker-status
node src/index.js circuit-breaker-reset <name>

# View/manage dead letter queue
node src/index.js dlq
node src/index.js dlq-retry <id>
node src/index.js dlq-cleanup [--days 30]
```

### **Backup Management**

```bash
# Schedule automated backups
node src/index.js backup-schedule [--interval 24]

# List all backups
node src/index.js backup-list

# Rotate old backups
node src/index.js backup-rotate [--days 30]
```

### **Cache Management**

```bash
# View PDF cache statistics
node src/index.js cache-stats

# Clear PDF cache
node src/index.js cache-clear
```

### **Help**

```bash
# Show all available commands
node src/index.js --help

# Show version
node src/index.js --version
```

---

## 🪟 Windows Service

Run Hello Club as a Windows service that starts automatically with Windows and restarts on failure.

### **Option 1: NSSM** (Recommended - Most Reliable)

**Why NSSM:**
- ✅ Production-grade reliability
- ✅ Full GUI configuration
- ✅ Built-in log rotation
- ✅ Easy updates (just restart, no reinstall)
- ✅ Industry standard

**Installation:**

```cmd
# Step 1: Download NSSM
Double-click "NSSM - Step 1 - Download NSSM.bat"

# Step 2: Install Service (as Administrator)
Right-click "NSSM - Step 2 - Install Service.bat"
Select "Run as administrator"

# Step 3: Verify
Double-click "Start Dashboard.bat"
Open http://localhost:3030
```

**Management:**

```cmd
# GUI Management Menu
Double-click "NSSM - Manage Service.bat"

# Options:
# 1. Start Service
# 2. Stop Service
# 3. Restart Service
# 4. View Status
# 5. Edit Configuration (opens GUI)
# 6. View Logs
# 7. Uninstall Service
# 8. Open Windows Services
```

**Service Details:**
- **Name:** HelloClubAttendance
- **Display Name:** Hello Club Event Attendance
- **Startup:** Automatic
- **Restart:** On failure (5 second delay)
- **Logs:** activity.log, error.log (10MB rotation)

See [NSSM-QUICK-START.md](NSSM-QUICK-START.md) for full guide.

---

### **Option 2: node-windows** (Quick Setup)

**Why node-windows:**
- ✅ Quick installation
- ✅ No downloads needed
- ✅ Good for testing

**Installation:**

```cmd
# Install (as Administrator)
Right-click "Install Service.bat"
Select "Run as administrator"

# Uninstall (as Administrator)
Right-click "Uninstall Service.bat"
Select "Run as administrator"
```

See [WINDOWS-SERVICE-SETUP.md](WINDOWS-SERVICE-SETUP.md) for details.

---

### **Managing Windows Service**

**Windows Services GUI:**
```cmd
# Open Services
Press Win+R → type "services.msc" → Enter

# Find "HelloClubAttendance" or "Hello Club Event Attendance"
# Right-click for Start/Stop/Restart/Properties
```

**Command Line:**
```cmd
# Start
net start HelloClubAttendance

# Stop
net stop HelloClubAttendance

# Restart
net stop HelloClubAttendance && net start HelloClubAttendance

# Check status
sc query HelloClubAttendance
```

**Updating the Application:**
```cmd
# 1. Stop service
net stop HelloClubAttendance

# 2. Update code
git pull
npm install

# 3. Start service
net start HelloClubAttendance

# No reinstall needed!
```

---

## 📦 Standalone Executable

Build Hello Club as a standalone `.exe` that **does NOT require Node.js** on end-user machines.

### **Building the Executable**

```cmd
# Step 1: Build executable (~2-5 minutes)
Double-click "Build Executable.bat"
# Creates: dist/hello-club.exe (~80-100MB)

# Step 2: Create distribution package
Double-click "Build Distribution Package.bat"
# Creates: dist/HelloClub-Portable/ and dist/HelloClub-Portable.zip
```

### **Distribution Package Contents**

```
HelloClub-Portable/
├── hello-club.exe              # Standalone executable
├── .env.example                # Configuration template
├── config.json.example         # Settings template
├── QUICK-START-EXE.md         # User guide
├── README.md                   # Full documentation
├── Start Service.bat           # Launch service
├── Start Dashboard.bat         # Open dashboard
├── Show Commands.bat           # List commands
├── Health Check.bat            # Check status
└── backups/                    # Backup folder
```

### **For End Users** (No Node.js Required!)

```cmd
# 1. Extract HelloClub-Portable.zip

# 2. Copy .env.example to .env
# Edit .env and add your API_KEY

# 3. Copy config.json.example to config.json
# Customize settings if needed

# 4. Double-click "Start Service.bat"

# Done! No Node.js installation needed!
```

### **All Commands Work**

```cmd
# Use exe instead of node
hello-club.exe start-service
hello-club.exe dashboard
hello-club.exe health-check
hello-club.exe --help
# ... all commands supported
```

### **Installing as Windows Service** (with exe)

```cmd
# Using NSSM (recommended)
nssm install HelloClubAttendance
# In GUI:
#   Path: C:\path\to\hello-club.exe
#   Arguments: start-service

# Using sc command
sc create HelloClubAttendance binPath= "C:\path\to\hello-club.exe start-service" start= auto
sc start HelloClubAttendance
```

See [BUILDING-EXECUTABLE.md](BUILDING-EXECUTABLE.md) for complete guide.

---

## 📊 Monitoring & Observability

### **Web Dashboard**

Real-time monitoring interface:

```bash
# Start dashboard
node src/index.js dashboard
# OR
Double-click "Start Dashboard.bat"

# Open browser
http://localhost:3030
```

**Features:**
- ✅ Real-time service status
- ✅ Event statistics (total, pending, processed)
- ✅ System health checks
- ✅ Configuration display
- ✅ Recent events list
- ✅ Auto-refresh (30 seconds)

### **Prometheus Metrics**

Expose metrics in Prometheus format:

```bash
# Start metrics server
node src/index.js metrics-server --port 9090

# Access metrics
curl http://localhost:9090/metrics

# Health endpoint
curl http://localhost:9090/health
```

**Available Metrics:**
- Circuit breaker states and statistics
- Dead letter queue metrics
- Backup status
- Database metrics
- Node.js process metrics (memory, uptime)
- Custom application metrics

**Configure Prometheus:**
```yaml
scrape_configs:
  - job_name: 'hello-club'
    static_configs:
      - targets: ['localhost:9090']
```

### **Logging**

**Log Files:**
- `activity.log` - All operations (info level)
- `error.log` - Errors only
- `status.json` - Service status snapshot
- `metrics.json` - Application metrics

**Features:**
- ✅ Winston logger with structured logging
- ✅ Automatic secrets masking (API keys, passwords hidden)
- ✅ Timestamp, log level, context
- ✅ Stack traces for errors
- ✅ Console output (development)

**View Logs:**
```cmd
# GUI
Double-click "View Logs.bat"

# Command line
type activity.log
type error.log

# Live tail
powershell -command "Get-Content activity.log -Tail 50 -Wait"
```

### **Health Checks**

```bash
# Run health check
node src/index.js health-check
```

**Checks:**
- ✅ Database connectivity
- ✅ API reachability
- ✅ Configuration validity
- ✅ Disk space
- ✅ Email configuration (if used)
- ✅ Printer availability (if local)
- ✅ Circuit breaker states
- ✅ Dead letter queue size

**Output:**
```
OVERALL STATUS: HEALTHY

Database:        OK
API Connection:  OK
Email Config:    OK (or N/A)
Printer:         OK (or N/A)
Disk Space:      OK
Config Valid:    OK
API Circuit:     CLOSED (healthy)
Email Circuit:   CLOSED (healthy)
```

---

## 🛡️ Production Features

### **Circuit Breakers**

Protect against cascading failures:

```javascript
// Automatically wraps:
// - API calls (getEventDetails, getUpcomingEvents, getAllAttendees)
// - Email sending
// - Printer operations
// - Webhook calls
```

**States:**
- **CLOSED** - Normal operation
- **OPEN** - Too many failures, rejecting calls
- **HALF_OPEN** - Testing recovery

**Management:**
```bash
# View circuit breaker status
node src/index.js circuit-breaker-status

# Reset circuit breaker
node src/index.js circuit-breaker-reset api
node src/index.js circuit-breaker-reset email
node src/index.js circuit-breaker-reset printer
node src/index.js circuit-breaker-reset webhook
```

### **Dead Letter Queue**

Failed jobs stored for investigation:

```bash
# View failed jobs
node src/index.js dlq

# Retry specific job
node src/index.js dlq-retry <job-id>

# Cleanup old entries
node src/index.js dlq-cleanup --days 30
```

**Storage:** `dead-letter-queue.json`

**Contains:**
- Job type (print, email, etc.)
- Failed data
- Error message and stack trace
- Retry count
- Timestamp

### **Automated Backups**

```bash
# Schedule backups (in service mode)
# Runs automatically every 24 hours

# Manual commands
node src/index.js backup-schedule --interval 24
node src/index.js backup-list
node src/index.js backup-rotate --days 30
```

**Backs up:**
- events.db (SQLite database)
- status.json (service status)
- metrics.json (metrics data)
- dead-letter-queue.json (failed jobs)
- config.json (configuration)

**Location:** `backups/` folder
**Naming:** `<filename>_backup_YYYY-MM-DD_HH-mm-ss.<ext>`
**Retention:** Configurable (default 30 days)

### **PDF Caching**

Prevents redundant PDF generation:

- **Cache Key:** MD5 hash of event + attendees
- **TTL:** 5 minutes
- **Location:** `.pdf-cache/`
- **Auto-cleanup:** Every minute

```bash
# View cache statistics
node src/index.js cache-stats

# Clear cache
node src/index.js cache-clear
```

### **Retry Logic**

Exponential backoff for transient failures:

- **Initial delay:** 2 seconds
- **Max attempts:** 3
- **Backoff:** Exponential with jitter
- **Applies to:** API calls, email, printing

### **Rate Limiting**

API rate limiting and tracking:

```bash
# View API statistics
node src/index.js api-stats --minutes 60
```

**Tracks:**
- Request count per endpoint
- Response times
- Rate limit headers
- Error rates

---

## 📚 Documentation

Comprehensive documentation included:

| Document | Purpose |
|----------|---------|
| **README.md** | Main documentation (this file) |
| **WINDOWS-SERVICE-SETUP.md** | Complete Windows service guide |
| **NSSM-QUICK-START.md** | NSSM installation and management |
| **BUILDING-EXECUTABLE.md** | Building standalone .exe |
| **IMPROVEMENTS-FEATURES-1-6.md** | Enterprise features implementation |
| **QUICK-START-EXE.md** | End-user guide for .exe version |
| **.env.example** | Environment variable template |
| **config.json.example** | Configuration template |

### **Quick Links**

- [Windows Service Setup](WINDOWS-SERVICE-SETUP.md)
- [NSSM Guide](NSSM-QUICK-START.md)
- [Building Executable](BUILDING-EXECUTABLE.md)
- [Feature Implementation](IMPROVEMENTS-FEATURES-1-6.md)

---

## 🐛 Troubleshooting

### **Common Issues**

#### **"API_KEY not found"**
```bash
# Solution: Create .env file
cp .env.example .env
# Edit .env and add your API_KEY
```

#### **"config.json not found"**
```bash
# Solution: Create config.json
cp config.json.example config.json
```

#### **"Cannot find module 'better-sqlite3'"**
```bash
# Solution: Rebuild native modules
npm rebuild better-sqlite3
```

#### **"Permission denied" on Windows**
```cmd
# Solution: Run as Administrator
Right-click Command Prompt → "Run as administrator"
```

#### **Service won't start**
```bash
# Check logs
type error.log

# Run health check
node src/index.js health-check

# Test manually
node src/index.js start-service
```

#### **PDF not printing**
```bash
# Test printer
node src/index.js test-printer

# Check circuit breaker
node src/index.js circuit-breaker-status

# Check dead letter queue
node src/index.js dlq
```

#### **Email not sending**
```bash
# Test email
node src/index.js test-email your@email.com

# Verify .env has:
# PRINTER_EMAIL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
```

### **Debug Mode**

```bash
# Enable debug logging
set LOG_TO_CONSOLE=true
set NODE_ENV=development

# Run with verbose output
node src/index.js start-service
```

### **Getting Help**

1. **Check logs:** `error.log`, `activity.log`
2. **Run health check:** `node src/index.js health-check`
3. **View dashboard:** `node src/index.js dashboard`
4. **Check circuit breakers:** `node src/index.js circuit-breaker-status`
5. **Review DLQ:** `node src/index.js dlq`

---

## 🚢 Deployment Options

### **Local Development**
```bash
npm start
```

### **Windows Service** (Production)
```cmd
# NSSM (recommended)
NSSM - Step 2 - Install Service.bat

# OR node-windows
Install Service.bat
```

### **Docker**
```bash
# Using docker-compose
docker-compose up -d

# Using Dockerfile
docker build -t hello-club .
docker run -d --name hello-club \
  -v $(pwd)/events.db:/app/events.db \
  -v $(pwd)/.env:/app/.env \
  -v $(pwd)/config.json:/app/config.json \
  hello-club
```

### **Standalone Executable**
```cmd
# Build
Build Executable.bat

# Distribute
dist/HelloClub-Portable.zip
```

### **PM2** (Linux/Mac)
```bash
# Install PM2
npm install -g pm2

# Start
pm2 start src/index.js --name hello-club -- start-service

# Auto-start on boot
pm2 startup
pm2 save

# Monitor
pm2 monit
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Watch mode
npm run test:watch

# Coverage
npm run coverage
```

---

## 🏗️ Project Structure

```
Hello-Club-Event-Attendance-Auto-Print/
├── src/
│   ├── index.js                 # Main entry point
│   ├── api-client.js            # Hello Club API client (with circuit breaker)
│   ├── api-rate-limiter.js      # Rate limiting and tracking
│   ├── args-parser.js           # CLI argument parsing
│   ├── backup-scheduler.js      # Automated backup system
│   ├── circuit-breaker.js       # Circuit breaker implementation
│   ├── commands.js              # CLI command implementations
│   ├── config-schema.js         # Joi configuration validation
│   ├── config-watcher.js        # Hot-reload configuration
│   ├── database.js              # SQLite database (WAL mode)
│   ├── dead-letter-queue.js     # Failed job queue
│   ├── email-service.js         # Email sending (with circuit breaker)
│   ├── event-filters.js         # Advanced event filtering
│   ├── functions.js             # Core business logic
│   ├── health-check.js          # Health check system
│   ├── logger.js                # Winston logger (with secrets masking)
│   ├── metrics.js               # Application metrics
│   ├── metrics-server.js        # Prometheus metrics HTTP server
│   ├── notifications.js         # Webhook notifications (with validation)
│   ├── pdf-cache.js             # PDF caching system
│   ├── pdf-generator.js         # PDF creation
│   ├── retry-util.js            # Retry logic with exponential backoff
│   ├── secrets-manager.js       # Security utilities
│   ├── service.js               # Service mode orchestration
│   ├── status-tracker.js        # Status file management
│   ├── validation.js            # Input validation
│   └── web-dashboard.js         # Web GUI (with XSS protection)
│
├── __tests__/                   # Test files
│   ├── unit/                    # Unit tests
│   └── integration/             # Integration tests
│
├── .github/                     # GitHub configuration
│   └── workflows/               # CI/CD workflows
│       └── ci.yml.example       # Example GitHub Actions workflow
│
├── nssm/                        # NSSM Windows service manager
│   ├── download-nssm.ps1        # NSSM download script
│   └── README.txt               # NSSM info
│
├── backups/                     # Automated backups (created at runtime)
├── .pdf-cache/                  # PDF cache (created at runtime)
│
├── Build Executable.bat         # Build standalone .exe
├── Build Distribution Package.bat  # Create portable distribution
├── Install Service.bat          # Install node-windows service
├── Uninstall Service.bat        # Uninstall node-windows service
├── NSSM - Step 1 - Download NSSM.bat  # Download NSSM
├── NSSM - Step 2 - Install Service.bat  # Install NSSM service
├── NSSM - Manage Service.bat    # NSSM management menu
├── Start Dashboard.bat          # Launch web dashboard
├── View Logs.bat                # Log viewer
│
├── install-service.js           # node-windows installer script
├── uninstall-service.js         # node-windows uninstaller script
│
├── .env.example                 # Environment variables template
├── config.json.example          # Configuration template
├── package.json                 # Dependencies and scripts
├── .gitignore                   # Git ignore rules
│
├── README.md                    # Main documentation (this file)
├── WINDOWS-SERVICE-SETUP.md     # Windows service guide
├── NSSM-QUICK-START.md          # NSSM quick start
├── BUILDING-EXECUTABLE.md       # Executable build guide
├── IMPROVEMENTS-FEATURES-1-6.md # Feature implementation docs
│
├── activity.log                 # Application log (created at runtime)
├── error.log                    # Error log (created at runtime)
├── events.db                    # SQLite database (created at runtime)
├── status.json                  # Service status (created at runtime)
├── metrics.json                 # Metrics data (created at runtime)
└── dead-letter-queue.json       # Failed jobs (created at runtime)
```

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Ensure all tests pass
5. Submit a pull request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- **Hello Club** - For the API
- **pkg** - For executable building
- **NSSM** - For Windows service management
- **Winston** - For logging
- **Better-SQLite3** - For database
- **PDFKit** - For PDF generation

---

## 📞 Support

For issues, questions, or feature requests:

1. **Check documentation** - See [Documentation](#-documentation)
2. **Check logs** - `error.log`, `activity.log`
3. **Run health check** - `node src/index.js health-check`
4. **Open an issue** - GitHub Issues

---

<div align="center">

**Built with ❤️ for automated event management**

[⬆ Back to Top](#hello-club---event-attendance-auto-print)

</div>
