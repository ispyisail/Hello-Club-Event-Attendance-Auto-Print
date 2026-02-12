const logger = require('../services/logger');
const {
  getDb,
  cleanupOldEvents,
  updateEventStatus,
  updateJobStatus,
  incrementJobRetryCount,
  getJobInfo,
} = require('./database');
const { fetchAndStoreUpcomingEvents, processSingleEvent } = require('./functions');
const { startHealthChecks } = require('./health-check');
const { getStatisticsSummary, writeStatisticsFile } = require('./statistics');
const {
  notifyEventProcessed,
  notifyJobRetry,
  notifyPermanentFailure,
  notifyServiceStatus,
} = require('../utils/webhook');
const { startWatchdog } = require('../utils/systemd-watchdog');

// In-memory map to store references to our scheduled timeout jobs.
// The key is the event ID, and the value is the timeout ID returned by setTimeout.
const scheduledJobs = new Map();

// Default retry configuration (can be overridden by config)
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_RETRY_DELAY_MINUTES = 5;

/**
 * Helper for safe webhook calls - logs errors but doesn't throw
 * @param {Function} notifyFn - Async function to call
 */
async function safeWebhookNotify(notifyFn) {
  try {
    await notifyFn();
  } catch (err) {
    logger.warn('Webhook notification failed (non-fatal):', err.message);
  }
}

/**
 * Get retry configuration from config or use defaults
 * @param {Object} config - Application configuration
 * @returns {Object} Retry configuration with maxRetries and baseRetryDelay
 */
function getRetryConfig(config) {
  const maxRetries = config.retry?.maxAttempts || DEFAULT_MAX_RETRIES;
  const baseDelayMinutes = config.retry?.baseDelayMinutes || DEFAULT_BASE_RETRY_DELAY_MINUTES;
  const baseRetryDelay = baseDelayMinutes * 60 * 1000;
  return { maxRetries, baseRetryDelay };
}

/**
 * Handle permanent failure of an event after all retries exhausted
 * @param {Object} event - The event object
 * @param {Object} config - Application configuration
 * @param {Error} error - The error that caused the failure
 * @param {number} retryCount - Total number of retries attempted
 */
async function handlePermanentFailure(event, config, error, retryCount) {
  updateJobStatus(event.id, 'failed', error.message);
  updateEventStatus(event.id, 'failed');
  logger.error(`✗ Event ${event.id} permanently failed after ${retryCount} retries`);

  if (config.webhook?.enabled && config.webhook?.url) {
    await safeWebhookNotify(() => notifyPermanentFailure(event, error.message, retryCount, config.webhook.url));
  }
}

/**
 * Schedule a retry for a failed event with exponential backoff
 * @param {Object} event - The event object
 * @param {Object} config - Application configuration
 * @param {number} currentRetries - Current retry count (0-indexed)
 * @param {Error} error - The error that caused the failure
 */
function scheduleRetry(event, config, currentRetries, error) {
  const { maxRetries, baseRetryDelay } = getRetryConfig(config);
  const retryDelay = baseRetryDelay * Math.pow(2, currentRetries);
  const retryMinutes = Math.round(retryDelay / 1000 / 60);

  incrementJobRetryCount(event.id);
  updateJobStatus(event.id, 'retrying', error.message);

  logger.warn(
    `Scheduling retry ${currentRetries + 1}/${maxRetries} for event ${event.id} in ${retryMinutes} minutes...`
  );

  if (config.webhook?.enabled && config.webhook?.url) {
    safeWebhookNotify(() => notifyJobRetry(event, currentRetries + 1, maxRetries, config.webhook.url));
  }

  const retryTimeoutId = setTimeout(async () => {
    logger.info(`🔄 Retry attempt ${currentRetries + 1} for event: ${event.name} (ID: ${event.id})`);
    updateJobStatus(event.id, 'processing');
    scheduledJobs.delete(event.id);

    await processEventWithRetry(event, config);
  }, retryDelay);

  scheduledJobs.set(event.id, retryTimeoutId);
}

