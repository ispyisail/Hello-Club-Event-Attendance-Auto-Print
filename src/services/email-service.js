/**
 * @fileoverview This module provides a function for sending emails with attachments using Nodemailer.
 * @module email-service
 */

const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

// Allowed directory for attachments (project root)
const ALLOWED_ATTACHMENT_DIR = path.resolve(process.cwd());

/**
 * Validates that an attachment path is within the allowed directory.
 * Prevents path traversal attacks.
 * @param {string} filePath - The path to validate
 * @returns {string} The validated absolute path
 * @throws {Error} If the path is outside the allowed directory or doesn't exist
 */
function validateAttachmentPath(filePath) {
  const resolved = path.resolve(filePath);

  // Check path is within allowed directory
  if (!resolved.startsWith(ALLOWED_ATTACHMENT_DIR)) {
    throw new Error('Invalid attachment path: file must be within project directory');
  }

  // Check file exists
  if (!fs.existsSync(resolved)) {
    throw new Error('Attachment file does not exist');
  }

  // Check it's a file, not a directory
  const stats = fs.statSync(resolved);
  if (!stats.isFile()) {
    throw new Error('Attachment path must be a file');
  }

  return resolved;
}

/**
 * Validates email parameters to prevent header injection.
 * @param {string} to - Recipient email
 * @param {string} from - Sender email
 * @param {string} subject - Email subject
 * @param {string} body - Email body
 * @throws {Error} If any parameter contains invalid characters
 */
function validateEmailParams(to, from, subject, body) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const headerInjectionRegex = /[\r\n]/;

  if (!emailRegex.test(to)) {
    throw new Error('Invalid recipient email address');
  }

  if (from && !emailRegex.test(from)) {
    throw new Error('Invalid sender email address');
  }

  if (headerInjectionRegex.test(subject)) {
    throw new Error('Subject contains invalid characters');
  }

  if (body && headerInjectionRegex.test(body)) {
    throw new Error('Email body contains invalid characters (CRLF injection detected)');
  }
}

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
  // Validate email parameters to prevent header injection
  validateEmailParams(to, from, subject, body);

  // Validate attachment path to prevent path traversal
  const safePath = validateAttachmentPath(attachmentPath);

  const transporter = nodemailer.createTransport(transportOptions);

  try {
    const info = await transporter.sendMail({
      from: from,
      to: to,
      subject: subject,
      text: body,
      attachments: [
        {
          path: safePath,
        },
      ],
    });

    logger.info('Email sent: ' + info.response);
    return info;
  } catch (error) {
    logger.error('Failed to send email:', error);
    throw error;
  }
}

module.exports = { sendEmailWithAttachment };
