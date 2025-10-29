const logger = require('./logger');
const { print } = require('pdf-to-printer');
const { sendEmailWithAttachment } = require('./email-service');
const PdfGenerator = require('./pdf-generator');
const { getDb } = require('./database');
const { getEventDetails, getAllAttendees, getUpcomingEvents } = require('./api-client');
const { recordFetch, recordProcess, recordError } = require('./status-tracker');
const { retryWithBackoff } = require('./retry-util');
const { incrementCounter, recordTiming } = require('./metrics');

/**
 * Processes a single event: fetches attendees, creates a PDF, prints it, and updates the database.
 * This function is designed to be called by the scheduler or the manual `process-schedule` command.
 * @param {Object} event - The event object from the local database.
 * @param {Object} finalConfig - The application's configuration object.
 * @returns {Promise<void>}
 */
async function processSingleEvent(event, finalConfig) {
  const { outputFilename, pdfLayout, printMode, dryRun } = finalConfig;
  try {
    logger.info(`${dryRun ? '[DRY RUN] ' : ''}Processing event "${event.name}" (ID: ${event.id})...`);

    // Get the full, up-to-date event details for the PDF header
    const fullEvent = await getEventDetails(event.id);
    const attendees = await getAllAttendees(event.id);

    if (attendees && attendees.length > 0) {
      if (dryRun) {
        logger.info(`[DRY RUN] Would print PDF for event "${event.name}" with ${attendees.length} attendees`);
        logger.info(`[DRY RUN] Print mode: ${printMode}`);
        logger.info(`[DRY RUN] Output file: ${outputFilename}`);
      } else {
        await createAndPrintPdf(fullEvent, attendees, outputFilename, pdfLayout, printMode, dryRun);
        const db = getDb();
        const updateStmt = db.prepare("UPDATE events SET status = 'processed' WHERE id = ?");
        updateStmt.run(event.id);
        logger.info(`Event "${event.name}" (ID: ${event.id}) marked as processed.`);
      }
    } else {
      logger.warn(`No attendees found for event "${event.name}" (ID: ${event.id}). Skipping PDF generation.`);
      if (!dryRun) {
        const db = getDb();
        const updateStmt = db.prepare("UPDATE events SET status = 'processed' WHERE id = ?");
        updateStmt.run(event.id);
        logger.info(`Event "${event.name}" (ID: ${event.id}) marked as processed to avoid retries.`);
      }
    }
  } catch (error) {
    logger.error(`Failed to process event ${event.id} ("${event.name}"). It will not be retried.`);
    try {
      const db = getDb();
      db.prepare("UPDATE events SET status = 'processed' WHERE id = ?").run(event.id);
      logger.warn(`Event ${event.id} marked as processed to prevent retries after error.`);
    } catch (dbError) {
      logger.error(`Additionally, failed to mark event ${event.id} as processed:`, dbError);
    }
  }
}


/**
 * Checks the database for events that are due for printing and calls processSingleEvent for each.
 * @param {Object} finalConfig - The application's configuration object.
 * @returns {Promise<void>}
 */
async function processScheduledEvents(finalConfig) {
  const { preEventQueryMinutes } = finalConfig;
  try {
    const db = getDb();
    const now = new Date();
    const queryTimeLimit = new Date(now.getTime() + preEventQueryMinutes * 60 * 1000);

    const stmt = db.prepare("SELECT * FROM events WHERE status = 'pending' AND startDate <= ?");
    const events = stmt.all(queryTimeLimit.toISOString());

    if (events.length === 0) {
      logger.info(`No events to process within the next ${preEventQueryMinutes} minutes.`);
      recordProcess(0);
      return;
    }

    logger.info(`Found ${events.length} event(s) to process.`);

    let processedCount = 0;
    for (const event of events) {
      try {
        await processSingleEvent(event, finalConfig);
        processedCount++;
      } catch (error) {
        logger.error(`Failed to process event ${event.id}:`, error.message);
        recordError('processEvent', `Event ${event.id}: ${error.message}`);
      }
    }

    recordProcess(processedCount);
  } catch (err) {
    logger.error('A critical error occurred during processScheduledEvents:', err.message);
    recordError('processScheduledEvents', err.message);
    throw err;
  }
}

