# Prioritized Fix Plan

Based on the comprehensive codebase review, here's a prioritized plan to address all identified issues.

---

## Phase 1: Critical Security Fixes (Immediate)

### 1.1 Path Traversal in Email Attachments

**File:** `src/services/email-service.js:31`
**Risk:** HIGH - Arbitrary file read

```javascript
// BEFORE (vulnerable)
attachments: [{ path: attachmentPath }];

// AFTER (fixed)
const path = require('path');
const ALLOWED_DIR = path.resolve(process.cwd());

function validateAttachmentPath(filePath) {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(ALLOWED_DIR)) {
    throw new Error('Invalid attachment path: outside allowed directory');
  }
  if (!fs.existsSync(resolved)) {
    throw new Error('Attachment file does not exist');
  }
  return resolved;
}

// In sendEmailWithAttachment():
const safePath = validateAttachmentPath(attachmentPath);
attachments: [{ path: safePath }];
```

### 1.2 Webhook Error Handling

**File:** `src/core/service.js` (lines 94-96, 127-129, 175-177, 234-236)
**Risk:** HIGH - Event processing stops on webhook failure

```javascript
// BEFORE (no error handling)
await notifyEventProcessed(event, attendeeCount, config.webhook.url);

// AFTER (wrapped in try-catch)
try {
  await notifyEventProcessed(event, attendeeCount, config.webhook.url);
} catch (webhookError) {
  logger.warn('Webhook notification failed (non-fatal):', webhookError.message);
  // Continue processing - webhook failure is not fatal
}
```

Apply to ALL webhook calls in service.js.

### 1.3 SSRF Protection in Webhook

**File:** `src/utils/webhook.js:23-30`
**Risk:** HIGH - Could hit internal services

```javascript
// ADD at top of file
const { URL } = require('url');

const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  // Add internal hostnames if known
];

function isPrivateIP(hostname) {
  // Check for private IP ranges
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4) return false;

  return (
    parts[0] === 10 || // 10.0.0.0/8
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
    (parts[0] === 192 && parts[1] === 168) || // 192.168.0.0/16
    parts[0] === 127 // 127.0.0.0/8
  );
}

function validateWebhookUrl(url) {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'https:') {
      throw new Error('Webhook URL must use HTTPS');
    }

    if (BLOCKED_HOSTS.includes(parsed.hostname) || isPrivateIP(parsed.hostname)) {
      throw new Error('Webhook URL cannot point to private/local addresses');
    }

    return true;
  } catch (error) {
    logger.error('Invalid webhook URL:', error.message);
    return false;
  }
}

// In sendWebhook():
async function sendWebhook(url, payload, retryCount = 0) {
  if (!url || !validateWebhookUrl(url)) {
    return { success: false, error: 'Invalid or blocked webhook URL' };
  }
  // ... rest of function
}
```

### 1.4 Logo Upload File Type Validation

**File:** `tray-app/main.js:546-552`
**Risk:** HIGH - Could upload executables

```javascript
// ADD validation before copy
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif'];
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif'];

// In upload-logo handler:
ipcMain.handle('upload-logo', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Logo Image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif'] }],
    properties: ['openFile'],
  });

  if (result.canceled || !result.filePaths.length) {
    return { success: false, error: 'No file selected' };
  }

  const sourcePath = result.filePaths[0];
  const ext = path.extname(sourcePath).toLowerCase();

  // Validate extension
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { success: false, error: 'Invalid file type. Only PNG, JPG, JPEG, GIF allowed.' };
  }

  // Validate file size (max 5MB)
  const stats = fs.statSync(sourcePath);
  if (stats.size > 5 * 1024 * 1024) {
    return { success: false, error: 'File too large. Maximum 5MB allowed.' };
  }

  // Copy file
  const logoFileName = `logo${ext}`;
  const destPath = path.join(PROJECT_ROOT, logoFileName);
  fs.copyFileSync(sourcePath, destPath);

  return { success: true, logoPath: logoFileName };
});
```

