const axios = require('axios');
const logger = require('../services/logger');
const cache = require('../utils/cache');

const API_KEY = process.env.API_KEY;
const BASE_URL = process.env.API_BASE_URL || 'https://api.helloclub.com';
// API request timeout in milliseconds (default: 30 seconds)
// Can be overridden via API_TIMEOUT environment variable
const API_TIMEOUT = parseInt(process.env.API_TIMEOUT) || 30000;

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${API_KEY}`
  },
  timeout: API_TIMEOUT
});

/**
 * Handles API errors, logs them, and throws an error to be handled by the caller.
 * @param {Error} error - The error object caught.
 * @param {string} context - A string describing the context in which the error occurred.
 */
function handleApiError(error, context) {
  let message;

  // Check for timeout errors first
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    message = `API Timeout: Request timed out after ${API_TIMEOUT}ms while ${context}. Check your internet connection or increase API_TIMEOUT.`;
    logger.error(message);
  } else if (error.response) {
    const { status, data } = error.response;
    if (status === 401) {
      message = `API Error: 401 Unauthorized while ${context}. Please check your API_KEY in the .env file.`;
      logger.error(message);
    } else {
      message = `API Error: ${status} while ${context}.`;
      logger.error(message, data);
    }
  } else if (error.request) {
    message = `Network Error: No response received while ${context}. Check your internet connection.`;
    logger.error(message);
  } else {
    message = `An unexpected error occurred while ${context}: ${error.message}`;
    logger.error(message);
  }
  // Throw an error to be handled by the caller
  throw new Error(message);
}

/**
 * Fetches the full details for a single event (with caching and graceful degradation).
 * Event details are cached for 5 minutes to reduce API calls.
 * Falls back to stale cache data if API fails.
 * @param {number} eventId - The ID of the event to fetch.
 * @param {Object} options - Options for graceful degradation
 * @param {boolean} options.allowStale - Allow returning stale cache data on API failure
 * @returns {Promise<Object|null>} A promise that resolves to the event object or null if not found.
 */
async function getEventDetails(eventId, options = { allowStale: true }) {
  const cacheKey = `event:${eventId}`;

  // Check fresh cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await api.get(`/event/${eventId}`);
    // Cache for 5 minutes fresh, 1 hour stale
    cache.set(cacheKey, response.data, 300, 3600);
    return response.data;
  } catch (error) {
    // Try to use stale cache data if allowed
    if (options.allowStale) {
      const staleData = cache.getStale(cacheKey);
      if (staleData) {
        logger.warn(`API failed for event ${eventId}, using stale cache data (graceful degradation)`);
        logger.warn(`API Error: ${error.message}`);
        return staleData;
      }
    }

    handleApiError(error, `fetching details for event ${eventId}`);
  }
}

/**
 * Fetches upcoming events from the Hello Club API within a given time window with graceful degradation.
 * @param {number} fetchWindowHours - The number of hours to look ahead for events.
 * @param {Object} options - Options for graceful degradation
 * @param {boolean} options.allowStale - Allow returning stale cache data on API failure
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of event objects.
 */
async function getUpcomingEvents(fetchWindowHours, options = { allowStale: true }) {
  const cacheKey = `upcoming_events:${fetchWindowHours}`;

  // Check fresh cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

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

    const events = response.data.events || [];

    // Cache for 5 minutes fresh, 1 hour stale
    cache.set(cacheKey, events, 300, 3600);

    if (events.length > 0) {
      logger.info(`Found ${events.length} upcoming events in the next ${fetchWindowHours} hours.`);
    } else {
      logger.info(`No upcoming events found in the next ${fetchWindowHours} hours.`);
    }

    return events;
  } catch (error) {
    // Try to use stale cache data if allowed
    if (options.allowStale) {
      const staleData = cache.getStale(cacheKey);
      if (staleData) {
        logger.warn(`API failed, using stale cache data for upcoming events (graceful degradation)`);
        logger.warn(`API Error: ${error.message}`);
        return staleData;
      }
    }

    handleApiError(error, 'fetching upcoming events');
  }
}

/**
 * Fetches all attendees for a given event, handling pagination with graceful degradation.
 * @param {string} eventId - The ID of the event to fetch attendees for.
 * @param {Object} options - Options for graceful degradation
 * @param {boolean} options.allowStale - Allow returning stale cache data on API failure
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of attendee objects, sorted by last name then first name.
 */
async function getAllAttendees(eventId, options = { allowStale: true }) {
  const cacheKey = `attendees:${eventId}`;

  // Check fresh cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

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

      // Wait for 1 second before the next request to avoid hitting the rate limit.
      await new Promise(resolve => setTimeout(resolve, 1000));
    } while (true);

    // Sort attendees by last name, then first name (case-insensitive)
    // Using nullish coalescing (??) to handle null/undefined while preserving empty strings
    attendees.sort((a, b) => {
      const lastNameA = (a.lastName ?? '').toLowerCase();
      const lastNameB = (b.lastName ?? '').toLowerCase();
      const firstNameA = (a.firstName ?? '').toLowerCase();
      const firstNameB = (b.firstName ?? '').toLowerCase();

      if (lastNameA < lastNameB) return -1;
      if (lastNameA > lastNameB) return 1;
      if (firstNameA < firstNameB) return -1;
      if (firstNameA > firstNameB) return 1;
      return 0;
    });

    // Cache for 2 minutes fresh (attendees can change close to event time), 30 minutes stale
    cache.set(cacheKey, attendees, 120, 1800);

    return attendees;
  } catch (error) {
    // Try to use stale cache data if allowed
    if (options.allowStale) {
      const staleData = cache.getStale(cacheKey);
      if (staleData) {
        logger.warn(`API failed for attendees of event ${eventId}, using stale cache data (graceful degradation)`);
        logger.warn(`API Error: ${error.message}`);
        return staleData;
      }
    }

    handleApiError(error, `fetching attendees for event ${eventId}`);
  }
}

/**
 * Clear the API response cache
 * Useful for testing or when fresh data is needed
 */
function clearCache() {
  cache.clear();
}

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
function getCacheStats() {
  return cache.getStats();
}

module.exports = {
    getEventDetails,
    getUpcomingEvents,
    getAllAttendees,
    clearCache,
    getCacheStats
};
