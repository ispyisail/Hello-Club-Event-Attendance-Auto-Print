# Hello Club Event Attendance Auto-Print

Windows service + Electron tray app for automating Hello Club event attendance printing.

## Architecture

```
src/index.js          Entry point, CLI commands (fetch-events, process-schedule, start-service)
src/core/             Business logic
  api-client.js       Hello Club API (axios w/retry, caching, graceful degradation)
  database.js         SQLite (better-sqlite3 singleton)
  functions.js        Event processing, PDF creation, printing
  service.js          Scheduler loop, job persistence, crash recovery
src/services/
  pdf-generator.js    PDFKit-based PDF generation
  email-service.js    Nodemailer SMTP
  logger.js           Winston logging (activity.log, error.log)
src/utils/
  config-schema.js    Joi validation
  cache.js            In-memory cache with stale fallback
service/              Windows service scripts (node-windows)
tray-app/main.js      Electron system tray application
tests/                Jest unit tests
```

## Key Patterns

**Error Handling:**

- `handleApiError()` pattern for API errors with timeout/401/network detection
- Try-catch with logger.error(message, error) - always pass error object
- Re-throw after logging for caller handling
- Mark events as 'failed' in DB on processing errors

**API Client:**

- Axios with timeout (30s default, API_TIMEOUT env override)
- Cache with fresh/stale TTL for graceful degradation
- Pagination with 1s delay between requests (rate limiting)

**Database:**

- Singleton pattern via `getDb()`
- Migrations in `src/core/migrations/`
- Status values: 'pending', 'processed', 'failed'

**Service:**

- setTimeout-based scheduling with in-memory Map
- Job persistence in scheduled_jobs table for crash recovery
- Exponential backoff retry (5min, 10min, 20min, max 3 retries)
- 15-minute heartbeat logging

**Electron:**

- Context isolation enabled, preload scripts for IPC
- Single instance lock via `app.requestSingleInstanceLock()`
- BrowserWindow for log viewer, settings, dashboard

## Common Commands

```bash
npm test                    # Run Jest tests
npm run lint                # ESLint check
npm run lint:fix            # Auto-fix lint errors
npm run coverage            # Test coverage report
npm run service:install     # Install Windows service (admin required)
npm run service:uninstall   # Remove Windows service
npm run tray                # Start Electron tray app
npm run validate            # Lint + test
```

## Config Files

- `.env` - Secrets: API*KEY, SMTP*\*, PRINTER_EMAIL (gitignored)
- `config.json` - Settings: categories, timing, printMode, pdfLayout
- `events.db` - SQLite database (gitignored)

## Code Style

- CommonJS modules (`require`/`module.exports`)
- ESLint + Prettier (auto-run via husky pre-commit)
- JSDoc comments on exported functions
- `prefer-const`, `no-var`, unused vars with `_` prefix allowed
- Winston logger, never raw `console.log` in production code

## Testing

- Jest with mocks for external dependencies
- Mock pattern: `jest.mock('../path')` at top of test file
- Mock DB: `getDb.mockReturnValue(mockDb)` with `prepare()`, `run()`, `all()`
- Assertions: `expect(fn).toHaveBeenCalledWith()`, `expect().rejects.toThrow()`

## Troubleshooting

- 401 errors: Check API_KEY in .env
- Service not starting: Run as Administrator, check error.log
- No events processing: Verify categories in config.json match API
- SMTP failures: Gmail requires App Password, not account password
