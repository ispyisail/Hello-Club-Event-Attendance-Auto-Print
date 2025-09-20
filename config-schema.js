const Joi = require('joi');

const configSchema = Joi.object({
  categories: Joi.array().items(Joi.string()).default([]),
  printWindowMinutes: Joi.number().integer().positive().default(15),
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
