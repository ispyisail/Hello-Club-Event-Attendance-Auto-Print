const logger = require('../services/logger');

/**
 * Validation utilities for input sanitization and defensive programming.
 * All validators return validated/sanitized values or throw descriptive errors.
 */

/**
 * Validates and sanitizes an event object from the API.
 * @param {Object} event - Raw event object from API
 * @returns {Object} Validated event object
 * @throws {Error} If event is invalid
 */
function validateEvent(event) {
  if (!event || typeof event !== 'object') {
    throw new Error('Event must be a valid object');
  }

  // Required fields
  if (!event.id || typeof event.id !== 'string') {
    throw new Error('Event must have a valid string ID');
  }

  if (!event.name || typeof event.name !== 'string') {
    throw new Error('Event must have a valid string name');
  }

  if (!event.startDate) {
    throw new Error('Event must have a startDate');
  }

  // Validate startDate is a valid date
  const startDate = new Date(event.startDate);
  if (isNaN(startDate.getTime())) {
    throw new Error(`Event has invalid startDate: ${event.startDate}`);
  }

  // Sanitize and validate categories
  let categories = [];
  if (event.categories) {
    if (!Array.isArray(event.categories)) {
      logger.warn(`Event ${event.id} has non-array categories, converting to array`);
      categories = [];
    } else {
      categories = event.categories.filter((cat) => cat && typeof cat === 'object' && cat.name);
    }
  }

  return {
    id: String(event.id).trim(),
    name: String(event.name).trim(),
    startDate: event.startDate,
    categories: categories,
    // Include other fields if present
    endDate: event.endDate || null,
    location: event.location || null,
    description: event.description || null,
  };
}

/**
 * Validates and sanitizes an attendee object from the API.
 * @param {Object} attendee - Raw attendee object from API
 * @returns {Object} Validated attendee object
 * @throws {Error} If attendee is critically invalid
 */
function validateAttendee(attendee) {
  if (!attendee || typeof attendee !== 'object') {
    throw new Error('Attendee must be a valid object');
  }

  // Allow missing names but log warning
  const firstName = attendee.firstName ? String(attendee.firstName).trim() : '';
  const lastName = attendee.lastName ? String(attendee.lastName).trim() : '';

  if (!firstName && !lastName) {
    logger.warn('Attendee has no first or last name');
  }

  return {
    firstName: firstName,
    lastName: lastName,
    email: attendee.email ? String(attendee.email).trim() : '',
    phone: attendee.phone ? String(attendee.phone).trim() : '',
    status: attendee.status ? String(attendee.status).trim() : 'unknown',
    signUpDate: attendee.signUpDate || null,
    fee: attendee.fee !== undefined && attendee.fee !== null ? attendee.fee : null,
  };
}

/**
 * Validates a date string or Date object.
 * @param {string|Date} date - Date to validate
 * @param {string} fieldName - Name of the field for error messages
 * @returns {Date} Valid Date object
 * @throws {Error} If date is invalid
 */
function validateDate(date, fieldName = 'date') {
  if (!date) {
    throw new Error(`${fieldName} is required`);
  }

  const dateObj = date instanceof Date ? date : new Date(date);

  if (isNaN(dateObj.getTime())) {
    throw new Error(`${fieldName} is not a valid date: ${date}`);
  }

  // Check for unreasonable dates (before 2000 or after 2100)
  const year = dateObj.getFullYear();
  if (year < 2000 || year > 2100) {
    throw new Error(`${fieldName} has unreasonable year: ${year}`);
  }

  return dateObj;
}

/**
 * Validates an event ID (string, non-empty, reasonable length).
 * @param {string} eventId - Event ID to validate
 * @returns {string} Validated and trimmed event ID
 * @throws {Error} If event ID is invalid
 */
function validateEventId(eventId) {
  if (!eventId || typeof eventId !== 'string') {
    throw new Error('Event ID must be a non-empty string');
  }

  const trimmed = eventId.trim();

  if (trimmed.length === 0) {
    throw new Error('Event ID cannot be empty');
  }

  if (trimmed.length > 100) {
    throw new Error(`Event ID too long: ${trimmed.length} characters`);
  }

  // Check for suspicious characters that might indicate injection
  if (/[<>;"'\\]/.test(trimmed)) {
    throw new Error('Event ID contains invalid characters');
  }

  return trimmed;
}

/**
 * Validates a configuration value is a positive integer.
 * @param {*} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number} Validated integer
 * @throws {Error} If value is invalid
 */
function validatePositiveInteger(value, fieldName, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const num = parseInt(value);

  if (isNaN(num)) {
    throw new Error(`${fieldName} must be a valid number`);
  }

  if (num < min) {
    throw new Error(`${fieldName} must be at least ${min}`);
  }

  if (num > max) {
    throw new Error(`${fieldName} must be at most ${max}`);
  }

  return num;
}

/**
 * Validates an array is non-null and returns it, or returns empty array.
 * @param {*} value - Value to validate
 * @param {string} fieldName - Name of the field for logging
 * @returns {Array} Valid array
 */
function ensureArray(value, fieldName = 'value') {
  if (!value) {
    return [];
  }

  if (!Array.isArray(value)) {
    logger.warn(`${fieldName} is not an array, converting to empty array`);
    return [];
  }

  return value;
}

/**
 * Safely extracts a string from an object, with fallback.
 * @param {Object} obj - Object to extract from
 * @param {string} key - Key to extract
 * @param {string} defaultValue - Default value if key is missing or invalid
 * @returns {string} Extracted string
 */
function safeString(obj, key, defaultValue = '') {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }

  const value = obj[key];

  if (value === null || value === undefined) {
    return defaultValue;
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  // Try to convert to string
  try {
    return String(value).trim();
  } catch (_e) {
    return defaultValue;
  }
}

/**
 * Validates database status value.
 * @param {string} status - Status to validate
 * @returns {string} Valid status
 * @throws {Error} If status is invalid
 */
function validateEventStatus(status) {
  const validStatuses = ['pending', 'processed', 'failed', 'cancelled'];

  if (!status || typeof status !== 'string') {
    throw new Error('Status must be a non-empty string');
  }

  const trimmed = status.trim().toLowerCase();

  if (!validStatuses.includes(trimmed)) {
    throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
  }

  return trimmed;
}

/**
 * Validates job status value.
 * @param {string} status - Status to validate
 * @returns {string} Valid status
 * @throws {Error} If status is invalid
 */
function validateJobStatus(status) {
  const validStatuses = ['pending', 'completed', 'failed', 'retrying', 'cancelled'];

  if (!status || typeof status !== 'string') {
    throw new Error('Job status must be a non-empty string');
  }

  const trimmed = status.trim().toLowerCase();

  if (!validStatuses.includes(trimmed)) {
    throw new Error(`Invalid job status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
  }

  return trimmed;
}

module.exports = {
  validateEvent,
  validateAttendee,
  validateDate,
  validateEventId,
  validatePositiveInteger,
  ensureArray,
  safeString,
  validateEventStatus,
  validateJobStatus,
};
