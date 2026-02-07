/**
 * @fileoverview This module contains the PdfGenerator class for creating PDF documents
 * of event attendee lists.
 * @module pdf-generator
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Sanitizes and validates the output file path to prevent path traversal attacks.
 * This is a shared utility function also used by functions.js and tray-app/main.js.
 * @param {string} fileName - The filename from config (potentially unsafe)
 * @returns {string} - Safe absolute path for PDF output
 * @throws {Error} - If filename contains path traversal attempts
 */
function sanitizeOutputPath(fileName) {
  // Extract just the filename (remove any directory paths)
  const basename = path.basename(fileName);

  // Check for path traversal attempts
  if (basename !== fileName || fileName.includes('..')) {
    throw new Error(
      `Invalid output filename: "${fileName}". Filename must not contain directory paths or traversal sequences.`
    );
  }

  // Ensure it has .pdf extension
  if (!basename.toLowerCase().endsWith('.pdf')) {
    throw new Error(`Invalid output filename: "${fileName}". Filename must end with .pdf extension.`);
  }

  // Create safe absolute path in project root
  const safeOutputPath = path.resolve(process.cwd(), basename);

  return safeOutputPath;
}

/**
 * A class to generate PDF attendee lists for events.
 */
class PdfGenerator {
  /**
   * Creates an instance of PdfGenerator.
   * @param {Object} event - The event object.
   * @param {Array<Object>} attendees - An array of attendee objects.
   * @param {Object} layout - The layout configuration for the PDF.
   */
  constructor(event, attendees, layout) {
    this.event = event;
    this.attendees = attendees;
    this.layout = layout;
    this.doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 50 });
    this.row_height = 28;
    this.checkboxSize = 16; // Proportional to text
  }

  /**
   * Generates the header section of the PDF.
   * @private
   */
  _generateHeader() {
    const startY = this.doc.y;
    const pageWidth = this.doc.page.width - this.doc.page.margins.left - this.doc.page.margins.right;

    // Event name (title) on the left
    this.doc
      .font('Helvetica')
      .fontSize(20)
      .text(this.event.name, this.doc.page.margins.left, startY, {
        width: pageWidth * 0.6,
        align: 'left',
      });

    // Timestamp below event name
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const formattedTime = now
      .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })
      .toUpperCase();
    this.doc
      .font('Helvetica')
      .fontSize(10)
      .text(`Attendees as of ${formattedDate}, ${formattedTime}`, this.doc.page.margins.left, this.doc.y + 5, {
        width: pageWidth * 0.6,
        align: 'left',
      });

    // Logo on the right (if exists)
    if (this.layout.logo && fs.existsSync(this.layout.logo)) {
      const logoX = this.doc.page.width - this.doc.page.margins.right - 120;
      this.doc.image(this.layout.logo, logoX, startY, {
        fit: [120, 80],
        align: 'right',
      });
    }

    this.doc.moveDown(4);
  }

  /**
   * Generates the table header row.
   * @private
   */
  _generateTableHeader() {
    const y = this.doc.y;
    const startX = this.doc.page.margins.left;

    // Fixed columns matching the screenshot layout
    const columns = [
      { header: 'Name', width: 200 },
      { header: 'Phone', width: 120 },
      { header: 'Signed up', width: 100 },
      { header: 'Fee', width: 80 },
    ];

    let x = startX + this.checkboxSize + 10; // Start after checkbox space

    // Draw column headers
    this.doc.font('Helvetica-Bold').fontSize(11);
    columns.forEach((column) => {
      this.doc.text(column.header, x, y, { width: column.width, align: 'left' });
      x += column.width;
    });

    this.doc.moveDown(1.5);
    this.doc.font('Helvetica').fontSize(11);
  }

  /**
   * Retrieves a specific value from an attendee object based on a column ID.
   * (Kept for backward compatibility with tests)
   * @param {Object} attendee - The attendee object.
   * @param {string} id - The ID of the column/value to retrieve.
   * @returns {string} The formatted value for the specified ID.
   * @private
   */
  _getAttendeeValue(attendee, id) {
    switch (id) {
      case 'name':
        return this._formatName(attendee);
      case 'phone':
        return this._formatPhone(attendee);
      case 'signUpDate':
        return this._formatSignUpDate(attendee);
      case 'fee':
        return this._formatFee(attendee);
      case 'status':
        return attendee.isPaid ? 'Paid' : attendee.hasFee ? 'Owing' : 'No Fee';
      default:
        return attendee[id] || '';
    }
  }

  /**
   * Formats attendee name as "Firstname Lastname"
   * @param {Object} attendee - The attendee object
   * @returns {string} Formatted name
   * @private
   */
  _formatName(attendee) {
    const firstName = attendee.firstName || '';
    const lastName = attendee.lastName || '';
    return firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName;
  }

  /**
   * Formats phone number
   * @param {Object} attendee - The attendee object
   * @returns {string} Phone number
   * @private
   */
  _formatPhone(attendee) {
    return attendee.phone || '';
  }

  /**
   * Formats sign-up date
   * @param {Object} attendee - The attendee object
   * @returns {string} Formatted date
   * @private
   */
  _formatSignUpDate(attendee) {
    if (attendee.signUpDate == null) {
      return '';
    }
    return new Date(attendee.signUpDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  /**
   * Formats fee amount with currency symbol
   * @param {Object} attendee - The attendee object
   * @returns {string} Fee amount, "Membership", or empty string
   * @private
   */
  _formatFee(attendee) {
    // Check if it's a membership (no fee amount but has membership rule)
    if (attendee.rule && attendee.rule.name && attendee.rule.name.toLowerCase().includes('membership')) {
      return 'Membership';
    }

    // Format fee with dollar sign
    if (attendee.hasFee && attendee.rule && attendee.rule.fee) {
      return '$' + parseFloat(attendee.rule.fee).toFixed(2);
    }

    return '';
  }

  /**
   * Gets the color for fee text based on payment status
   * @param {Object} attendee - The attendee object
   * @returns {string} Color name for fee text
   * @private
   */
  _getFeeColor(attendee) {
    // Membership is always green/teal
    if (attendee.rule && attendee.rule.name && attendee.rule.name.toLowerCase().includes('membership')) {
      return '#008080'; // Teal color matching the sample
    }

    // Paid fees are green
    if (attendee.hasFee && attendee.isPaid) {
      return '#008080'; // Teal color matching the sample
    }

    // Unpaid fees are red
    if (attendee.hasFee && !attendee.isPaid) {
      return '#DC143C'; // Crimson red
    }

    // Default black for no fee
    return 'black';
  }

  /**
   * Generates a single row in the attendee table.
   * @param {Object} attendee - The attendee object for the row.
   * @param {number} y - The y-coordinate to draw the row at.
   * @private
   */
  _generateTableRow(attendee, y) {
    const startX = this.doc.page.margins.left;

    // Draw checkbox aligned with text baseline
    const checkboxY = y + 1; // Align top of checkbox with text
    this.doc.rect(startX, checkboxY, this.checkboxSize, this.checkboxSize).stroke();

    // Fixed column widths matching header
    const columns = [
      { value: this._formatName(attendee), width: 200, color: 'black' },
      { value: this._formatPhone(attendee), width: 120, color: 'black' },
      { value: this._formatSignUpDate(attendee), width: 100, color: 'black' },
      { value: this._formatFee(attendee), width: 80, color: this._getFeeColor(attendee) },
    ];

    let x = startX + this.checkboxSize + 10;

    // Draw column values with appropriate colors
    this.doc.font('Helvetica').fontSize(11);
    columns.forEach((column) => {
      this.doc.fillColor(column.color);
      this.doc.text(column.value, x, y, { width: column.width, align: 'left' });
      x += column.width;
    });

    // Reset to black for next row
    this.doc.fillColor('black');
  }

  /**
   * Generates the entire attendee table, handling page breaks.
   * @private
   */
  _generateTable() {
    const writePageHeader = () => {
      this._generateHeader();
      this._generateTableHeader();
    };

    writePageHeader();

    this.doc.on('pageAdded', writePageHeader);

    let y = this.doc.y;
    this.attendees.forEach((attendee) => {
      if (y + this.row_height > this.doc.page.height - this.doc.page.margins.bottom) {
        this.doc.addPage();
        y = this.doc.y;
      }
      this._generateTableRow(attendee, y);
      y += this.row_height;
      this.doc.y = y;
    });

    this.doc.off('pageAdded', writePageHeader);
  }

  /**
   * Generates the PDF and saves it to a file.
   * @param {string} outputFileName - The filename to save the output PDF file (will be sanitized).
   * @throws {Error} If outputFileName contains path traversal attempts
   */
  generate(outputFileName) {
    // Sanitize the output path to prevent path traversal attacks
    const safeOutputPath = sanitizeOutputPath(outputFileName);

    this.doc.pipe(fs.createWriteStream(safeOutputPath));
    this._generateTable();
    this.doc.end();
  }
}

module.exports = PdfGenerator;
module.exports.sanitizeOutputPath = sanitizeOutputPath;
