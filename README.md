# Hello Club - Event Attendee Printout

## Description

This command-line tool provides a robust, automated solution for generating and printing attendee lists for upcoming events from the Hello Club API. It is designed to be efficient by minimizing API calls while ensuring the final attendee list is as up-to-date as possible.

## Features

### Core Features
- **Automated Event Fetching**: Automatically finds upcoming events within a configurable time window.
- **Just-in-Time Attendee Lists**: Fetches the final attendee list moments before an event starts to capture last-minute sign-ups.
- **Efficient API Usage**: A two-stage process reduces the load on the Hello Club API with built-in rate limiting.
- **PDF Generation**: Creates a clean, printable PDF of the attendee list with customizable layout.
- **Flexible Printing**: Supports printing to local printers or sending the PDF to a printer's email address.
- **Highly Configurable**: Customize event categories, time windows, PDF layout, and more.
- **Run as a Service**: Designed to run continuously in the background using a process manager like PM2.

### Advanced Features
- **Web Dashboard**: Windows-friendly GUI for monitoring service status and events.
- **Webhook Notifications**: Send alerts to Slack, Discord, or custom webhooks on success/error.
- **Multiple Printers**: Route different event categories to different printers.
- **Advanced Filtering**: Filter events by keywords, attendee count, and payment status.
- **Performance Metrics**: Track API usage, processing times, and service health.
- **Configuration Hot-Reload**: Update config.json without restarting the service.
- **Database Management**: Built-in commands for backup, restore, cleanup, and preview.
- **Health Monitoring**: Comprehensive health checks with detailed status reporting.
- **Docker Support**: Container-ready with docker-compose for easy deployment.

## How It Works

The tool can be run as a continuous service or as two separate, scheduled commands.

### The Two-Stage Process

The core logic is split into two stages to ensure efficiency and accuracy:

1.  **`fetch-events`**: This command queries the Hello Club API for all upcoming events within a configurable time window (e.g., the next 24 hours). It then stores these events in a local database. This command is designed to be run periodically (e.g., once every hour).
2.  **`process-schedule`**: This command checks the local database for stored events that are about to start. When an event is within a configurable time window (e.g., 5 minutes from its start time), it makes one final API call to get the latest attendee list and generates a printable PDF. This command is designed to be run frequently (e.g., once every minute).

### The `start-service` Command

For ease of use, the `start-service` command combines both stages into a single, long-running process. It will periodically fetch events and constantly monitor the schedule to process printouts automatically. This is the recommended way to run the application.

## Getting Started

This guide will get you up and running quickly. For more detailed information, please refer to the sections below.

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print.git
    cd Hello-Club-Event-Attendance-Auto-Print
    ```

2.  **Configure Environment**
    Create a `.env` file in the project root. You can copy the example file to get started:
    ```bash
    cp .env.example .env
    ```
    Now, edit the `.env` file and add your Hello Club `API_KEY`.

3.  **Install Dependencies**
    ```bash
    npm install
    ```

4.  **Run the Service**
    The easiest way to run the application is to use the `start-service` command, which handles everything automatically.
    ```bash
    npm start
    ```
    The service will now be running in the foreground. For production use, it is recommended to run this as a background service using a process manager like PM2 (see "Running as a Service" below).

---

## Installation

### Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js**: This project is built on Node.js. You can download it from [https://nodejs.org/](https://nodejs.org/).
- **npm**: The Node Package Manager is included with Node.js and is used to manage the project's dependencies.
- **Git**: You will need Git to clone the repository. You can download it from [https://git-scm.com/](https://git-scm.com/).

### Build Tools for `sqlite3`

One of this project's dependencies (`sqlite3`) may need to be compiled from source, which requires a build toolchain.

- **Python**: Required by the `node-gyp` build tool. You can download it from [https://www.python.org/](https://www.python.org/).
- **C++ Compiler**:
    - **Windows:** Install the "Desktop development with C++" workload from the [Visual Studio Installer](https://visualstudio.microsoft.com/downloads/).
    - **macOS:** Install the Xcode Command Line Tools by running `xcode-select --install`.
    - **Linux:** Install a compiler like GCC (e.g., `sudo apt install build-essential`).

> **Important for Python 3.12+ Users:** The `distutils` module has been removed from Python 3.12 and newer, which can cause an error when `node-gyp` tries to build `sqlite3`. To fix this, you must manually install `setuptools`:
>
> ```bash
> pip install setuptools
> ```

### Local Printing Requirements

To print PDFs directly to a physical printer (`--print-mode local`), you may need additional software:

-   **Windows:** You must install **SumatraPDF**. You can download it from [https://www.sumatrapdfreader.org/free-pdf-reader](https://www.sumatrapdfreader.org/free-pdf-reader).
-   **macOS/Linux:** A printer must be configured through the system's printing service (e.g., CUPS).

### Installation Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print.git
    ```

