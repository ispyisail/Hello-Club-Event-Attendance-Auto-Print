const logger = require('./logger');
const { getDb } = require('./database');
const { fetchAndStoreUpcomingEvents, processSingleEvent } = require('./functions');

// In-memory map to store references to our scheduled timeout jobs.
// The key is the event ID, and the value is the timeout ID returned by setTimeout.
const scheduledJobs = new Map();

/**
 * Schedules a single event to be processed at the correct time.
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

    // Only schedule jobs that are in the future.
    if (processTime > now) {
        const delay = processTime - now;
        const timeoutId = setTimeout(() => {
            logger.info(`Scheduled job triggered for event: ${event.name} (ID: ${event.id})`);
            // The job is done, so remove it from the map.
            scheduledJobs.delete(event.id);
            // Process the event.
            processSingleEvent(event, config);
        }, delay);

        // Store the timeout ID so we can manage it.
        scheduledJobs.set(event.id, timeoutId);
        logger.info(`Scheduled job for event: "${event.name}" (ID: ${event.id}) in ${Math.round(delay / 1000 / 60)} minutes.`);
    } else {
        logger.info(`Event "${event.name}" (ID: ${event.id}) is in the past and will not be scheduled.`);
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
    logger.info(`Scheduler loop finished. Next run in ${config.fetchWindowHours} hours.`);
}

/**
 * Starts the long-running service.
 * @param {Object} config - The application configuration.
 */
function runService(config) {
    logger.info('Service starting...');
    logger.info(`Service started successfully. The scheduler will run every ${config.serviceRunIntervalHours} hours.`);

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
    setInterval(task, runInterval);
}

module.exports = { runService };
