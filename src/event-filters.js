/**
 * @fileoverview Advanced event filtering beyond basic category matching.
 * @module event-filters
 */

const logger = require('./logger');

/**
 * Applies custom filters to events.
 * @param {Array<Object>} events - Events to filter.
 * @param {Object} filters - Filter configuration.
 * @param {Array<Object>} [attendeeCounts] - Optional attendee counts for each event.
 * @returns {Array<Object>} Filtered events.
 */
function applyFilters(events, filters, attendeeCounts = null) {
  if (!filters) {
    return events;
  }

  let filtered = [...events];
  const originalCount = filtered.length;

  // Filter by keywords in event name
  if (filters.excludeKeywords && filters.excludeKeywords.length > 0) {
    filtered = filtered.filter(event => {
      const name = event.name.toLowerCase();
      return !filters.excludeKeywords.some(keyword =>
        name.includes(keyword.toLowerCase())
      );
    });
    logger.info(`Excluded ${originalCount - filtered.length} event(s) by keywords`);
  }

  if (filters.includeKeywords && filters.includeKeywords.length > 0) {
    const beforeInclude = filtered.length;
    filtered = filtered.filter(event => {
      const name = event.name.toLowerCase();
      return filters.includeKeywords.some(keyword =>
        name.includes(keyword.toLowerCase())
      );
    });
    logger.info(`Included ${filtered.length} of ${beforeInclude} event(s) by keywords`);
  }

  // Filter by fee status
  if (filters.onlyPaidEvents) {
    filtered = filtered.filter(event => event.hasFee === true);
    logger.info(`Filtered to ${filtered.length} paid events`);
  }

  if (filters.onlyFreeEvents) {
    filtered = filtered.filter(event => event.hasFee === false);
    logger.info(`Filtered to ${filtered.length} free events`);
  }

  // Note: Attendee count filtering would require fetching attendees for all events
  // This is expensive, so we log a warning if these filters are used
  if ((filters.minAttendees || filters.maxAttendees) && !attendeeCounts) {
    logger.warn('Attendee count filters (minAttendees/maxAttendees) require fetching all attendees - this is expensive!');
    logger.warn('Consider using these filters only for preview/list commands, not for automated processing');
  }

  if (attendeeCounts) {
    if (filters.minAttendees !== undefined) {
      filtered = filtered.filter((event, index) => {
        const count = attendeeCounts[event.id] || 0;
        return count >= filters.minAttendees;
      });
      logger.info(`Filtered to events with >= ${filters.minAttendees} attendees`);
    }

    if (filters.maxAttendees !== undefined) {
      filtered = filtered.filter((event, index) => {
        const count = attendeeCounts[event.id] || 0;
        return count <= filters.maxAttendees;
      });
      logger.info(`Filtered to events with <= ${filters.maxAttendees} attendees`);
    }
  }

  return filtered;
}

/**
 * Checks if an event passes the filters.
 * @param {Object} event - Event to check.
 * @param {Object} filters - Filter configuration.
 * @param {number} [attendeeCount] - Optional attendee count.
 * @returns {boolean} Whether the event passes filters.
 */
function passesFilters(event, filters, attendeeCount = null) {
  if (!filters) {
    return true;
  }

  // Check keywords
  if (filters.excludeKeywords && filters.excludeKeywords.length > 0) {
    const name = event.name.toLowerCase();
    if (filters.excludeKeywords.some(keyword => name.includes(keyword.toLowerCase()))) {
      return false;
    }
  }

  if (filters.includeKeywords && filters.includeKeywords.length > 0) {
    const name = event.name.toLowerCase();
    if (!filters.includeKeywords.some(keyword => name.includes(keyword.toLowerCase()))) {
      return false;
    }
  }

  // Check fee status
  if (filters.onlyPaidEvents && event.hasFee !== true) {
    return false;
  }

  if (filters.onlyFreeEvents && event.hasFee !== false) {
    return false;
  }

  // Check attendee count
  if (attendeeCount !== null) {
    if (filters.minAttendees !== undefined && attendeeCount < filters.minAttendees) {
      return false;
    }

    if (filters.maxAttendees !== undefined && attendeeCount > filters.maxAttendees) {
      return false;
    }
  }

  return true;
}

module.exports = {
  applyFilters,
  passesFilters
};