2.  **Navigate to the project directory:**
    ```bash
    cd Hello-Club-Event-Attendance-Auto-Print
    ```

3.  **Install the dependencies:**
    ```bash
    npm install
    ```

## Configuration

The tool is configured using two files: `.env` for secrets and `config.json` for settings.

### 1. API Key & Email (`.env` file)

This file stores your Hello Club API key and email settings for the email print mode.

1.  Create a file named `.env` in the root of the project directory.
2.  Add your configuration to the file. `API_KEY` is always required. The other variables are only needed if you use the `email` print mode.

    ```
    # Required for API access
    API_KEY=your_hello_club_api_key

    # Required for Email Printing Mode (Defaults are for Gmail)
    PRINTER_EMAIL=your_printer_email_address@domain.com
    SMTP_USER=your_gmail_username_or_app_password
    SMTP_PASS=your_gmail_app_password
    EMAIL_FROM=sender_address@example.com
    ```

### 2. Event & Print Settings (`config.json` file)

This file allows you to specify the default behavior for the script. Command-line options will always override the settings in this file.

Example `config.json`:
```json
{
  "categories": ["NBA - Junior Events", "Pickleball"],
  "fetchWindowHours": 24,
  "preEventQueryMinutes": 5,
  "serviceRunIntervalHours": 1,
  "outputFilename": "attendees.pdf",
  "pdfLayout": {
    "logo": null,
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
- `categories`: A list of event category names to process. An empty list `[]` processes all categories.
- `fetchWindowHours`: How many hours to look ahead for upcoming events. (Default: 24)
- `preEventQueryMinutes`: How many minutes before an event starts to perform the final query for attendees. (Default: 5)
- `serviceRunIntervalHours`: How often (in hours) the `start-service` command should re-fetch the list of upcoming events. (Default: 1)
- `outputFilename`: The default name for the generated PDF file. (Default: "attendees.pdf")
- `pdfLayout`: Configuration for the PDF's appearance. The `"id"` for a column must match a data field from the Hello Club API.

### 3. Advanced Configuration (Optional)

The following advanced features can be added to your `config.json`:

#### Webhooks & Notifications

Send notifications to Slack, Discord, or custom webhooks when events are processed or errors occur:

```json
{
  "webhooks": {
    "onSuccess": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
    "onError": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
    "onWarning": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
  }
}
```

Supports Slack, Discord, and generic webhooks.

#### Multiple Printers

Route events to different printers based on category:

```json
{
  "printers": {
    "NBA - Junior Events": {
      "type": "local",
      "name": "HP LaserJet Pro"
    },
    "Pickleball": {
      "type": "email",
      "email": "pickleball-printer@example.com"
    }
  }
}
```

#### Event Filters

Apply advanced filtering beyond categories:

```json
{
  "filters": {
    "includeKeywords": ["tournament", "championship"],
    "excludeKeywords": ["cancelled", "test"],
    "onlyPaidEvents": false,
    "onlyFreeEvents": false,
    "minAttendees": 5,
    "maxAttendees": 100
  }
}
```

**Note:** `minAttendees` and `maxAttendees` are expensive to evaluate and should be used sparingly.

#### PDF Layout Extensions

Customize PDF appearance with watermarks, headers, and footers:

```json
{
  "pdfLayout": {
    "logo": null,
    "fontSize": 10,
    "columns": [...],
    "headerText": "Hello Club Events",
    "footerText": "Generated by Hello Club Auto-Print",
    "watermark": "DRAFT"
  }
}
```

#### Configuration Hot-Reload

Enable automatic configuration reloading without restart:

```json
{
  "watchConfig": true
}
```

When enabled, the service will automatically detect changes to `config.json` and reload the configuration. Note that some changes (like intervals) require a service restart.

## Usage

The application can be run using one of three commands.

### `fetch-events`

Finds and stores upcoming events. Should be run periodically if not using the `start-service` command.

**Usage:**
```bash
node src/index.js fetch-events [options]
```

**Options:**
- `--category "Category Name"` (`-c`): Overrides the `categories` in `config.json`. Use the flag multiple times for multiple categories.
- `--fetch-window-hours <hours>` (`--fwh`): Overrides the `fetchWindowHours` in `config.json`.

### `process-schedule`

Processes stored events that are about to start. Should be run frequently if not using the `start-service` command.

**Usage:**
```bash
node src/index.js process-schedule [options]
```

**Options:**
- `--pre-event-query-minutes <minutes>` (`-w`): Overrides the `preEventQueryMinutes` in `config.json`.
- `--output <filename>` (`-o`): Overrides the `outputFilename` in `config.json`.
- `--print-mode <mode>` (`-p`): Sets the print mode (`local` or `email`).

### `start-service`

Runs the entire fetch and process cycle continuously. **This is the recommended command for automation.**

**Usage:**
```bash
node src/index.js start-service [options]
```
This command accepts all options available to `fetch-events` and `process-schedule`.

### `health-check`

Checks the health and status of the running service. This command is essential for monitoring and troubleshooting in production.

**Usage:**
```bash
node src/index.js health-check
```

**What it checks:**
- Service running status (heartbeat monitoring)
- Database connectivity and event counts
- Log file status and timestamps
- Required environment variables
- Last successful fetch and process operations
- Recent errors (if any)
- Current service configuration

**Exit codes:**
- `0` - Service is healthy
- `1` - Service is unhealthy (errors detected)
- `2` - Service is degraded (warnings detected)

**Example output:**
```
========================================
  Hello Club Service - Health Check