### 1.5 Fix Race Condition in Scheduled Jobs

**File:** `src/core/service.js:30-31, 78`
**Risk:** HIGH - Events could be permanently stuck

```javascript
// ADD helper function at top of service.js
function isJobAlreadyScheduled(eventId) {
  // Check both in-memory map AND database
  if (scheduledJobs.has(eventId)) {
    return true;
  }

  const db = getDb();
  const job = db
    .prepare("SELECT status FROM scheduled_jobs WHERE event_id = ? AND status IN ('scheduled', 'processing')")
    .get(eventId);

  return !!job;
}

// MODIFY scheduleEvent() opening:
function scheduleEvent(event, config) {
  if (isJobAlreadyScheduled(event.id)) {
    logger.info(`Event ${event.id} already scheduled, skipping`);
    return;
  }
  // ... rest of function
}

// In recoverPendingJobs(), sync map with database:
function recoverPendingJobs(config) {
  const db = getDb();

  // Clear stale in-memory entries
  scheduledJobs.clear();

  const pendingJobs = db.prepare("SELECT * FROM scheduled_jobs WHERE status IN ('scheduled', 'processing')").all();

  for (const job of pendingJobs) {
    // ... existing recovery logic
  }
}
```

---

## Phase 2: High Priority Fixes (This Week)

### 2.1 Add Database Indexes

**File:** `src/core/migrations/002_add_indexes.js` (NEW FILE)

```javascript
// Create new migration file
module.exports = {
  up: (db) => {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
      CREATE INDEX IF NOT EXISTS idx_events_startdate ON events(startDate);
      CREATE INDEX IF NOT EXISTS idx_events_status_startdate ON events(status, startDate);
      CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_event_id ON scheduled_jobs(event_id);
      CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_scheduled_time ON scheduled_jobs(scheduled_time);
    `);
  },
  down: (db) => {
    db.exec(`
      DROP INDEX IF EXISTS idx_events_status;
      DROP INDEX IF EXISTS idx_events_startdate;
      DROP INDEX IF EXISTS idx_events_status_startdate;
      DROP INDEX IF EXISTS idx_scheduled_jobs_status;
      DROP INDEX IF EXISTS idx_scheduled_jobs_event_id;
      DROP INDEX IF EXISTS idx_scheduled_jobs_scheduled_time;
    `);
  },
};
```

### 2.2 Add Cache Size Limits

**File:** `src/utils/cache.js`

```javascript
// ADD at top
const MAX_CACHE_SIZE = 1000;

// MODIFY set() method
set(key, value, ttlSeconds = 300, staleTtlSeconds = 3600) {
  // Evict oldest entries if at capacity
  if (this.cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = this.cache.keys().next().value;
    this.cache.delete(oldestKey);
    logger.debug(`Cache evicted oldest entry: ${oldestKey}`);
  }

  const now = Date.now();
  this.cache.set(key, {
    value,
    expiresAt: now + ttlSeconds * 1000,
    staleExpiresAt: now + staleTtlSeconds * 1000,
    createdAt: now  // Track age for LRU
  });
}
```

### 2.3 Add Pagination Safety Check

**File:** `src/core/api-client.js:166-183`

```javascript
// MODIFY getAllAttendees() loop
async function getAllAttendees(eventId, options = { allowStale: true }) {
  // ... existing setup ...

  const MAX_PAGES = 100; // Safety limit
  let pageCount = 0;

  do {
    pageCount++;
    if (pageCount > MAX_PAGES) {
      logger.error(`Pagination exceeded ${MAX_PAGES} pages for event ${eventId}`);
      break;
    }

    const response = await api.get('/eventAttendee', {
      params: { event: eventId, limit, offset },
    });

    const receivedAttendees = response.data.attendees;
    const total = response.data.meta?.total || 0;

    if (!receivedAttendees || receivedAttendees.length === 0) {
      break;
    }

    attendees = attendees.concat(receivedAttendees);
    offset += receivedAttendees.length;

    // Safety check: stop if we've fetched all
    if (offset >= total) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  } while (true);

  // ... rest of function
}
```

### 2.4 Extract Database Helper Functions

**File:** `src/core/database.js` (ADD functions)

```javascript
// ADD helper functions for common operations
function updateEventStatus(eventId, status) {
  const db = getDb();
  const stmt = db.prepare('UPDATE events SET status = ? WHERE id = ?');
  return stmt.run(status, eventId);
}

