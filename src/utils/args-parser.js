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
 * @property {number} [fetchWindowHours] - Time window in hours to look ahead for events.
 * @property {number} [preEventQueryMinutes] - Default lead time when a print: tag omits one.
 * @property {string} [output] - The name of the output PDF file.
 * @property {string} [printMode] - Default print mode ('local' or 'email').
 */
const argv = yargs(hideBin(process.argv))
  .command('fetch-events', 'Fetch upcoming events from the API and store them in the database', (yargs) => {
    return yargs.option('fetch-window-hours', {
      alias: 'fwh',
      type: 'number',
      description: 'The time window in hours to look ahead for upcoming events. Overrides config file.',
    });
  })
  .command('process-schedule', 'Process stored events that are due for printing', (yargs) => {
    return yargs
      .option('pre-event-query-minutes', {
        alias: 'w',
        type: 'number',
        description: "Default lead time in minutes, used when an event's print: tag does not specify one.",
      })
      .option('output', {
        alias: 'o',
        type: 'string',
        description: 'The name of the output PDF file. Overrides config file.',
      })
      .option('print-mode', {
        alias: 'p',
        type: 'string',
        choices: ['local', 'email'],
        description: "Default print mode (`local` or `email`), used when an event's print: tag does not specify one.",
      });
  })
  .command(
    'start-service',
    'Run the application as a long-running service to automatically fetch and process events',
    (yargs) => {
      // This command can accept all options from the other commands
      return yargs
        .option('print-mode', {
          alias: 'p',
          type: 'string',
          choices: ['local', 'email'],
          description: "Default print mode (`local` or `email`), used when an event's print: tag does not specify one.",
        })
        .option('service-run-interval-hours', {
          alias: 'srih',
          type: 'number',
          description: 'How often the service runs to fetch new events, in hours. Overrides config file.',
        });
    }
  )
  .demandCommand(1, 'You must provide a valid command: fetch-events, process-schedule, or start-service')
  .help()
  .alias('help', 'h').argv;

module.exports = argv;
