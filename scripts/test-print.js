/**
 * Test print simulation script.
 *
 * Generates a PDF with realistic fake data and runs it through the full
 * pipeline (page reversal + email/print) exactly as a live event would.
 *
 * Usage:
 *   node scripts/test-print.js
 *   node scripts/test-print.js --pdf-only   # generate PDF but skip sending
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const configSchema = require('../src/utils/config-schema');
const { createAndPrintPdf } = require('../src/core/functions');

// ---------------------------------------------------------------------------
// Fake data
// ---------------------------------------------------------------------------

const fakeEvent = {
  id: 'TEST-001',
  name: 'Pickleball — Tuesday Night Social (TEST)',
  startDate: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min from now
  endDate: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
  timezone: 'Pacific/Auckland',
};

// 35 attendees — enough to push onto a second page and exercise the write-in section
const fakeAttendees = [
  {
    firstName: 'Sarah',
    lastName: 'Thompson',
    phone: '021 456 7890',
    signUpDate: '2026-02-10T08:00:00Z',
    hasFee: true,
    isPaid: true,
    rule: { fee: 8.0 },
  },
  {
    firstName: 'James',
    lastName: 'Mitchell',
    phone: '027 123 4567',
    signUpDate: '2026-02-10T08:05:00Z',
    hasFee: true,
    isPaid: false,
    rule: { fee: 8.0 },
  },
  {
    firstName: 'Emily',
    lastName: 'Walker',
    phone: '022 987 6543',
    signUpDate: '2026-02-11T09:00:00Z',
    hasMembershipRule: true,
  },
  {
    firstName: 'Michael',
    lastName: 'Brown',
    phone: '021 234 5678',
    signUpDate: '2026-02-11T09:15:00Z',
    hasFee: true,
    isPaid: true,
    rule: { fee: 8.0 },
  },
  {
    firstName: 'Jessica',
    lastName: 'Taylor',
    phone: '027 876 5432',
    signUpDate: '2026-02-12T10:00:00Z',
    hasMembershipRule: true,
  },
  {
    firstName: 'David',
    lastName: 'Anderson',
    phone: '021 345 6789',
    signUpDate: '2026-02-12T10:30:00Z',
    hasFee: true,
    isPaid: true,
    rule: { fee: 8.0 },
  },
  { firstName: 'Lauren', lastName: 'Harris', phone: '022 654 3210', signUpDate: '2026-02-13T07:00:00Z', hasFee: false },
  {
    firstName: 'Chris',
    lastName: 'Martin',
    phone: '027 321 0987',
    signUpDate: '2026-02-13T07:30:00Z',
    hasMembershipRule: true,
  },
  {
    firstName: 'Amanda',
    lastName: 'Wilson',
    phone: '021 567 8901',
    signUpDate: '2026-02-14T08:00:00Z',
    hasFee: true,
    isPaid: false,
    rule: { fee: 8.0 },
  },
  {
    firstName: 'Ryan',
    lastName: 'Moore',
    phone: '022 432 1098',
    signUpDate: '2026-02-14T08:20:00Z',
    hasFee: true,
    isPaid: true,
    rule: { fee: 8.0 },
  },
  {
    firstName: 'Megan',
    lastName: 'Jackson',
    phone: '027 210 9876',
    signUpDate: '2026-02-15T09:00:00Z',
    hasMembershipRule: true,
  },
  {
    firstName: 'Nathan',
    lastName: 'White',
    phone: '021 678 9012',
    signUpDate: '2026-02-15T09:45:00Z',
    hasFee: true,
    isPaid: true,
    rule: { fee: 8.0 },
  },
  { firstName: 'Rebecca', lastName: 'Clark', phone: '022 543 2109', signUpDate: '2026-02-16T10:00:00Z', hasFee: false },
  {
    firstName: 'Daniel',
    lastName: 'Lewis',
    phone: '027 109 8765',
    signUpDate: '2026-02-16T10:15:00Z',
    hasFee: true,
    isPaid: true,
    rule: { fee: 8.0 },
  },
  {
    firstName: 'Stephanie',
    lastName: 'Robinson',
    phone: '021 789 0123',
    signUpDate: '2026-02-17T08:00:00Z',
    hasMembershipRule: true,
  },
  {
    firstName: 'Andrew',
    lastName: 'Hall',
    phone: '022 098 7654',
    signUpDate: '2026-02-17T08:30:00Z',
    hasFee: true,
    isPaid: false,
    rule: { fee: 8.0 },
  },
  {
    firstName: 'Natalie',
    lastName: 'Allen',
    phone: '027 987 6543',
    signUpDate: '2026-02-18T09:00:00Z',
    hasFee: true,
    isPaid: true,
    rule: { fee: 8.0 },
  },
  {
    firstName: 'Mark',
    lastName: 'Young',
    phone: '021 890 1234',
    signUpDate: '2026-02-18T09:30:00Z',
    hasMembershipRule: true,
  },
  {
    firstName: 'Rachel',
    lastName: 'King',
    phone: '022 765 4321',
    signUpDate: '2026-02-19T07:00:00Z',
    hasFee: true,
    isPaid: true,
    rule: { fee: 8.0 },
  },
  { firstName: 'Jason', lastName: 'Wright', phone: '027 654 3210', signUpDate: '2026-02-19T07:15:00Z', hasFee: false },
  {
    firstName: 'Melissa',
    lastName: 'Scott',
    phone: '021 901 2345',
    signUpDate: '2026-02-20T08:00:00Z',
    hasMembershipRule: true,
  },
  {
    firstName: 'Timothy',
    lastName: 'Green',
    phone: '022 210 9876',
    signUpDate: '2026-02-20T08:45:00Z',
    hasFee: true,
    isPaid: true,
    rule: { fee: 8.0 },
  },
  {
    firstName: 'Ashley',
    lastName: 'Baker',
    phone: '027 543 2109',
    signUpDate: '2026-02-21T09:00:00Z',
    hasFee: true,
    isPaid: false,
    rule: { fee: 8.0 },
  },
  {
    firstName: 'Joshua',
    lastName: 'Adams',
    phone: '021 012 3456',
    signUpDate: '2026-02-21T09:20:00Z',
    hasMembershipRule: true,
  },
  {
    firstName: 'Brittany',
    lastName: 'Nelson',
    phone: '022 876 5432',
    signUpDate: '2026-02-22T10:00:00Z',
    hasFee: true,
    isPaid: true,
    rule: { fee: 8.0 },
  },
  { firstName: 'Kevin', lastName: 'Carter', phone: '027 432 1098', signUpDate: '2026-02-22T10:30:00Z', hasFee: false },
  {
    firstName: 'Samantha',
    lastName: 'Mitchell',
    phone: '021 123 4561',
    signUpDate: '2026-02-23T07:00:00Z',
    hasMembershipRule: true,
  },
  {
    firstName: 'Brandon',
    lastName: 'Perez',
    phone: '022 321 0984',
    signUpDate: '2026-02-23T07:30:00Z',
    hasFee: true,
    isPaid: true,
    rule: { fee: 8.0 },
  },
  {
    firstName: 'Nicole',
    lastName: 'Roberts',
    phone: '027 210 9873',
    signUpDate: '2026-02-24T08:00:00Z',
    hasFee: true,
    isPaid: false,
    rule: { fee: 8.0 },
  },
  {
    firstName: 'Tyler',
    lastName: 'Turner',
    phone: '021 234 5672',
    signUpDate: '2026-02-24T08:15:00Z',
    hasMembershipRule: true,
  },
  {
    firstName: 'Kayla',
    lastName: 'Phillips',
    phone: '022 098 7651',
    signUpDate: '2026-02-24T09:00:00Z',
    hasFee: true,
    isPaid: true,
    rule: { fee: 8.0 },
  },
  { firstName: 'Eric', lastName: 'Campbell', phone: '027 987 6540', signUpDate: '2026-02-24T09:30:00Z', hasFee: false },
  {
    firstName: 'Heather',
    lastName: 'Parker',
    phone: '021 345 6780',
    signUpDate: '2026-02-24T10:00:00Z',
    hasMembershipRule: true,
  },
  {
    firstName: 'Sean',
    lastName: 'Evans',
    phone: '022 654 3207',
    signUpDate: '2026-02-24T10:15:00Z',
    hasFee: true,
    isPaid: true,
    rule: { fee: 8.0 },
  },
  {
    firstName: 'Tiffany',
    lastName: 'Edwards',
    phone: '027 321 0984',
    signUpDate: '2026-02-24T10:45:00Z',
    hasFee: true,
    isPaid: false,
    rule: { fee: 8.0 },
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const pdfOnly = process.argv.includes('--pdf-only');

  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║         Hello Club — Test Print Simulation           ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  // Load and validate config
  let rawConfig = {};
  try {
    rawConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../config.json'), 'utf8'));
  } catch (e) {
    console.error('Could not read config.json:', e.message);
    process.exit(1);
  }
  const { error, value: config } = configSchema.validate(rawConfig);
  if (error) {
    console.error('Invalid config.json:', error.message);
    process.exit(1);
  }

  const printMode = pdfOnly ? 'none' : config.printMode;
  const outputFilename = 'test-print.pdf';

  console.log(`  Event      : ${fakeEvent.name}`);
  console.log(`  Attendees  : ${fakeAttendees.length}`);
  console.log(`  Print mode : ${printMode === 'none' ? 'PDF only (skipping send)' : printMode}`);
  console.log(`  Page order : ${config.pdfLayout?.reversePageOrder ? 'reversed (last page first)' : 'normal'}`);
  console.log('');

  if (pdfOnly) {
    // Generate PDF directly without sending
    const PdfGenerator = require('../src/services/pdf-generator');
    const { execFile } = require('child_process');
    const { promisify } = require('util');
    const execFileAsync = promisify(execFile);

    console.log('  Generating PDF...');
    const generator = new PdfGenerator(fakeEvent, fakeAttendees, config.pdfLayout);
    const safeOutputPath = await generator.generate(outputFilename);

    if (config.pdfLayout?.reversePageOrder) {
      console.log('  Reversing page order...');
      const reversedPath = safeOutputPath + '.reversed.pdf';
      await execFileAsync('qpdf', ['--empty', '--pages', safeOutputPath, 'z-1', '--', reversedPath]);
      fs.renameSync(reversedPath, safeOutputPath);
    }

    const stats = fs.statSync(safeOutputPath);
    console.log(`  ✓ PDF saved: ${safeOutputPath} (${(stats.size / 1024).toFixed(1)} KB)`);
    console.log('');
    console.log('  Open it with: xdg-open ' + safeOutputPath);
  } else {
    // Full pipeline: generate + reverse + email/print (PDF is deleted after sending)
    console.log('  Running full pipeline...');
    await createAndPrintPdf(fakeEvent, fakeAttendees, outputFilename, config.pdfLayout, printMode);
    console.log('');

    if (printMode === 'email') {
      console.log(`  ✓ Email sent to: ${process.env.PRINTER_EMAIL}`);
    } else if (printMode === 'local') {
      console.log('  ✓ Sent to local CUPS printer.');
    }
  }

  console.log('');
  console.log('  Simulation complete.');
  console.log('');
}

main().catch((err) => {
  console.error('\n  ERROR:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
