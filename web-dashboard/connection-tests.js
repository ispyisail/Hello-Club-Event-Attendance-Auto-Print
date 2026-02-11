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

/**
 * Test print with real event data
 * Fetches an upcoming event from the filtered list and prints it
 * @returns {Promise<{success: boolean, message: string, details: object}>}
 */
async function testPrintWithEvent() {
  const startTime = Date.now();

  try {
    const fs = require('fs');
    const path = require('path');
    const APP_DIR = path.resolve(__dirname, '..');

    // Load config
    const config = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'config.json'), 'utf8'));

    // Load env vars
    const envPath = path.join(APP_DIR, '.env');
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
        message: 'API_KEY not configured',
        details: { error: 'Missing API_KEY' },
      };
    }

    // Set env vars
    process.env.API_KEY = envConfig.API_KEY;
    if (envConfig.API_BASE_URL) process.env.API_BASE_URL = envConfig.API_BASE_URL;

    // Clear cached modules
    delete require.cache[require.resolve('../src/core/api-client')];
    delete require.cache[require.resolve('../src/services/pdf-generator')];
    delete require.cache[require.resolve('../src/services/cups-printer')];

    const { getUpcomingEvents, getAllAttendees } = require('../src/core/api-client');
    const PdfGenerator = require('../src/services/pdf-generator');
    const { printPdf } = require('../src/services/cups-printer');

    // Get upcoming events
    const allEvents = await getUpcomingEvents(config.fetchWindowHours || 168);

    // Filter by categories
    const allowedCategories = config.categories || [];
    const filteredEvents =
      allowedCategories.length > 0
        ? allEvents.filter(
            (e) => Array.isArray(e.categories) && e.categories.some((cat) => allowedCategories.includes(cat.name))
          )
        : allEvents;

    if (filteredEvents.length === 0) {
      return {
        success: false,
        message: 'No upcoming events found in your filtered categories',
        details: { totalEvents: allEvents.length, filteredEvents: 0 },
      };
    }

    // Find the first event with attendees
    let event = null;
    let attendees = null;

    for (const evt of filteredEvents) {
      const evtAttendees = await getAllAttendees(evt.id);
      if (evtAttendees && evtAttendees.length > 0) {
        event = evt;
        attendees = evtAttendees;
        break;
      }
    }

    if (!event || !attendees) {
      return {
        success: false,
        message: `No events with attendees found in your filtered categories. Checked ${filteredEvents.length} event(s).`,
        details: {
          totalEvents: allEvents.length,
          filteredEvents: filteredEvents.length,
          eventsChecked: filteredEvents.map((e) => ({ name: e.name, id: e.id })),
        },
      };
    }

    // Generate PDF
    const outputFilename = 'test-print.pdf';
    const pdfLayout = config.pdfLayout || {};
    const generator = new PdfGenerator(event, attendees, pdfLayout);
    generator.generate(outputFilename);

    // Wait for PDF to be written
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Print the PDF based on printMode
    const printMode = config.printMode || 'email';
    console.log('Print mode:', printMode);

    if (printMode === 'local') {
      // Local CUPS printing
      if (envConfig.PRINTER_NAME) {
        process.env.PRINTER_NAME = envConfig.PRINTER_NAME;
      }
      await printPdf(outputFilename);
    } else {
      // Email printing - this will be sent to the printer email, notification email is separate
      console.log('Skipping direct print (email mode) - will send notification email only');
    }

    // Send notification email if configured
    let emailSent = false;
    console.log('Checking notification email...', {
      hasNotificationEmail: !!envConfig.NOTIFICATION_EMAIL,
      notificationEmail: envConfig.NOTIFICATION_EMAIL,
      hasSmtp: !!(envConfig.SMTP_HOST && envConfig.SMTP_USER && envConfig.SMTP_PASS),
    });
    if (envConfig.NOTIFICATION_EMAIL && envConfig.SMTP_HOST && envConfig.SMTP_USER && envConfig.SMTP_PASS) {
      console.log('Sending notification email to:', envConfig.NOTIFICATION_EMAIL);
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: envConfig.SMTP_HOST,
          port: parseInt(envConfig.SMTP_PORT) || 587,
          secure: parseInt(envConfig.SMTP_PORT) === 465,
          auth: {
            user: envConfig.SMTP_USER,
            pass: envConfig.SMTP_PASS.replace(/\s/g, ''),
          },
        });

        const mailOptions = {
          from: envConfig.EMAIL_FROM || envConfig.SMTP_USER,
          to: envConfig.NOTIFICATION_EMAIL,
          subject: `Print Notification: ${event.name}`,
          text: `A print job was sent for "${event.name}" with ${attendees.length} attendee(s).\n\nSee attached PDF.`,
          attachments: [
            {
              filename: outputFilename,
              path: require('path').resolve(process.cwd(), outputFilename),
            },
          ],
        };
        console.log('Sending email with options:', { ...mailOptions, attachments: '[PDF]' });
        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', result.messageId);
        emailSent = true;
      } catch (emailError) {
        // Don't fail the whole operation if email fails
        console.error('Failed to send notification email:', emailError);
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: true,
      message: `Test print sent (${duration}ms): "${event.name}" with ${attendees.length} attendee(s)${emailSent ? ' • Notification email sent' : ''}`,
      details: {
        eventName: event.name,
        eventDate: event.startDate,
        attendeeCount: attendees.length,
        pdfFile: outputFilename,
        notificationEmailSent: emailSent,
        responseTime: duration,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      message: `Test print failed: ${error.message}`,
      details: { error: error.message, responseTime: duration, timestamp: new Date().toISOString() },
    };
  }
}

