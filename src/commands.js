/**
 * @fileoverview Additional commands for database management, testing, and monitoring.
 * @module commands
 */

const logger = require('./logger');
const { getDb } = require('./database');
const { getEventDetails, getAllAttendees } = require('./api-client');
const { print } = require('pdf-to-printer');
const { sendEmailWithAttachment } = require('./email-service');
const PdfGenerator = require('./pdf-generator');
const fs = require('fs');
const path = require('path');
const { EVENT_STATUS } = require('./constants');

/**
 * Lists events from the database with optional status filter.
 * @param {Object} options - Command options.
 * @param {string} [options.status] - Filter by status ('pending', 'processed', or 'all').
 * @param {number} [options.limit] - Maximum number of events to display.
 */
function listEvents(options = {}) {
  try {
    const db = getDb();
    const { status = 'all', limit = 50 } = options;

    let query = 'SELECT * FROM events';
    const params = [];

    if (status && status !== 'all') {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY startDate DESC LIMIT ?';
    params.push(limit);

    const stmt = db.prepare(query);
    const events = stmt.all(...params);

    if (events.length === 0) {
      console.log(`\nNo events found${status !== 'all' ? ` with status '${status}'` : ''

}.\n`);
      return;
    }

    console.log(`\n${'='.repeat(100)}`);
    console.log(`Found ${events.length} event(s)${status !== 'all' ? ` with status '${status}'` : ''}:`);
    console.log('='.repeat(100));
    console.log(`${'ID'.padEnd(12)} | ${'Name'.padEnd(40)} | ${'Start Date'.padEnd(25)} | Status`);
    console.log('-'.repeat(100));

    events.forEach(event => {
      const startDate = new Date(event.startDate).toLocaleString();
      console.log(`${event.id.padEnd(12)} | ${event.name.substring(0, 40).padEnd(40)} | ${startDate.padEnd(25)} | ${event.status}`);
    });

    console.log('='.repeat(100));
    console.log(`\nTotal: ${events.length} event(s)\n`);
  } catch (error) {
    logger.error('Failed to list events:', error.message);
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Cleans up old processed events from the database.
 * @param {Object} options - Command options.
 * @param {number} [options.days=30] - Delete events processed more than this many days ago.
 * @param {boolean} [options.dryRun=false] - If true, only show what would be deleted.
 */
function cleanupDatabase(options = {}) {
  try {
    const db = getDb();
    const { days = 30, dryRun = false } = options;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const countStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM events
      WHERE status = ? AND startDate < ?
    `);
    const { count } = countStmt.get(EVENT_STATUS.PROCESSED, cutoffDate.toISOString());

    console.log(`\nDatabase Cleanup ${dryRun ? '(DRY RUN)' : ''}`);
    console.log('='.repeat(50));
    console.log(`Cutoff date: ${cutoffDate.toLocaleDateString()}`);
    console.log(`Events to delete: ${count}`);

    if (count === 0) {
      console.log('No events to clean up.\n');
      return;
    }

    if (dryRun) {
      const eventsStmt = db.prepare(`
        SELECT id, name, startDate
        FROM events
        WHERE status = ? AND startDate < ?
        LIMIT 10
      `);
      const events = eventsStmt.all(EVENT_STATUS.PROCESSED, cutoffDate.toISOString());

      console.log('\nEvents that would be deleted (showing first 10):');
      events.forEach(event => {
        console.log(`  - ${event.name} (${new Date(event.startDate).toLocaleDateString()})`);
      });
      if (count > 10) {
        console.log(`  ... and ${count - 10} more`);
      }
      console.log('\nRun without --dry-run to actually delete these events.\n');
    } else {
      const deleteStmt = db.prepare(`
        DELETE FROM events
        WHERE status = ? AND startDate < ?
      `);
      const result = deleteStmt.run(EVENT_STATUS.PROCESSED, cutoffDate.toISOString());

      console.log(`Successfully deleted ${result.changes} event(s).\n`);
      logger.info(`Database cleanup: Deleted ${result.changes} old events`);
    }
  } catch (error) {
    logger.error('Failed to cleanup database:', error.message);
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Previews event details and attendee count without processing.
 * @param {string} eventId - The ID of the event to preview.
 */
async function previewEvent(eventId) {
  try {
    console.log(`\nFetching event details for ID: ${eventId}...\n`);

    const event = await getEventDetails(eventId);
    const attendees = await getAllAttendees(eventId);

    console.log('='.repeat(60));
    console.log('EVENT PREVIEW');
    console.log('='.repeat(60));
    console.log(`Name: ${event.name}`);
    console.log(`ID: ${event.id}`);
    console.log(`Start: ${new Date(event.startDate).toLocaleString()}`);
    console.log(`End: ${new Date(event.endDate).toLocaleString()}`);
    console.log(`Timezone: ${event.timezone || 'Not specified'}`);
    console.log(`Location: ${event.location || 'Not specified'}`);

    if (event.categories && event.categories.length > 0) {
      console.log(`Categories: ${event.categories.map(c => c.name).join(', ')}`);
    }

    console.log(`\nAttendees: ${attendees.length}`);

    if (attendees.length > 0) {
      console.log('\nFirst 10 attendees:');
      attendees.slice(0, 10).forEach((attendee, index) => {
        const name = `${attendee.firstName || ''} ${attendee.lastName || ''}`.trim();
        const status = attendee.isPaid ? 'Paid' : (attendee.hasFee ? 'Owing' : 'No Fee');
        console.log(`  ${index + 1}. ${name} - ${status}`);
      });

      if (attendees.length > 10) {
        console.log(`  ... and ${attendees.length - 10} more`);
      }

      // Show payment summary
      const paid = attendees.filter(a => a.isPaid).length;
      const owing = attendees.filter(a => a.hasFee && !a.isPaid).length;
      const noFee = attendees.filter(a => !a.hasFee).length;

      console.log('\nPayment Summary:');
      console.log(`  Paid: ${paid}`);
      console.log(`  Owing: ${owing}`);
      console.log(`  No Fee: ${noFee}`);

      if (owing > 0) {
        const totalOwing = attendees
          .filter(a => a.hasFee && !a.isPaid && a.rule && a.rule.fee)
          .reduce((sum, a) => sum + parseFloat(a.rule.fee), 0);
        console.log(`  Total Owing: $${totalOwing.toFixed(2)}`);
      }
    }

    console.log('='.repeat(60));
    console.log();
  } catch (error) {
    logger.error('Failed to preview event:', error.message);
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Tests email configuration by sending a test message.
 * @param {string} [recipient] - Optional recipient email address (defaults to PRINTER_EMAIL).
 */
async function testEmail(recipient) {
  try {
    const PRINTER_EMAIL = recipient || process.env.PRINTER_EMAIL;
    const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
    const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 587;
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;
    const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;

    if (!PRINTER_EMAIL || !SMTP_USER || !SMTP_PASS) {
      console.error('\nError: Missing required email configuration.');
      console.error('Please ensure PRINTER_EMAIL, SMTP_USER, and SMTP_PASS are set in .env file.\n');
      process.exit(1);
    }

    console.log('\nTesting Email Configuration');
    console.log('='.repeat(50));
    console.log(`SMTP Host: ${SMTP_HOST}`);
    console.log(`SMTP Port: ${SMTP_PORT}`);
    console.log(`From: ${EMAIL_FROM}`);
    console.log(`To: ${PRINTER_EMAIL}`);
    console.log('='.repeat(50));
    console.log('\nSending test email...');

    const transportOptions = {
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    };

    const subject = 'Hello Club - Test Email';
    const body = `This is a test email from Hello Club Event Attendance system.\n\nSent at: ${new Date().toLocaleString()}\n\nIf you received this, your email configuration is working correctly!`;

    // Create a simple test PDF
    const testPdfPath = 'test-email.pdf';
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(testPdfPath));
    doc.fontSize(20).text('Hello Club - Test Email', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`This is a test PDF attachment.`);
    doc.text(`Sent at: ${new Date().toLocaleString()}`);
    doc.end();

    // Wait for PDF to be written
    await new Promise(resolve => setTimeout(resolve, 100));

    await sendEmailWithAttachment(transportOptions, PRINTER_EMAIL, EMAIL_FROM, subject, body, testPdfPath);

    // Clean up test PDF
    fs.unlinkSync(testPdfPath);

    console.log('\n✓ Test email sent successfully!');
    console.log(`Check ${PRINTER_EMAIL} for the test message.\n`);
  } catch (error) {
    logger.error('Email test failed:', error.message);
    console.error(`\n✗ Email test failed: ${error.message}\n`);
    process.exit(1);
  }
}

/**
 * Tests local printer configuration.
 * @param {string} [printerName] - Optional printer name (uses default if not specified).
 */
async function testPrinter(printerName) {
  try {
    console.log('\nTesting Local Printer Configuration');
    console.log('='.repeat(50));

    // Create a simple test PDF
    const testPdfPath = 'test-printer.pdf';
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(testPdfPath));
    doc.fontSize(20).text('Hello Club - Printer Test', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`This is a test print job.`);
    doc.text(`Sent at: ${new Date().toLocaleString()}`);
    doc.text(`\nIf you can read this, your printer configuration is working!`);
    doc.end();

    // Wait for PDF to be written
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log(`\nSending test document to ${printerName || 'default printer'}...`);

    const options = printerName ? { printer: printerName } : {};
    const msg = await print(testPdfPath, options);

    // Clean up test PDF
    fs.unlinkSync(testPdfPath);

    console.log('\n✓ Test print job sent successfully!');
    console.log(`${msg}`);
    console.log('Check your printer for the test document.\n');
  } catch (error) {
    logger.error('Printer test failed:', error.message);
    console.error(`\n✗ Printer test failed: ${error.message}`);
    console.error('\nTroubleshooting:');
    console.error('  - On Windows: Ensure SumatraPDF is installed');
    console.error('  - On Linux/Mac: Ensure CUPS is configured');
    console.error('  - Check printer name with system printer settings\n');
    process.exit(1);
  }
}

/**
 * Creates a backup of the database.
 * @param {string} [backupPath] - Optional path for the backup file.
 * @returns {string} Path to the backup file.
 */
function backupDatabase(backupPath) {
  try {
    const db = getDb();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultBackupPath = `backup-${timestamp}.db`;
    const finalBackupPath = backupPath || defaultBackupPath;

    console.log('\nCreating Database Backup');
    console.log('='.repeat(50));

    // Use SQLite backup API
    db.backup(finalBackupPath);

    const stats = fs.statSync(finalBackupPath);
    console.log(`✓ Backup created successfully`);
    console.log(`  Location: ${path.resolve(finalBackupPath)}`);
    console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log('='.repeat(50));
    console.log();

    logger.info(`Database backup created: ${finalBackupPath}`);
    return finalBackupPath;
  } catch (error) {
    logger.error('Database backup failed:', error.message);
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Restores the database from a backup file.
 * @param {string} backupPath - Path to the backup file.
 */
function restoreDatabase(backupPath) {
  try {
    if (!fs.existsSync(backupPath)) {
      console.error(`\nError: Backup file not found: ${backupPath}\n`);
      process.exit(1);
    }

    console.log('\nRestoring Database from Backup');
    console.log('='.repeat(50));
    console.log(`Backup file: ${backupPath}`);
    console.log('\nWARNING: This will replace the current database!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');

    // In a real CLI, we'd use readline for confirmation
    // For now, just proceed after logging
    setTimeout(() => {
      const dbPath = './events.db';

      // Create backup of current database
      if (fs.existsSync(dbPath)) {
        const emergencyBackup = `emergency-backup-${Date.now()}.db`;
        fs.copyFileSync(dbPath, emergencyBackup);
        console.log(`\nCurrent database backed up to: ${emergencyBackup}`);
      }

      // Copy backup file to database location
      fs.copyFileSync(backupPath, dbPath);

      console.log(`\n✓ Database restored successfully from ${backupPath}`);
      console.log('='.repeat(50));
      console.log();

      logger.info(`Database restored from backup: ${backupPath}`);
    }, 5000);
  } catch (error) {
    logger.error('Database restore failed:', error.message);
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  listEvents,
  cleanupDatabase,
  previewEvent,
  testEmail,
  testPrinter,
  backupDatabase,
  restoreDatabase
};
