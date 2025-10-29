require('dotenv').config();
const fs = require('fs');
const logger = require('./logger');
const configSchema = require('./config-schema');
const argv = require('./args-parser');
const { fetchAndStoreUpcomingEvents, processScheduledEvents } = require('./functions');
const { runService } = require('./service');

// Check for required environment variables
const requiredEnvVars = ['API_KEY'];
const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingEnvVars.length > 0) {
    logger.error(`Error: Missing required environment variables: ${missingEnvVars.join(', ')}`);
    logger.error('Please create a .env file in the root of the project and add the necessary variables.');
    process.exit(1);
}

/**
 * Main function to orchestrate the application logic based on commands.
 */
async function main() {
    let config = {};
    try {
        const configData = fs.readFileSync('config.json', 'utf8');
        config = JSON.parse(configData);
    } catch (error) {
        logger.warn('Warning: config.json not found or is invalid. Using default values.');
    }

    // Validate config file data
    const { error, value: validatedConfig } = configSchema.validate(config);
    if (error) {
        logger.error('Invalid configuration in config.json:', error.details.map(d => d.message).join('\n'));
        process.exit(1);
    }

    // The first element of _ is the command
    const command = argv._[0];

    // Build the final configuration by merging config file, defaults, and command-line arguments
    const finalConfig = {
        // For fetch-events
        allowedCategories: argv.category ?? validatedConfig.categories,
        fetchWindowHours: argv.fetchWindowHours ?? validatedConfig.fetchWindowHours,
        // For process-schedule
        preEventQueryMinutes: argv.preEventQueryMinutes ?? validatedConfig.preEventQueryMinutes,
        outputFilename: argv.output ?? validatedConfig.outputFilename,
        pdfLayout: validatedConfig.pdfLayout,
        printMode: argv.printMode ?? validatedConfig.printMode
    };

    logger.info(`Executing command: ${command}`);

    if (command === 'fetch-events') {
        await fetchAndStoreUpcomingEvents(finalConfig);
    } else if (command === 'process-schedule') {
        // Check for email-related env vars only if printing
        if (finalConfig.printMode === 'email') {
            const requiredEmailVars = ['PRINTER_EMAIL', 'SMTP_USER', 'SMTP_PASS'];
            const missingEmailVars = requiredEmailVars.filter(key => !process.env[key]);
            if (missingEmailVars.length > 0) {
                logger.error(`Error: Missing required environment variables for email printing: ${missingEmailVars.join(', ')}`);
                process.exit(1);
            }
        }
        await processScheduledEvents(finalConfig);
    } else if (command === 'start-service') {
        // The service runs indefinitely, so no need for await here in the same way.
        runService(finalConfig);
    } else if (command === 'health-check') {
        // Run health check and exit
        const { displayHealthCheck } = require('./health-check');
        displayHealthCheck();
    } else if (command === 'list-events') {
        const { listEvents } = require('./commands');
        listEvents({ status: argv.status, limit: argv.limit });
    } else if (command === 'cleanup') {
        const { cleanupDatabase } = require('./commands');
        cleanupDatabase({ days: argv.days, dryRun: argv.dryRun });
    } else if (command === 'preview-event') {
        const { previewEvent } = require('./commands');
        await previewEvent(argv.eventId);
    } else if (command === 'test-email') {
        const { testEmail } = require('./commands');
        await testEmail(argv.recipient);
    } else if (command === 'test-printer') {
        const { testPrinter } = require('./commands');
        await testPrinter(argv.name);
    } else if (command === 'backup') {
        const { backupDatabase } = require('./commands');
        backupDatabase(argv.path);
    } else if (command === 'restore') {
        const { restoreDatabase } = require('./commands');
        restoreDatabase(argv.path);
    } else {
        logger.error('Invalid command. Run with --help to see available commands.');
        process.exit(1);
    }
}

// Start the application
main();
