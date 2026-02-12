# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Automated service that fetches Hello Club event attendance lists, generates PDFs, and prints them (locally via CUPS or remotely via email). Runs on Raspberry Pi 5 as a systemd service with a web dashboard for monitoring.

**Stack:** Node.js 18+ (CommonJS), SQLite (better-sqlite3), Express, PDFKit, Nodemailer, Winston logging.

## Commands

```bash
npm start                       # Run service (node src/index.js start-service)
npm run dashboard               # Start web dashboard (port 3000)
npm test                        # Run all Jest tests (118 tests)
npm run coverage                # Test coverage report
npm run lint                    # ESLint check
npm run lint:fix                # Auto-fix lint errors
npm run format                  # Prettier format all files
npm run validate                # Lint + test combined

# Single test file
npx jest tests/functions.test.js

# On Raspberry Pi
sudo systemctl start|stop|status helloclub
journalctl -u helloclub -f
```

## Architecture

```
src/index.js              Entry point, CLI commands (fetch-events, process-schedule, start-service)
src/core/
  api-client.js           Hello Club API (axios, circuit breaker, caching with fresh/stale TTL, pagination)
  database.js             SQLite singleton via getDb(), migrations system, withRetry(), withTransaction()
  functions.js            Event processing pipeline: fetch attendees -> generate PDF -> print/email
  service.js              Scheduler loop (setTimeout + in-memory Map), job persistence, retry, memory monitoring
  health-check.js         Service health monitoring (DB, cache, circuit breaker, memory)
  statistics.js           Event processing stats
  migrations/             Database schema migrations (001_initial_schema, 002_add_events_indexes)
src/services/
  pdf-generator.js        PDFKit PDF generation with configurable layout
  email-service.js        Nodemailer SMTP integration
  cups-printer.js         CUPS local printing (lp command wrapper)
  logger.js               Winston: activity.log + error.log
src/utils/
  config-schema.js        Joi validation for config.json
  cache.js                In-memory cache with TTL + stale fallback (max 1000 entries, FIFO eviction)
  validators.js           Input validation/sanitization (validateEvent, validateAttendee, etc.)
  circuit-breaker.js      Circuit breaker pattern implementation
  memory-monitor.js       Memory leak detection and monitoring
  backup.js               Config backup/restore
  webhook.js              Webhook notifications
web-dashboard/
  server.js               Express + WebSocket server (real-time log streaming)
  routes/api.js           Dashboard REST API
  middleware/auth.js       HTTP Basic Auth
tests/                    Jest unit tests
docs/
  HARDENING.md            Comprehensive hardening features documentation
```

## Data Flow

1. **Scheduler** (service.js) periodically fetches events from Hello Club API within a configurable time window
2. Events filtered by allowed categories, stored as 'pending' in SQLite
3. Jobs scheduled via setTimeout for `preEventQueryMinutes` before event start
4. When triggered: fetch attendees -> generate PDF -> print (CUPS) or email (SMTP)
5. On failure: exponential backoff retry (5min, 10min, 20min, max 3 retries)
6. Job state persisted in `scheduled_jobs` table for crash recovery

## Key Patterns

- **Error handling:** `handleApiError()` for API errors with timeout/401/network detection. Always pass error object to `logger.error(message, error)`, re-throw after logging.
- **Database:** Singleton `getDb()`, status values: 'pending' | 'processed' | 'failed'. Migrations in `src/core/migrations/`. Use `withRetry()` for operations that may encounter SQLITE_BUSY. Use `withTransaction()` for atomic multi-step operations.
- **API client:** Axios with 30s timeout (API_TIMEOUT env override), cache with fresh/stale TTL, 1s delay between paginated requests. Protected by circuit breaker (opens after 5 failures, 1min cooldown).
- **Input validation:** All external data (API, user input) validated via `src/utils/validators.js`. Use `validateEvent()`, `validateAttendee()`, `validateEventId()` before processing.
- **Memory management:** Bounded cache (max 1000 entries), automatic cleanup every 5 minutes. Memory monitoring logs warnings at 300MB heap / 400MB RSS.
- **PDF generation:** `generate()` returns a Promise (resolves on stream 'finish'). Callers must `await` it before using the output file — otherwise the file may not exist yet when emailing/printing.
- **Testing:** Jest mocks at file top. Mock DB: `getDb.mockReturnValue(mockDb)` with `prepare()`, `run()`, `all()`. Mock `withTransaction`/`withRetry` to execute callbacks: `withTransaction.mockImplementation((fn) => fn())`. Coverage thresholds enforced per-module (80-90% for functions.js, 70-80% for pdf-generator.js).

## Config Files

- `.env` — Secrets: API*KEY, SMTP*\*, PRINTER_EMAIL, DASHBOARD_USER/PASS (gitignored)
- `config.json` — Settings: categories, timing, printMode ('local'|'email'), pdfLayout, retry config
- `events.db` — SQLite database (gitignored)

## Code Style

- CommonJS modules (`require`/`module.exports`)
- ESLint + Prettier enforced via Husky pre-commit hook
- `prefer-const`, `no-var`, unused vars prefixed with `_`
- Winston logger only — no raw `console.log` in production code
- Prettier: 120 char width, single quotes, semicolons, ES5 trailing commas, LF line endings
