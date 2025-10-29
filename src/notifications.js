/**
 * @fileoverview Webhook and notification system for alerting on events.
 * @module notifications
 */

const axios = require('axios');
const logger = require('./logger');

/**
 * Sends a webhook notification.
 * @param {string} webhookUrl - The webhook URL to send to.
 * @param {Object} payload - The payload to send.
 * @returns {Promise<boolean>} Whether the webhook succeeded.
 */
async function sendWebhook(webhookUrl, payload) {
  try {
    await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    logger.info(`Webhook sent successfully to ${webhookUrl}`);
    return true;
  } catch (error) {
    logger.error(`Failed to send webhook to ${webhookUrl}:`, error.message);
    return false;
  }
}

/**
 * Sends a Slack notification.
 * @param {string} webhookUrl - Slack webhook URL.
 * @param {string} message - Message to send.
 * @param {string} [color='good'] - Message color (good, warning, danger).
 * @returns {Promise<boolean>} Whether the notification succeeded.
 */
async function sendSlackNotification(webhookUrl, message, color = 'good') {
  const payload = {
    attachments: [{
      color: color,
      text: message,
      ts: Math.floor(Date.now() / 1000)
    }]
  };
  return sendWebhook(webhookUrl, payload);
}

/**
 * Sends a Discord notification.
 * @param {string} webhookUrl - Discord webhook URL.
 * @param {string} message - Message to send.
 * @param {string} [username='Hello Club Bot'] - Bot username.
 * @returns {Promise<boolean>} Whether the notification succeeded.
 */
async function sendDiscordNotification(webhookUrl, message, username = 'Hello Club Bot') {
  const payload = {
    username: username,
    content: message,
    embeds: [{
      description: message,
      timestamp: new Date().toISOString()
    }]
  };
  return sendWebhook(webhookUrl, payload);
}

/**
 * Sends notification based on configuration.
 * @param {Object} config - Notification configuration.
 * @param {string} event - Event type (success, error, warning).
 * @param {string} message - Message to send.
 * @param {Object} [data] - Additional data to include.
 */
async function notify(config, event, message, data = {}) {
  if (!config || !config.webhooks) {
    return;
  }

  const webhooks = config.webhooks;
  const eventConfig = webhooks[event];

  if (!eventConfig) {
    return;
  }

  // Prepare payload
  const payload = {
    event: event,
    message: message,
    timestamp: new Date().toISOString(),
    data: data
  };

  // Send to all configured webhooks for this event
  if (Array.isArray(eventConfig)) {
    for (const webhook of eventConfig) {
      await sendNotification(webhook, payload, event);
    }
  } else if (typeof eventConfig === 'string') {
    await sendNotification(eventConfig, payload, event);
  }
}

/**
 * Sends notification to a single webhook.
 * @param {string|Object} webhook - Webhook URL or configuration.
 * @param {Object} payload - Payload to send.
 * @param {string} event - Event type.
 */
async function sendNotification(webhook, payload, event) {
  if (typeof webhook === 'string') {
    // Detect webhook type by URL
    if (webhook.includes('slack.com')) {
      const color = event === 'error' ? 'danger' : event === 'warning' ? 'warning' : 'good';
      await sendSlackNotification(webhook, payload.message, color);
    } else if (webhook.includes('discord.com')) {
      await sendDiscordNotification(webhook, payload.message);
    } else {
      await sendWebhook(webhook, payload);
    }
  } else if (webhook.url) {
    // Custom webhook configuration
    await sendWebhook(webhook.url, payload);
  }
}

/**
 * Notifies about a successful event processing.
 * @param {Object} config - Application configuration.
 * @param {Object} event - Event that was processed.
 * @param {number} attendeeCount - Number of attendees.
 */
async function notifyEventProcessed(config, event, attendeeCount) {
  await notify(
    config,
    'onSuccess',
    `✓ Event "${event.name}" processed successfully with ${attendeeCount} attendees.`,
    { eventId: event.id, eventName: event.name, attendeeCount }
  );
}

/**
 * Notifies about an error.
 * @param {Object} config - Application configuration.
 * @param {string} operation - Operation that failed.
 * @param {Error} error - Error object.
 */
async function notifyError(config, operation, error) {
  await notify(
    config,
    'onError',
    `✗ Error in ${operation}: ${error.message}`,
    { operation, error: error.message, stack: error.stack }
  );
}

/**
 * Notifies about service startup.
 * @param {Object} config - Application configuration.
 */
async function notifyServiceStart(config) {
  await notify(
    config,
    'onStart',
    `🚀 Hello Club service started`,
    { startTime: new Date().toISOString() }
  );
}

/**
 * Notifies about service health issues.
 * @param {Object} config - Application configuration.
 * @param {Object} healthCheck - Health check results.
 */
async function notifyHealthIssue(config, healthCheck) {
  if (healthCheck.overall !== 'HEALTHY') {
    await notify(
      config,
      'onWarning',
      `⚠️ Service health: ${healthCheck.overall}`,
      { healthCheck }
    );
  }
}

module.exports = {
  sendWebhook,
  sendSlackNotification,
  sendDiscordNotification,
  notify,
  notifyEventProcessed,
  notifyError,
  notifyServiceStart,
  notifyHealthIssue
};
