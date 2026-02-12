require('dotenv').config();
const fs = require('fs');
const logger = require('./services/logger');
const configSchema = require('./utils/config-schema');
const argv = require('./utils/args-parser');
const { fetchAndStoreUpcomingEvents, processScheduledEvents } = require('./core/functions');
const { runService, cancelAllScheduledJobs } = require('./core/service');
const { closeDb } = require('./core/database');
const { stopWatchdog } = require('./utils/systemd-watchdog');

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Give logger time to write before exiting
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown handler
let isShuttingDown = false;
function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    stopWatchdog();
  } catch (_err) {
    // Watchdog may not have been started
  }

  try {
    cancelAllScheduledJobs();
  } catch (err) {
    logger.error('Error cancelling scheduled jobs:', err.message);
  }

  try {
    closeDb();
  } catch (err) {
    logger.error('Error closing database:', err.message);
  }

  logger.info('Graceful shutdown complete.');

  // Give logger time to flush before exiting
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Check for required environment variables with helpful error messages
const requiredEnvVars = ['API_KEY'];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
  logger.error('╔════════════════════════════════════════════════════════════════╗');
  logger.error('║  ERROR: Missing Required Environment Variables                ║');
  logger.error('╚════════════════════════════════════════════════════════════════╝');
  logger.error(`Missing: ${missingEnvVars.join(', ')}`);
  logger.error('');
  logger.error('To fix this:');
  logger.error('  1. Copy .env.example to .env in the project root');
  logger.error('  2. Edit .env and add your Hello Club API key:');
  logger.error('     API_KEY=your_api_key_here');
  logger.error('');
  logger.error('For help getting your API key, see: docs/CONFIGURATION.md');
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

  // Validate config file data with helpful error messages
  const { error, value: validatedConfig } = configSchema.validate(config);
  if (error) {
    logger.error('╔════════════════════════════════════════════════════════════════╗');
    logger.error('║  ERROR: Invalid Configuration in config.json                  ║');
    logger.error('╚════════════════════════════════════════════════════════════════╝');
    logger.error('');
    error.details.forEach((detail, index) => {
      logger.error(`${index + 1}. ${detail.message}`);
      logger.error(`   Path: ${detail.path.join('.')}`);

      // Add contextual help for common errors
      if (detail.path.includes('printMode')) {
        logger.error('   → Valid values: "local" or "email"');
      } else if (detail.path.includes('preEventQueryMinutes')) {
        logger.error('   → Must be a positive integer (e.g., 5, 10, 15)');
      } else if (detail.path.includes('serviceRunIntervalHours')) {
        logger.error('   → Must be a positive integer (e.g., 1, 2, 4)');
      } else if (detail.path.includes('outputFilename')) {
        logger.error('   → Must end with .pdf (e.g., "attendees.pdf")');
      }
      logger.error('');
    });
    logger.error('For configuration help, see: docs/CONFIGURATION.md');
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
    printMode: argv.printMode ?? validatedConfig.printMode,
    // For start-service
    serviceRunIntervalHours: argv.serviceRunIntervalHours ?? validatedConfig.serviceRunIntervalHours,
  };

  logger.info(`Executing command: ${command}`);

  if (command === 'fetch-events') {
    await fetchAndStoreUpcomingEvents(finalConfig);
  } else if (command === 'process-schedule') {
    // Check for email-related env vars only if printing
    if (finalConfig.printMode === 'email') {
      const requiredEmailVars = ['PRINTER_EMAIL', 'SMTP_USER', 'SMTP_PASS'];
      const missingEmailVars = requiredEmailVars.filter((key) => !process.env[key]);
      if (missingEmailVars.length > 0) {
        logger.error('╔════════════════════════════════════════════════════════════════╗');
        logger.error('║  ERROR: Email Printing Mode Requires SMTP Configuration       ║');
        logger.error('╚════════════════════════════════════════════════════════════════╝');
        logger.error(`Missing: ${missingEmailVars.join(', ')}`);
        logger.error('');
        logger.error('To fix this:');
        logger.error('  1. Edit your .env file');
        logger.error('  2. Add the following SMTP settings:');
        logger.error('     PRINTER_EMAIL=your.printer@hp.com');
        logger.error('     SMTP_USER=your.email@gmail.com');
        logger.error('     SMTP_PASS=your_app_password');
        logger.error('     SMTP_HOST=smtp.gmail.com  (optional)');
        logger.error('     SMTP_PORT=587  (optional)');
        logger.error('');
        logger.error('For Gmail setup instructions, see: docs/CONFIGURATION.md#email-setup');
        logger.error('Or change printMode to "local" in config.json');
        process.exit(1);
      }
    }
    await processScheduledEvents(finalConfig);
  } else if (command === 'start-service') {
    // The service runs indefinitely, so no need for await here in the same way.
    runService(finalConfig);
  } else {
    logger.error('Invalid command. Please use "fetch-events", "process-schedule", or "start-service".');
  }
}

// Start the application
main();