/**
 * Handle processing error - decide whether to retry or mark as failed
 * @param {Object} event - The event object
 * @param {Object} config - Application configuration
 * @param {Error} error - The error that occurred
 */
async function handleProcessingError(event, config, error) {
  logger.error(`Error processing event ${event.id}:`, error);

  const jobInfo = getJobInfo(event.id);
  const currentRetries = jobInfo?.retry_count || 0;
  const { maxRetries } = getRetryConfig(config);

  // Update error message in job record
  updateJobStatus(event.id, jobInfo?.status || 'processing', error.message);

  if (currentRetries < maxRetries) {
    scheduleRetry(event, config, currentRetries, error);
  } else {
    await handlePermanentFailure(event, config, error, maxRetries);
  }
}

/**
 * Process an event with retry support
 * @param {Object} event - The event object
 * @param {Object} config - Application configuration
 */
async function processEventWithRetry(event, config) {
  try {
    const result = await processSingleEvent(event, config);

    updateJobStatus(event.id, 'completed');
    updateEventStatus(event.id, 'processed');
    logger.info(`✓ Job completed successfully for event: ${event.name}`);

    if (config.webhook?.enabled && config.webhook?.url) {
      const attendeeCount = result?.attendeeCount || 0;
      await safeWebhookNotify(() => notifyEventProcessed(event, attendeeCount, config.webhook.url));
    }
  } catch (error) {
    await handleProcessingError(event, config, error);
  }
}

/**
 * Check if a job is already scheduled (in memory OR in database).
 * This prevents race conditions where a job could be scheduled twice.
 * @param {string} eventId - The event ID to check
 * @returns {boolean} True if job is already scheduled
 */
function isJobAlreadyScheduled(eventId) {
  // First check in-memory map (fast path)
  if (scheduledJobs.has(eventId)) {
    return true;
  }

  // Then check database for jobs in active states
  try {
    const db = getDb();
    const job = db
      .prepare(
        `
            SELECT status FROM scheduled_jobs
            WHERE event_id = ? AND status IN ('scheduled', 'processing', 'retrying')
        `
      )
      .get(eventId);

    return !!job;
  } catch (error) {
    logger.error(`Error checking job status for ${eventId}:`, error);
    // In case of DB error, be conservative and assume not scheduled
    return false;
  }
}

/**
 * Schedules a single event to be processed at the correct time.
 * Persists the job to the database to survive service restarts.
 * @param {Object} event - The event object from the database.
 * @param {Object} config - The application configuration.
 */