========================================

Overall Status: HEALTHY

Check Time: 2024-01-15T10:30:00.000Z

✓ serviceRunning: OK
  Service is active (last heartbeat 45s ago)
✓ database: OK
  Total Events: 15
  Pending: 3
  Processed: 12
✓ logFiles: OK
  activity.log: 45231 bytes (modified: 2024-01-15T10:29:30.000Z)
  error.log: 1024 bytes (modified: 2024-01-15T09:00:00.000Z)
✓ environment: OK
  All required environment variables are set

========================================
```

### NEW: Additional Commands

The application now includes many additional commands for database management, testing, and monitoring.

#### `dashboard` - Web-Based GUI (Windows-Friendly!)

Start a web-based dashboard for monitoring the service status. Perfect for Windows users who prefer a GUI!

**Usage:**
```bash
node src/index.js dashboard [--port 3030]

# Or on Windows, just double-click:
start-dashboard.bat
```

Opens a browser-based dashboard at `http://localhost:3030` showing:
- Real-time service status
- Event counts (total/pending/processed)
- System health checks
- Recent events
- Configuration details
- Auto-refreshes every 30 seconds

#### `list-events` - View Database Contents

List all events in the database with optional filtering.

**Usage:**
```bash
node src/index.js list-events [--status all|pending|processed] [--limit 50]
```

#### `cleanup` - Database Maintenance

Remove old processed events to keep database size manageable.

**Usage:**
```bash
# Preview what would be deleted
node src/index.js cleanup --days 30 --dry-run

# Actually delete
node src/index.js cleanup --days 30
```

