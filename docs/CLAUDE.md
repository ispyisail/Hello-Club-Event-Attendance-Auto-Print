# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Hello Club Event Attendance Auto-Print

Automated Node.js service that prints Hello Club event attendance lists. Runs on a Raspberry Pi 5 as a systemd service with a web dashboard for monitoring; CommonJS throughout, no build step (deploy is just `npm install --production`).

## How It Works

Two-stage, just-in-time process:

1. **`fetch-events`** — periodically scans the Hello Club API for upcoming events within `fetchWindowHours`, filters by `categories`, and stores them in SQLite with `status = 'pending'`.
2. **`process-schedule`** — for each pending event, `setTimeout`-schedules a job for `preEventQueryMinutes` before the event starts, then re-fetches the attendee list at that moment (to capture last-minute sign-ups), generates a PDF, and prints it (locally via CUPS or by emailing it to a network printer).

`start-service` runs both stages forever in one process: it fetches/schedules on a `setInterval` loop (every `serviceRunIntervalHours`) and lets the per-event `setTimeout` jobs fire independently.

## Architecture

```
src/index.js               CLI entry point (yargs). Commands: fetch-events, process-schedule, start-service
src/core/
  api-client.js             Hello Club API (axios + axios-retry, in-memory cache, graceful degradation)
  database.js                better-sqlite3 singleton (getDb()), runs migrations on first connection
  migrations.js               Migration runner — reads src/core/migrations/NNN_*.js, tracks applied versions in a `migrations` table
  migrations/                 Numbered migration files (001_initial_schema.js, 002_add_events_indexes.js)
  functions.js                Event processing: fetchAndStoreUpcomingEvents, processScheduledEvents, processSingleEvent, createAndPrintPdf
  service.js                  Scheduler: setTimeout job scheduling, DB-persisted job state, exponential-backoff retry, crash recovery, daily cleanup, health checks, statistics, webhooks
  health-check.js             Writes service-health.json every 60s (db/log/cache/job checks) — read by the dashboard's /api/service/status
  statistics.js               Aggregates event/job counts into statistics.json
src/services/
  pdf-generator.js            PDFKit-based PDF generation; also exports sanitizeOutputPath() (path-traversal guard)
  email-service.js            Nodemailer SMTP sending
  cups-printer.js              CUPS local printing (`lp` command wrapper, Linux only)
  logger.js                    Winston logging (activity.log, error.log)
src/utils/
  config-schema.js             Joi schema + defaults for config.json (categories, timing, printMode, retry, api, logging, database, pdfLayout, webhook)
  args-parser.js                yargs CLI argument parsing
  cache.js                      In-memory cache with fresh/stale TTL for graceful API degradation
  webhook.js                    Outbound webhook notifications (event.processed/failed, job.retrying/permanent_failure, service.status) with SSRF protection (HTTPS-only, blocks localhost/private IPs, no redirects)
  backup.js                     Config backup helper, used by the dashboard before writing config changes
web-dashboard/                Express + WebSocket dashboard (separate process from the service; started with `npm run dashboard`)
  server.js                     App setup, static file serving, WS log tailing (`tail -f` on activity.log)
  middleware/auth.js             Token-based session auth (skips /login.html, /api/login)
  routes/api.js                  REST API: service control (start/stop/restart via sudo systemctl), statistics, logs, config get/put (env + json), connection tests, PDF preview, logo upload
  connection-tests.js            API/Email/Print connectivity checks used by the dashboard's "Test" buttons
setup/                        Raspberry Pi install scripts + systemd unit files (helloclub.service, helloclub-dashboard.service)
tests/                        Jest unit tests (one file per src module roughly; mocks all external deps)
docs/                          Full documentation set — see docs/INDEX.md for the index; ARCHITECTURE.md, CONFIGURATION.md, WEB-DASHBOARD.md, DEPLOYMENT.md, RASPBERRY-PI-SETUP.md, TROUBLESHOOTING.md are the most relevant for deep dives
.claude/rules/                 Longer-form pattern references (API client, database, service, testing, web dashboard, code style) — consult these for copy-pasteable snippets beyond the summary below
```

The service (`src/core/service.js`) is the most complex module — a request to "fix scheduling" or "add a retry option" almost always means editing here, not `functions.js`. Key things it does beyond basic scheduling:

