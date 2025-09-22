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
   * The time window in hours to look ahead for upcoming events.
   * @type {number}
   */
  fetchWindowHours: Joi.number().integer().positive().default(24),
  outputFilename: Joi.string().default('attendees.pdf'),
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
  }).optional(),
});

module.exports = configSchema;
