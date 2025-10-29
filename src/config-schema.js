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
   * The time in minutes before an event starts to perform the final query for attendees.
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
  outputFilename: Joi.string().default('attendees.pdf'),
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
  pdfLayout: Joi.object({
    logo: Joi.string().allow(null).default(null),
    fontSize: Joi.number().positive().default(10),
    columns: Joi.array().items(Joi.object({
      id: Joi.string().required(),
      header: Joi.string().required(),
      width: Joi.number().positive().required(),
    })).default([
      { "id": "name", "header": "Name", "width": 140 },
      { "id": "phone", "header": "Phone", "width": 100 },
      { "id": "signUpDate", "header": "Signed up", "width": 100 },
      { "id": "fee", "header": "Fee", "width": 60 },
      { "id": "status", "header": "Status", "width": 90 }
    ]),
    headerText: Joi.string().optional(),
    footerText: Joi.string().optional(),
    watermark: Joi.string().optional(),
  }).optional(),
  // Webhook notifications
  webhooks: Joi.object({
    onSuccess: Joi.alternatives().try(
      Joi.string().uri(),
      Joi.array().items(Joi.string().uri())
    ).optional(),
    onError: Joi.alternatives().try(
      Joi.string().uri(),
      Joi.array().items(Joi.string().uri())
    ).optional(),
    onWarning: Joi.alternatives().try(
      Joi.string().uri(),
      Joi.array().items(Joi.string().uri())
    ).optional(),
    onStart: Joi.alternatives().try(
      Joi.string().uri(),
      Joi.array().items(Joi.string().uri())
    ).optional(),
  }).optional(),
  // Multiple printer support
  printers: Joi.object().pattern(
    Joi.string(),
    Joi.alternatives().try(
      Joi.string(), // Printer name or email
      Joi.object({
        email: Joi.string().email(),
        name: Joi.string()
      })
    )
  ).optional(),
  // Custom event filters
  filters: Joi.object({
    minAttendees: Joi.number().integer().min(0).optional(),
    maxAttendees: Joi.number().integer().positive().optional(),
    excludeKeywords: Joi.array().items(Joi.string()).optional(),
    includeKeywords: Joi.array().items(Joi.string()).optional(),
    onlyPaidEvents: Joi.boolean().optional(),
    onlyFreeEvents: Joi.boolean().optional(),
  }).optional(),
  // Hot reload
  watchConfig: Joi.boolean().default(false),
});

module.exports = configSchema;