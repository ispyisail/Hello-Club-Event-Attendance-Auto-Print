const logger = require('../services/logger');
const { getDb, cleanupOldEvents } = require('./database');
const { fetchAndStoreUpcomingEvents, processSingleEvent } = require('./functions');
const { startHealthChecks } = require('./health-check');
const { getStatisticsSummary, writeStatisticsFile } = require('./statistics');
const {
    notifyEventProcessed,
    notifyEventFailed,
    notifyJobRetry,
    notifyPermanentFailure,
    notifyServiceStatus
} = require('../utils/webhook');

// In-memory map to store references to our scheduled timeout jobs.
// The key is the event ID, and the value is the timeout ID returned by setTimeout.
const scheduledJobs = new Map();

// Retry configuration
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY = 5 * 60 * 1000; // 5 minutes

/**
 * Schedules a single event to be processed at the correct time.
 * Persists the job to the database to survive service restarts.
 * @param {Object} event - The event object from the database.
 * @param {Object} config - The application configuration.
 */
function scheduleEvent(event, config) {
    // If a job for this event is already scheduled, do nothing.
    if (scheduledJobs.has(event.id)) {
        return;
    }

    const { preEventQueryMinutes } = config;
    const now = new Date().getTime();
    const eventStartTime = new Date(event.startDate).getTime();
    const processTime = eventStartTime - (preEventQueryMinutes * 60 * 1000);
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

            // Update job status to 'processing'
            try {
                const updateStmt = db.prepare(`
                    UPDATE scheduled_jobs
                    SET status = 'processing', updated_at = datetime('now')
                    WHERE event_id = ?
                `);
                updateStmt.run(event.id);
            } catch (err) {
                logger.error(`Failed to update job status for event ${event.id}:`, err);
            }

            // Remove from in-memory map
            scheduledJobs.delete(event.id);

            // Process the event and handle result
            try {
                const result = await processSingleEvent(event, config);

                // Mark job as completed
                const completeStmt = db.prepare(`
                    UPDATE scheduled_jobs
                    SET status = 'completed', updated_at = datetime('now')
                    WHERE event_id = ?
                `);
                completeStmt.run(event.id);
                logger.info(`✓ Job completed successfully for event: ${event.name}`);

                // Send webhook notification if enabled
                if (config.webhook?.enabled && config.webhook?.url) {
                    const attendeeCount = result?.attendeeCount || 0;
                    await notifyEventProcessed(event, attendeeCount, config.webhook.url);
                }
            } catch (err) {
                logger.error(`Error processing event ${event.id}:`, err);

                // Get current retry count
                const jobInfo = db.prepare(`
                    SELECT retry_count FROM scheduled_jobs WHERE event_id = ?
                `).get(event.id);

                const currentRetries = jobInfo ? jobInfo.retry_count : 0;

                // Increment retry count
                const updateStmt = db.prepare(`
                    UPDATE scheduled_jobs
                    SET error_message = ?,
                        retry_count = retry_count + 1,
                        updated_at = datetime('now')
                    WHERE event_id = ?
                `);
                updateStmt.run(err.message, event.id);

                // Check if we should retry
                if (currentRetries < MAX_RETRIES) {
                    // Calculate retry delay with exponential backoff: 5min, 10min, 20min
                    const retryDelay = BASE_RETRY_DELAY * Math.pow(2, currentRetries);
                    const retryMinutes = Math.round(retryDelay / 1000 / 60);

                    logger.warn(`Scheduling retry ${currentRetries + 1}/${MAX_RETRIES} for event ${event.id} in ${retryMinutes} minutes...`);

                    // Send webhook notification if enabled
                    if (config.webhook?.enabled && config.webhook?.url) {
                        await notifyJobRetry(event, currentRetries + 1, MAX_RETRIES, config.webhook.url);
                    }

                    // Update status to 'retrying'
                    const retryStmt = db.prepare(`
                        UPDATE scheduled_jobs
                        SET status = 'retrying',
                            updated_at = datetime('now')
                        WHERE event_id = ?
                    `);
                    retryStmt.run(event.id);

                    // Schedule retry
                    const retryTimeoutId = setTimeout(async () => {
                        logger.info(`🔄 Retry attempt ${currentRetries + 1} for event: ${event.name} (ID: ${event.id})`);

                        // Update status back to processing
                        try {
                            const processingStmt = db.prepare(`
                                UPDATE scheduled_jobs
                                SET status = 'processing',
                                    updated_at = datetime('now')
                                WHERE event_id = ?
                            `);
                            processingStmt.run(event.id);
                        } catch (updateErr) {
                            logger.error(`Failed to update retry status:`, updateErr);
                        }

                        // Remove from scheduled jobs map
                        scheduledJobs.delete(event.id);

                        // Try processing again (this will use the same error handling logic)
                        try {
                            const result = await processSingleEvent(event, config);

                            // Mark as completed on success
                            const completeStmt = db.prepare(`
                                UPDATE scheduled_jobs
                                SET status = 'completed',
                                    updated_at = datetime('now')
                                WHERE event_id = ?
                            `);
                            completeStmt.run(event.id);
                            logger.info(`✓ Retry successful for event: ${event.name}`);

                            // Send webhook notification if enabled
                            if (config.webhook?.enabled && config.webhook?.url) {
                                const attendeeCount = result?.attendeeCount || 0;
                                await notifyEventProcessed(event, attendeeCount, config.webhook.url);
                            }
                        } catch (retryErr) {
                            logger.error(`Retry failed for event ${event.id}:`, retryErr);

                            // This will increment retry_count and potentially schedule another retry
                            const newRetries = currentRetries + 1;
                            if (newRetries >= MAX_RETRIES) {
                                // Mark as permanently failed
                                const finalFailStmt = db.prepare(`
                                    UPDATE scheduled_jobs
                                    SET status = 'failed',
                                        error_message = ?,
                                        updated_at = datetime('now')
                                    WHERE event_id = ?
                                `);
                                finalFailStmt.run(retryErr.message, event.id);
                                logger.error(`✗ Event ${event.id} permanently failed after ${MAX_RETRIES} retries`);

                                // Send webhook notification if enabled
                                if (config.webhook?.enabled && config.webhook?.url) {
                                    await notifyPermanentFailure(event, retryErr.message, newRetries, config.webhook.url);
                                }
                            } else {
                                // Schedule another retry (recursive)
                                const nextRetryDelay = BASE_RETRY_DELAY * Math.pow(2, newRetries);
                                const nextRetryMinutes = Math.round(nextRetryDelay / 1000 / 60);
                                logger.warn(`Scheduling retry ${newRetries + 1}/${MAX_RETRIES} in ${nextRetryMinutes} minutes...`);

                                // Update retry count and status
                                const nextRetryStmt = db.prepare(`
                                    UPDATE scheduled_jobs
                                    SET status = 'retrying',
                                        retry_count = retry_count + 1,
                                        error_message = ?,
                                        updated_at = datetime('now')
                                    WHERE event_id = ?
                                `);
                                nextRetryStmt.run(retryErr.message, event.id);
                            }
                        }
                    }, retryDelay);

                    // Store retry timeout
                    scheduledJobs.set(event.id, retryTimeoutId);
                } else {
                    // Mark as permanently failed
                    const failStmt = db.prepare(`
                        UPDATE scheduled_jobs
                        SET status = 'failed',
                            updated_at = datetime('now')
                        WHERE event_id = ?
                    `);
                    failStmt.run(event.id);
                    logger.error(`✗ Event ${event.id} permanently failed after ${MAX_RETRIES} retries`);

                    // Send webhook notification if enabled
                    if (config.webhook?.enabled && config.webhook?.url) {
                        await notifyPermanentFailure(event, err.message, MAX_RETRIES, config.webhook.url);
                    }
                }
            }
        }, delay);

        // Store the timeout ID so we can manage it.
        scheduledJobs.set(event.id, timeoutId);
        logger.info(`Scheduled job for event: "${event.name}" (ID: ${event.id}) in ${Math.round(delay / 1000 / 60)} minutes.`);
    } else {
        logger.info(`Event "${event.name}" (ID: ${event.id}) is in the past and will not be scheduled.`);
    }
}