function scheduleEvent(event, config, options = {}) {
  // If a job for this event is already scheduled (in memory or DB), do nothing.
  // Skip this check during crash recovery — the DB has stale 'scheduled' status
  // but no in-memory setTimeout exists, so we must recreate it.
  if (!options.fromRecovery && isJobAlreadyScheduled(event.id)) {
    logger.debug(`Event ${event.id} already has an active job, skipping`);
    return;
  }

  const { preEventQueryMinutes } = config;
  const now = new Date().getTime();
  const eventStartTime = new Date(event.startDate).getTime();
  const processTime = eventStartTime - preEventQueryMinutes * 60 * 1000;
  const scheduledTime = new Date(processTime).toISOString();

  // Only schedule jobs that are in the future.
  if (processTime > now) {
    const delay = processTime - now;

    // Persist job to database for crash recovery
    const db = getDb();
    try {
      const insertJob = db.prepare(`
                INSERT INTO scheduled_jobs (event_id, event_name, scheduled_time, status)
                VALUES (?, ?, ?, 'scheduled')
                ON CONFLICT(event_id) DO UPDATE SET
                    event_name = excluded.event_name,
                    status = 'scheduled',
                    scheduled_time = excluded.scheduled_time,
                    updated_at = datetime('now')
            `);
      insertJob.run(event.id, event.name, scheduledTime);
    } catch (err) {
      logger.error(`Failed to persist job for event ${event.id}:`, err);
      // Continue despite database error - still schedule in memory
    }

    const timeoutId = setTimeout(async () => {
      logger.info('───────────────────────────────────────────────────────────────');
      logger.info(`⏰ Scheduled job triggered for event: ${event.name} (ID: ${event.id})`);

      // Check if event was cancelled before processing
      const db = getDb();
      const currentEvent = db.prepare('SELECT status FROM events WHERE id = ?').get(event.id);

      if (!currentEvent || currentEvent.status === 'cancelled') {
        logger.info(`Event ${event.id} was cancelled, skipping processing`);
        updateJobStatus(event.id, 'cancelled', 'Event was cancelled in Hello Club');
        scheduledJobs.delete(event.id);
        return;
      }

      // Update job status to 'processing'
      updateJobStatus(event.id, 'processing');

      // Remove from in-memory map
      scheduledJobs.delete(event.id);

      // Process the event with retry support
      await processEventWithRetry(event, config);
    }, delay);

    // Store the timeout ID so we can manage it.
    scheduledJobs.set(event.id, timeoutId);
    logger.info(
      `Scheduled job for event: "${event.name}" (ID: ${event.id}) in ${Math.round(delay / 1000 / 60)} minutes.`
    );
  } else {
    // Event's scheduled time has passed - check if it's still worth processing
    const eventStartTime = new Date(event.startDate).getTime();
    const gracePeriodMinutes = 60; // Process events up to 1 hour after start time
    const gracePeriodEnd = eventStartTime + gracePeriodMinutes * 60 * 1000;

    if (now < gracePeriodEnd) {
      // Still within grace period - process immediately
      logger.warn(
        `Event "${event.name}" (ID: ${event.id}) missed scheduled time but is within grace period. Processing immediately...`
      );

      // Persist job with immediate processing status
      const db = getDb();
      try {
        const insertJob = db.prepare(`
                INSERT INTO scheduled_jobs (event_id, event_name, scheduled_time, status)
                VALUES (?, ?, ?, 'processing')
                ON CONFLICT(event_id) DO UPDATE SET
                    event_name = excluded.event_name,
                    status = 'processing',
                    scheduled_time = excluded.scheduled_time,
                    updated_at = datetime('now')
            `);
        insertJob.run(event.id, event.name, scheduledTime);
      } catch (err) {
        logger.error(`Failed to persist job for event ${event.id}:`, err);
      }

      // Process immediately (asynchronously, don't block scheduler)
      setImmediate(async () => {
        logger.info('───────────────────────────────────────────────────────────────');
        logger.info(`⚡ Late job processing for event: ${event.name} (ID: ${event.id})`);
        await processEventWithRetry(event, config);
      });
    } else {
      // Too late to process - mark as failed
      logger.warn(
        `Event "${event.name}" (ID: ${event.id}) is too far in the past (grace period expired). Marking as failed.`
      );

      // Mark both event and job as failed
      updateEventStatus(event.id, 'failed');
      const db = getDb();
      try {
        const insertJob = db.prepare(`
                INSERT INTO scheduled_jobs (event_id, event_name, scheduled_time, status, error_message)
                VALUES (?, ?, ?, 'failed', 'Missed processing window - event too far in the past')
                ON CONFLICT(event_id) DO UPDATE SET
                    status = 'failed',
                    error_message = 'Missed processing window - event too far in the past',
                    updated_at = datetime('now')
            `);
        insertJob.run(event.id, event.name, scheduledTime);
      } catch (err) {
        logger.error(`Failed to persist failed job for event ${event.id}:`, err);
      }
    }
  }
}