- Persists every scheduled job to the `scheduled_jobs` table so a crash/restart can recover (`recoverPendingJobs`): future jobs are rescheduled, past-due jobs are marked `failed`.
- Retries failed event processing with exponential backoff: `baseDelayMinutes * 2^retryCount` (config: `retry.maxAttempts`, `retry.baseDelayMinutes`), then calls `handlePermanentFailure` once retries are exhausted.
- Fires webhook notifications (non-fatal — failures are logged, never thrown) at each state transition when `config.webhook.enabled`.
- Runs a daily DB cleanup at 3 AM (`cleanupOldEvents`, keeps `database.cleanupDays` days) and writes `service-health.json` / `statistics.json` on intervals.

## Database

- SQLite via `better-sqlite3`, singleton connection from `getDb()` in `src/core/database.js`; migrations run automatically on first connection.
- Two tables: `events` (`id`, `name`, `startDate`, `status`) and `scheduled_jobs` (`event_id`, `scheduled_time`, `status`, `retry_count`, `error_message`, ...), FK'd on `event_id`.
- `events.status`: `pending` → `processed` | `failed`.
- `scheduled_jobs.status`: `scheduled` → `processing` → `completed` | `retrying` → `failed`.
- To add a migration: create `src/core/migrations/003_description.js` exporting `{ up(db), down(db) }` — it's picked up automatically by filename sort order. ESLint ignores the `migrations/` directory (see `.eslintignore`).

## Common Commands

```bash
npm test                    # Run Jest tests
npm run coverage            # Test coverage report (thresholds enforced in jest.config.js)
npm run lint                # ESLint check (src/ and tests/)
npm run lint:fix            # Auto-fix lint errors
npm run format               # Prettier write across **/*.{js,json,md}
npm run format:check
npm run validate            # lint + test (run before committing non-trivial changes)

npx jest tests/functions.test.js       # Run a single test file
npx jest -t "should fetch events"      # Run tests matching a name pattern
npx jest --watch                       # Watch mode

npm start                    # node src/index.js start-service (foreground)
npm run fetch-events          # node src/index.js fetch-events (one-shot)
node src/index.js process-schedule     # Process due events once (no npm script)
npm run dashboard             # node web-dashboard/server.js (separate process, port 3000)

# On Raspberry Pi
sudo systemctl start helloclub    # Start service
sudo systemctl stop helloclub     # Stop service
sudo systemctl status helloclub   # Check status
journalctl -u helloclub -f        # Follow logs
```

There are two Claude slash commands defined in `.claude/commands/`: `/run-single-test <name-or-pattern>` and `/test-api` (quick standalone check that `API_KEY` in `.env` is valid, without starting the service).

Git hooks: husky's `pre-commit` runs `npx lint-staged`, which runs `eslint --fix` + `prettier --write` on staged `*.js` and `prettier --write` on staged `*.{json,md}`.

Node version: `.nvmrc` pins `16.0.0`, but `package.json`/README target Node 18+ and the current `better-sqlite3`/`joi`/`yargs` majors require a modern Node — treat `.nvmrc` as stale and use Node 18+ in practice.

## Key Patterns

**Error Handling:**

- `handleApiError(error, context)` in `api-client.js` classifies timeout/401/network/unexpected errors, logs, and throws — always call it from `catch` blocks that touch the API.
- General pattern: `try { ... } catch (error) { logger.error('Context:', error); throw error; }` — always pass the error object as a second arg to the logger, and re-throw for the caller to handle (service.js turns thrown errors into retry/failure state).
- `processSingleEvent` marks the event `failed` in the DB on error before re-throwing.

**API Client (`src/core/api-client.js`):**

- Axios instance with configurable timeout (`API_TIMEOUT` env, default 30s) and axios-retry.
- Cache with separate fresh/stale TTLs (`api.cacheFreshSeconds` / `api.cacheStaleSeconds` in config.json) — on API failure, falls back to stale cache instead of hard-failing.
- Pagination uses `api.paginationLimit` / `api.paginationDelayMs` (default 1s) to rate-limit requests to Hello Club.