#### `preview-event` - Preview Event Details

See event details and attendee information before processing.

**Usage:**
```bash
node src/index.js preview-event <event-id>
```

Shows:
- Event details (name, date, location, categories)
- Attendee count
- Payment summary
- First 10 attendees

#### `test-email` - Test Email Configuration

Verify your email/SMTP settings by sending a test message.

**Usage:**
```bash
node src/index.js test-email [recipient@example.com]
```

Sends a test email with a PDF attachment to verify your setup.

#### `test-printer` - Test Printer Configuration

Verify your local printer setup.

**Usage:**
```bash
node src/index.js test-printer [printer-name]
```

Sends a test document to your printer.

#### `backup` - Create Database Backup

Create a timestamped backup of your database.

**Usage:**
```bash
node src/index.js backup [path/to/backup.db]
```

#### `restore` - Restore from Backup

Restore your database from a backup file.

**Usage:**
```bash
node src/index.js restore path/to/backup.db
```

**Note:** Creates an emergency backup before restoring.

#### `metrics` - Performance Metrics Dashboard

Display performance metrics and statistics about the service.

**Usage:**
```bash
node src/index.js metrics
```

Shows:
- Total events processed, fetched, and errors
- API call statistics
- Average processing times
- Uptime and last reset time
- Per-operation metrics

#### `metrics-reset` - Reset Metrics

Reset all performance metrics data to start fresh.

**Usage:**
```bash
node src/index.js metrics-reset
```

#### `api-stats` - API Rate Limiting Dashboard

Display API usage statistics and rate limit information.

**Usage:**
```bash
node src/index.js api-stats [--minutes 60]
```

Shows:
- API rate limit status (remaining requests, reset time)
- Visual progress bar of rate limit usage
- Total API calls in time window
- Calls per minute
- Recent call history
- Per-endpoint statistics

## Running as a Service (Automation)

To achieve full automation, the application should be run as a persistent background service.

### Method 1: Using PM2 (Recommended)

PM2 is a production process manager for Node.js applications that keeps your service alive.

**1. Install PM2**
If you don't have PM2 installed, install it globally using `npm`:
```bash
npm install pm2 -g
```

**2. Start the Service**
Navigate to the project directory and use the following command to start the application with PM2.
```bash
pm2 start src/index.js --name "hello-club-service" -- -- start-service
```
- `pm2 start src/index.js`: Tells PM2 to execute the main script at `src/index.js`. Using the script file directly is more reliable than using `npm` across different platforms.
- `--name "hello-club-service"`: Gives the process a memorable name.
- `-- -- start-service`: The double dash (`--`) separates `pm2` options from your script's arguments. `start-service` is the command passed to your application.

**3. Enable Automatic Startup**
To ensure the service restarts when your computer reboots, run this command and follow the on-screen instructions:
```bash
pm2 startup
```

**4. Save the Process List**
Save the current process list so PM2 knows what to restart on boot:
```bash
pm2 save
```

**5. Managing the Service**
- **Check status:** `pm2 status`
- **View logs:** `pm2 logs hello-club-service`
- **Stop the service:** `pm2 stop hello-club-service`
- **Restart the service:** `pm2 restart hello-club-service`
- **Delete the service:** `pm2 delete hello-club-service`

### Method 2: Using Windows Task Scheduler (Alternative)

If you are on Windows and prefer not to use PM2, you can schedule two separate tasks.

**Task 1: Fetch Events (Run Periodically)**
- **Frequency:** Every 1 to 4 hours.
- **Action:**
    - Program/script: `C:\Program Files\nodejs\node.exe`
    - Add arguments: `src/index.js fetch-events`
    - Start in: `C:\path\to\your\project`

**Task 2: Process Schedule (Run Frequently)
- **Frequency:** Every 1 to 5 minutes.
- **Action:**
    - Program/script: `C:\Program Files\nodejs\node.exe`
    - Add arguments: `src/index.js process-schedule`
    - Start in: `C:\path\to\your\project`

