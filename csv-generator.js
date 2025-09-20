const fs = require('fs');
const { format } = require('fast-csv');
const logger = require('./logger');

function generateCsv(event, attendees, outputPath) {
  const csvStream = format({ headers: true });
  const writableStream = fs.createWriteStream(outputPath);

  writableStream.on('finish', () => {
    logger.info(`Successfully created ${outputPath}`);
  });

  csvStream.pipe(writableStream);

  // Add a header row with event info
  csvStream.write({ 
    'Event Name': event.name, 
    'Event Date': new Date(event.startDate).toLocaleString()
  });
  // Add an empty row for spacing
  csvStream.write({});

  // Write attendees
  attendees.forEach(attendee => {
    csvStream.write({
      'First Name': attendee.firstName || '',
      'Last Name': attendee.lastName || '',
      'Phone': attendee.phone || '',
      'Signed Up': new Date(attendee.signUpDate).toLocaleDateString(),
      'Fee': attendee.hasFee && attendee.rule && attendee.rule.fee ? attendee.rule.fee.toFixed(2) : '',
      'Status': attendee.isPaid ? 'Paid' : (attendee.hasFee ? 'Owing' : 'No Fee'),
    });
  });

  csvStream.end();
}

module.exports = { generateCsv };
