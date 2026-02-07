const path = require('path');

/**
 * Test API connection to Hello Club API
 * @returns {Promise<{success: boolean, message: string, details: object}>}
 */
async function testApiConnection() {
  const startTime = Date.now();

  try {
    // Load environment variables directly from .env file (not from process.env which may be stale)
    const fs = require('fs');
    const envPath = path.join(__dirname, '..', '.env');

    const envConfig = {};
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach((line) => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
          const match = line.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            value = value.replace(/^["']|["']$/g, '');
            envConfig[key] = value;
          }
        }
      });
    }

    // Check if API_KEY is set
    if (!envConfig.API_KEY) {
      return {
        success: false,
        message: 'API_KEY not configured. Please add it in Settings.',
        details: { error: 'Missing API_KEY' },
      };
    }

    // Set environment variables for API client
    process.env.API_KEY = envConfig.API_KEY;
    process.env.API_BASE_URL = envConfig.API_BASE_URL;

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
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      message: parseApiError(error),
      details: {
        error: error.message,
        responseTime: duration,
        timestamp: new Date().toISOString(),
      },
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
    // Load environment variables directly from .env file (not from process.env which may be stale)
    const fs = require('fs');
    const envPath = path.join(__dirname, '..', '.env');

    const envConfig = {};
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach((line) => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
          const match = line.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            value = value.replace(/^["']|["']$/g, '');
            envConfig[key] = value;
          }
        }
      });
    }

    // Check if required SMTP variables are set
    const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
    const missingVars = requiredVars.filter((varName) => !envConfig[varName]);

    if (missingVars.length > 0) {
      // Debug: show what we actually found in the .env file
      const debugInfo = {
        error: 'Missing SMTP configuration',
        missingVars,
        foundVars: Object.keys(envConfig),
        envFileExists: fs.existsSync(envPath),
      };
      return {
        success: false,
        message: `Missing SMTP configuration: ${missingVars.join(', ')}. Please add them in Settings.`,
        details: debugInfo,
      };
    }

    // Import nodemailer
    const nodemailer = require('nodemailer');

    // Create transporter with timeout
    const transporter = nodemailer.createTransport({
      host: envConfig.SMTP_HOST,
      port: parseInt(envConfig.SMTP_PORT),
      secure: envConfig.SMTP_PORT == 465,
      auth: {
        user: envConfig.SMTP_USER,
        // Strip spaces from password (Google App passwords may have spaces)
        pass: (envConfig.SMTP_PASS || '').replace(/\s/g, ''),
      },
      connectionTimeout: 10000, // 10 second timeout
      greetingTimeout: 10000,
    });

    // Verify connection (does not send email)
    await transporter.verify();
    const duration = Date.now() - startTime;

    return {
      success: true,
      message: `SMTP connected successfully (${duration}ms)`,
      details: {
        host: envConfig.SMTP_HOST,
        port: envConfig.SMTP_PORT,
        user: envConfig.SMTP_USER,
        responseTime: duration,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      message: parseSmtpError(error),
      details: {
        error: error.message,
        responseTime: duration,
        timestamp: new Date().toISOString(),
      },
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
  if (
    errorMsg.includes('ENOTFOUND') ||
    errorMsg.includes('ECONNREFUSED') ||
    errorMsg.includes('ETIMEDOUT') ||
    errorMsg.includes('ENETUNREACH')
  ) {
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
  if (
    errorMsg.includes('Invalid login') ||
    errorMsg.includes('authentication failed') ||
    errorMsg.includes('535') ||
    errorCode === 'EAUTH'
  ) {
    return (
      'SMTP authentication failed. For Gmail: ensure you use an App Password (not your regular password), and 2FA is enabled. Details: ' +
      errorMsg
    );
  }

  // Check for network errors
  if (
    errorCode === 'ENOTFOUND' ||
    errorCode === 'ECONNREFUSED' ||
    errorCode === 'ETIMEDOUT' ||
    errorCode === 'ENETUNREACH'
  ) {
    return 'Cannot reach SMTP server. Check host (smtp.gmail.com) and port (587) in Settings. Details: ' + errorMsg;
  }

  // Check for connection errors
  if (errorMsg.includes('connect ECONNREFUSED')) {
    return 'SMTP server refused connection. Check host and port in Settings. Details: ' + errorMsg;
  }

  // Check for timeout
  if (errorMsg.includes('timeout') || errorCode === 'ETIMEDOUT') {
    return 'SMTP connection timed out. Check your internet connection. Details: ' + errorMsg;
  }

  // Generic error
  return `SMTP connection failed: ${errorMsg}`;
}

module.exports = {
  testApiConnection,
  testEmailConnection,
};