/**
 * Recovers jobs from the database that were scheduled but not completed.
 * This is called on service startup to handle crash recovery after unexpected restarts.
 *
 * The recovery process:
 * 1. Clears in-memory scheduled jobs map to prevent orphaned references
 * 2. Queries database for jobs with 'scheduled' or 'processing' status
 * 3. For past-due jobs: marks them as failed with an error message
 * 4. For future jobs: reschedules them using scheduleEvent()
 *
 * @param {Object} config - The application configuration object
 * @param {number} config.preEventQueryMinutes - Minutes before event to process
 */
function recoverPendingJobs(config) {
  try {
    const db = getDb();

    // Clear stale in-memory entries to ensure clean state after restart
    // This prevents orphaned timeout references from previous session
    scheduledJobs.clear();
    logger.debug('Cleared in-memory scheduled jobs map for recovery');

    // Find jobs that were scheduled but not completed
    const pendingJobs = db
      .prepare(
        `
            SELECT sj.*, e.startDate
            FROM scheduled_jobs sj
            JOIN events e ON sj.event_id = e.id
            WHERE sj.status IN ('scheduled', 'processing')
            ORDER BY sj.scheduled_time ASC
        `
      )
      .all();

    if (pendingJobs.length > 0) {
      logger.info(`Recovering ${pendingJobs.length} pending job(s) from previous session...`);

      for (const job of pendingJobs) {
        const now = new Date().getTime();
        const scheduledTime = new Date(job.scheduled_time).getTime();

        // If the scheduled time has already passed, mark as failed
        if (scheduledTime <= now) {
          logger.warn(
            `Job for event ${job.event_name} (ID: ${job.event_id}) missed scheduled time. Marking as failed.`
          );
          const failStmt = db.prepare(`
                        UPDATE scheduled_jobs
                        SET status = 'failed',
                            error_message = 'Missed scheduled time due to service restart',
                            updated_at = datetime('now')
                        WHERE event_id = ?
                    `);
          failStmt.run(job.event_id);
          continue;
        }

        // Reschedule the job — pass fromRecovery to bypass isJobAlreadyScheduled()
        // since the DB still has status='scheduled' but no in-memory setTimeout exists
        const event = {
          id: job.event_id,
          name: job.event_name,
          startDate: job.startDate,
        };
        scheduleEvent(event, config, { fromRecovery: true });
        logger.info(`Recovered job for event: ${job.event_name} (ID: ${job.event_id})`);
      }
    } else {
      logger.info('No pending jobs to recover from previous session.');
    }
  } catch (error) {
    logger.error('Error recovering pending jobs:', error);
  }
}

/**
 * Fetches all pending events from the database and schedules them.
 * @param {Object} config - The application configuration.
 */
function scheduleAllPendingEvents(config) {
  try {
    const db = getDb();
    const pendingEvents = db.prepare("SELECT * FROM events WHERE status = 'pending'").all();
    logger.info(`Found ${pendingEvents.length} pending events to schedule.`);
    for (const event of pendingEvents) {
      scheduleEvent(event, config);
    }
  } catch (error) {
    logger.error('Error scheduling all pending events:', error);
  }
}

/**
 * Runs the main scheduler loop: fetches new events and schedules all pending events.
 * @param {Object} config - The application configuration.
 */
async function runScheduler(config) {
  logger.info('Scheduler loop started...');
  try {
    // First, fetch the latest events from the API and store them.
    await fetchAndStoreUpcomingEvents(config);
  } catch (error) {
    logger.error(
      'An error occurred during the scheduler loop while fetching events. The service will continue to run.',
      error
    );
  }
  // Always try to schedule any pending events, even if the fetch fails.
  scheduleAllPendingEvents(config);
  logger.info(`Scheduler loop finished. Next run in ${config.serviceRunIntervalHours} hours.`);
}