### Method 3: Using Docker (Modern Deployment)

Docker provides isolated, reproducible deployments perfect for production servers.

**1. Build and Start with Docker Compose**
```bash
# Create .env file with your configuration
cp .env.example .env
# Edit .env with your API keys and settings

# Start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

**2. Or Build and Run Manually**
```bash
# Build the image
docker build -t hello-club-service .

# Run the container
docker run -d \
  --name hello-club \
  --restart unless-stopped \
  -v $(pwd)/events.db:/app/events.db \
  -v $(pwd)/config.json:/app/config.json:ro \
  -e API_KEY=your_api_key \
  -e PRINTER_EMAIL=printer@example.com \
  -e SMTP_USER=your_email \
  -e SMTP_PASS=your_password \
  -p 3030:3030 \
  hello-club-service
```

**3. Run Dashboard as Separate Container**
```bash
# Start with dashboard profile
docker-compose --profile dashboard up -d
```

**Docker Features:**
- Built-in health checks
- Automatic restarts
- Volume persistence
- Environment-based configuration
- Small Alpine-based image
- Production-ready logging

## Testing

To run the automated tests, use the following command:
```bash
npm test
```

To see the test coverage, run:
```bash
npm run coverage
```

## Troubleshooting

### Service Not Working in Production

If the service worked on your test bench but isn't working in production, follow these steps:

**1. Run the Health Check**
```bash
node src/index.js health-check
```
This will show you the current status and identify any issues.

**2. Check Log Files**
The service creates two log files in the working directory:
- `activity.log` - All operations and info messages
- `error.log` - Only errors

View the logs:
```bash
# View last 50 lines of activity log
tail -n 50 activity.log

# View error log
cat error.log

# For PM2 users
pm2 logs hello-club-service
```

**3. Enable Console Logging in Production**
By default, the service only logs to files in production. To see logs in the console:
```bash
# In your .env file, add:
LOG_TO_CONSOLE=true
```
Then restart the service.

**4. Check the Status File**
The service creates a `status.json` file that tracks:
- When the service last started
- Last successful fetch and process times
- Current configuration
- Recent errors

View the status file:
```bash
cat status.json
```

### Common Issues

- **Error: "401 Unauthorized"**: Your `API_KEY` in the `.env` file is incorrect or has expired.

- **Message: "No new events to store"**: The `fetch-events` command ran but did not find any new events that matched your category filters within the `fetchWindowHours`.

- **Message: "No events to process"**: The `process-schedule` command ran but no stored events were scheduled to start within the `preEventQueryMinutes`.

- **Database is never populated**:
  1. Run `health-check` to see if the service is actually running
  2. Check `activity.log` for fetch operations
  3. Ensure your category filters in `config.json` are correct
  4. Verify your API key has proper permissions

- **Events are not being printed**:
  1. Check if events exist in the database: `node src/index.js health-check`
  2. Verify `preEventQueryMinutes` allows enough time before event start
  3. Check `activity.log` for processing attempts
  4. If using email mode, verify SMTP settings are correct

- **Service appears to stop after some time**:
  1. Check `error.log` for any critical errors
  2. Verify the server hasn't run out of disk space
  3. Check system resources (memory, CPU)
  4. If using PM2, check `pm2 logs` for crash reports

- **Health check shows service is inactive**:
  1. The service may have crashed - check `error.log`
  2. Restart the service with PM2: `pm2 restart hello-club-service`
  3. Check if the process is actually running: `pm2 status` or `ps aux | grep node`

### Monitoring the Service

For continuous monitoring, you can:

1. **Set up a cron job to run health checks:**
```bash
# Check every 10 minutes and send email if unhealthy
*/10 * * * * cd /path/to/project && node src/index.js health-check || mail -s "Service Unhealthy" you@example.com
```

2. **Use PM2's monitoring:**
```bash
pm2 monit hello-club-service
```

3. **Check service status regularly:**
```bash
# Quick status check
node src/index.js health-check

# View recent activity
tail -f activity.log
```
