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
        printMode: argv.printMode ?? validatedConfig.printMode,
        dryRun: argv.dryRun ?? false,
        serviceRunIntervalHours: argv.serviceRunIntervalHours ?? validatedConfig.serviceRunIntervalHours,
        // Advanced features
        filters: validatedConfig.filters,
        webhooks: validatedConfig.webhooks,
        printers: validatedConfig.printers,
        watchConfig: validatedConfig.watchConfig
    };

    // Validate CLI arguments
    const { validateArguments } = require('./validation');
    const validation = validateArguments(argv, finalConfig);
    if (!validation.valid) {
        logger.error('Invalid arguments:');
        validation.errors.forEach(err => logger.error(`  - ${err}`));
        process.exit(1);
    }

    // Run startup validation for start-service command
    if (command === 'start-service') {
        const { runStartupValidation } = require('./validation');
        const startupCheck = await runStartupValidation(finalConfig);
        if (!startupCheck.allValid) {
            logger.error('Startup validation failed. Please fix the errors above before starting the service.');
            process.exit(1);
        }
    }

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
    } else if (command === 'dashboard') {
        process.env.DASHBOARD_PORT = argv.port || 3030;
        const { startDashboard } = require('./web-dashboard');
        startDashboard();
    } else if (command === 'gui') {
        const { startGuiServer } = require('./gui-server');
        const port = argv.port || 3000;
        await startGuiServer(port);
        // Keep process alive
        await new Promise(() => {});
    } else if (command === 'metrics') {
        const { displayMetrics } = require('./metrics');
        displayMetrics();
    } else if (command === 'metrics-reset') {
        const { resetMetrics } = require('./metrics');
        resetMetrics();
        console.log('All metrics have been reset.');
    } else if (command === 'api-stats') {
        const { displayApiStats } = require('./api-rate-limiter');
        displayApiStats(argv.minutes || 60);
    } else if (command === 'metrics-server') {
        const { startMetricsServer } = require('./metrics-server');
        const port = argv.port || 9090;
        startMetricsServer(port);
        logger.info('Metrics server is running. Press Ctrl+C to stop.');
        // Keep process alive
        await new Promise(() => {});
    } else if (command === 'dlq') {
        const { displayQueue } = require('./dead-letter-queue');
        displayQueue();
    } else if (command === 'dlq-retry') {
        const { retryJob } = require('./dead-letter-queue');
        const { processScheduledEvents } = require('./functions');

        const jobId = argv.id;
        if (!jobId) {
            logger.error('Error: Job ID is required. Use: dlq-retry <id>');
            process.exit(1);
        }

        const success = await retryJob(jobId, async (jobData) => {
            // Retry the failed operation based on job type
            if (jobData.type === 'print') {
                await processScheduledEvents(finalConfig);
            } else if (jobData.type === 'email') {
                const { sendEmailWithAttachment } = require('./email-service');
                await sendEmailWithAttachment(jobData.recipient, jobData.subject, jobData.body, jobData.attachment);
            }
        });

        if (success) {
            console.log(`Job ${jobId} retried successfully`);
        } else {
            console.log(`Job ${jobId} retry failed`);
            process.exit(1);
        }
    } else if (command === 'dlq-cleanup') {
        const { cleanup } = require('./dead-letter-queue');
        const days = argv.days || 30;
        const removed = cleanup(days);
        console.log(`Removed ${removed} old dead letter queue entries (older than ${days} days)`);
    } else if (command === 'circuit-breaker-status') {
        const { getAllStats } = require('./circuit-breaker');
        const stats = getAllStats();

        console.log('='.repeat(80));
        console.log('Circuit Breaker Status');
        console.log('='.repeat(80));

        for (const [name, stat] of Object.entries(stats)) {
            console.log(`\n${name}:`);
            console.log(`  State: ${stat.state}`);
            console.log(`  Total Calls: ${stat.totalCalls}`);
            console.log(`  Successful: ${stat.successfulCalls}`);
            console.log(`  Failed: ${stat.failedCalls}`);
            console.log(`  Rejected: ${stat.rejectedCalls}`);

            if (stat.state === 'OPEN') {
                const timeRemaining = Math.round((stat.nextAttempt - Date.now()) / 1000);
                console.log(`  Next attempt in: ${timeRemaining}s`);
            }
        }
        console.log('\n' + '='.repeat(80));
    } else if (command === 'circuit-breaker-reset') {
        const { getCircuitBreaker } = require('./circuit-breaker');
        const name = argv.name;

        if (!name) {
            logger.error('Error: Circuit breaker name is required. Use: circuit-breaker-reset <name>');
            logger.error('Available circuit breakers: api, email, printer, webhook');
            process.exit(1);
        }

        try {
            const breaker = getCircuitBreaker(name);
            breaker.reset();
            console.log(`Circuit breaker '${name}' has been reset`);
        } catch (error) {
            logger.error(`Error: Circuit breaker '${name}' not found`);
            logger.error('Available circuit breakers: api, email, printer, webhook');
            process.exit(1);
        }
    } else if (command === 'backup-schedule') {
        const { scheduleBackups } = require('./backup-scheduler');
        const interval = argv.interval || 24;
        scheduleBackups(interval);
        console.log(`Backup scheduler started (interval: ${interval} hours). Press Ctrl+C to stop.`);
        // Keep process alive
        await new Promise(() => {});
    } else if (command === 'backup-list') {
        const { displayBackups } = require('./backup-scheduler');
        displayBackups();
    } else if (command === 'backup-rotate') {
        const { rotateBackups } = require('./backup-scheduler');
        const days = argv.days || 30;
        const removed = rotateBackups(days);
        console.log(`Removed ${removed} old backups (older than ${days} days)`);
    } else if (command === 'cache-stats') {
        const { getCacheStats } = require('./pdf-cache');
        const stats = getCacheStats();

        console.log('='.repeat(80));
        console.log('PDF Cache Statistics');
        console.log('='.repeat(80));
        console.log(`Total Entries: ${stats.totalEntries}`);
        console.log(`Valid Entries: ${stats.validEntries}`);
        console.log(`Expired Entries: ${stats.expiredEntries}`);
        console.log(`Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
        console.log('='.repeat(80));
    } else if (command === 'cache-clear') {
        const { clearCache } = require('./pdf-cache');
        clearCache();
        console.log('PDF cache cleared successfully');
    } else {
        logger.error('Invalid command. Run with --help to see available commands.');
        process.exit(1);
    }
}

// Start the application
main();
