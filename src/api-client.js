const axios = require('axios');
const logger = require('./logger');

const API_KEY = process.env.API_KEY;
const BASE_URL = process.env.API_BASE_URL || 'https://api.helloclub.com';

const axiosRetry = require('axios-retry').default;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${API_KEY}`
  }
});

// Apply the retry logic to the axios instance
axiosRetry(api, {
  retries: 3, // Number of retries
  retryDelay: (retryCount, error) => {
    // Add a small random factor to the delay to avoid thundering herd issues
    const randomFactor = Math.random() * 1000;
    return axiosRetry.exponentialDelay(retryCount, error) + randomFactor;
  },
  retryCondition: (error) => {
    // Retry on 429 (Too Many Requests) and other network errors
    return error.response?.status === 429 || axiosRetry.isNetworkOrIdempotentRequestError(error);
  },
  onRetry: (retryCount, error, requestConfig) => {
    logger.warn(`Retrying request to ${requestConfig.url} due to ${error.response?.status || 'network error'}. Attempt ${retryCount} of 3.`);
  }
});

/**
 * Handles API errors, logs them, and throws an error to be handled by the caller.
 * @param {Error} error - The error object caught.
 * @param {string} context - A string describing the context in which the error occurred.
 */
function handleApiError(error, context) {
  let message;
  if (error.response) {
    const { status, data } = error.response;
    if (status === 401) {
      message = `API Error: 401 Unauthorized while ${context}. Please check your API_KEY in the .env file.`;
      logger.error(message);
    } else {
      message = `API Error: ${status} while ${context}.`;
      logger.error(message, data);
    }
  } else if (error.request) {
    message = `Network Error: No response received while ${context}.`;
    logger.error(message);
  } else {
    message = `An unexpected error occurred while ${context}: ${error.message}`;
    logger.error(message);
  }
  // Throw an error to be handled by the caller
  throw new Error(message);
}

/**
 * Fetches the full details for a single event.
 * @param {number} eventId - The ID of the event to fetch.
 * @returns {Promise<Object|null>} A promise that resolves to the event object or null if not found.
 */
async function getEventDetails(eventId) {
  try {
    const response = await api.get(`/event/${eventId}`);
    return response.data;
  } catch (error) {
    handleApiError(error, `fetching details for event ${eventId}`);
  }
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

      const receivedAttendees = response.data.attendees;

      if (!receivedAttendees || receivedAttendees.length === 0) {
        break;
      }

      attendees = attendees.concat(receivedAttendees);
      total = response.data.meta.total;
      offset += receivedAttendees.length;
    } while (true);

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
  }
}

module.exports = {
    getEventDetails,
    getUpcomingEvents,
    getAllAttendees,
};
