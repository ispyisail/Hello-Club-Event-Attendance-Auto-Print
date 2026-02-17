/**
 * @fileoverview This module defines the Joi schema for the application's configuration file (config.json).
 * It ensures that the configuration is valid and provides default values for optional settings.
 * @module config-schema
 */

const Joi = require('joi');

/**
 * The Joi schema for validating the `config.json` file.
 * @type {Joi.ObjectSchema}
 */
const configSchema = Joi.object({
  /**
   * A list of event category names to process.
   * @type {Array<string>}
   */
  categories: Joi.array().items(Joi.string()).default([]),
  /**
   * The time in minutes before an event starts to fetch the latest attendee list, generate the PDF, and print it.
   * For example, 5 means the PDF will be ready 5 minutes before the event begins.
   * @type {number}
   */
  preEventQueryMinutes: Joi.number().integer().min(1).default(5),
  /**
   * How often the service runs to fetch new events, in hours.
   * @type {number}
   */
  serviceRunIntervalHours: Joi.number().integer().positive().default(1),
  /**
   * The time window in hours to look ahead for upcoming events.
   * @type {number}
   */
  fetchWindowHours: Joi.number().integer().positive().default(24),
  outputFilename: Joi.string()
    .default('attendees.pdf')
    .custom((value, helpers) => {
      const path = require('path');
      const basename = path.basename(value);
      if (basename !== value || value.includes('..')) {
        return helpers.error('any.invalid', {
          message: 'outputFilename must not contain directory paths or traversal sequences (e.g., ../)',
        });
      }
      if (!basename.toLowerCase().endsWith('.pdf')) {
        return helpers.error('any.invalid', {
          message: 'outputFilename must end with .pdf extension',
        });
      }
      return value;
    }, 'Path traversal validation'),
  printMode: Joi.string().valid('local', 'email').default('email'),
  email: Joi.object({
    to: Joi.string().email().required(),
    from: Joi.string().email().required(),
    transport: Joi.object({
      host: Joi.string().required(),
      port: Joi.number().integer().positive().required(),
      secure: Joi.boolean().required(),
      auth: Joi.object({
        user: Joi.string().required(),
        pass: Joi.string().required(),
      }).required(),
    }).required(),
  }).optional(),
  /**
   * Retry configuration for failed event processing
   * @type {Object}
   */
  retry: Joi.object({
    maxAttempts: Joi.number().integer().min(1).max(10).default(3),
    baseDelayMinutes: Joi.number().integer().min(1).max(60).default(5),
  })
    .optional()
    .default({ maxAttempts: 3, baseDelayMinutes: 5 }),
  /**
   * API client configuration
   * @type {Object}
   */
  api: Joi.object({
    paginationLimit: Joi.number().integer().min(10).max(500).default(100),
    paginationDelayMs: Joi.number().integer().min(100).max(5000).default(1000),
    cacheFreshSeconds: Joi.number().integer().min(30).max(3600).default(120),
    cacheStaleSeconds: Joi.number().integer().min(300).max(86400).default(1800),
  })
    .optional()
    .default({
      paginationLimit: 100,
      paginationDelayMs: 1000,
      cacheFreshSeconds: 120,
      cacheStaleSeconds: 1800,
    }),
  /**
   * Logging configuration
   * @type {Object}
   */
  logging: Joi.object({
    maxFileSizeBytes: Joi.number().integer().min(1048576).max(52428800).default(5242880),
    maxFiles: Joi.number().integer().min(1).max(20).default(5),
  })
    .optional()
    .default({ maxFileSizeBytes: 5242880, maxFiles: 5 }),
  /**
   * Database configuration
   * @type {Object}
   */
  database: Joi.object({
    cleanupDays: Joi.number().integer().min(1).max(365).default(30),
  })
    .optional()
    .default({ cleanupDays: 30 }),
  pdfLayout: Joi.object({
    logo: Joi.string().allow(null).default(null),
    fontSize: Joi.number().positive().default(10),
    columns: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().required(),
          header: Joi.string().required(),
          width: Joi.number().positive().required(),
        })
      )
      .default([
        { id: 'name', header: 'Name', width: 140 },
        { id: 'phone', header: 'Phone', width: 100 },
        { id: 'signUpDate', header: 'Signed up', width: 100 },
        { id: 'fee', header: 'Fee', width: 60 },
        { id: 'status', header: 'Status', width: 90 },
      ]),
  }).optional(),
  /**
   * Service runtime tunables
   * @type {Object}
   */
  service: Joi.object({
    gracePeriodMinutes: Joi.number().integer().min(0).max(480).default(60),
    heartbeatIntervalMinutes: Joi.number().integer().min(1).max(60).default(15),
    healthCheckIntervalSeconds: Joi.number().integer().min(10).max(300).default(60),
    memoryHeapWarningMB: Joi.number().integer().min(100).max(2000).default(300),
    memoryRssWarningMB: Joi.number().integer().min(100).max(4000).default(400),
  })
    .optional()
    .default({
      gracePeriodMinutes: 60,
      heartbeatIntervalMinutes: 15,
      healthCheckIntervalSeconds: 60,
      memoryHeapWarningMB: 300,
      memoryRssWarningMB: 400,
    }),
  /**
   * Webhook configuration for event notifications
   * @type {Object}
   */
  webhook: Joi.object({
    url: Joi.string().uri().allow(null, '').default(null),
    enabled: Joi.boolean().default(false),
    timeoutMs: Joi.number().integer().min(1000).max(60000).default(10000),
    maxRetries: Joi.number().integer().min(0).max(5).default(2),
    retryDelayMs: Joi.number().integer().min(500).max(10000).default(2000),
  })
    .optional()
    .default({
      url: null,
      enabled: false,
      timeoutMs: 10000,
      maxRetries: 2,
      retryDelayMs: 2000,
    }),
});

module.exports = configSchema;