function updateJobStatus(eventId, status, errorMessage = null) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE scheduled_jobs
    SET status = ?, error_message = ?, updated_at = datetime('now')
    WHERE event_id = ?
  `);
  return stmt.run(status, errorMessage, eventId);
}

function incrementJobRetryCount(eventId) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE scheduled_jobs
    SET retry_count = retry_count + 1, updated_at = datetime('now')
    WHERE event_id = ?
  `);
  return stmt.run(eventId);
}

function getJobInfo(eventId) {
  const db = getDb();
  return db.prepare('SELECT * FROM scheduled_jobs WHERE event_id = ?').get(eventId);
}

module.exports = {
  getDb,
  cleanupOldEvents,
  updateEventStatus,
  updateJobStatus,
  incrementJobRetryCount,
  getJobInfo,
};
```

### 2.5 Add Email Header Validation

**File:** `src/services/email-service.js`

```javascript
// ADD validation function
function validateEmailParams(to, from, subject) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const headerInjectionRegex = /[\r\n]/;

  if (!emailRegex.test(to)) {
    throw new Error('Invalid recipient email address');
  }

  if (from && !emailRegex.test(from)) {
    throw new Error('Invalid sender email address');
  }

  if (headerInjectionRegex.test(subject)) {
    throw new Error('Subject contains invalid characters');
  }

  return true;
}

// MODIFY sendEmailWithAttachment()
async function sendEmailWithAttachment(transportOptions, to, from, subject, body, attachmentPath) {
  validateEmailParams(to, from, subject);
  // ... rest of function
}
```

---

## Phase 3: Code Quality Improvements (Next Sprint)

### 3.1 Refactor scheduleEvent() - Break Into Smaller Functions

**File:** `src/core/service.js`

```javascript
// EXTRACT these functions from scheduleEvent():

async function processEventWithRetry(event, config) {
  const db = getDb();

  try {
    updateJobStatus(event.id, 'processing');

    const result = await processSingleEvent(event, config);

    updateJobStatus(event.id, 'completed');
    updateEventStatus(event.id, 'processed');

    await safeWebhookNotify(() => notifyEventProcessed(event, result.attendeeCount, config.webhook?.url));

    return { success: true, result };
  } catch (error) {
    return { success: false, error };
  }
}

async function handleProcessingError(event, config, error) {
  const jobInfo = getJobInfo(event.id);
  const currentRetries = jobInfo?.retry_count || 0;

  if (currentRetries < MAX_RETRIES) {
    return scheduleRetry(event, config, currentRetries);
  } else {
    return handlePermanentFailure(event, config, error);
  }
}

function scheduleRetry(event, config, currentRetries) {
  const retryDelay = BASE_RETRY_DELAY * Math.pow(2, currentRetries);

  incrementJobRetryCount(event.id);
  updateJobStatus(event.id, 'retrying');

  logger.info(`Scheduling retry ${currentRetries + 1}/${MAX_RETRIES} for ${event.id} in ${retryDelay / 1000}s`);

  const timeoutId = setTimeout(() => {
    processEventWithRetry(event, config);
  }, retryDelay);

  scheduledJobs.set(event.id, timeoutId);

  return { scheduled: true, retryCount: currentRetries + 1 };
}

async function handlePermanentFailure(event, config, error) {
  updateJobStatus(event.id, 'failed', error.message);
  updateEventStatus(event.id, 'failed');

  await safeWebhookNotify(() => notifyPermanentFailure(event, error.message, config.webhook?.url));

  logger.error(`Event ${event.id} permanently failed after ${MAX_RETRIES} retries`);

  return { failed: true };
}

