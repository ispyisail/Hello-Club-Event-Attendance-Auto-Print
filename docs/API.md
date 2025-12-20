# API Reference

> Complete reference for all modules, functions, and classes

## Table of Contents

- [Core Modules](#core-modules)
  - [api-client](#api-client)
  - [database](#database)
  - [functions](#functions)
  - [service](#service)
- [Service Modules](#service-modules)
  - [logger](#logger)
  - [email-service](#email-service)
  - [pdf-generator](#pdf-generator)
- [Utility Modules](#utility-modules)
  - [config-schema](#config-schema)
  - [args-parser](#args-parser)
- [Entry Point](#entry-point)
- [Service Management](#service-management)
- [Tray Application](#tray-application)

---

## Core Modules

### api-client

**Location**: `src/core/api-client.js`

**Purpose**: Provides functions to interact with the Hello Club API

#### Constants

```javascript
const API_KEY = process.env.API_KEY
const BASE_URL = process.env.API_BASE_URL || 'https://api.helloclub.com'
```

#### Functions

##### `getEventDetails(eventId)`

Fetches the full details for a single event.

**Parameters**:
- `eventId` *(number)* - The ID of the event to fetch

**Returns**: `Promise<Object|null>`
- Event object with full details
- `null` if not found

**Throws**: `Error` - If API request fails

**Example**:
```javascript
const event = await getEventDetails(12345);
console.log(event.name); // "Junior Basketball Practice"
```

**API Response Structure**:
```javascript
{
  id: 12345,
  name: "Event Name",
  startDate: "2024-12-25T10:00:00Z",
  endDate: "2024-12-25T12:00:00Z",
  timezone: "America/New_York",
  categories: [{ name: "Category 1" }],
  // ... more fields
}
```

---

##### `getUpcomingEvents(fetchWindowHours)`

Fetches upcoming events from the Hello Club API within a given time window.

**Parameters**:
- `fetchWindowHours` *(number)* - Number of hours to look ahead for events

**Returns**: `Promise<Array<Object>>`
- Array of event objects
- Empty array if no events found

**Throws**: `Error` - If API request fails

**Example**:
```javascript
const events = await getUpcomingEvents(24);
console.log(`Found ${events.length} events`);
```

**Request Details**:
```http
GET /event?fromDate=2024-12-20T00:00:00Z&toDate=2024-12-21T00:00:00Z&sort=startDate
Authorization: Bearer {API_KEY}
```

---

##### `getAllAttendees(eventId)`

Fetches all attendees for a given event, handling pagination automatically.

**Parameters**:
- `eventId` *(string)* - The ID of the event

**Returns**: `Promise<Array<Object>>`
- Array of attendee objects sorted by last name, then first name
- Empty array if no attendees

**Throws**: `Error` - If API request fails

**Example**:
```javascript
const attendees = await getAllAttendees('evt_123');
console.log(`${attendees.length} attendees registered`);
```

**Attendee Object Structure**:
```javascript
{
  firstName: "John",
  lastName: "Doe",
  phone: "555-1234",
  signUpDate: 1703505600000, // Unix timestamp
  hasFee: true,
  isPaid: false,
  rule: { fee: "10.00" }
}
```

**Pagination Handling**:
- Fetches 100 attendees per request
- Automatically paginates through all results
- 1-second delay between requests to respect rate limits

---

##### `handleApiError(error, context)` *(private)*

Handles API errors with detailed logging.

**Parameters**:
- `error` *(Error)* - The error object from axios
- `context` *(string)* - Description of the operation

**Throws**: `Error` - Always throws with formatted message

**Error Types**:
- `401 Unauthorized` - Invalid API key
- `Network Error` - No response received
- `API Error` - Other HTTP errors
- `Unexpected Error` - Unknown errors

---

### database

**Location**: `src/core/database.js`

**Purpose**: Manages the SQLite database connection and schema

#### Functions

##### `getDb()`

Opens a persistent connection to the SQLite database (singleton pattern).

**Returns**: `Database` - The better-sqlite3 database instance

**Throws**: `Error` - If database initialization fails

**Example**:
```javascript
const db = getDb();
const events = db.prepare("SELECT * FROM events").all();
```

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  startDate TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
)
```

**Singleton Behavior**:
- First call creates the database connection
- Subsequent calls return the same connection
- Connection persists for the lifetime of the process

---

### functions

**Location**: `src/core/functions.js`

**Purpose**: Core business logic for event processing

#### Functions

##### `fetchAndStoreUpcomingEvents(finalConfig)`

Fetches upcoming events from the API and stores them in the local database.

**Parameters**:
- `finalConfig` *(Object)* - Application configuration
  - `fetchWindowHours` *(number)* - Hours to look ahead
  - `allowedCategories` *(Array<string>)* - Category filter

**Returns**: `Promise<void>`

**Throws**: `Error` - If database or API operation fails

**Example**:
```javascript
await fetchAndStoreUpcomingEvents({
  fetchWindowHours: 24,
  allowedCategories: ["NBA - Junior Events"]
});
```

**Process**:
1. Fetch events from API
2. Filter by categories (if specified)
3. Insert into database (INSERT OR IGNORE)
4. Log results

**Database Transaction**:
```javascript
const insertMany = db.transaction((events) => {
  for (const event of events) {
    stmt.run(event.id, event.name, event.startDate);
  }
});
```

---

##### `processScheduledEvents(finalConfig)`

Checks the database for events due for processing and processes them.

**Parameters**:
- `finalConfig` *(Object)* - Application configuration
  - `preEventQueryMinutes` *(number)* - Minutes before event to process

**Returns**: `Promise<void>`

**Throws**: `Error` - If processing fails

**Example**:
```javascript
await processScheduledEvents({
  preEventQueryMinutes: 5,
  outputFilename: "attendees.pdf",
  printMode: "local"
});
```

**Query**:
```sql
SELECT * FROM events
WHERE status = 'pending'
  AND startDate <= ?
```

**Process**:
1. Query database for pending events
2. Process each event sequentially
3. Update status to 'processed'

---

##### `processSingleEvent(event, finalConfig)`

Processes a single event: fetches attendees, creates PDF, prints it.

**Parameters**:
- `event` *(Object)* - The event object from database
- `finalConfig` *(Object)* - Application configuration

**Returns**: `Promise<void>`

**Example**:
```javascript
await processSingleEvent({
  id: 'evt_123',
  name: 'Basketball Practice',
  startDate: '2024-12-25T10:00:00Z'
}, config);
```

**Process Flow**:
1. Fetch full event details from API
2. Fetch all attendees (paginated)
3. Generate PDF
4. Print (local or email)
5. Mark as processed in database

**Error Handling**:
- Events are marked as processed even if they fail
- This prevents infinite retry loops
- Errors are logged to error.log

---

##### `createAndPrintPdf(event, attendees, outputFileName, pdfLayout, printMode)` *(private)*

Creates a PDF and sends it to the printer.

**Parameters**:
- `event` *(Object)* - Full event object
- `attendees` *(Array<Object>)* - Attendee list
- `outputFileName` *(string)* - PDF filename
- `pdfLayout` *(Object)* - PDF layout configuration
- `printMode` *(string)* - "local" or "email"

**Returns**: `Promise<void>`

**Print Modes**:

**Local Mode**:
```javascript
const { print } = require('pdf-to-printer');
await print(outputFileName);
```

**Email Mode**:
```javascript
await sendEmailWithAttachment(
  transportOptions,
  PRINTER_EMAIL,
  EMAIL_FROM,
  `Print Job: ${event.name}`,
  `Attendee list for ${event.name}`,
  outputFileName
);
```

---

### service

**Location**: `src/core/service.js`

**Purpose**: Service scheduler that orchestrates the two-stage process

#### Variables

```javascript
const scheduledJobs = new Map(); // In-memory job scheduler
```

#### Functions

##### `runService(config)`

Starts the long-running service process.

**Parameters**:
- `config` *(Object)* - Application configuration

**Returns**: `void` - Runs indefinitely

**Exits**: `process.exit(1)` - If configuration is invalid

**Example**:
```javascript
runService({
  serviceRunIntervalHours: 1,
  fetchWindowHours: 24,
  preEventQueryMinutes: 5
});
```

**Validation**:
```javascript
if (!config.serviceRunIntervalHours || config.serviceRunIntervalHours <= 0) {
  logger.error('Invalid serviceRunIntervalHours');
  process.exit(1);
}
```

**Intervals**:
- **Scheduler**: Runs every `serviceRunIntervalHours` hours
- **Heartbeat**: Logs every 15 minutes to show the service is alive

**Lifecycle**:
1. Validate configuration
2. Run scheduler immediately
3. Set up recurring interval
4. Set up heartbeat logging

---

##### `runScheduler(config)` *(async)*

Runs one iteration of the scheduler loop.

**Parameters**:
- `config` *(Object)* - Application configuration

**Returns**: `Promise<void>`

**Process**:
1. Fetch and store upcoming events
2. Schedule all pending events
3. Log completion

**Error Handling**:
- Errors during fetch are logged but don't crash the service
- Scheduling always runs even if fetch fails

---

##### `scheduleAllPendingEvents(config)`

Fetches pending events from database and schedules them.

**Parameters**:
- `config` *(Object)* - Application configuration

**Returns**: `void`

**Query**:
```sql
SELECT * FROM events WHERE status = 'pending'
```

**Process**:
- Calls `scheduleEvent()` for each pending event
- Skips events already scheduled (checked via `scheduledJobs` Map)

---

##### `scheduleEvent(event, config)` *(private)*

Schedules a single event for processing.

**Parameters**:
- `event` *(Object)* - Event to schedule
- `config` *(Object)* - Application configuration

**Returns**: `void`

**Calculation**:
```javascript
const processTime = eventStartTime - (preEventQueryMinutes * 60 * 1000);
const delay = processTime - now;
```

**Behavior**:
- If event is in the past: Skip (log warning)
- If already scheduled: Skip (idempotent)
- If in future: Create setTimeout job

**Job Management**:
```javascript
const timeoutId = setTimeout(() => {
  scheduledJobs.delete(event.id);  // Clean up
  processSingleEvent(event, config);
}, delay);

scheduledJobs.set(event.id, timeoutId);  // Track job
```

---

## Service Modules

### logger

**Location**: `src/services/logger.js`

**Purpose**: Winston logging configuration

#### Configuration

```javascript
{
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf()
  ),
  transports: [
    new winston.transports.File({
      filename: 'activity.log',
      level: 'info',
      maxsize: 5242880,  // 5MB
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
      tailable: true
    })
  ]
}
```

#### Methods

```javascript
logger.info("Message");
logger.warn("Warning message");
logger.error("Error message", errorObject);
```

#### Log Format

```
2024-12-20 10:30:00 info: Service starting...
2024-12-20 10:30:01 info: Found 3 upcoming events
2024-12-20 10:30:02 error: API Error - Stack trace...
```

---

### email-service

**Location**: `src/services/email-service.js`

**Purpose**: SMTP email sending with attachments

#### Functions

##### `sendEmailWithAttachment(transportOptions, to, from, subject, body, attachmentPath)`

Sends an email with a file attachment using Nodemailer.

**Parameters**:
- `transportOptions` *(Object)* - Nodemailer transport configuration
  - `host` *(string)* - SMTP hostname
  - `port` *(number)* - SMTP port
  - `secure` *(boolean)* - Use TLS
  - `auth` *(Object)* - Credentials
    - `user` *(string)* - SMTP username
    - `pass` *(string)* - SMTP password
- `to` *(string)* - Recipient email
- `from` *(string)* - Sender email
- `subject` *(string)* - Email subject
- `body` *(string)* - Plain text body
- `attachmentPath` *(string)* - Path to file attachment

**Returns**: `Promise<Object>` - Nodemailer response

**Throws**: `Error` - If email fails to send

**Example**:
```javascript
await sendEmailWithAttachment(
  {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: 'user@gmail.com', pass: 'password' }
  },
  'printer@company.com',
  'sender@gmail.com',
  'Print Job: Event Name',
  'Please print the attached document.',
  './attendees.pdf'
);
```

**Response**:
```javascript
{
  messageId: '<...@gmail.com>',
  response: '250 Message accepted'
}
```

---

### pdf-generator

**Location**: `src/services/pdf-generator.js`

**Purpose**: Generates PDF attendee lists

#### Class: `PdfGenerator`

##### Constructor

```javascript
constructor(event, attendees, layout)
```

**Parameters**:
- `event` *(Object)* - Event object with full details
- `attendees` *(Array<Object>)* - Array of attendee objects
- `layout` *(Object)* - PDF layout configuration

**Example**:
```javascript
const generator = new PdfGenerator(
  event,
  attendees,
  {
    logo: null,
    fontSize: 10,
    columns: [
      { id: "name", header: "Name", width: 140 },
      { id: "phone", header: "Phone", width: 100 }
    ]
  }
);
```

##### Methods

###### `generate(outputFileName)`

Generates the PDF and saves it to a file.

**Parameters**:
- `outputFileName` *(string)* - Path to save PDF

**Returns**: `void`

**Example**:
```javascript
generator.generate('attendees.pdf');
```

**PDF Structure**:
1. Header (event name, date, time)
2. Table header (column names with checkboxes)
3. Attendee rows (one per attendee)
4. Automatic page breaks

##### Private Methods

- `_generateHeader()` - Creates PDF header with event details
- `_generateTableHeader()` - Creates column headers
- `_generateTableRow(attendee, y)` - Renders one attendee row
- `_generateTable()` - Renders entire table with pagination
- `_getAttendeeValue(attendee, id)` - Formats attendee data for display

**Column ID Mappings**:
- `"name"` → `lastName, firstName`
- `"phone"` → `phone`
- `"signUpDate"` → Formatted date
- `"fee"` → Fee amount or empty
- `"status"` → "Paid" (green), "Owing" (red), "No Fee" (black)

---

## Utility Modules

### config-schema

**Location**: `src/utils/config-schema.js`

**Purpose**: Joi schema for validating `config.json`

#### Schema Definition

```javascript
const configSchema = Joi.object({
  categories: Joi.array().items(Joi.string()).default([]),
  preEventQueryMinutes: Joi.number().integer().min(1).default(5),
  serviceRunIntervalHours: Joi.number().integer().positive().default(1),
  fetchWindowHours: Joi.number().integer().positive().default(24),
  outputFilename: Joi.string().default('attendees.pdf'),
  printMode: Joi.string().valid('local', 'email').default('email'),
  email: Joi.object({...}).optional(),
  pdfLayout: Joi.object({...}).optional()
});
```

#### Usage

```javascript
const { error, value } = configSchema.validate(config);
if (error) {
  console.error(error.details);
}
```

#### Validation Features

- **Type checking**: Ensures correct data types
- **Defaults**: Provides default values
- **Constraints**: Validates min/max values
- **Optional fields**: Email and pdfLayout are optional

---

### args-parser

**Location**: `src/utils/args-parser.js`

**Purpose**: Command-line argument parsing with yargs

#### Commands

##### `fetch-events`

```bash
node index.js fetch-events [options]
```

**Options**:
- `--category <name>`, `-c` - Event category filter (repeatable)
- `--fetch-window-hours <hours>`, `--fwh` - Hours to look ahead

##### `process-schedule`

```bash
node index.js process-schedule [options]
```

**Options**:
- `--pre-event-query-minutes <minutes>`, `-w` - Minutes before event
- `--output <filename>`, `-o` - PDF filename
- `--print-mode <mode>`, `-p` - "local" or "email"

##### `start-service`

```bash
node index.js start-service [options]
```

Accepts all options from both commands above plus:
- `--service-run-interval-hours <hours>`, `--srih` - Service interval

#### Parsed Output

```javascript
{
  _: ['fetch-events'],
  category: ['NBA - Junior Events'],
  fetchWindowHours: 24
}
```

---

## Entry Point

### index.js

**Location**: `src/index.js`

**Purpose**: Application entry point and command router

#### Process

1. Load `.env` variables
2. Check for required environment variables
3. Load and validate `config.json`
4. Parse command-line arguments
5. Merge configuration (file + defaults + CLI)
6. Route to appropriate command handler

#### Global Error Handlers

```javascript
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', reason);
});
```

#### Configuration Merging

```javascript
const finalConfig = {
  allowedCategories: argv.category ?? validatedConfig.categories,
  fetchWindowHours: argv.fetchWindowHours ?? validatedConfig.fetchWindowHours,
  // CLI args override config file
};
```

---

## Service Management

### install.js

**Location**: `service/install.js`

**Purpose**: Installs the application as a Windows Service

#### Usage

```bash
node service/install.js
```

**Requires**: Administrator privileges

#### Service Configuration

```javascript
const svc = new Service({
  name: 'HelloClubEventAttendance',
  description: 'Automatically fetches and prints Hello Club event attendance lists',
  script: path.join(__dirname, '..', 'src', 'index.js'),
  scriptOptions: 'start-service',
  env: [{ name: 'NODE_ENV', value: 'production' }],
  maxRestarts: 10,
  maxRetries: 5,
  wait: 2,
  grow: 0.5
});
```

#### Events

- `install` - Service installed successfully
- `start` - Service started
- `error` - Installation failed
- `alreadyinstalled` - Service already exists

---

### uninstall.js

**Location**: `service/uninstall.js`

**Purpose**: Removes the Windows Service

**Usage**:
```bash
node service/uninstall.js
```

---

### status.js

**Location**: `service/status.js`

**Purpose**: Checks Windows Service status

**Usage**:
```bash
node service/status.js
```

**Output**:
```
Service: HelloClubEventAttendance
Status: RUNNING
Start Type: AUTO_START
```

---

## Tray Application

### main.js

**Location**: `tray-app/main.js`

**Purpose**: Electron system tray application

#### Key Functions

##### `checkServiceStatus(callback)`

Checks Windows Service status using `sc query`.

**Returns** (via callback):
```javascript
{
  installed: true,
  running: true,
  status: 'running'  // 'running', 'stopped', 'error', 'not-installed'
}
```

##### `startService(callback)`

Starts the Windows Service using `net start`.

##### `stopService(callback)`

Stops the Windows Service using `net stop`.

##### `restartService(callback)`

Restarts the Windows Service (stop then start).

##### `updateTrayStatus()`

Updates tray icon based on service status and recent errors.

**Icon Selection**:
- Green: Service running, no recent errors
- Red: Service stopped or error
- Yellow: Service status unknown

##### `getTrayIcon(status)`

Returns path to appropriate icon file.

#### IPC Handlers

```javascript
ipcMain.handle('get-activity-log', () => getRecentLogs(ACTIVITY_LOG, 500));
ipcMain.handle('get-error-log', () => getRecentLogs(ERROR_LOG, 500));
ipcMain.handle('get-service-status', () => checkServiceStatus());
ipcMain.handle('start-service', () => startService());
ipcMain.handle('stop-service', () => stopService());
ipcMain.handle('restart-service', () => restartService());
```

---

**Last Updated**: 2024-12-20