/**
 * Simulate the automated event trigger workflow
 * This mimics what the service scheduler does automatically
 * @returns {Promise<{success: boolean, message: string, details: object}>}
 */
async function simulateEventTrigger() {
  const startTime = Date.now();

  try {
    const fs = require('fs');
    const path = require('path');
    const APP_DIR = path.resolve(__dirname, '..');

    console.log('🎬 SIMULATING EVENT TRIGGER - Starting automated workflow test...');

    // Load config and env
    const config = JSON.parse(fs.readFileSync(path.join(APP_DIR, 'config.json'), 'utf8'));
    const envPath = path.join(APP_DIR, '.env');
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
      return { success: false, message: 'API_KEY not configured', details: { error: 'Missing API_KEY' } };
    }

    // Set env vars
    process.env.API_KEY = envConfig.API_KEY;
    if (envConfig.API_BASE_URL) process.env.API_BASE_URL = envConfig.API_BASE_URL;

    // Clear cached modules
    delete require.cache[require.resolve('../src/core/api-client')];
    delete require.cache[require.resolve('../src/services/pdf-generator')];
    delete require.cache[require.resolve('../src/services/cups-printer')];

    console.log('📡 Fetching upcoming events from Hello Club API...');
    const { getUpcomingEvents, getAllAttendees } = require('../src/core/api-client');
    const allEvents = await getUpcomingEvents(config.fetchWindowHours || 168);
    console.log(`✅ Found ${allEvents.length} total events`);

    // Filter by categories (same as service does)
    const allowedCategories = config.categories || [];
    const filteredEvents =
      allowedCategories.length > 0
        ? allEvents.filter(
            (e) => Array.isArray(e.categories) && e.categories.some((cat) => allowedCategories.includes(cat.name))
          )
        : allEvents;

    console.log(`🔍 Filtered to ${filteredEvents.length} events matching categories:`, allowedCategories);

    if (filteredEvents.length === 0) {
      return {
        success: false,
        message: 'No upcoming events found in filtered categories',
        details: { totalEvents: allEvents.length, categories: allowedCategories },
      };
    }

    // Find first event with attendees
    let event = null;
    let attendees = null;
    for (const evt of filteredEvents) {
      console.log(`🔎 Checking event: "${evt.name}" (${evt.startDate})`);
      const evtAttendees = await getAllAttendees(evt.id);
      console.log(`   → ${evtAttendees.length} attendees found`);
      if (evtAttendees && evtAttendees.length > 0) {
        event = evt;
        attendees = evtAttendees;
        break;
      }
    }

    if (!event || !attendees) {
      return {
        success: false,
        message: `No events with attendees. Checked ${filteredEvents.length} event(s).`,
        details: { totalEvents: allEvents.length, filteredEvents: filteredEvents.length },
      };
    }

    console.log(`✨ Selected event: "${event.name}"`);
    console.log(`👥 Attendees: ${attendees.length}`);

    // Generate PDF (same as service does)
    console.log('📄 Generating PDF...');
    const outputFilename = config.outputFilename || 'attendees.pdf';
    const PdfGenerator = require('../src/services/pdf-generator');
    const pdfLayout = config.pdfLayout || {};
    const generator = new PdfGenerator(event, attendees, pdfLayout);
    generator.generate(outputFilename);
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log(`✅ PDF generated: ${outputFilename}`);

    // Print based on mode (same as service does)
    const printMode = config.printMode || 'email';
    console.log(`🖨️  Print mode: ${printMode}`);

    let printMethod = '';
    if (printMode === 'local') {
      // Local CUPS printing
      if (envConfig.PRINTER_NAME) {
        process.env.PRINTER_NAME = envConfig.PRINTER_NAME;
      }
      const { printPdf } = require('../src/services/cups-printer');
      await printPdf(outputFilename);
      console.log('✅ Sent to CUPS printer');
      printMethod = 'CUPS';
    } else if (printMode === 'email') {
      // Email printing
      if (envConfig.SMTP_HOST && envConfig.SMTP_USER && envConfig.SMTP_PASS && envConfig.PRINTER_EMAIL) {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: envConfig.SMTP_HOST,
          port: parseInt(envConfig.SMTP_PORT) || 587,
          secure: parseInt(envConfig.SMTP_PORT) === 465,
          auth: { user: envConfig.SMTP_USER, pass: envConfig.SMTP_PASS.replace(/\s/g, '') },
        });

        await transporter.sendMail({
          from: envConfig.EMAIL_FROM || envConfig.SMTP_USER,
          to: envConfig.PRINTER_EMAIL,
          subject: `Print: ${event.name}`,
          text: `Attendance list for "${event.name}"`,
          attachments: [{ filename: outputFilename, path: path.resolve(process.cwd(), outputFilename) }],
        });
        console.log(`✅ Sent to printer email: ${envConfig.PRINTER_EMAIL}`);
        printMethod = 'Email';
      } else {
        console.log('⚠️  Email printing configured but missing credentials');
      }
    }

    // Send notification email if configured
    let notificationSent = false;
    if (envConfig.NOTIFICATION_EMAIL && envConfig.SMTP_HOST && envConfig.SMTP_USER && envConfig.SMTP_PASS) {
      console.log(`📧 Sending notification to: ${envConfig.NOTIFICATION_EMAIL}`);
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: envConfig.SMTP_HOST,
          port: parseInt(envConfig.SMTP_PORT) || 587,
          secure: parseInt(envConfig.SMTP_PORT) === 465,
          auth: { user: envConfig.SMTP_USER, pass: envConfig.SMTP_PASS.replace(/\s/g, '') },
        });

        await transporter.sendMail({
          from: envConfig.EMAIL_FROM || envConfig.SMTP_USER,
          to: envConfig.NOTIFICATION_EMAIL,
          subject: `[SIMULATION] Print Notification: ${event.name}`,
          text: `This is a SIMULATED event trigger.\n\nEvent: "${event.name}"\nAttendees: ${attendees.length}\nPrint Method: ${printMethod}\n\nSee attached PDF.`,
          attachments: [{ filename: outputFilename, path: path.resolve(process.cwd(), outputFilename) }],
        });
        console.log('✅ Notification email sent');
        notificationSent = true;
      } catch (emailError) {
        console.error('❌ Notification email failed:', emailError.message);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`🎉 Simulation complete! (${duration}ms)`);

    return {
      success: true,
      message: `✅ Simulation complete (${duration}ms): "${event.name}" • ${attendees.length} attendees • ${printMethod} printing${notificationSent ? ' • Notification sent' : ''}`,
      details: {
        eventName: event.name,
        eventDate: event.startDate,
        attendeeCount: attendees.length,
        printMode: printMethod,
        notificationSent,
        responseTime: duration,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Simulation failed:', error);
    return {
      success: false,
      message: `Simulation failed: ${error.message}`,
      details: {
        error: error.message,
        stack: error.stack,
        responseTime: duration,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

module.exports = {
  testApiConnection,
  testEmailConnection,
  testPrintConnection,
  testPrintWithEvent,
  simulateEventTrigger,
};
