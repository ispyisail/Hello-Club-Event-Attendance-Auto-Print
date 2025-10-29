/**
 * @fileoverview Application-wide constants to prevent magic strings and ensure consistency.
 * @module constants
 */

/**
 * Event status values
 */
const EVENT_STATUS = {
  PENDING: 'pending',
  PROCESSED: 'processed'
};

/**
 * Print mode options
 */
const PRINT_MODE = {
  LOCAL: 'local',
  EMAIL: 'email'
};

/**
 * Command names
 */
const COMMANDS = {
  FETCH_EVENTS: 'fetch-events',
  PROCESS_SCHEDULE: 'process-schedule',
  START_SERVICE: 'start-service',
  HEALTH_CHECK: 'health-check',
  LIST_EVENTS: 'list-events',
  CLEANUP: 'cleanup',
  PREVIEW_EVENT: 'preview-event',
  TEST_EMAIL: 'test-email',
  TEST_PRINTER: 'test-printer',
  BACKUP: 'backup',
  RESTORE: 'restore',
  API_STATS: 'api-stats'
};

/**
 * Default configuration values
 */
const DEFAULTS = {
  FETCH_WINDOW_HOURS: 24,
  PRE_EVENT_QUERY_MINUTES: 5,
  SERVICE_RUN_INTERVAL_HOURS: 1,
  OUTPUT_FILENAME: 'attendees.pdf',
  PRINT_MODE: PRINT_MODE.EMAIL,
  HEARTBEAT_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
  MAX_ATTENDEES: 10000,
  PAGINATION_LIMIT: 100,
  PDF_ROW_HEIGHT: 30,
  CLEANUP_DAYS: 30,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE_MS: 2000
};

/**
 * HTTP status codes
 */
const HTTP_STATUS = {
  OK: 200,
  UNAUTHORIZED: 401,
  TOO_MANY_REQUESTS: 429
};

/**
 * Exit codes for health check and other commands
 */
const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  WARNING: 2
};

module.exports = {
  EVENT_STATUS,
  PRINT_MODE,
  COMMANDS,
  DEFAULTS,
  HTTP_STATUS,
  EXIT_CODES
};