/**
 * Fetches upcoming events and stores them in the local database.
 * @param {Object} finalConfig - The application's configuration object.
 * @returns {Promise<void>}
 */
async function fetchAndStoreUpcomingEvents(finalConfig) {
  const { fetchWindowHours, allowedCategories } = finalConfig;
  const startTime = Date.now();

  try {
    const events = await getUpcomingEvents(fetchWindowHours);

    if (!events || events.length === 0) {
      logger.info('No upcoming events found from API.');
      recordFetch(0);
      return;
    }

    logger.info(`Fetched ${events.length} event(s) from API.`);

    const filteredEvents = events.filter(event => {
      if (!allowedCategories || allowedCategories.length === 0) {
        return true; // No category filter, include all events
      }
      // Defensively check if categories is an array before trying to filter on it.
      return Array.isArray(event.categories) && event.categories.some(category => allowedCategories.includes(category.name));
    });

    if (filteredEvents.length === 0) {
      logger.info('No events matched the specified categories.');
      recordFetch(0);
      return;
    }

    if (filteredEvents.length < events.length) {
      logger.info(`${filteredEvents.length} event(s) matched category filter (${events.length - filteredEvents.length} filtered out).`);
    }

    const db = getDb();
    const stmt = db.prepare("INSERT OR IGNORE INTO events (id, name, startDate, status) VALUES (?, ?, ?, 'pending')");

    const insertMany = db.transaction((events) => {
      let insertedCount = 0;
      for (const event of events) {
        const result = stmt.run(event.id, event.name, event.startDate);
        if (result.changes > 0) {
          insertedCount++;
        }
      }
      return insertedCount;
    });

    const insertedCount = insertMany(filteredEvents);

    if (insertedCount > 0) {
      logger.info(`Successfully stored ${insertedCount} new event(s) in the database.`);
    } else {
      logger.info('No new events to store (all events already in database).');
    }

    recordFetch(insertedCount);

    // Record metrics
    incrementCounter('eventsFetched', insertedCount);
    recordTiming('fetch', Date.now() - startTime);
  } catch (err) {
    logger.error('An error occurred during fetchAndStoreUpcomingEvents:', err.message);
    recordError('fetchAndStoreUpcomingEvents', err.message);
    incrementCounter('errors');
    throw err;
  }
}

/**
 * Creates a PDF from event and attendee data, and then prints it either locally or via email.
 * @param {Object} event - The event object.
 * @param {Array<Object>} attendees - An array of attendee objects.
 * @param {string} outputFileName - The name of the file to save the PDF as.
 * @param {Object} pdfLayout - The layout configuration for the PDF.
 * @param {string} printMode - The printing mode ('local' or 'email').
 * @returns {Promise<void>}
 */
async function createAndPrintPdf(event, attendees, outputFileName, pdfLayout, printMode) {
  // Generate PDF with proper error handling
  try {
    const generator = new PdfGenerator(event, attendees, pdfLayout);
    generator.generate(outputFileName);
    logger.info(`Successfully created ${outputFileName}`);
  } catch (err) {
    logger.error(`Failed to generate PDF for event ${event.id}:`, err.message);
    throw new Error(`PDF generation failed: ${err.message}`);
  }

  // Print with retry logic
  if (printMode === 'local') {
    logger.info(`Printing PDF locally...`);
    await retryWithBackoff(
      async () => {
        const msg = await print(outputFileName);
        logger.info(msg);
        return msg;
      },
      {
        maxAttempts: 3,
        baseDelay: 2000,
        operationName: 'Local print'
      }
    );
  } else if (printMode === 'email') {
    logger.info(`Sending PDF to printer via email...`);
    // Get email settings from environment variables
    const PRINTER_EMAIL = process.env.PRINTER_EMAIL;
    const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
    const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 587;
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;
    const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;

    const transportOptions = {
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    };
    const subject = `Print Job: ${event.name}`;
    const body = `Attached is the attendee list for the event: ${event.name}.`;

    await retryWithBackoff(
      async () => {
        await sendEmailWithAttachment(transportOptions, PRINTER_EMAIL, EMAIL_FROM, subject, body, outputFileName);
      },
      {
        maxAttempts: 3,
        baseDelay: 2000,
        operationName: 'Email print'
      }
    );
  }
}

module.exports = {
  fetchAndStoreUpcomingEvents,
  processScheduledEvents
};