# Architecture Documentation

> System design and architectural decisions for Hello Club Event Attendance Auto-Print

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Component Design](#component-design)
- [Data Flow](#data-flow)
- [Database Schema](#database-schema)
- [Deployment Architecture](#deployment-architecture)
- [Design Decisions](#design-decisions)
- [Security Considerations](#security-considerations)

## Overview

Hello Club Event Attendance Auto-Print is built as a **headless Linux service** optimized for Raspberry Pi 5, following the **Service-Oriented Architecture** pattern. The system runs 24/7 as a systemd service with a modern web dashboard for remote monitoring and control.

### Architecture Principles

1. **Separation of Concerns** - Each component has a single, well-defined responsibility
2. **Service-Based Design** - Runs as systemd service for reliability and automatic recovery
3. **Event-Driven Operation** - Components react to scheduled events and triggers
4. **Self-Healing** - Automatic restart on failure via systemd
5. **Remote Management** - Web dashboard for monitoring without direct system access
6. **Production-Ready** - Battle-tested on Raspberry Pi 5 with security hardening

### Platform Focus

**Primary Platform:** Raspberry Pi 5 with Raspberry Pi OS Lite 64-bit

**Also Supported:** Ubuntu/Debian Linux servers, Docker containers

**Legacy Support:** Windows documentation available in [`docs/legacy/`](./legacy/)

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Layer                              │
│                                                                 │
│  ┌──────────────────┐          ┌──────────────────────┐        │
│  │  Web Browser     │          │   Mobile Device      │        │
│  │  (Any Device)    │◄─────────┤   (Tablet/Phone)     │        │
│  └────────┬─────────┘          └──────────────────────┘        │
│           │ HTTP/WebSocket                                      │
└───────────┼─────────────────────────────────────────────────────┘
            │ Port 3000
            │
┌───────────▼─────────────────────────────────────────────────────┐
│                      Web Dashboard                              │
│                   (Express + WebSocket)                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • Real-time log streaming                                │  │
│  │  • Service control (start/stop/restart via sudo)         │  │
│  │  • Configuration editor (.env, config.json)              │  │
│  │  • Connection tests (API, Email, Printer)                │  │
│  │  • Statistics dashboard                                   │  │
│  │  • Backup management                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────────┘
                     │ IPC / systemctl commands
                     │
┌────────────────────▼────────────────────────────────────────────┐
│                   systemd Service Layer                         │
│                  (helloclub.service)                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Node.js Background Service                              │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │  │
│  │  │ Scheduler  │  │  Event     │  │  Processor │         │  │
│  │  │  Loop      │─►│  Queue     │─►│   Jobs     │         │  │
│  │  └────────────┘  └────────────┘  └────────────┘         │  │
│  │                                                           │  │
│  │  Features:                                                │  │
│  │  • Automatic restart on failure                          │  │
│  │  • Memory & CPU limits                                   │  │
│  │  • Security sandboxing (ProtectSystem, PrivateTmp)       │  │
│  │  • Journal logging integration                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│           │                    │                    │           │
└───────────┼────────────────────┼────────────────────┼───────────┘
            │                    │                    │
┌───────────▼────────────────────▼────────────────────▼───────────┐
│                      Data Layer                                 │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                 │
│  │  SQLite  │    │  Winston │    │   File   │                 │
│  │  events  │    │   Logs   │    │  System  │                 │
│  │   DB     │    │activity/ │    │  (PDFs)  │                 │
│  │          │    │  error   │    │          │                 │
│  └──────────┘    └──────────┘    └──────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
            │                                │
┌───────────▼────────────────────────────────▼───────────────────┐
│                    External Services                            │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │  Hello Club  │    │    CUPS      │    │     SMTP     │    │
│  │     API      │    │  (Local      │    │   (Email     │    │
│  │              │    │   Print)     │    │    Print)    │    │
│  └──────────────┘    └──────────────┘    └──────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. systemd Service (Background Daemon)

**Location**: `src/` managed by `/etc/systemd/system/helloclub.service`

**Purpose**: Always-running background process that handles all event automation

**Key Responsibilities**:

- Periodically fetch upcoming events from Hello Club API
- Schedule event processing based on start times
- Execute print jobs at the right moment
- Maintain event queue in SQLite database
- Log all operations to activity.log and error.log
- Write health check file for monitoring

**Technology Stack**:

- **Runtime**: Node.js 18+ process
- **Process Management**: systemd (System and Service Manager)
- **Scheduling**: JavaScript setTimeout with in-memory job Map
- **Persistence**: better-sqlite3 (synchronous SQLite)

**Lifecycle**:

```
[System Boot] → [systemd starts service] → [Initialize DB] → [Load Config] →
[Restore scheduled jobs] → [Scheduler Loop] → [Fetch Events] →
[Schedule Jobs] → [Process Events] → [Repeat every N hours]
```

**Auto-Recovery**:

- systemd configured with `Restart=always`
- `RestartSec=10` provides 10-second cooldown between restarts
- All state persisted in SQLite and scheduled_jobs table
- On restart, scheduled jobs are restored from database
- Exponential backoff retry for failed events (3 attempts)

**Resource Limits** (configured in service file):

```ini
MemoryMax=512M        # Prevents memory leaks from consuming system
CPUQuota=50%          # Limits CPU usage
```

**Security Hardening**:

```ini
NoNewPrivileges=true  # Prevents privilege escalation
PrivateTmp=true       # Isolated /tmp directory
ProtectSystem=strict  # Read-only system directories
ProtectHome=true      # No access to user home directories
ReadWritePaths=/opt/helloclub/app  # Only write to app directory
```

### 2. Web Dashboard (Management Interface)

**Location**: `web-dashboard/`

**Purpose**: Remote monitoring and control interface accessible from any device

**Key Responsibilities**:

- Display real-time service status
- Stream live logs via WebSocket
- Provide service control (start/stop/restart via sudo)
- Edit configuration files with backup support
- Test API, Email, and Printer connectivity
- Display statistics and trends
- Manage configuration backups

**Technology Stack**:

- **Backend**: Express.js with WebSocket server
- **Frontend**: Vanilla JavaScript (no framework dependencies)
- **Real-time**: WebSocket for log streaming
- **Authentication**: Session-based with bcrypt
- **Process Control**: Executes `systemctl` commands via sudo

**UI Components**:

```
Dashboard Home
├── Service Status Card
│   ├── Status: Running/Stopped/Starting
│   ├── Uptime display
│   └── Quick actions (Start/Stop/Restart)
│
├── Statistics Card
│   ├── Events processed today/week/month
│   ├── Success rate
│   └── Scheduled events count
│
├── Live Logs Panel
│   ├── Real-time WebSocket streaming
│   ├── Auto-scroll toggle
│   ├── Tab: Activity Log / Error Log
│   └── Refresh button
│
├── Configuration Editor
│   ├── Tab: Environment Variables (.env)
│   ├── Tab: Application Settings (config.json)
│   ├── Validation before save
│   └── Automatic backup creation
│
└── Connection Tests
    ├── Test API Connection
    ├── Test Email Connection
    └── Test Printer Connection
```

**Security Features**:

- Authentication required for all operations
- Session timeout (24 hours)
- Sudo access limited to specific systemctl commands
- No plaintext password storage
- Input validation and sanitization
- CSRF protection

### 3. Core Processing Engine

**Location**: `src/core/`

**Purpose**: Business logic for event processing and PDF generation

**Modules**:

**`api-client.js`**:

- Axios-based HTTP client with retry logic
- Caching with stale fallback for graceful degradation
- Rate limiting (1-second delay between paginated requests)
- Error handling with context-specific messages

**`database.js`**:

- Singleton pattern for SQLite connection management
- WAL (Write-Ahead Logging) mode for better concurrency
- Foreign keys enabled
- Prepared statements for SQL injection prevention

**`functions.js`**:

- Event processing orchestration
- PDF generation coordination
- Print job execution (local or email)
- Error handling and retry logic

**`service.js`**:

- Scheduler loop implementation
- Job persistence for crash recovery
- Exponential backoff retry pattern
- Health check file writing
- Heartbeat logging

### 4. Supporting Services

**Location**: `src/services/`

**`pdf-generator.js`**:

- PDFKit-based PDF document generation
- Configurable layouts (columns, fonts, logos)
- Table generation with alternating row colors
- Header and footer support

**`email-service.js`**:

- Nodemailer SMTP client
- Email printing mode support
- Attachment handling
- Error recovery

**`logger.js`**:

- Winston-based logging
- Separate activity and error logs
- Log rotation support
- Structured JSON logging
- Console and file transports

**`cups-printer.js`** (Raspberry Pi):

- CUPS (Common Unix Printing System) integration
- Uses `lp` command for local printing
- Printer availability checking
- Print queue management

## Data Flow

### Event Processing Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Event Discovery (Periodic - Every N Hours)              │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │  GET /event?fromDate&toDate  │
    │     (Hello Club API)         │
    └──────────────┬───────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │  Filter by Categories        │
    │  (Config.categories)         │
    └──────────────┬───────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │  INSERT INTO events          │
    │  WHERE NOT EXISTS            │
    │  (SQLite)                    │
    └──────────────┬───────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 2. Event Scheduling (Immediate After Discovery)            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │  SELECT * FROM events        │
    │  WHERE status='pending'      │
    └──────────────┬───────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │  Calculate Processing Time   │
    │  (startTime - N minutes)     │
    └──────────────┬───────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │  setTimeout(() => process(), │
    │         delayMs)              │
    │  Store in scheduledJobs Map  │
    │  Persist to scheduled_jobs   │
    └──────────────┬───────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 3. Event Processing (Triggered at Scheduled Time)          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │  GET /event/:id              │
    │  (Full event details)        │
    └──────────────┬───────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │  GET /eventAttendee          │
    │  (Paginated attendees)       │
    └──────────────┬───────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │  Generate PDF (PDFKit)       │
    │  Save to file system         │
    └──────────────┬───────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │  Print PDF                   │
    │  • CUPS (lp command)         │
    │  • Email (Nodemailer)        │
    └──────────────┬───────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │  UPDATE events               │
    │  SET status='processed'      │
    │  Write to health check file  │
    └──────────────────────────────┘
```

### Print Modes

#### Local Printing (CUPS)

```
PDF File → lp command → CUPS → USB/Network Printer
```

**Configuration**:

```json
{
  "printMode": "local",
  "printerName": "Brother_HL_L2350DW"
}
```

**Command executed**:

```bash
lp -d Brother_HL_L2350DW -o fit-to-page attendees.pdf
```

#### Email Printing (SMTP)

```
PDF File → Nodemailer → SMTP Server → Printer Email Address → Network Printer
```

**Configuration**:

```env
PRINTER_EMAIL=printer@yourdomain.com
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

## Database Schema

### SQLite Database (`events.db`)

**Table: `events`**

| Column        | Type                           | Description                           |
| ------------- | ------------------------------ | ------------------------------------- |
| `id`          | TEXT PRIMARY KEY               | Unique event ID from Hello Club API   |
| `name`        | TEXT NOT NULL                  | Event name                            |
| `startTime`   | TEXT NOT NULL                  | ISO 8601 timestamp of event start     |
| `category`    | TEXT NOT NULL                  | Event category                        |
| `status`      | TEXT NOT NULL                  | Event processing status               |
| `retryCount`  | INTEGER DEFAULT 0              | Number of retry attempts              |
| `createdAt`   | TEXT DEFAULT CURRENT_TIMESTAMP | When event was discovered             |
| `processedAt` | TEXT                           | When event was successfully processed |

**Status Values**:

- `'pending'` - Event discovered, waiting to be processed
- `'processed'` - Event successfully printed
- `'failed'` - Event failed after max retries

**Indexes**:

```sql
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_startTime ON events(startTime);
CREATE INDEX idx_events_category ON events(category);
```

**Table: `scheduled_jobs`**

| Column          | Type             | Description                 |
| --------------- | ---------------- | --------------------------- |
| `eventId`       | TEXT PRIMARY KEY | Foreign key to events.id    |
| `scheduledTime` | TEXT NOT NULL    | When the job should execute |

**Purpose**: Crash recovery - restore scheduled jobs after service restart

**Example Data**:

```sql
INSERT INTO events (id, name, startTime, category, status) VALUES
  ('evt_123', 'Junior Basketball Practice', '2025-02-15T10:00:00Z', 'NBA - Junior Events', 'pending'),
  ('evt_124', 'Pickleball Tournament', '2025-02-16T14:00:00Z', 'Pickleball', 'pending');

INSERT INTO scheduled_jobs (eventId, scheduledTime) VALUES
  ('evt_123', '2025-02-15T09:55:00Z');
```

## Deployment Architecture

### Raspberry Pi 5 Directory Structure

**Standard Production Deployment:**

```
/opt/helloclub/
├── app/                          # Application root
│   ├── src/                      # Source code
│   │   ├── core/                 # Business logic
│   │   ├── services/             # Supporting services
│   │   ├── utils/                # Utilities
│   │   └── index.js              # Entry point
│   │
│   ├── web-dashboard/            # Web interface
│   │   ├── server.js             # Express server
│   │   ├── routes/               # API routes
│   │   ├── middleware/           # Auth, etc.
│   │   └── public/               # Frontend assets
│   │
│   ├── node_modules/             # Dependencies
│   ├── .env                      # Environment variables (secrets)
│   ├── config.json               # Application settings
│   ├── events.db                 # SQLite database
│   ├── activity.log              # Activity log
│   ├── error.log                 # Error log
│   ├── service-health.json       # Health check file
│   └── attendees.pdf             # Generated PDFs
│
├── backups/                      # Configuration backups
│   └── config_YYYYMMDD_HHMMSS.tar.gz
│
└── logs/                         # Archived logs (optional)

/etc/systemd/system/
├── helloclub.service             # Main service
└── helloclub-dashboard.service   # Dashboard service (if separate)

/etc/sudoers.d/
└── helloclub                     # Sudo permissions for service control

/home/pi/.ssh/
└── authorized_keys               # SSH public keys for remote access
```

### systemd Service Configuration

**Service Name**: `helloclub.service`

**Service File** (`/etc/systemd/system/helloclub.service`):

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

# Automatic restart on failure
Restart=always
RestartSec=10

# Logging
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

**Management Commands**:

```bash
sudo systemctl start helloclub      # Start service
sudo systemctl stop helloclub       # Stop service
sudo systemctl restart helloclub    # Restart service
sudo systemctl status helloclub     # Check status
sudo systemctl enable helloclub     # Auto-start on boot
journalctl -u helloclub -f          # View real-time logs
```

### Network Configuration

**Dashboard Access**:

- **Local Network**: `http://helloclub-pi.local:3000`
- **IP Address**: `http://192.168.1.XX:3000`
- **Port**: 3000 (configurable via DASHBOARD_PORT in .env)

**Firewall Rules** (ufw):

```bash
sudo ufw allow from 192.168.1.0/24 to any port 3000  # Dashboard
sudo ufw allow 22/tcp                                 # SSH
sudo ufw enable
```

## Design Decisions

### Why Raspberry Pi 5?

**Chosen**: Raspberry Pi 5 (8GB model)

**Alternatives Considered**: x86 Linux server, Raspberry Pi 4, Windows PC

**Rationale**:

- ✅ **Low Power**: ~10W power consumption (vs 100W+ for PC)
- ✅ **Always-On**: Designed for 24/7 operation
- ✅ **Silent**: Fanless or quiet cooling
- ✅ **Affordable**: ~$80 for complete setup
- ✅ **Linux Native**: No Windows licensing costs
- ✅ **ARM64**: Excellent Node.js performance
- ✅ **GPIO**: Future expansion capabilities
- ✅ **Reliability**: SD card + USB backup options

### Why systemd Over PM2?

**Chosen**: systemd for production

**Alternatives Considered**: PM2, Docker, supervisord

**Rationale**:

- ✅ **Native Integration**: Built into Linux, no extra dependencies
- ✅ **Starts Before Login**: Runs even without user session
- ✅ **Journal Logging**: Integrated with systemd journal
- ✅ **Resource Limits**: Built-in memory and CPU limits
- ✅ **Security**: Sandboxing with ProtectSystem, PrivateTmp
- ✅ **Dependency Management**: Waits for network with After/Wants
- ✅ **Standard Tool**: Universal across Linux distributions

### Why SQLite?

**Chosen**: SQLite (better-sqlite3)

**Alternatives Considered**: PostgreSQL, MySQL, JSON files, Redis

**Rationale**:

- ✅ **Zero Configuration**: No server required
- ✅ **ACID Transactions**: Data integrity guaranteed
- ✅ **Embedded**: Single file, no separate process
- ✅ **Perfect for Event Queue**: Handles typical load effortlessly
- ✅ **Synchronous API**: better-sqlite3 is fast and simple
- ✅ **Backup Friendly**: Copy single file to backup
- ✅ **Low Overhead**: Minimal memory footprint
- ❌ Don't Need: Multi-user access, network access, replication

### Why Express for Dashboard?

**Chosen**: Express.js with WebSocket

**Alternatives Considered**: FastAPI (Python), Flask, native Node HTTP

**Rationale**:

- ✅ **Reuse Node.js**: Same runtime as main service
- ✅ **WebSocket Support**: Real-time log streaming
- ✅ **Middleware Ecosystem**: Authentication, body parsing, etc.
- ✅ **Lightweight**: Minimal dependencies
- ✅ **Well Documented**: Extensive community support
- ✅ **Easy Deployment**: Single systemd service

### Why Web Dashboard Over Tray App?

**Previous Version**: Electron-based system tray app (Windows)

**New Version**: Web dashboard (cross-platform)

**Rationale**:

- ✅ **Headless Operation**: Pi runs without monitor
- ✅ **Remote Access**: Manage from any device
- ✅ **No GUI Dependencies**: Works on Raspberry Pi OS Lite
- ✅ **Mobile Friendly**: Access from phone/tablet
- ✅ **Lower Memory**: No Electron overhead (~150MB saved)
- ✅ **Cross-Platform**: Same interface on any OS
- ✅ **Multi-User**: Multiple admins can access simultaneously

### Why CUPS Over Other Printing?

**Chosen**: CUPS (Common Unix Printing System)

**Alternatives Considered**: Direct USB, PDF-to-printer libraries, LPR

**Rationale**:

- ✅ **Standard on Linux**: Pre-installed on most distributions
- ✅ **Network Printing**: Supports IPP, LPD, SMB printers
- ✅ **USB Printing**: Direct USB printer support
- ✅ **Web Interface**: Built-in management at localhost:631
- ✅ **Driver Support**: Extensive printer compatibility
- ✅ **Command Line**: Simple `lp` command for printing

## Security Considerations

### Secret Management

**API Keys and Credentials**:

- Stored in `.env` file (gitignored)
- File permissions: `chmod 600 .env` (owner read/write only)
- Never logged or displayed in UI
- Validated before use
- Dashboard shows masked values (●●●●●●)

**Best Practices**:

```bash
# Set secure permissions
sudo chown helloclub:helloclub /opt/helloclub/app/.env
sudo chmod 600 /opt/helloclub/app/.env

# Verify
ls -la /opt/helloclub/app/.env
# Should show: -rw------- 1 helloclub helloclub
```

### Database Security

**SQLite File**:

- Stored in application directory with restrictive permissions
- No network exposure (file-based)
- Contains only event IDs and names (no sensitive attendee data at rest)
- Attendee data only in memory during processing
- Automatic backups encrypted if using external storage

**Permissions**:

```bash
sudo chown helloclub:helloclub /opt/helloclub/app/events.db
sudo chmod 640 /opt/helloclub/app/events.db
```

### Web Dashboard Security

**Authentication**:

- Session-based authentication with secure cookies
- Passwords never stored in plaintext (bcrypt hashing)
- Session timeout after 24 hours
- CSRF token protection
- Rate limiting on login attempts

**Network Security**:

- Firewall restricts dashboard to local network only
- HTTPS via reverse proxy (nginx/Caddy) for production
- No default credentials (set during setup)

**Sudo Access** (limited scope):

```bash
# /etc/sudoers.d/helloclub
helloclub ALL=(ALL) NOPASSWD: /usr/bin/systemctl start helloclub
helloclub ALL=(ALL) NOPASSWD: /usr/bin/systemctl stop helloclub
helloclub ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart helloclub
helloclub ALL=(ALL) NOPASSWD: /usr/bin/systemctl status helloclub
```

### systemd Security Hardening

**Service Sandboxing**:

- `NoNewPrivileges=true` - Prevents privilege escalation
- `PrivateTmp=true` - Isolated temporary directory
- `ProtectSystem=strict` - Read-only system directories
- `ProtectHome=true` - No access to user home directories
- `ReadWritePaths=/opt/helloclub/app` - Only write to app directory

**Resource Limits**:

- `MemoryMax=512M` - Prevents memory exhaustion
- `CPUQuota=50%` - Prevents CPU hogging

### SSH Security

**Raspberry Pi Hardening**:

- SSH key-based authentication only
- Password authentication disabled
- Root login disabled
- fail2ban monitors failed login attempts
- Non-standard SSH port (optional)

**Configuration** (`/etc/ssh/sshd_config`):

```
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
Port 22  # Or custom port
```

### Log Security

**Logging Practices**:

- No API keys or passwords logged
- No sensitive attendee information in logs (names/emails/phones)
- Log rotation prevents disk filling
- Error logs separate from activity logs
- Log files readable only by helloclub user

**Log Rotation** (`/etc/logrotate.d/helloclub`):

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

### SMTP Credentials

**Email Mode Security**:

- Credentials stored in `.env` (secure file permissions)
- Supports app-specific passwords (Gmail, Outlook)
- TLS encryption for SMTP connection (port 587)
- Credentials never logged
- Dashboard masks SMTP password

**Gmail Security**:

- Requires 2-factor authentication
- Use App Password (not account password)
- Revocable without changing main password

## Performance Considerations

### Memory Usage

**Service Process** (typical):

- Baseline: ~30-50 MB
- Per scheduled event: ~1-2 MB (setTimeout overhead)
- During PDF generation: +20-30 MB (temporary)
- **Total**: ~80-150 MB typical, ~200 MB peak

**Dashboard Process**:

- Baseline: ~40-60 MB (Express + WebSocket)
- Per active WebSocket: +5-10 MB
- **Total**: ~60-100 MB typical

**Raspberry Pi 5 (8GB RAM)**: Plenty of headroom for other services

### CPU Usage

**Idle**: <1% CPU (sleeping between scheduler loops)

**During Event Fetch**: 2-5% CPU for 1-2 seconds

**During PDF Generation**: 10-20% CPU for 2-5 seconds (depends on attendee count)

**Raspberry Pi 5 (Quad-core Cortex-A76 @ 2.4GHz)**: Excellent performance for this workload

### Disk I/O

**Database**:

- Minimal (few events, small records)
- WAL mode reduces lock contention
- Typical database size: <10 MB

**Logs**:

- Activity log: ~1-5 MB/day
- Error log: ~100 KB/day (if errors occur)
- Log rotation prevents unbounded growth

**PDFs**:

- Overwritten each event (configurable filename)
- Typical size: 50-200 KB per PDF

**SD Card**: Use high-endurance or Application Class cards for reliability

### Network

**API Calls**:

- Fetch events: 1 call per service interval (e.g., every 1 hour)
- Process event: 2 calls per event (event details + attendees)
- Attendee pagination: 1 call per 100 attendees

**Bandwidth**: Negligible (<1 MB per event typically)

**Dashboard**: WebSocket keeps persistent connection, minimal overhead

## Scaling Considerations

### Current Capacity

**Tested Load**:

- 50+ events per day
- 100+ attendees per event
- 24/7 operation for weeks without restart

**Typical Use Case**: 10-20 events per day, well within capacity

### Limitations

- Single machine deployment (Raspberry Pi)
- SQLite limits to ~100K concurrent events (far exceeds typical use)
- Dashboard serves one organization (no multi-tenancy)

### Future Scaling Options

If processing many organizations/venues:

1. **Multi-Instance**: Deploy separate Raspberry Pi per organization (~$80 each)
2. **Kubernetes**: Deploy as Docker containers with orchestration
3. **Database Upgrade**: Migrate to PostgreSQL if needed (unlikely)
4. **Load Balancing**: Distribute processing across multiple machines
5. **Cloud Deployment**: Run on AWS/Azure/GCP with auto-scaling

**Note**: Current architecture handles typical use cases (10-100 events/day) effortlessly on a single Raspberry Pi 5.

## Legacy Platforms

### Windows Support

Previous versions (v1.0.x and earlier) ran on Windows with:

- Windows Service wrapper (node-windows)
- Electron system tray application
- Inno Setup installer

**Status**: Windows deployment is no longer recommended but still supported via manual installation.

**Documentation**: See [`docs/legacy/`](./legacy/) for Windows-specific guides:

- [Windows Service Setup](./legacy/WINDOWS-SERVICE-SETUP.md)
- [Tray App Guide](./legacy/TRAY-APP-GUIDE.md)
- [Installer User Guide](./legacy/INSTALLER-USER-GUIDE.md)
- [Build Installer](./legacy/BUILD-INSTALLER.md)

---

**Last Updated**: 2025-02-10

**Architecture Version**: 2.0 (Raspberry Pi/systemd)

**Platform**: Optimized for Raspberry Pi 5 with Raspberry Pi OS Lite 64-bit
