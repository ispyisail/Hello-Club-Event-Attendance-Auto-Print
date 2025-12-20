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

Hello Club Event Attendance Auto-Print is built as a multi-process Windows application following the **Service-Oriented Architecture** pattern. The system consists of three main components that work together to provide automated event attendance tracking.

### Architecture Principles

1. **Separation of Concerns** - Each component has a single, well-defined responsibility
2. **Process Isolation** - Services run independently to prevent cascading failures
3. **Event-Driven Design** - Components react to events and scheduled triggers
4. **Fail-Safe Operation** - Services automatically restart on failure
5. **User-Friendly Monitoring** - Visual feedback through system tray interface

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Layer                              │
│                                                                 │
│  ┌──────────────────┐          ┌──────────────────────┐        │
│  │  System Tray     │          │   Log Viewer         │        │
│  │  (Electron UI)   │◄─────────┤   (HTML Window)      │        │
│  └────────┬─────────┘          └──────────────────────┘        │
│           │                                                     │
└───────────┼─────────────────────────────────────────────────────┘
            │ IPC / Windows Services API
            │
┌───────────▼─────────────────────────────────────────────────────┐
│                      Service Layer                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Windows Service (node-windows)                          │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │  │
│  │  │ Scheduler  │  │  Event     │  │  Processor │         │  │
│  │  │  Loop      │─►│  Queue     │─►│   Jobs     │         │  │
│  │  └────────────┘  └────────────┘  └────────────┘         │  │
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
│  ┌──────────────┐         ┌──────────────┐                    │
│  │  Hello Club  │         │    Printer   │                    │
│  │     API      │         │   (Local/    │                    │
│  │              │         │    Email)    │                    │
│  └──────────────┘         └──────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Windows Service (Background Daemon)

**Location**: `src/` + `service/`

**Purpose**: Continuous background process that handles all event automation

**Key Responsibilities**:
- Periodically fetch upcoming events from Hello Club API
- Schedule event processing based on start times
- Execute print jobs at the right moment
- Maintain event queue in local database
- Log all operations

**Technology Stack**:
- **Runtime**: Node.js process wrapped by node-windows
- **Process Management**: Windows Service Control Manager
- **Scheduling**: JavaScript setTimeout/setInterval
- **Persistence**: better-sqlite3

**Lifecycle**:
```
[Boot] → [Service Start] → [Initialize DB] → [Load Config] →
[Scheduler Loop] → [Fetch Events] → [Schedule Jobs] →
[Process Events] → [Repeat]
```

**Auto-Recovery**:
- Configured to restart automatically on crash
- Maximum 10 restarts with exponential backoff
- All state persisted in SQLite for recovery

### 2. System Tray Application (User Interface)

**Location**: `tray-app/`

**Purpose**: Visual monitoring and control interface

**Key Responsibilities**:
- Display service status via color-coded icon
- Provide service control (start/stop/restart)
- Show log viewer window
- Send desktop notifications
- Monitor service health

**Technology Stack**:
- **Framework**: Electron (Chromium + Node.js)
- **UI**: HTML5 + JavaScript
- **Process Communication**: Windows command execution (sc query, net start/stop)
- **Notifications**: Electron Notification API

**UI Components**:

```
System Tray Icon
├── Status Indicator (Color)
│   ├── Green: Running
│   ├── Red: Stopped/Error
│   └── Yellow: Starting/Warning
│
└── Context Menu
    ├── Status Display
    ├── View Logs → Opens Log Viewer Window
    ├── Service Controls
    │   ├── Start Service
    │   ├── Stop Service
    │   └── Restart Service
    ├── Utilities
    │   ├── Check Status Now
    │   ├── Open Services Manager
    │   └── Open Project Folder
    └── Quit
```

**Log Viewer Window**:
```html
┌─────────────────────────────────────────┐
│  Hello Club Service - Log Viewer       │
├─────────────────────────────────────────┤
│  [Activity Log] [Error Log]   [Refresh]│
├─────────────────────────────────────────┤
│  2024-12-20 10:30:00 info: Service...  │
│  2024-12-20 10:35:00 info: Found 3...  │
│  2024-12-20 10:40:00 info: Event...    │
│  ...                                    │
│                                         │
└─────────────────────────────────────────┘
```

