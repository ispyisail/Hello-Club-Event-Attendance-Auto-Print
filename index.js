require('dotenv').config();

const requiredEnvVars = ['API_KEY', 'PRINTER_EMAIL', 'SMTP_USER', 'SMTP_PASS'];
const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingEnvVars.length > 0) {
    console.error(`Error: Missing required environment variables: ${missingEnvVars.join(', ')}`)
    console.error('Please create a .env file in the root of the project and add the necessary variables.');
    console.error('You can refer to the .env.example file for a template.');
    process.exit(1);
}

/**
 * @fileoverview This is the main entry point for the application.
 * It parses command-line arguments and invokes the main application logic.
 * @author Your Name
 * @version 1.0.0
 */

const { main, getNextEvent, getAllAttendees, createAndPrintPdf } = require('./functions');
const argv = require('./args-parser');

// Start the main application logic
main(argv, { getNextEvent, getAllAttendees, createAndPrintPdf });