/**
 * Recovers jobs from the database that were scheduled but not completed.
 * This is called on service startup to handle crash recovery.
 * @param {Object} config - The application configuration.
 */
function recoverPendingJobs(config) {
    try {
        const db = getDb();

        // Find jobs that were scheduled but not completed
        const pendingJobs = db.prepare(`
            SELECT sj.*, e.startDate
            FROM scheduled_jobs sj
            JOIN events e ON sj.event_id = e.id
            WHERE sj.status IN ('scheduled', 'processing')
            ORDER BY sj.scheduled_time ASC
        `).all();

        if (pendingJobs.length > 0) {
            logger.info(`Recovering ${pendingJobs.length} pending job(s) from previous session...`);

            for (const job of pendingJobs) {
                const now = new Date().getTime();
                const scheduledTime = new Date(job.scheduled_time).getTime();

                // If the scheduled time has already passed, mark as failed
                if (scheduledTime <= now) {
                    logger.warn(`Job for event ${job.event_name} (ID: ${job.event_id}) missed scheduled time. Marking as failed.`);
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

                // Reschedule the job
                const event = {
                    id: job.event_id,
                    name: job.event_name,
                    startDate: job.startDate
                };
                scheduleEvent(event, config);
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
        logger.error('An error occurred during the scheduler loop while fetching events. The service will continue to run.', error);
    }
    // Always try to schedule any pending events, even if the fetch fails.
    scheduleAllPendingEvents(config);
    logger.info(`Scheduler loop finished. Next run in ${config.serviceRunIntervalHours} hours.`);
}

/**
 * Starts the long-running service.
 * @param {Object} config - The application configuration.
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

    // Send service startup notification if webhook is enabled
    if (config.webhook?.enabled && config.webhook?.url) {
        notifyServiceStatus('started', {
            serviceRunIntervalHours: config.serviceRunIntervalHours,
            fetchWindowHours: config.fetchWindowHours,
            preEventQueryMinutes: config.preEventQueryMinutes,
            printMode: config.printMode,
            scheduledJobsCount: scheduledJobs.size
        }, config.webhook.url);
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
    task();

    // Then, set up the interval to run the task periodically.
    const runInterval = config.serviceRunIntervalHours * 60 * 60 * 1000;
    logger.info(`Next scheduler run in ${config.serviceRunIntervalHours} hour(s) (${runInterval}ms)`);
    setInterval(task, runInterval);

    // Add a heartbeat log every 15 minutes to show the service is alive
    const heartbeatInterval = 15 * 60 * 1000; // 15 minutes
    setInterval(() => {
        const scheduledCount = scheduledJobs.size;
        logger.info(`Service heartbeat: Running normally. ${scheduledCount} event(s) scheduled for processing.`);
    }, heartbeatInterval);

    // Write statistics report every hour
    setInterval(() => {
        logger.info(getStatisticsSummary());
        writeStatisticsFile();
    }, 60 * 60 * 1000); // Every hour

    // Write initial statistics
    setTimeout(() => {
        logger.info(getStatisticsSummary());
        writeStatisticsFile();
    }, 5000); // 5 seconds after startup

    // Run database cleanup daily at 3 AM to remove old events
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
            logger.info('Running daily database cleanup...');
            cleanupOldEvents(30); // Keep events for 30 days
            // Schedule next cleanup
            setInterval(() => {
                logger.info('Running daily database cleanup...');
                cleanupOldEvents(30);
            }, 24 * 60 * 60 * 1000); // Every 24 hours
        }, timeUntil3AM);

        logger.info(`Database cleanup scheduled for ${next3AM.toLocaleString()}`);
    };

    scheduleDailyCleanup();

    // Start health checks (writes status file every 60 seconds)
    startHealthChecks(60);
    logger.info('Health check monitoring started');
}

module.exports = { runService };
