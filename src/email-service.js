/**
 * @fileoverview This module provides a function for sending emails with attachments using Nodemailer.
 * @module email-service
 */

const nodemailer = require('nodemailer');
const logger = require('./logger');
const { getCircuitBreaker } = require('./circuit-breaker');

/**
 * Sends an email with a file attachment.
 * @param {Object} transportOptions - The transport configuration object for Nodemailer.
 * @param {string} to - The recipient's email address.
 * @param {string} from - The sender's email address.
 * @param {string} subject - The subject of the email.
 * @param {string} body - The plain text body of the email.
 * @param {string} attachmentPath - The file path to the attachment.
 * @returns {Promise<Object>} A promise that resolves with the Nodemailer response object upon success.
 * @throws {Error} Throws an error if the email fails to send.
 */
async function sendEmailWithAttachment(transportOptions, to, from, subject, body, attachmentPath) {
  const emailCircuitBreaker = getCircuitBreaker('email');
  const transporter = nodemailer.createTransport(transportOptions);

  try {
    const info = await emailCircuitBreaker.execute(async () => {
      return await transporter.sendMail({
        from: from,
        to: to,
        subject: subject,
        text: body,
        attachments: [
          {
            path: attachmentPath,
          },
        ],
      });
    });

    logger.info('Email sent: ' + info.response);
    return info;
  } catch (error) {
    logger.error('Failed to send email:', error);
    throw error;
  }
}

module.exports = { sendEmailWithAttachment };
