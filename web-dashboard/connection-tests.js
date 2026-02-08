/**
 * Connection test helpers for the web dashboard.
 * Adapted from the original tray-app/connection-tests.js.
 * Pure Node.js — no Electron dependency.
 */

'use strict';

const path = require('path');

/**
 * Test API connection to Hello Club API
 * @returns {Promise<{success: boolean, message: string, details: object}>}
 */
async function testApiConnection() {
  const startTime = Date.now();

  try {
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

    if (!envConfig.API_KEY) {
      return {
        success: false,
        message: 'API_KEY not configured. Please add it in Config.',
        details: { error: 'Missing API_KEY' },
      };
    }

    process.env.API_KEY = envConfig.API_KEY;
    if (envConfig.API_BASE_URL) {
      process.env.API_BASE_URL = envConfig.API_BASE_URL;
    } else {
      delete process.env.API_BASE_URL;
    }

    // Clear cached api-client module so it picks up fresh env vars
    const apiClientPath = require.resolve('../src/core/api-client');
    delete require.cache[apiClientPath];

    const { getUpcomingEvents } = require('../src/core/api-client');
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
      details: { error: error.message, responseTime: duration, timestamp: new Date().toISOString() },
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

    const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
    const missingVars = requiredVars.filter((v) => !envConfig[v]);

    if (missingVars.length > 0) {
      return {
        success: false,
        message: `Missing SMTP configuration: ${missingVars.join(', ')}`,
        details: { error: 'Missing SMTP configuration', missingVars },
      };
    }

    process.env.SMTP_HOST = envConfig.SMTP_HOST;
    process.env.SMTP_PORT = envConfig.SMTP_PORT;
    process.env.SMTP_USER = envConfig.SMTP_USER;
    process.env.SMTP_PASS = envConfig.SMTP_PASS;
    if (envConfig.PRINTER_EMAIL) process.env.PRINTER_EMAIL = envConfig.PRINTER_EMAIL;
    if (envConfig.EMAIL_FROM) process.env.EMAIL_FROM = envConfig.EMAIL_FROM;

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: envConfig.SMTP_HOST,
      port: parseInt(envConfig.SMTP_PORT),
      secure: envConfig.SMTP_PORT == 465,
      auth: { user: envConfig.SMTP_USER, pass: (envConfig.SMTP_PASS || '').replace(/\s/g, '') },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });

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
      details: { error: error.message, responseTime: duration, timestamp: new Date().toISOString() },
    };
  }
}

function parseApiError(error) {
  const msg = error.message || '';
  if (msg.includes('401') || msg.toLowerCase().includes('unauthorized'))
    return 'API authentication failed. Check your API_KEY in Config.';
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ENETUNREACH/.test(msg))
    return 'Cannot reach Hello Club API. Check your internet connection.';
  if (msg.includes('timeout')) return 'API request timed out.';
  return `API connection failed: ${msg}`;
}

function parseSmtpError(error) {
  const msg = error.message || '';
  const code = error.code || '';
  if (msg.includes('Invalid login') || msg.includes('535') || code === 'EAUTH')
    return `SMTP authentication failed. For Gmail use an App Password. Details: ${msg}`;
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ENETUNREACH/.test(code))
    return `Cannot reach SMTP server. Check host and port. Details: ${msg}`;
  if (msg.includes('timeout') || code === 'ETIMEDOUT') return `SMTP connection timed out. Details: ${msg}`;
  return `SMTP connection failed: ${msg}`;
}

/**
 * Test local print connection (CUPS on Linux/Raspberry Pi)
 * Checks if CUPS is available and a printer is configured.
 * @returns {Promise<{success: boolean, message: string, details: object}>}
 */
async function testPrintConnection() {
  const startTime = Date.now();

  try {
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);

    // Check if lpstat command is available (CUPS installed)
    const { stdout } = await execFileAsync('lpstat', ['-p'], { timeout: 5000 });
    const duration = Date.now() - startTime;

    const printers = stdout
      .trim()
      .split('\n')
      .filter((line) => line.startsWith('printer'));

    if (printers.length === 0) {
      return {
        success: false,
        message: 'No printers found. Install a printer via CUPS (http://localhost:631).',
        details: { error: 'No printers configured', responseTime: duration },
      };
    }

    // Check default printer
    let defaultPrinter = process.env.PRINTER_NAME || null;
    if (!defaultPrinter) {
      try {
        const { stdout: defOut } = await execFileAsync('lpstat', ['-d'], { timeout: 5000 });
        const match = defOut.match(/system default destination:\s*(.+)/);
        if (match) defaultPrinter = match[1].trim();
      } catch (_e) {
        // No default set
      }
    }

    return {
      success: true,
      message: `CUPS connected (${duration}ms) — ${printers.length} printer(s) found`,
      details: {
        printerCount: printers.length,
        defaultPrinter: defaultPrinter || '(none set)',
        responseTime: duration,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const msg = error.message || '';

    if (msg.includes('ENOENT')) {
      return {
        success: false,
        message: 'CUPS not installed. Run: sudo apt install cups',
        details: { error: 'lpstat command not found', responseTime: duration },
      };
    }

    return {
      success: false,
      message: `Print test failed: ${msg}`,
      details: { error: msg, responseTime: duration, timestamp: new Date().toISOString() },
    };
  }
}

module.exports = { testApiConnection, testEmailConnection, testPrintConnection };
