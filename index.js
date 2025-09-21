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
