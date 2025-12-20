const path = require('path');
const dotenv = require('dotenv');

/**
 * Test API connection to Hello Club API
 * @returns {Promise<{success: boolean, message: string, details: object}>}
 */
async function testApiConnection() {
  const startTime = Date.now();

  try {
    // Load environment variables
    const envPath = path.join(__dirname, '..', '.env');
    dotenv.config({ path: envPath });

    // Check if API_KEY is set
    if (!process.env.API_KEY) {
      return {
        success: false,
        message: 'API_KEY not configured. Please add it in Settings.',
        details: { error: 'Missing API_KEY' }
      };
    }

    // Import API client
    const { getUpcomingEvents } = require('../src/core/api-client');

    // Make minimal API call (1 hour window)
    const events = await getUpcomingEvents(1);
    const duration = Date.now() - startTime;

    return {
      success: true,
      message: `API connected successfully (${duration}ms)`,
      details: {
        eventsFound: events ? events.length : 0,
        responseTime: duration,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      message: parseApiError(error),
      details: {
        error: error.message,
        responseTime: duration,
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Test email/SMTP connection
 * @returns {Promise<{success: boolean, message: string, details: object}>}
 */
async function testEmailConnection() {
  const startTime = Date.now();

  try {
    // Load environment variables
    const envPath = path.join(__dirname, '..', '.env');
    dotenv.config({ path: envPath });

    // Check if required SMTP variables are set
    const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
      return {
        success: false,
        message: `Missing SMTP configuration: ${missingVars.join(', ')}. Please add them in Settings.`,
        details: { error: 'Missing SMTP configuration', missingVars }
      };
    }

    // Import nodemailer
    const nodemailer = require('nodemailer');

    // Create transporter with timeout
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT == 465,
      auth: {
        user: process.env.SMTP_USER,
        // Strip spaces from password (Google App passwords may have spaces)
        pass: (process.env.SMTP_PASS || '').replace(/\s/g, '')
      },
      connectionTimeout: 10000, // 10 second timeout
      greetingTimeout: 10000
    });

    // Verify connection (does not send email)
    await transporter.verify();
    const duration = Date.now() - startTime;

    return {
      success: true,
      message: `SMTP connected successfully (${duration}ms)`,
      details: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        responseTime: duration,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      message: parseSmtpError(error),
      details: {
        error: error.message,
        responseTime: duration,
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Parse API error into user-friendly message
 * @param {Error} error - The error object
 * @returns {string} User-friendly error message
 */
function parseApiError(error) {
  const errorMsg = error.message || '';

  // Check for 401 Unauthorized
  if (errorMsg.includes('401') || errorMsg.toLowerCase().includes('unauthorized')) {
    return 'API authentication failed. Check your API_KEY in Settings.';
  }

  // Check for network errors
  if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('ECONNREFUSED') ||
      errorMsg.includes('ETIMEDOUT') || errorMsg.includes('ENETUNREACH')) {
    return 'Cannot reach Hello Club API. Check your internet connection.';
  }

  // Check for timeout
  if (errorMsg.includes('timeout')) {
    return 'API request timed out. Check your internet connection.';
  }

  // Generic error
  return `API connection failed: ${errorMsg}`;
}

/**
 * Parse SMTP error into user-friendly message
 * @param {Error} error - The error object
 * @returns {string} User-friendly error message
 */
function parseSmtpError(error) {
  const errorMsg = error.message || '';
  const errorCode = error.code || '';

  // Check for authentication errors
  if (errorMsg.includes('Invalid login') || errorMsg.includes('authentication failed') ||
      errorMsg.includes('535') || errorCode === 'EAUTH') {
    return 'SMTP authentication failed. Check your credentials in Settings.';
  }

  // Check for network errors
  if (errorCode === 'ENOTFOUND' || errorCode === 'ECONNREFUSED' ||
      errorCode === 'ETIMEDOUT' || errorCode === 'ENETUNREACH') {
    return 'Cannot reach SMTP server. Check host and port in Settings.';
  }

  // Check for connection errors
  if (errorMsg.includes('connect ECONNREFUSED')) {
    return 'SMTP server refused connection. Check host and port in Settings.';
  }

  // Check for timeout
  if (errorMsg.includes('timeout') || errorCode === 'ETIMEDOUT') {
    return 'SMTP connection timed out. Check your internet connection.';
  }

  // Generic error
  return `SMTP connection failed: ${errorMsg}`;
}

module.exports = {
  testApiConnection,
  testEmailConnection
};
