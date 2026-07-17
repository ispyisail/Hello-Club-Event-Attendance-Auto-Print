# Convert Hello-Club-Event-Attendance-Auto-Print to pure CLI with `print:` description tags

## Context

The app currently runs as a Node.js systemd service with a separate `web-dashboard/` Express+WebSocket GUI, and selects which events to print via a `categories` list in `config.json`. The goal: remove all GUI features and make the primary per-event configuration a keyword tag placed in the Hello Club event description — the same pattern the esp32-badminton-timer uses (`timer: 15min 3rounds`, parsed in `esp32-badminton-timer/src/helloclub.cpp` `parseTimerTag()`).

**Decisions (agreed):**

- **Tag-only selection** — only events whose description contains `print:` are printed; `categories` config removed.
- **Keyword syntax** — `print:`, `print: 30min`, `print: 30min 2copies`, `print: email|local`. Case-insensitive, value runs to end of line, tag can appear anywhere in the (markdown, nullable) description.
- **Tag params:** lead time (minutes before start to fetch+print), copies (local mode only), print mode. Machine settings (SMTP, printer name) stay in `.env`; `config.json` values become fallback defaults.
- **Removal scope:** dashboard + its feeders (health-check/statistics JSON writers, backup.js). Keep webhooks and other core features.

Verified facts: nothing in `src/` imports `web-dashboard/`; `health-check.js`/`statistics.js` are imported only by `src/core/service.js` (lines ~11–12, ~531–587); `backup.js` is imported only by the dashboard. Hello Club `description` is nullable (~60% presence) — must null-check.

---

## Phase A — GUI removal (pure deletion, commit as its own step)

1. **Delete:** `web-dashboard/` (entire dir), `setup/helloclub-dashboard.service`, `.claude/rules/web-dashboard.md`, tracked runtime artifacts (`service-health.json`, `statistics.json`, `backups/`) if in git.
2. **`package.json`:** remove `express`, `ws`, `multer` deps and the `dashboard` script; grep for `node-cron` usage — remove it too if unused. `npm install` to refresh lockfile.
3. **`src/core/service.js`:** remove health-check/statistics imports (lines 11–12), the hourly statistics interval + initial timeout (~lines 531–552), and `startHealthChecks(...)` (~lines 585–587). Heartbeat, watchdog, memory monitor, cleanup, webhooks stay.
4. **Delete:** `src/core/health-check.js`, `src/core/statistics.js`, `src/utils/backup.js`, `tests/health-check.test.js`.
5. **Env/setup:** remove `DASHBOARD_USER/PASS/PORT` from `.env.example`; grep `dashboard` in `setup/pi-install-app.sh`, `pi-configure.sh`, `pi-upgrade.sh` and drop those parts. `setup/helloclub.service` stays.
6. Checkpoint: `npm test`, `npm run lint`, `node src/index.js fetch-events` all pass. Re-run `npm run coverage`; adjust global jest thresholds only if deletion changed them.

## Phase B — Tag-based configuration

### New parser: `src/core/tag-parser.js`

`parseTag(description)` → `null` (no tag / non-string description) or `{ leadMinutes, copies, printMode }` with `null` for unspecified fields (caller falls back to config).