### 3. Installer (Deployment Package)

**Location**: `installer/`

**Purpose**: One-click installation wizard

**Technology Stack**:
- **Installer**: Inno Setup 6.x
- **Scripts**: Batch files for automation

**Installation Steps**:
1. Check for Node.js
2. Copy files to Program Files
3. Install npm dependencies
4. Prompt for API key configuration
5. Create `.env` file
6. Install Windows Service
7. Start service
8. Add tray app to startup
9. Create shortcuts

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
    │  (startDate - N minutes)     │
    └──────────────┬───────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │  setTimeout(() => process()  │
    │         delay: minutes       │
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
    │  Generate PDF                │
    │  (PDFKit)                    │
    └──────────────┬───────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │  Print PDF                   │
    │  (Local or Email)            │
    └──────────────┬───────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │  UPDATE events               │
    │  SET status='processed'      │
    └──────────────────────────────┘
```

### Print Modes

#### Local Printing
```
PDF File → pdf-to-printer → SumatraPDF → Windows Print Spooler → Physical Printer
```

#### Email Printing
```
PDF File → Nodemailer → SMTP Server → Printer Email Address → Network Printer
```

## Database Schema

### SQLite Database (`events.db`)

**Table: `events`**

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT PRIMARY KEY | Unique event ID from Hello Club API |
| `name` | TEXT NOT NULL | Event name |
| `startDate` | TEXT NOT NULL | ISO 8601 timestamp of event start |
| `status` | TEXT NOT NULL | Event processing status |

**Status Values**:
- `'pending'` - Event discovered, waiting to be processed
- `'processed'` - Event has been printed

**Indexes**:
```sql
CREATE INDEX idx_status ON events(status);
CREATE INDEX idx_startDate ON events(startDate);
```

**Example Data**:
```sql
INSERT INTO events (id, name, startDate, status) VALUES
  ('evt_123', 'Junior Basketball Practice', '2024-12-25T10:00:00Z', 'pending'),
  ('evt_124', 'Pickleball Tournament', '2024-12-26T14:00:00Z', 'pending');
```

## Deployment Architecture

### Directory Structure in Production

```
C:\Program Files\Hello Club Event Attendance\
├── src/                      # Application code
├── service/                  # Service management
├── tray-app/                 # Tray application
├── installer/                # Installer scripts
├── node_modules/             # Dependencies
├── .env                      # Configuration (secrets)
├── config.json               # Configuration (settings)
├── events.db                 # SQLite database
├── activity.log              # Activity log
├── error.log                 # Error log
└── attendees.pdf             # Generated PDFs

C:\Users\{User}\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\
└── Hello Club Monitor.lnk    # Tray app startup shortcut

C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Hello Club\
├── Tray Monitor.lnk
├── View Logs.lnk
├── Service Status.lnk
└── Uninstall.lnk
```

### Windows Service Registration

**Service Name**: `HelloClubEventAttendance`

**Configuration**:
```ini
Display Name: Hello Club Event Attendance
Description: Automatically fetches and prints Hello Club event attendance lists
Start Type: Automatic
Recovery: Restart the service after 2 seconds
Account: Local System
```

**Service Wrapper** (node-windows):
```
C:\Program Files\Hello Club Event Attendance\bin\daemon\
├── helloclubeventattendance.exe        # Service executable
├── helloclubeventattendance.exe.config # Configuration
└── helloclubeventattendance.xml        # Service definition
```

## Design Decisions

### Why Node.js?

**Chosen**: Node.js

**Alternatives Considered**: Python, C#, Go

**Rationale**:
- ✅ Excellent API client libraries (axios)
- ✅ Rich ecosystem for PDF generation (PDFKit)
- ✅ Cross-platform potential
- ✅ Async I/O perfect for scheduled tasks
- ✅ node-windows provides reliable Windows service integration
- ✅ Electron enables native desktop UI

### Why SQLite?

**Chosen**: SQLite (better-sqlite3)

**Alternatives Considered**: JSON files, PostgreSQL, Redis

**Rationale**:
- ✅ Zero-configuration - no server required
- ✅ ACID transactions for data integrity
- ✅ Embedded in application - no separate process
- ✅ Perfect for event queue management
- ✅ better-sqlite3 is synchronous and fast
- ❌ Don't need: Multi-user access, network access

### Why Electron for Tray App?

**Chosen**: Electron

**Alternatives Considered**: Native C++, PyQt, Tauri

**Rationale**:
- ✅ Reuse Node.js knowledge and npm ecosystem
- ✅ Easy HTML/CSS for log viewer UI
- ✅ Built-in system tray APIs
- ✅ Can share code with main service
- ✅ Rapid development
- ❌ Downside: Larger memory footprint (acceptable for desktop app)

### Why Two-Stage Processing?

**Design**: Separate fetch and process stages

**Rationale**:
- ✅ **Efficiency**: Fetch events once every N hours instead of checking API constantly
- ✅ **Accuracy**: Final attendee fetch moments before event captures last-minute sign-ups
- ✅ **API Friendly**: Minimizes API calls to Hello Club
- ✅ **Offline Resilience**: Can process events even if API temporarily unavailable
- ✅ **Flexibility**: Can manually trigger either stage independently

### Why node-windows Instead of PM2?

**Chosen**: node-windows for production

**PM2 Available**: For development

**Rationale**:
- ✅ True Windows Service integration (appears in services.msc)
- ✅ Starts before user login
- ✅ Respects Windows security model
- ✅ Better Windows logging integration
- ✅ No Node.js required on PATH
- ✅ Professional deployment story

## Security Considerations

### Secret Management

**API Keys and Credentials**:
- Stored in `.env` file (never committed to git)
- File permissions restricted to admin users
- Not logged or displayed in UI
- Validated before use

### Database Security

**SQLite File**:
- Stored in application directory (requires admin to modify)
- No network exposure
- Contains only event IDs and names (no sensitive attendee data in storage)
- Attendee data only in memory during processing

### Log Security

**Logging Practices**:
- No API keys or passwords logged
- No sensitive attendee information in logs
- Log rotation to prevent disk filling
- Error logs separate from activity logs

### Windows Service Security

**Service Account**:
- Runs as Local System by default
- Can be configured to run as specific user
- Restricted file system access
- No network credentials stored

### SMTP Credentials

**Email Mode**:
- Credentials stored in `.env`
- Supports app-specific passwords (Gmail)
- TLS encryption for SMTP connection
- Credentials never logged

## Performance Considerations

### Memory Usage

**Service Process**:
- ~50-100 MB baseline
- +20 MB per scheduled event (setTimeout)
- +50 MB during PDF generation
- Total: ~150 MB typical

**Tray App**:
- ~150 MB (Electron overhead)
- Acceptable for desktop application

### CPU Usage

**Idle**: <1% CPU

**During Fetch**: 5-10% CPU for 1-2 seconds

**During PDF Generation**: 20-30% CPU for 2-5 seconds

### Disk I/O

**Database**: Minimal (few events, small records)

**Logs**: Rotating logs prevent unbounded growth

**PDFs**: Overwritten each event (configurable filename)

### Network

**API Calls**:
- Fetch events: 1 call per service interval
- Process event: 1-2 calls per event (event details + attendees)
- Attendee pagination: 1 call per 100 attendees

**Bandwidth**: Negligible (<1 MB per event typically)

## Scaling Considerations

### Current Limitations

- Single machine deployment
- One service instance per machine
- SQLite limits to ~100K concurrent events (far exceeds typical use)

### Future Scaling Options

If processing many organizations/venues:

1. **Multi-Instance**: Deploy separate instances per organization
2. **Load Balancing**: Distribute processing across multiple machines
3. **Database Upgrade**: Migrate to PostgreSQL if needed
4. **Cloud Deployment**: Run as cloud service with API

**Note**: Current architecture handles typical use cases (1-100 events/day) effortlessly.

---

**Last Updated**: 2024-12-20