// Helper for safe webhook calls
async function safeWebhookNotify(notifyFn) {
  try {
    await notifyFn();
  } catch (err) {
    logger.warn('Webhook notification failed (non-fatal):', err.message);
  }
}
```

### 3.2 Convert Magic Numbers to Config

**File:** `config.json` (ADD new fields)

```json
{
  "categories": ["NBA - Junior Events", "Pickleball"],
  "preEventQueryMinutes": 5,
  "fetchWindowHours": 168,
  "serviceRunIntervalHours": 1,
  "printMode": "local",
  "outputFilename": "attendees.pdf",

  "retry": {
    "maxAttempts": 3,
    "baseDelayMinutes": 5
  },

  "api": {
    "paginationLimit": 100,
    "paginationDelayMs": 1000,
    "cacheFreshSeconds": 120,
    "cacheStaleSeconds": 1800
  },

  "logging": {
    "maxFileSizeBytes": 5242880,
    "maxFiles": 5
  },

  "webhook": {
    "enabled": false,
    "url": null,
    "timeoutMs": 10000,
    "maxRetries": 2,
    "retryDelayMs": 2000
  },

  "database": {
    "cleanupDays": 30
  },

  "pdfLayout": { ... }
}
```

**File:** `src/utils/config-schema.js` (UPDATE schema)

```javascript
// ADD new schema sections
retry: Joi.object({
  maxAttempts: Joi.number().integer().min(1).max(10).default(3),
  baseDelayMinutes: Joi.number().integer().min(1).max(60).default(5)
}).default(),

api: Joi.object({
  paginationLimit: Joi.number().integer().min(10).max(500).default(100),
  paginationDelayMs: Joi.number().integer().min(100).max(5000).default(1000),
  cacheFreshSeconds: Joi.number().integer().min(30).max(3600).default(120),
  cacheStaleSeconds: Joi.number().integer().min(300).max(86400).default(1800)
}).default(),

logging: Joi.object({
  maxFileSizeBytes: Joi.number().integer().min(1048576).max(52428800).default(5242880),
  maxFiles: Joi.number().integer().min(1).max(20).default(5)
}).default(),

database: Joi.object({
  cleanupDays: Joi.number().integer().min(1).max(365).default(30)
}).default()
```

---

## Phase 4: Add Missing Tests (Ongoing)

### 4.1 Create service.js Tests

**File:** `tests/service.test.js` (NEW FILE)

```javascript
jest.mock('../src/core/database');
jest.mock('../src/core/functions');
jest.mock('../src/utils/webhook');
jest.mock('../src/services/logger');

const { scheduleEvent, recoverPendingJobs, runService } = require('../src/core/service');
const { getDb } = require('../src/core/database');
const { processSingleEvent } = require('../src/core/functions');

describe('Service Module', () => {
  let mockDb, mockStmt;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockStmt = {
      run: jest.fn(() => ({ changes: 1 })),
      get: jest.fn(() => null),
      all: jest.fn(() => []),
    };
    mockDb = {
      prepare: jest.fn(() => mockStmt),
    };
    getDb.mockReturnValue(mockDb);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('scheduleEvent', () => {
    it('should schedule event for future processing', () => {
      const event = {
        id: 'event-1',
        name: 'Test Event',
        startDate: new Date(Date.now() + 3600000).toISOString(),
      };
      const config = { preEventQueryMinutes: 5 };

      scheduleEvent(event, config);

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT'));
    });

    it('should skip already scheduled events', () => {
      const event = { id: 'event-1', name: 'Test' };
      mockStmt.get.mockReturnValue({ status: 'scheduled' });

      scheduleEvent(event, {});

      // Should not insert duplicate
      expect(mockStmt.run).not.toHaveBeenCalled();
    });

    it('should handle retry logic with exponential backoff', async () => {
      // Test retry scheduling
    });
  });

  describe('recoverPendingJobs', () => {
    it('should reschedule pending jobs on startup', () => {
      mockStmt.all.mockReturnValue([{ event_id: 'e1', scheduled_time: new Date(Date.now() + 60000).toISOString() }]);

      recoverPendingJobs({});

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('scheduled_jobs'));
    });

    it('should mark past-due jobs as failed', () => {
      mockStmt.all.mockReturnValue([{ event_id: 'e1', scheduled_time: new Date(Date.now() - 60000).toISOString() }]);

      recoverPendingJobs({});

      expect(mockStmt.run).toHaveBeenCalledWith('failed', expect.any(String), 'e1');
    });
  });
});
```

### 4.2 Create health-check.js Tests

**File:** `tests/health-check.test.js` (NEW FILE)

```javascript
jest.mock('../src/core/database');
jest.mock('../src/services/logger');
jest.mock('fs');