Grammar (improves on ESP32's digit-adjacency scan):

- Case-insensitive `print:` anywhere; value = text after tag up to first `\n`, trimmed. Bare `print:` → all-null params (event selected, defaults apply).
- Token patterns: `(\d+)\s*min` → leadMinutes (1–1440); `(\d+)\s*cop(y|ies)` → copies (1–10); standalone `local`/`email` → printMode; `enabled` accepted as no-op.
- Out-of-range or unrecognized tokens: log warn, ignore (tag presence still selects the event — a typo must not silently drop a printout).
- Strip markdown punctuation around tokens (descriptions are markdown; tolerate `**print: 30min**`).

Unit tests: `tests/tag-parser.test.js` — null/empty/no-tag, bare tag, each param, combined, case/whitespace variants, out-of-range, newline termination, markdown wrapping, garbage tokens. Add a jest threshold entry (90/90) for the module.

### DB migration: `src/core/migrations/003_add_tag_columns.js`

Follow existing `up/down` module shape. `ALTER TABLE events ADD COLUMN leadMinutes INTEGER; ... copies INTEGER; ... printMode TEXT;` (nullable = use config default). Flat columns, not JSON — scheduling reads `leadMinutes` directly.

### Pipeline changes (land as one commit with test updates — these are coupled)

- **`src/core/functions.js` `fetchAndStoreUpcomingEvents`** (~lines 124–224): delete category filter/logging; filter on `parseTag(event.description) !== null`; upsert tag columns with `ON CONFLICT ... DO UPDATE` so description edits refresh params on next fetch. Side effect to document: removing the tag now cancels a pending print via existing stale-event detection.
- **`src/core/service.js` `scheduleEvent`** (~line 197): `event.leadMinutes ?? config.preEventQueryMinutes` for the job time.
- **`src/core/service.js` `recoverPendingJobs`** (~lines 339–381): add `leadMinutes, copies, printMode` to the recovery SELECT and reconstructed event object — **easy to miss; without it recovered jobs print with defaults**.
- **Reschedule on tag edit:** in `scheduleAllPendingEvents`, if the persisted `scheduled_time` differs >1 min from recomputed, cancel + reschedule (~10 lines).
- **`src/core/functions.js` `processSingleEvent` / `createAndPrintPdf`:** per-event `printMode = event.printMode ?? config.printMode`, `copies = event.copies ?? 1`. Copies policy: local → pass through; email + copies>1 → warn "copies only supported in local mode", send one email.
- **`src/core/functions.js` `processScheduledEvents`:** select pending, filter in JS with per-row `event.leadMinutes ?? preEventQueryMinutes`.
- **`src/services/cups-printer.js` `printPdf(filePath, copies=1)`:** add `-n <copies>` to `lp` args when >1 (validate 1–10).

### Config/CLI cleanup

- **`src/utils/config-schema.js`:** remove `categories`. `preEventQueryMinutes` and `printMode` stay as tag-fallback defaults (update JSDoc). Joi will hard-reject old configs containing `categories` — add a hint in `src/index.js`'s config-error help: "categories is no longer supported — use print: tags in event descriptions".
- **`src/index.js`:** drop `allowedCategories` from the merged config (~line 128).
- **`src/utils/args-parser.js`:** remove `--category/-c` from `fetch-events` and `start-service`; reword remaining option descriptions as "default when the event's print: tag does not specify".

### Test updates

- `tests/functions.test.js`: replace category tests with tag-selection tests (tagged stored, untagged skipped, null description skipped, columns written); per-event printMode/copies; copies→lp and copies-with-email warning. (Coverage threshold for functions.js is 85/80.)
- `tests/service.test.js`: leadMinutes vs null scheduling; recovery carries tag columns; reschedule-on-change.

## Phase C — Docs, rollout, verification

- **Docs:** root `CLAUDE.md` (data flow, architecture tree, commands; delete stale `docs/CLAUDE.md`), `README.md` + `docs/CONFIGURATION.md` end-user tag-syntax section (rules: anywhere in description, case-insensitive, one line, no tag = no print, removing tag cancels), trim health-check mention in `.claude/rules/service-patterns.md`, `.env.example` already cleaned in Phase A.
- **Rollout:** bump to 2.0.0 + CHANGELOG note: add `print:` tags to upcoming event descriptions in Hello Club _before_ upgrading, or pending prints will drop (existing pending rows without tags get cancelled on next fetch — desired behaviour).
- **Out of scope, flagged for follow-up:** api-client uses `Authorization: Bearer` where the API guide documents `X-Api-Key`, and paginated sorts should append `,id` for stability. Both currently work; separate change.

## Phase D — Side-by-side deployment on the Raspberry Pi (original + v2 test instance)

Run the untouched original at `/opt/helloclub/app` (service `helloclub`) and the new version in parallel at `/opt/helloclub-v2/app` (new service `helloclub-v2`). Everything stateful is per-directory, so isolation falls out naturally:

- **Install dir:** clone/deploy the new branch to `/opt/helloclub-v2/app`; `npm install --production` there. Do not touch `/opt/helloclub`.
- **New unit file `setup/helloclub-v2.service`** (add to repo): copy of `helloclub.service` with `Description=... (v2 test)`, `WorkingDirectory=/opt/helloclub-v2/app`, `EnvironmentFile=/opt/helloclub-v2/app/.env`, `ReadWritePaths=/opt/helloclub-v2/app`. Same `User=helloclub` is fine.
- **State isolation (automatic, verify anyway):** `events.db` (default `DB_PATH` = app dir), `activity.log`/`error.log` (Winston, app dir), `config.json` — all per-directory. v2 has no dashboard, so no port conflict with the original's dashboard on 3000.
- **Shared API key is fine:** two services fetching hourly is far below the 30 req/min rate limit. Optionally stagger start times.
- **Double-print hazard (the one real risk):** the original prints events matching its `categories` config; v2 prints events with a `print:` tag. An event that is both in a printed category _and_ tagged prints twice. Test strategy:
  1. Set v2's `.env`/`config.json` to `printMode: "email"` with `PRINTER_EMAIL` pointed at a **test inbox**, not the real printer — v2 output goes to email for inspection.
  2. Create test events in a Hello Club category **not** in the original's `categories` list, with the `print:` tag in their descriptions — only v2 picks them up; the original ignores them.
  3. Final realistic test: tag one real event and accept the duplicate, or remove its category from the original's config for that day.
- **Cutover** (once v2 proves itself): add `print:` tags to upcoming events, `sudo systemctl disable --now helloclub`, deploy v2 code into `/opt/helloclub/app` (or repoint the original unit), re-enable. Keep `/opt/helloclub-v2` until confident, then remove it and the v2 unit.
- **Repo changes for this phase:** new `setup/helloclub-v2.service`; a short "parallel test install" section in `docs/DEPLOYMENT.md` with the manual steps above (no changes to `pi-install-app.sh` for a temporary test instance).

## Verification (end-to-end, no printer needed)

1. `npm test` + `npm run coverage` green after each phase.
2. `node src/index.js fetch-events` against the real API with a test event whose description contains `print: 5min 2copies email`; check `sqlite3 events.db "SELECT id,name,leadMinutes,copies,printMode FROM events"`.
3. `node src/index.js process-schedule --print-mode email` with a test SMTP target (or stub `printPdf`) to see the PDF flow.
4. Short `start-service` run with a small `serviceRunIntervalHours` and an event a few minutes out; confirm `activity.log` shows the per-event lead time in the "Scheduled job … in N minutes" line, then edit the description tag and confirm reschedule.

## Known risks

- Recovery path dropping tag params (mitigated above).
- Cache staleness: description edits can take up to `serviceRunIntervalHours` + cache TTL to be seen — document, don't fix.
- Markdown-wrapped tags need forgiving tokenization.
