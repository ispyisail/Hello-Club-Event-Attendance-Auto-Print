const PDFDocument = require('pdfkit');
const fs = require('fs');

class PdfGenerator {
  constructor(event, attendees, layout) {
    this.event = event;
    this.attendees = attendees;
    this.layout = layout;
    this.doc = new PDFDocument({ size: 'A4', layout: 'portrait' });
    this.row_height = 30;
  }

  _generateHeader() {
    if (this.layout.logo && fs.existsSync(this.layout.logo)) {
      this.doc.image(this.layout.logo, {
        fit: [100, 50],
        align: 'center'
      });
      this.doc.moveDown();
    }

    this.doc.font('Helvetica-Bold').fontSize(14).text(this.event.name, { align: 'center' });
    this.doc.moveDown();

    const eventStartDate = new Date(this.event.startDate).toLocaleString('en-US', { timeZone: this.event.timezone, hour: '2-digit', minute: '2-digit', hour12: true });
    const eventEndDate = new Date(this.event.endDate).toLocaleString('en-US', { timeZone: this.event.timezone, hour: '2-digit', minute: '2-digit', hour12: true });
    const eventDate = new Date(this.event.startDate).toLocaleDateString('en-US', { timeZone: this.event.timezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    this.doc.font('Helvetica').fontSize(this.layout.fontSize).text(`${eventDate}, ${eventStartDate} - ${eventEndDate}`, { align: 'center' });
    this.doc.moveDown();

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    this.doc.font('Helvetica').fontSize(this.layout.fontSize).text(`Attendees as of ${formattedDate}, ${formattedTime}`, { align: 'center' });
    this.doc.moveDown(2);
  }

  _generateTableHeader() {
    this.doc.font('Courier-Bold');
    let y = this.doc.y;
    let x = 50;
    this.doc.rect(x, y, 10, 10).stroke(); // Checkbox for header
    x += 30;

    this.layout.columns.forEach(column => {
      this.doc.text(column.header, x, y, { width: column.width });
      x += column.width;
    });

    this.doc.moveDown();
    this.doc.font('Courier');
  }

  _getAttendeeValue(attendee, id) {
    switch (id) {
      case 'name':
        return (attendee.lastName || '') + ', ' + (attendee.firstName || '');
      case 'phone':
        return attendee.phone || '';
      case 'signUpDate':
        return new Date(attendee.signUpDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      case 'fee':
        return attendee.hasFee && attendee.rule && attendee.rule.fee ? `${attendee.rule.fee.toFixed(2)}` : '';
      case 'status':
        return attendee.isPaid ? 'Paid' : (attendee.hasFee ? 'Owing' : 'No Fee');
      default:
        return attendee[id] || '';
    }
  }

  _generateTableRow(attendee, y) {
    let x = 50;
    this.doc.rect(x, y, 10, 10).stroke();
    x += 30;

    this.layout.columns.forEach(column => {
      const value = this._getAttendeeValue(attendee, column.id);
      if (column.id === 'status') {
        if (value === 'Paid') {
          this.doc.fillColor('green');
        } else if (value === 'Owing') {
          this.doc.fillColor('red');
        } else {
          this.doc.fillColor('black');
        }
      }
      this.doc.text(value, x, y, { width: column.width });
      this.doc.fillColor('black'); // Reset color
      x += column.width;
    });
  }

  _generateTable() {
    const writePageHeader = () => {
      this._generateHeader();
      this._generateTableHeader();
    };

    writePageHeader();

    this.doc.on('pageAdded', writePageHeader);

    let y = this.doc.y;
    this.attendees.forEach(attendee => {
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

  generate(outputFileName) {
    this.doc.pipe(fs.createWriteStream(outputFileName));
    this._generateTable();
    this.doc.end();
  }
}

module.exports = PdfGenerator;