/**
 * Starts the long-running service that manages event scheduling and processing.
 * This is the main entry point for the Windows service.
 *
 * The service performs the following operations:
 * - Validates critical configuration values
 * - Recovers pending jobs from previous session (crash recovery)
 * - Runs the scheduler immediately and then at configured intervals
 * - Sets up periodic health checks and statistics reporting
 * - Schedules daily database cleanup
 *
 * @param {Object} config - The application configuration object
 * @param {number} config.serviceRunIntervalHours - How often to check for new events (hours)
 * @param {number} config.preEventQueryMinutes - Minutes before event to process attendees
 * @param {number} config.fetchWindowHours - How far ahead to look for events (hours)
 * @param {string} config.printMode - Print mode ('local' or 'email')
 * @param {Object} [config.webhook] - Optional webhook configuration
 * @param {Object} [config.retry] - Optional retry configuration
 * @param {Object} [config.database] - Optional database configuration
 */
function runService(config) {
  // Validate critical configuration values
  if (!config.serviceRunIntervalHours || config.serviceRunIntervalHours <= 0) {
    logger.error('Invalid or missing serviceRunIntervalHours in configuration. Service cannot start.');
    process.exit(1);
  }
  if (!config.preEventQueryMinutes || config.preEventQueryMinutes <= 0) {
    logger.error('Invalid or missing preEventQueryMinutes in configuration. Service cannot start.');
    process.exit(1);
  }
  if (!config.fetchWindowHours || config.fetchWindowHours <= 0) {
    logger.error('Invalid or missing fetchWindowHours in configuration. Service cannot start.');
    process.exit(1);
  }

  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('  Hello Club Event Attendance Auto-Print Service');
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('Service starting...');
  logger.info(`Configuration validated successfully:`);
  logger.info(`  - Service run interval: ${config.serviceRunIntervalHours} hour(s)`);
  logger.info(`  - Fetch window: ${config.fetchWindowHours} hour(s)`);
  logger.info(`  - Pre-event query window: ${config.preEventQueryMinutes} minute(s)`);
  logger.info(`  - Print mode: ${config.printMode}`);

  // Recover any jobs that were pending from previous session (crash recovery)
  logger.info('Checking for pending jobs from previous session...');
  recoverPendingJobs(config);

  logger.info('───────────────────────────────────────────────────────────────');
  logger.info(`✓ Service started successfully`);
  logger.info(`✓ Scheduler will run every ${config.serviceRunIntervalHours} hours`);
  logger.info(`✓ Monitoring ${scheduledJobs.size} scheduled job(s)`);
  logger.info('═══════════════════════════════════════════════════════════════');

  // Send service startup notification if webhook is enabled (non-fatal if fails)
  if (config.webhook?.enabled && config.webhook?.url) {
    notifyServiceStatus(
      'started',
      {
        serviceRunIntervalHours: config.serviceRunIntervalHours,
        fetchWindowHours: config.fetchWindowHours,
        preEventQueryMinutes: config.preEventQueryMinutes,
        printMode: config.printMode,
        scheduledJobsCount: scheduledJobs.size,
      },
      config.webhook.url
    ).catch((err) => {
      logger.warn('Service startup webhook notification failed (non-fatal):', err.message);
    });
  }

  // Define the task to be run periodically, with proper error handling.
  const task = async () => {
    try {
      await runScheduler(config);
    } catch (error) {
      logger.error('An error occurred during the scheduler execution:', error);
    }
  };

  // Run the task immediately on startup.
  task().catch((err) => {
    logger.error('Initial scheduler task failed:', err);
  });

  // Then, set up the interval to run the task periodically.
  const runInterval = config.serviceRunIntervalHours * 60 * 60 * 1000;
  logger.info(`Next scheduler run in ${config.serviceRunIntervalHours} hour(s) (${runInterval}ms)`);
  setInterval(task, runInterval);

  // Add a heartbeat log every 15 minutes to show the service is alive
  const heartbeatInterval = 15 * 60 * 1000; // 15 minutes
  setInterval(() => {
    try {
      const scheduledCount = scheduledJobs.size;
      logger.info(`Service heartbeat: Running normally. ${scheduledCount} event(s) scheduled for processing.`);
    } catch (err) {
      logger.error('Heartbeat error:', err);
    }
  }, heartbeatInterval);

  // Write statistics report every hour
  setInterval(
    () => {
      try {
        logger.info(getStatisticsSummary());
        writeStatisticsFile();
      } catch (err) {
        logger.error('Statistics write error:', err);
      }
    },
    60 * 60 * 1000
  ); // Every hour

  // Write initial statistics
  setTimeout(() => {
    try {
      logger.info(getStatisticsSummary());
      writeStatisticsFile();
    } catch (err) {
      logger.error('Initial statistics write error:', err);
    }
  }, 5000); // 5 seconds after startup

  // Run database cleanup daily at 3 AM to remove old events
  // Uses self-scheduling setTimeout to avoid double-setInterval and handle DST changes
  const cleanupDays = config.database?.cleanupDays || 30;
  const scheduleDailyCleanup = () => {
    const now = new Date();
    const next3AM = new Date();
    next3AM.setHours(3, 0, 0, 0);

    // If it's past 3 AM today, schedule for tomorrow
    if (now > next3AM) {
      next3AM.setDate(next3AM.getDate() + 1);
    }

    const timeUntil3AM = next3AM - now;

    setTimeout(() => {
      try {
        logger.info(`Running daily database cleanup (keeping ${cleanupDays} days)...`);
        cleanupOldEvents(cleanupDays);
      } catch (err) {
        logger.error('Database cleanup error:', err);
      }
      // Reschedule for next 3 AM (handles DST changes correctly)
      scheduleDailyCleanup();
    }, timeUntil3AM);

    logger.info(`Database cleanup scheduled for ${next3AM.toLocaleString()} (will keep ${cleanupDays} days of events)`);
  };

  scheduleDailyCleanup();

  // Start health checks (writes status file every 60 seconds)
  startHealthChecks(60);
  logger.info('Health check monitoring started');

  // Start systemd watchdog integration (if enabled)
  startWatchdog();
}

