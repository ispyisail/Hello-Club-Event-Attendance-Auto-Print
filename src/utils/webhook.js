/**
 * @fileoverview Webhook notification sender
 * Sends HTTP POST notifications to configured webhook URLs for key events
 */

const axios = require('axios');
const { URL } = require('url');
const logger = require('../services/logger');

// Webhook timeout (10 seconds)
const WEBHOOK_TIMEOUT = 10000;

// Retry configuration for webhook delivery
const WEBHOOK_MAX_RETRIES = 2;
const WEBHOOK_RETRY_DELAY = 2000; // 2 seconds

// Blocked hostnames for SSRF protection
const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];

/**
 * Check if an IP address is in a private range
 * @param {string} hostname - The hostname to check
 * @returns {boolean} True if private IP
 */
function isPrivateIP(hostname) {
  // IPv4 private ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const parts = ipv4Match.slice(1).map(Number);

    // Check private ranges
    return (
      parts[0] === 10 || // 10.0.0.0/8
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
      (parts[0] === 192 && parts[1] === 168) || // 192.168.0.0/16
      parts[0] === 127 || // 127.0.0.0/8 (loopback)
      (parts[0] === 169 && parts[1] === 254) || // 169.254.0.0/16 (link-local)
      parts[0] === 0 // 0.0.0.0/8
    );
  }

  return false;
}

/**
 * Validate webhook URL to prevent SSRF attacks
 * @param {string} url - The URL to validate
 * @returns {{valid: boolean, error?: string}} Validation result
 */
function validateWebhookUrl(url) {
  try {
    const parsed = new URL(url);

    // Only allow HTTPS for security
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Webhook URL must use HTTPS' };
    }

    // Check against blocked hostnames
    if (BLOCKED_HOSTS.includes(parsed.hostname.toLowerCase())) {
      return { valid: false, error: 'Webhook URL cannot point to localhost' };
    }

    // Check for private IP ranges
    if (isPrivateIP(parsed.hostname)) {
      return { valid: false, error: 'Webhook URL cannot point to private IP addresses' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Invalid URL: ${error.message}` };
  }
}

/**
 * Send a webhook notification
 * @param {string} url - The webhook URL to send to
 * @param {Object} payload - The data to send
 * @param {number} retryCount - Current retry attempt (internal use)
 * @returns {Promise<Object>} Response data
 */
async function sendWebhook(url, payload, retryCount = 0) {
  if (!url) {
    logger.warn('Webhook URL not configured, skipping notification');
    return { success: false, reason: 'No URL configured' };
  }

  // Validate URL to prevent SSRF attacks
  const validation = validateWebhookUrl(url);
  if (!validation.valid) {
    logger.error(`Webhook URL validation failed: ${validation.error}`);
    return { success: false, error: validation.error };
  }

  try {
    const response = await axios.post(url, payload, {
      timeout: WEBHOOK_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'HelloClub-Event-Attendance/1.0',
      },
    });

    logger.info(`✓ Webhook sent successfully to ${url} (Status: ${response.status})`);
    return {
      success: true,
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    const errorMessage = error.response
      ? `HTTP ${error.response.status}: ${error.response.statusText}`
      : error.code === 'ECONNABORTED'
        ? 'Request timeout'
        : error.message;

    logger.error(`Failed to send webhook to ${url}: ${errorMessage}`);

    // Retry logic
    if (retryCount < WEBHOOK_MAX_RETRIES) {
      logger.warn(`Retrying webhook delivery (attempt ${retryCount + 1}/${WEBHOOK_MAX_RETRIES})...`);
      await new Promise((resolve) => setTimeout(resolve, WEBHOOK_RETRY_DELAY));
      return sendWebhook(url, payload, retryCount + 1);
    }

    logger.error(`✗ Webhook delivery failed after ${WEBHOOK_MAX_RETRIES} retries`);
    return {
      success: false,
      error: errorMessage,
      retries: retryCount,
    };
  }
}

/**
 * Send event processing success notification
 * @param {Object} event - The event that was processed
 * @param {number} attendeeCount - Number of attendees
 * @param {string} webhookUrl - Webhook URL from config
 */
async function notifyEventProcessed(event, attendeeCount, webhookUrl) {
  const payload = {
    event: 'event.processed',
    timestamp: new Date().toISOString(),
    data: {
      eventId: event.id,
      eventName: event.name,
      eventDate: event.startDate,
      attendeeCount: attendeeCount,
      status: 'success',
    },
  };

  return await sendWebhook(webhookUrl, payload);
}

/**
 * Send event processing failure notification
 * @param {Object} event - The event that failed
 * @param {string} error - Error message
 * @param {string} webhookUrl - Webhook URL from config
 */
async function notifyEventFailed(event, error, webhookUrl) {
  const payload = {
    event: 'event.failed',
    timestamp: new Date().toISOString(),
    data: {
      eventId: event.id,
      eventName: event.name,
      eventDate: event.startDate,
      error: error,
      status: 'failed',
    },
  };

  return await sendWebhook(webhookUrl, payload);
}

/**
 * Send job retry notification
 * @param {Object} event - The event being retried
 * @param {number} retryCount - Current retry count
 * @param {number} maxRetries - Maximum retries allowed
 * @param {string} webhookUrl - Webhook URL from config
 */
async function notifyJobRetry(event, retryCount, maxRetries, webhookUrl) {
  const payload = {
    event: 'job.retrying',
    timestamp: new Date().toISOString(),
    data: {
      eventId: event.id,
      eventName: event.name,
      eventDate: event.startDate,
      retryCount: retryCount,
      maxRetries: maxRetries,
      status: 'retrying',
    },
  };

  return await sendWebhook(webhookUrl, payload);
}

/**
 * Send permanent failure notification
 * @param {Object} event - The event that permanently failed
 * @param {string} error - Final error message
 * @param {number} retryCount - Number of retries attempted
 * @param {string} webhookUrl - Webhook URL from config
 */
async function notifyPermanentFailure(event, error, retryCount, webhookUrl) {
  const payload = {
    event: 'job.permanent_failure',
    timestamp: new Date().toISOString(),
    data: {
      eventId: event.id,
      eventName: event.name,
      eventDate: event.startDate,
      error: error,
      retriesAttempted: retryCount,
      status: 'permanently_failed',
    },
  };

  return await sendWebhook(webhookUrl, payload);
}

/**
 * Send service status notification
 * @param {string} status - Service status (started, stopped, error)
 * @param {Object} details - Additional details
 * @param {string} webhookUrl - Webhook URL from config
 */
async function notifyServiceStatus(status, details, webhookUrl) {
  const payload = {
    event: 'service.status',
    timestamp: new Date().toISOString(),
    data: {
      status: status,
      ...details,
    },
  };

  return await sendWebhook(webhookUrl, payload);
}

module.exports = {
  sendWebhook,
  notifyEventProcessed,
  notifyEventFailed,
  notifyJobRetry,
  notifyPermanentFailure,
  notifyServiceStatus,
};
