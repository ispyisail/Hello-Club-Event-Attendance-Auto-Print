const nodemailer = require('nodemailer');
const logger = require('./logger');

async function sendEmailWithAttachment(transportOptions, to, from, subject, body, attachmentPath) {
  const transporter = nodemailer.createTransport(transportOptions);

  try {
    const info = await transporter.sendMail({
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

    logger.info('Email sent: ' + info.response);
    return info;
  } catch (error) {
    logger.error('Failed to send email:', error);
    throw error;
  }
}

module.exports = { sendEmailWithAttachment };
