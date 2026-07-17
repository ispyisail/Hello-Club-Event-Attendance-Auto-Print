const { execFile } = require('child_process');
const { promisify } = require('util');
const logger = require('./logger');

const execFileAsync = promisify(execFile);

/**
 * Prints a PDF file using the CUPS lp command (Linux/Raspberry Pi).
 * Uses the system default printer unless PRINTER_NAME env var is set.
 * @param {string} filePath - Absolute path to the PDF file to print.
 * @param {number} [copies=1] - Number of copies to print (clamped to 1–10).
 * @returns {Promise<string>} Output message from lp command.
 * @throws {Error} When lp command fails or printer is unavailable.
 */
async function printPdf(filePath, copies = 1) {
  const args = [];

  const printerName = process.env.PRINTER_NAME;
  if (printerName) {
    args.push('-d', printerName);
  }

  const copyCount = Number(copies);
  if (Number.isInteger(copyCount) && copyCount > 1 && copyCount <= 10) {
    args.push('-n', String(copyCount));
  }

  args.push(filePath);

  try {
    const { stdout, stderr } = await execFileAsync('lp', args);
    const output = stdout.trim() || stderr.trim();
    logger.info(`CUPS print job submitted: ${output}`);
    return output;
  } catch (error) {
    const message = `CUPS print failed for ${filePath}: ${error.message}`;
    logger.error(message, error);
    throw new Error(message);
  }
}

module.exports = { printPdf };
