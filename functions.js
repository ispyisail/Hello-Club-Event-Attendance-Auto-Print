require('dotenv').config();
const logger = require('./logger');
const axios = require('axios');
const fs = require('fs');
const { print } = require('pdf-to-printer');
const { sendEmailWithAttachment } = require('./email-service');
const PdfGenerator = require('./pdf-generator');
const configSchema = require('./config-schema');
const db = require('./database');

const API_KEY = process.env.API_KEY;
const PRINTER_EMAIL = process.env.PRINTER_EMAIL;
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;

const BASE_URL = 'https://api.helloclub.com';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${API_KEY}`
  }
});

/**
 * Handles API errors, logs them, and exits if necessary.
 * @param {Error} error - The error object caught.
 * @param {string} context - A string describing the context in which the error occurred.
 */
function handleApiError(error, context) {
  if (error.response) {
    const { status, data } = error.response;
    if (status === 401) {
      logger.error(`API Error: 401 Unauthorized while ${context}. Please check your API_KEY in the .env file.`);
      process.exit(1);
    } else {
      logger.error(`API Error: ${status} while ${context}.`, data);
    }
  } else if (error.request) {
    logger.error(`Network Error: No response received while ${context}.`);
  } else {
    logger.error(`An unexpected error occurred while ${context}:`, error.message);
  }
}

/**
 * Checks the database for events that are due for printing, then fetches attendees and generates the PDF.
 * @param {Object} finalConfig - The application's configuration object.
 * @returns {Promise<void>}
 */
async function processScheduledEvents(finalConfig) {
  const { preEventQueryMinutes, outputFilename, pdfLayout, printMode } = finalConfig;

  const now = new Date();
  const queryTimeLimit = new Date(now.getTime() + preEventQueryMinutes * 60 * 1000);

  db.all("SELECT * FROM events WHERE status = 'pending' AND startDate <= ?", [queryTimeLimit.toISOString()], async (err, events) => {
    if (err) {
      logger.error('Error querying for pending events:', err.message);
      db.close();
      return;
    }

    if (events.length === 0) {
      logger.info(`No events to process within the next ${preEventQueryMinutes} minutes.`);
      db.close();
      return;
    }

    logger.info(`Found ${events.length} event(s) to process.`);

    for (const event of events) {
      logger.info(`Processing event "${event.name}" (ID: ${event.id})...`);

      const attendees = await getAllAttendees(event.id);
      if (attendees && attendees.length > 0) {
        // The createAndPrintPdf function expects an event object that matches the API response,
        // so we pass the database row which has `id` and `name`.
        await createAndPrintPdf(event, attendees, outputFilename, pdfLayout, printMode);

        // Mark the event as processed in the database
        db.run("UPDATE events SET status = 'processed' WHERE id = ?", [event.id], (updateErr) => {
          if (updateErr) {
            logger.error(`Error updating status for event ${event.id}:`, updateErr.message);
          } else {
            logger.info(`Event "${event.name}" (ID: ${event.id}) marked as processed.`);
          }
        });
      } else {
        logger.warn(`No attendees found for event "${event.name}" (ID: ${event.id}). Skipping PDF generation.`);
         // Mark as processed anyway to avoid retrying an event with no attendees
         db.run("UPDATE events SET status = 'processed' WHERE id = ?", [event.id], (updateErr) => {
            if (updateErr) {
                logger.error(`Error updating status for event ${event.id}:`, updateErr.message);
            }
         });
      }
    }
    // It's tricky to know when all async operations are done.
    // This simple db.close() might run too early.
    // For this app's purpose, we'll accept it. A more robust solution might use Promises for db calls.
    setTimeout(() => db.close(), 5000); // Give it a few seconds to finish up.
  });
}

/**
 * Fetches upcoming events from the Hello Club API within a given time window.
 * @param {number} fetchWindowHours - The number of hours to look ahead for events.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of event objects.
 */
async function getUpcomingEvents(fetchWindowHours) {
  try {
    const fromDate = new Date();
    const toDate = new Date(fromDate.getTime() + fetchWindowHours * 60 * 60 * 1000);

    const response = await api.get('/event', {
      params: {
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
        sort: 'startDate'
      }
    });

    if (response.data.events.length > 0) {
      logger.info(`Found ${response.data.events.length} upcoming events in the next ${fetchWindowHours} hours.`);
      return response.data.events;
    } else {
      logger.info(`No upcoming events found in the next ${fetchWindowHours} hours.`);
      return [];
    }
  } catch (error) {
    handleApiError(error, 'fetching upcoming events');
    return [];
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

  if (events.length === 0) {
    return;
  }

  const filteredEvents = events.filter(event => {
    if (allowedCategories.length === 0) {
      return true; // No category filter, include all events
    }
    return event.categories.some(category => allowedCategories.includes(category.name));
  });

  if (filteredEvents.length === 0) {
    logger.info('No events matched the specified categories.');
    return;
  }

  const stmt = db.prepare("INSERT OR IGNORE INTO events (id, name, startDate, status) VALUES (?, ?, ?, 'pending')");
  let insertedCount = 0;
  for (const event of filteredEvents) {
    stmt.run(event.id, event.name, event.startDate, function(err) {
      if (err) {
        logger.error(`Error inserting event ${event.id}:`, err.message);
      } else if (this.changes > 0) {
        insertedCount++;
      }
    });
  }
  stmt.finalize((err) => {
    if (err) {
        logger.error('Error finalizing statement:', err.message);
    }
    if (insertedCount > 0) {
        logger.info(`Successfully stored ${insertedCount} new events in the database.`);
    } else {
        logger.info('No new events to store.');
    }
    db.close();
  });
}

/**
 * Fetches all attendees for a given event, handling pagination.
 * @param {string} eventId - The ID of the event to fetch attendees for.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of attendee objects, sorted by last name then first name.
 */
async function getAllAttendees(eventId) {
  let attendees = [];
  let offset = 0;
  const limit = 100;
  let total = 0;
  try {
    do {
      const response = await api.get('/eventAttendee', {
        params: { event: eventId, limit: limit, offset: offset }
      });
      attendees = attendees.concat(response.data.attendees);
      total = response.data.meta.total;
      offset += response.data.meta.count;
    } while (attendees.length < total);

    attendees.sort((a, b) => {
      const lastNameA = a.lastName || '';
      const lastNameB = b.lastName || '';
      const firstNameA = a.firstName || '';
      const firstNameB = b.firstName || '';
      if (lastNameA.toLowerCase() < lastNameB.toLowerCase()) return -1;
      if (lastNameA.toLowerCase() > lastNameB.toLowerCase()) return 1;
      if (firstNameA.toLowerCase() < firstNameB.toLowerCase()) return -1;
      if (firstNameA.toLowerCase() > firstNameB.toLowerCase()) return 1;
      return 0;
    });
    return attendees;
  } catch (error) {
    handleApiError(error, `fetching attendees for event ${eventId}`);
    return [];
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
      logger.error(err);
    }
  } else if (printMode === 'email') {
    logger.info(`Sending PDF to printer via email...`);
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
  getUpcomingEvents,
  fetchAndStoreUpcomingEvents,
  processScheduledEvents,
  getAllAttendees,
  createAndPrintPdf,
  api,
  handleApiError
};