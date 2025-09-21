require('dotenv').config();
const logger = require('./logger');
const axios = require('axios');
const fs = require('fs');
const { print } = require('pdf-to-printer');
const { sendEmailWithAttachment } = require('./email-service');
const PdfGenerator = require('./pdf-generator');
const configSchema = require('./config-schema');

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
 * Fetches the next upcoming event from the Hello Club API.
 * @param {string[]} [allowedCategories=[]] - A list of event categories to filter by. If empty, all categories are considered.
 * @returns {Promise<Object|null>} A promise that resolves to the next event object, or null if no event is found.
 */
async function getNextEvent(allowedCategories = []) {
  try {
    const response = await api.get('/event', {
      params: {
        fromDate: new Date().toISOString(),
        sort: 'startDate'
      }
    });

    if (response.data.events.length > 0) {
      const nextEvent = response.data.events.find(event => {
        if (allowedCategories.length === 0) {
          return true;
        }
        return event.categories.some(category => allowedCategories.includes(category.name));
      });

      if (nextEvent) {
        return nextEvent;
      } else {
        logger.info(`No upcoming events found with the specified categories: ${allowedCategories.join(', ')}`);
        return null;
      }
    } else {
      logger.info('No upcoming events found.');
      return null;
    }
  } catch (error) {
    handleApiError(error, 'fetching next event');
    return null;
  }
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

/**
 * The main function of the application.
 * @param {Object} argv - The parsed command-line arguments.
 * @param {Object} dependencies - The dependencies to be injected.
 * @param {function} dependencies.getNextEvent - The function to get the next event.
 * @param {function} dependencies.getAllAttendees - The function to get all attendees.
 * @param {function} dependencies.createAndPrintPdf - The function to create and print the PDF.
 * @returns {Promise<void>}
 */
async function main(argv, { getNextEvent, getAllAttendees, createAndPrintPdf }) {
  let config = {};
  try {
    const configData = fs.readFileSync('config.json', 'utf8');
    config = JSON.parse(configData);
  } catch (error) {
    logger.warn('Warning: config.json not found or is invalid JSON. Using default configuration.');
  }

  const { error, value: validatedConfig } = configSchema.validate(config);

  if (error) {
    logger.error('Invalid configuration in config.json:', error.details.map(d => d.message).join('\n'));
    process.exit(1);
  }

  const finalConfig = {
    printWindowMinutes: argv.window || validatedConfig.printWindowMinutes,
    allowedCategories: argv.category || validatedConfig.categories,
    outputFilename: argv.output || validatedConfig.outputFilename,
    pdfLayout: validatedConfig.pdfLayout,
    printMode: argv.printMode || 'email',
  };

  const { printWindowMinutes, allowedCategories, outputFilename, pdfLayout, printMode } = finalConfig;

  const event = await getNextEvent(allowedCategories);

  if (event) {
    const now = new Date();
    const eventDate = new Date(event.startDate);
    const timeDiff = eventDate.getTime() - now.getTime();
    const minutesDiff = Math.floor(timeDiff / 1000 / 60);

    if (minutesDiff <= printWindowMinutes && minutesDiff > 0) {
      logger.info(`Event "${event.name}" is starting in ${minutesDiff} minutes. Generating printout...`);
      const attendees = await getAllAttendees(event.id);
      if (attendees) {
        createAndPrintPdf(event, attendees, outputFilename, pdfLayout, printMode);
      }
    } else {
      logger.info(`Next event "${event.name}" is not starting within the next ${printWindowMinutes} minutes. Current difference: ${minutesDiff} minutes.`);
    }
  } else {
    logger.info('No event selected or found.');
  }
}

module.exports = { getNextEvent, getAllAttendees, createAndPrintPdf, main, api };