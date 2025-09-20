const { main, getNextEvent, getAllAttendees, createAndPrintPdf } = require('./functions');
const argv = require('./args-parser');

main(argv, { getNextEvent, getAllAttendees, createAndPrintPdf });