/**
 * Cancel a scheduled job for an event
 * Clears the timeout and removes it from the in-memory map
 * @param {string} eventId - The event ID to cancel
 * @returns {boolean} True if a job was cancelled, false if no job was found
 */
function cancelScheduledJob(eventId) {
  if (scheduledJobs.has(eventId)) {
    const timeoutId = scheduledJobs.get(eventId);
    clearTimeout(timeoutId);
    scheduledJobs.delete(eventId);
    logger.debug(`Cancelled scheduled job for event: ${eventId}`);
    return true;
  }
  return false;
}

/**
 * Cancel all scheduled jobs (used during graceful shutdown)
 * Clears all timeouts from the in-memory Map
 * @returns {number} Number of jobs cancelled
 */
function cancelAllScheduledJobs() {
  const count = scheduledJobs.size;
  for (const [eventId, timeoutId] of scheduledJobs) {
    clearTimeout(timeoutId);
    logger.debug(`Cancelled scheduled job for event: ${eventId}`);
  }
  scheduledJobs.clear();
  if (count > 0) {
    logger.info(`Cancelled ${count} scheduled job(s) during shutdown`);
  }
  return count;
}

module.exports = {
  runService,
  // Export for testing
  scheduleEvent,
  recoverPendingJobs,
  scheduleAllPendingEvents,
  isJobAlreadyScheduled,
  processEventWithRetry,
  handleProcessingError,
  scheduleRetry,
  handlePermanentFailure,
  safeWebhookNotify,
  getRetryConfig,
  cancelScheduledJob,
  cancelAllScheduledJobs,
  // Export scheduledJobs map for testing (read-only use)
  _getScheduledJobs: () => scheduledJobs,
};