**Config:** `config.json` is validated against the Joi schema in `src/utils/config-schema.js` on every run (`src/index.js`); invalid config prints field-by-field errors with contextual hints and exits. CLI flags (via yargs) override `config.json` values, which override schema defaults. Secrets (`API_KEY`, `SMTP_*`, `PRINTER_EMAIL`, `DASHBOARD_USER/PASS`) live only in `.env`, never in `config.json`.

**Security-sensitive code to be careful with:**

- `pdf-generator.js`'s `sanitizeOutputPath()` and `config-schema.js`'s `outputFilename` validator both guard against path traversal — don't bypass them when changing PDF output paths.
- `functions.js`'s `sanitizeEmailText()` strips CRLF to prevent email header injection.
- `webhook.js` enforces HTTPS-only, blocks localhost/private/link-local IPs, and refuses to follow redirects (SSRF protection) — preserve this if touching webhook delivery.
- `web-dashboard/routes/api.js` uses `execFile` (not `exec`) for systemctl calls, restricted to a fixed `SERVICE_NAME`.

## Web Dashboard

- Separate Express process (`web-dashboard/server.js`), not started by `start-service` — run alongside it in production via its own systemd unit (`setup/helloclub-dashboard.service`).
- Token-based auth middleware (`middleware/auth.js`) gates everything except the login page/endpoint.
- `/api/service/status` reads `service-health.json` (written by the running service every 60s) first, falling back to `systemctl is-active` — so dashboard status can lag up to ~2 minutes behind reality if the health file is stale (`ageSeconds < 120` check).
- Live log streaming over `/ws/logs` WebSocket by spawning `tail -f` on `activity.log`; sends last 100 lines as history on connect.
- Config edits go through `/api/config/env` and `/api/config/json`, backed up via `src/utils/backup.js` before overwrite.

## Testing

- Jest (`testMatch: tests/**/*.test.js`), mocks for all external dependencies (DB, axios, nodemailer, pdfkit, etc.) — see `jest.config.js` for coverage thresholds (global 50-60%, `functions.js` 80-90%, `pdf-generator.js` 70-80%).
- Mock pattern: `jest.mock('../src/core/database')` at top of file, then `getDb.mockReturnValue(mockDb)` with a mock `{ prepare, run, all, get, transaction }`.
- Assertions: `expect(fn).toHaveBeenCalledWith()`, `expect(fn()).rejects.toThrow()`, `expect.stringContaining(...)` for partial SQL/message matches.
- Full conventions and larger examples: `.claude/rules/testing.md`, `.claude/rules/database.md`, `.claude/rules/service-patterns.md`, `.claude/rules/api-client.md`, `.claude/rules/web-dashboard.md`.

## Code Style

- CommonJS modules (`require`/`module.exports`), ESLint (`eslint:recommended` + `prettier`) with `prefer-const`/`no-var` enforced and unused-arg exception for `_`-prefixed params (see `.eslintrc.js`).
- Prettier: single quotes, semicolons, 2-space indent, 120 print width, LF line endings (`.prettierrc`).
- JSDoc comments on exported functions; files kebab-case, functions camelCase, classes PascalCase, constants SCREAMING_SNAKE_CASE.
- Winston logger only — no raw `console.log` in `src/` (dashboard's `server.js` startup line is the one exception).

## Config Files

- `.env` — Secrets: `API_KEY`, `SMTP_*`, `PRINTER_EMAIL`, `DASHBOARD_USER`/`PASS`, `DB_PATH`, `LOG_LEVEL` (gitignored; see `.env.example` for the full annotated list).
- `config.json` — Non-secret settings: `categories`, `preEventQueryMinutes`, `fetchWindowHours`, `serviceRunIntervalHours`, `printMode`, `outputFilename`, `retry`, `api`, `logging`, `database`, `pdfLayout`, `webhook`.
- `events.db` — SQLite database (gitignored, created/migrated automatically).

## Troubleshooting

- 401 errors: Check `API_KEY` in `.env`.
- Service not starting: Check `journalctl -u helloclub -xe`, verify `.env` path.
- No events processing: Verify `categories` in `config.json` match the API's category names exactly.
- SMTP failures: Gmail requires an App Password, not the account password (spaces in a pasted app password are stripped automatically).
- Dashboard shows service as down but it's running: `service-health.json` may just be stale (>120s old) — check `journalctl` directly.
