const logger = require('./logger');
const { print } = require('pdf-to-printer');
const { sendEmailWithAttachment } = require('./email-service');
const PdfGenerator = require('./pdf-generator');
const { getDb } = require('./database');
const { getEventDetails, getAllAttendees, getUpcomingEvents } = require('./api-client');

/**
 * Processes a single event: fetches attendees, creates a PDF, prints it, and updates the database.
 * This function is designed to be called by the scheduler or the manual `process-schedule` command.
 * @param {Object} event - The event object from the local database.
 * @param {Object} finalConfig - The application's configuration object.
 * @returns {Promise<void>}
 */
async function processSingleEvent(event, finalConfig) {
  const { outputFilename, pdfLayout, printMode } = finalConfig;
  try {
    logger.info(`Processing event "${event.name}" (ID: ${event.id})...`);

    // Get the full, up-to-date event details for the PDF header
    const fullEvent = await getEventDetails(event.id);
    const attendees = await getAllAttendees(event.id);

    const db = getDb();
    const updateStmt = db.prepare("UPDATE events SET status = 'processed' WHERE id = ?");

    if (attendees && attendees.length > 0) {
      await createAndPrintPdf(fullEvent, attendees, outputFilename, pdfLayout, printMode);
      updateStmt.run(event.id);
      logger.info(`Event "${event.name}" (ID: ${event.id}) marked as processed.`);
    } else {
      logger.warn(`No attendees found for event "${event.name}" (ID: ${event.id}). Skipping PDF generation.`);
      updateStmt.run(event.id);
      logger.info(`Event "${event.name}" (ID: ${event.id}) marked as processed to avoid retries.`);
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
      return;
    }

    logger.info(`Found ${events.length} event(s) to process.`);

    for (const event of events) {
      await processSingleEvent(event, finalConfig);
    }
  } catch (err) {
    logger.error('A critical error occurred during processScheduledEvents:', err.message);
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
  const events = await getUpcomingEvents(fetchWindowHours);

  if (!events || events.length === 0) {
    return;
  }

  const filteredEvents = events.filter(event => {
    if (!allowedCategories || allowedCategories.length === 0) {
      return true; // No category filter, include all events
    }
    // Defensively check if categories is an array before trying to filter on it.
    return Array.isArray(event.categories) && event.categories.some(category => allowedCategories.includes(category.name));
  });

  if (filteredEvents.length === 0) {
    logger.info('No events matched the specified categories.');
    return;
  }

  try {
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
      logger.info(`Successfully stored ${insertedCount} new events in the database.`);
    } else {
      logger.info('No new events to store.');
    }
  } catch (err) {
    logger.error('An error occurred during fetchAndStoreUpcomingEvents:', err.message);
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
  const generator = new PdfGenerator(event, attendees, pdfLayout);
  generator.generate(outputFileName);
  logger.info(`Successfully created ${outputFileName}`);

  if (printMode === 'local') {
    logger.info(`Printing PDF locally...`);
    try {
      const msg = await print(outputFileName);
      logger.info(msg);
    } catch (err) {
      logger.error('Failed to print locally:', err);
      throw err;
    }
  } else if (printMode === 'email') {
    logger.info(`Sending PDF to printer via email...`);
    // Get email settings from environment variables
    const PRINTER_EMAIL = process.env.PRINTER_EMAIL;
    const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
    const SMTP_PORT = process.env.SMTP_PORT || 587;
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;
    const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;

    const transportOptions = {
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT == 465, // true for 465, false for other ports
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    };
    const subject = `Print Job: ${event.name}`;
    const body = `Attached is the attendee list for the event: ${event.name}.`;
    await sendEmailWithAttachment(transportOptions, PRINTER_EMAIL, EMAIL_FROM, subject, body, outputFileName);
  }
}

module.exports = {
  fetchAndStoreUpcomingEvents,
  processScheduledEvents
};