const { getHealthStatus, writeHealthFile } = require('../src/core/health-check');
const { getDb } = require('../src/core/database');
const fs = require('fs');

describe('Health Check Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when database is accessible', () => {
      const mockDb = { prepare: jest.fn(() => ({ get: jest.fn(() => ({ count: 5 })) })) };
      getDb.mockReturnValue(mockDb);

      const status = getHealthStatus();

      expect(status.healthy).toBe(true);
      expect(status.database).toBe('connected');
    });

    it('should return unhealthy when database fails', () => {
      getDb.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const status = getHealthStatus();

      expect(status.healthy).toBe(false);
      expect(status.database).toBe('error');
    });
  });

  describe('writeHealthFile', () => {
    it('should write health status to file', () => {
      fs.writeFileSync = jest.fn();

      writeHealthFile({ healthy: true });

      expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('health.json'), expect.any(String));
    });
  });
});
```

---

## Phase 5: Documentation Updates

### 5.1 Add Missing JSDoc

**Files to update:**

- `src/core/service.js` - Add JSDoc to `runService()`, `recoverPendingJobs()`
- `src/core/functions.js` - Add JSDoc to `createAndPrintPdf()`

### 5.2 Update .env.example

Add documentation for:

- `LOG_LEVEL` (info, debug, error)
- `DB_PATH` (database file location)
- Webhook configuration

### 5.3 Update README.md

- Update test badge count
- Add webhook configuration section
- Add troubleshooting guide

---

## Implementation Order

| Phase | Priority | Estimated Effort | Dependencies |
| ----- | -------- | ---------------- | ------------ |
| 1.1   | CRITICAL | 30 min           | None         |
| 1.2   | CRITICAL | 30 min           | None         |
| 1.3   | CRITICAL | 45 min           | None         |
| 1.4   | CRITICAL | 30 min           | None         |
| 1.5   | CRITICAL | 1 hour           | None         |
| 2.1   | HIGH     | 30 min           | None         |
| 2.2   | HIGH     | 30 min           | None         |
| 2.3   | HIGH     | 30 min           | None         |
| 2.4   | HIGH     | 1 hour           | None         |
| 2.5   | HIGH     | 30 min           | None         |
| 3.1   | MEDIUM   | 2 hours          | 2.4          |
| 3.2   | MEDIUM   | 2 hours          | None         |
| 4.1   | MEDIUM   | 3 hours          | 3.1          |
| 4.2   | MEDIUM   | 1 hour           | None         |
| 5.x   | LOW      | 2 hours          | All above    |

---

## Quick Start Commands

```bash
# After making changes, run tests
npm test

# Check for linting issues
npm run lint

# Run with coverage
npm run coverage

# Validate configuration
node -e "require('./src/utils/config-schema').validate(require('./config.json'))"
```

---

## Verification Checklist

After implementing fixes:

- [ ] All tests pass (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Coverage meets thresholds (`npm run coverage`)
- [ ] Service starts without errors (`npm start`)
- [ ] Tray app launches (`npm run tray`)
- [ ] API connection test passes
- [ ] Email connection test passes (if configured)
- [ ] Webhook blocked for localhost URLs
- [ ] Logo upload rejects non-image files
