/**
 * @fileoverview This module configures and parses command-line arguments using yargs.
 * It defines the options available to the user when running the application from the command line.
 * @module args-parser
 */

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

/**
 * The parsed command-line arguments.
 * @type {Object}
 * @property {Array<string>} [category] - Event categories to filter by.
 * @property {number} [window] - Time window in minutes to check for events.
 * @property {string} [output] - The name of the output PDF file.
 * @property {string} printMode - The printing method ('local' or 'email').
 */
const argv = yargs(hideBin(process.argv))
  .command('fetch-events', 'Fetch upcoming events from the API and store them in the database', (yargs) => {
    return yargs
      .option('category', {
        alias: 'c',
        type: 'array',
        description: 'Event category to filter by (can be used multiple times). Overrides config file.'
      })
      .option('fetch-window-hours', {
        alias: 'fwh',
        type: 'number',
        description: 'The time window in hours to look ahead for upcoming events. Overrides config file.'
      });
  })
  .command('process-schedule', 'Process stored events that are due for printing', (yargs) => {
    return yargs
      .option('pre-event-query-minutes', {
        alias: 'w',
        type: 'number',
        description: 'The time in minutes before an event starts to perform the final query. Overrides config file.'
      })
      .option('output', {
        alias: 'o',
        type: 'string',
        description: 'The name of the output PDF file. Overrides config file.'
      })
      .option('print-mode', {
        alias: 'p',
        type: 'string',
        choices: ['local', 'email'],
        description: 'The printing method to use (`local` or `email`). Overrides config file.'
      })
      .option('dry-run', {
        type: 'boolean',
        default: false,
        description: 'Show what would be processed without actually printing'
      });
  })
  .command('start-service', 'Run the application as a long-running service to automatically fetch and process events', (yargs) => {
    // This command can accept all options from the other commands
    return yargs
      .option('category', {
        alias: 'c',
        type: 'array',
        description: 'Event category to filter by (can be used multiple times). Overrides config file.'
      })
      .option('print-mode', {
        alias: 'p',
        type: 'string',
        choices: ['local', 'email'],
        description: 'The printing method to use (`local` or `email`). Overrides config file.'
      })
      .option('service-run-interval-hours', {
        alias: 'srih',
        type: 'number',
        description: 'How often the service runs to fetch new events, in hours. Overrides config file.'
      });
  })
  .command('health-check', 'Check the health and status of the service')
  .command('list-events', 'List events from the database', (yargs) => {
    return yargs
      .option('status', {
        type: 'string',
        choices: ['all', 'pending', 'processed'],
        default: 'all',
        description: 'Filter events by status'
      })
      .option('limit', {
        type: 'number',
        default: 50,
        description: 'Maximum number of events to display'
      });
  })
  .command('cleanup', 'Remove old processed events from the database', (yargs) => {
    return yargs
      .option('days', {
        type: 'number',
        default: 30,
        description: 'Delete events older than this many days'
      })
      .option('dry-run', {
        type: 'boolean',
        default: false,
        description: 'Show what would be deleted without actually deleting'
      });
  })
  .command('preview-event <eventId>', 'Preview event details and attendee list', (yargs) => {
    return yargs.positional('eventId', {
      describe: 'The ID of the event to preview',
      type: 'string'
    });
  })
  .command('test-email [recipient]', 'Test email configuration by sending a test message', (yargs) => {
    return yargs.positional('recipient', {
      describe: 'Optional recipient email (defaults to PRINTER_EMAIL from .env)',
      type: 'string'
    });
  })
  .command('test-printer [name]', 'Test local printer configuration', (yargs) => {
    return yargs.positional('name', {
      describe: 'Optional printer name (uses default if not specified)',
      type: 'string'
    });
  })
  .command('backup [path]', 'Create a backup of the database', (yargs) => {
    return yargs.positional('path', {
      describe: 'Optional path for backup file',
      type: 'string'
    });
  })
  .command('restore <path>', 'Restore database from a backup file', (yargs) => {
    return yargs.positional('path', {
      describe: 'Path to the backup file',
      type: 'string'
    });
  })
  .command('dashboard', 'Start the web-based dashboard (Windows-friendly GUI)', (yargs) => {
    return yargs
      .option('port', {
        type: 'number',
        default: 3030,
        description: 'Port to run the dashboard on'
      });
  })
  .command('metrics', 'Display performance metrics and statistics')
  .command('metrics-reset', 'Reset all metrics data')
  .command('api-stats', 'Display API rate limiting statistics', (yargs) => {
    return yargs
      .option('minutes', {
        type: 'number',
        default: 60,
        description: 'Time window in minutes for statistics'
      });
  })
  .demandCommand(1, 'You must provide a valid command. Run with --help to see available commands.')
  .help()
  .alias('help', 'h')
  .argv;

module.exports = argv;
