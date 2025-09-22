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
      });
  })
  .demandCommand(1, 'You must provide a valid command: fetch-events or process-schedule')
  .help()
  .alias('help', 'h')
  .argv;

module.exports = argv;
