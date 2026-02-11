# Configuration Guide

> Complete guide to configuring Hello Club Event Attendance Auto-Print

## Table of Contents

- [Overview](#overview)
- [Configuration Files](#configuration-files)
- [Environment Variables](#environment-variables)
- [Application Settings](#application-settings)
- [PDF Layout Configuration](#pdf-layout-configuration)
- [Email Configuration](#email-configuration)
- [Advanced Configuration](#advanced-configuration)
- [Configuration Examples](#configuration-examples)

## Overview

The application uses a two-file configuration approach:

1. **`.env`** - Secrets and credentials (never commit to version control)
2. **`config.json`** - Application settings (can be committed, contains no secrets)

### Configuration Priority

When the same setting exists in multiple places, this is the precedence order:

1. **Command-line arguments** (highest priority)
2. **Environment variables** (`.env` file)
3. **Configuration file** (`config.json`)
4. **Schema defaults** (lowest priority)

**Example**:

```bash
# config.json has: "fetchWindowHours": 24
# Command line: --fetch-window-hours 48
# Result: Uses 48 (CLI overrides config file)
```

## Configuration Files

### `.env` File

**Location**: Project root

**Purpose**: Store secrets and credentials

**Format**: KEY=value pairs (one per line)

**Security**:

- ✅ Listed in `.gitignore` (never committed)
- ✅ Required for application to run
- ✅ Should have restricted file permissions

**Template**:

```env
# Copy from .env.example and fill in your values
```

**How to Create**:

```bash
# Copy the example
copy .env.example .env

# Edit with your favorite editor
notepad .env
```

---

### `config.json` File

**Location**: Project root

**Purpose**: Application settings and preferences

**Format**: JSON

**Security**:

- ⚠️ Can be committed to version control (contains no secrets)
- ✅ Validated against Joi schema on startup

**How to Edit**:

```bash
notepad config.json
```

**Validation**:

- Happens automatically on application start
- Invalid configuration causes startup failure
- Error messages indicate the specific problem

## Environment Variables

### Required Variables

#### `API_KEY`

Your Hello Club API authentication key.

**Required**: ✅ Yes (always)

**Type**: String

**Format**: Any string (API key format varies by platform)

**Example**:

```env
API_KEY=hc_live_abc123xyz789...
```

**How to Obtain**:

1. Log into Hello Club
2. Navigate to Settings → API Keys
3. Create a new API key
4. Copy the key to `.env`

**Security Notes**:

- Never share this key
- Never commit it to version control
- Rotate keys periodically for security

---

### Email Printing Variables

These are only required if you use `printMode: "email"`.

#### `PRINTER_EMAIL`

Email address of the network printer or print server.

**Required**: Only for email mode

**Type**: Email address

**Example**:

```env
PRINTER_EMAIL=printer@mycompany.com
```

**How to Find**:

- Check your printer's network settings
- Some printers have built-in email addresses
- Your IT department can provide this

---

#### `SMTP_USER`

SMTP server username (often your email address).

**Required**: Only for email mode

**Type**: String (email address)

**Example**:

```env
SMTP_USER=myemail@gmail.com
```

**Gmail Users**: Use your full Gmail address

**Office 365/Outlook Users**: Use your full Outlook address

---

#### `SMTP_PASS`

SMTP server password or app-specific password.

**Required**: Only for email mode

**Type**: String

**Example**:

```env
SMTP_PASS=abcdefghijklmnop
```

**Gmail Users**: Must use [App Password](https://support.google.com/accounts/answer/185833), not your regular password

**How to Create Gmail App Password**:

Google App Passwords are required when using Gmail with this application. Follow these steps:

1. **Enable 2-Factor Authentication** (required for App Passwords)
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Under "2-Step Verification", click "Get started" and follow the setup

2. **Create an App Password**
   - Go to [Google Account](https://myaccount.google.com/)
   - Click "Security" in the left sidebar
   - Scroll down to "2-Step Verification" and click it
   - Scroll to the bottom and click "App passwords"
   - You may be asked to sign in again
   - Select "Mail" as the app and "Other" as the device
   - Enter a name like "Hello Club Printer"
   - Click "Generate"

3. **Copy the App Password**
   - Google will display a 16-character password like: `uwmo ybdz apyk pmfv`
   - **You can copy-paste it with or without spaces** - the application automatically removes all spaces
   - If you prefer, you can manually remove spaces: `uwmoybdzapykpmfv`
   - Paste it into your `.env` file or the Settings UI

4. **Important Notes**
   - You can only see the password once - save it somewhere safe
   - If you lose it, just delete it and create a new one
   - Spaces in the password are automatically removed, so don't worry if you copy it with spaces

**Outlook Users**: May use regular password or app password

---

#### `SMTP_HOST`

SMTP server hostname.

**Required**: Only for email mode

**Type**: String (hostname)

**Default**: `smtp.gmail.com`

**Common Values**:

```env
# Gmail
SMTP_HOST=smtp.gmail.com

# Outlook/Office 365
SMTP_HOST=smtp.office365.com

# Yahoo
SMTP_HOST=smtp.mail.yahoo.com

# Custom server
SMTP_HOST=mail.yourcompany.com
```

---

#### `SMTP_PORT`

SMTP server port number.

**Required**: Only for email mode

**Type**: Number

**Default**: `587`

**Common Values**:

```env
# TLS (recommended)
SMTP_PORT=587

# SSL
SMTP_PORT=465

# Unencrypted (not recommended)
SMTP_PORT=25
```

**Which Port to Use**:

- **587** (TLS) - Recommended for most providers
- **465** (SSL) - Alternative secure option
- **25** (Unencrypted) - Only for internal networks

---

#### `EMAIL_FROM`

Sender email address (appears in "From" field).

**Required**: Only for email mode

**Type**: Email address

**Default**: Same as `SMTP_USER`

**Example**:

```env
EMAIL_FROM=autoprint@mycompany.com
```

**Note**: Some SMTP servers require this to match `SMTP_USER`

---

### Optional Variables

#### `API_BASE_URL`

Hello Club API base URL (for testing).

**Required**: No

**Type**: URL

**Default**: `https://api.helloclub.com`

**Example**:

```env
API_BASE_URL=https://api-staging.helloclub.com
```

**When to Use**: Only when directed by Hello Club support for testing

---

## Application Settings

### config.json Structure

```json
{
  "categories": [],
  "preEventQueryMinutes": 5,
  "fetchWindowHours": 24,
  "serviceRunIntervalHours": 1,
  "outputFilename": "attendees.pdf",
  "printMode": "local",
  "pdfLayout": { ... }
}
```

### Settings Reference

#### `categories`

Array of event category names to process.

**Type**: `Array<string>`

**Default**: `[]` (process all categories)

**Example**:

```json
{
  "categories": ["NBA - Junior Events", "Pickleball"]
}
```

**Behavior**:

- **Empty array** `[]` → Process ALL categories
- **With values** → Only process events matching these categories
- **Case sensitive** → Must match exactly

**How to Find Category Names**:

1. Log into Hello Club
2. View an event
3. Check the "Categories" field
4. Use the exact category name

---

#### `preEventQueryMinutes`

How many minutes before an event starts to fetch the latest attendee list, generate the PDF, and print it. For example, `5` means the PDF will be ready 5 minutes before the event begins.

**Type**: `number` (integer, min: 1)

**Default**: `5`

**Unit**: Minutes

**Example**:

```json
{
  "preEventQueryMinutes": 10
}
```

**Recommendations**:

- **5 minutes** - Captures last-minute sign-ups, PDF ready just before event
- **10 minutes** - More buffer time for printing/delivery before event starts
- **30 minutes** - PDF ready well in advance, but may miss late registrations

**Trade-offs**:

- **Smaller value**: More up-to-date attendee list, but less time buffer before event
- **Larger value**: PDF printed earlier before event, more time to handle printing issues, but may miss last-minute sign-ups

---

#### `fetchWindowHours`

How many hours ahead to look for upcoming events.

**Type**: `number` (integer, min: 1)

**Default**: `24`

**Unit**: Hours

**Example**:

```json
{
  "fetchWindowHours": 48
}
```

**Recommendations**:

- **24 hours** - Good for daily operations
- **48 hours** - Good for weekend events
- **168 hours** - Fetch week ahead

**Note**: Fetching too far ahead may include events you don't need yet

---

#### `serviceRunIntervalHours`

How often the service re-fetches the event list.

**Type**: `number` (integer, min: 1)

**Default**: `1`

**Unit**: Hours

**Example**:

```json
{
  "serviceRunIntervalHours": 2
}
```

**Recommendations**:

- **1 hour** - Recommended for most use cases
- **2 hours** - For slower-changing schedules
- **0.25 hours** (15 min) - For very dynamic schedules

**Note**: Scheduled events are still processed on time even if this is set high

---

#### `outputFilename`

Filename for generated PDF files.

**Type**: `string`

**Default**: `"attendees.pdf"`

**Example**:

```json
{
  "outputFilename": "event-list.pdf"
}
```

**Behavior**:

- PDF is created in project root directory
- File is overwritten for each event
- To keep multiple PDFs, use different filenames per event

**Tips**:

- Use `.pdf` extension
- Avoid special characters in filename
- Use descriptive names if manually reviewing

---

#### `printMode`

Printing method to use.

**Type**: `"local"` or `"email"`

**Default**: `"email"`

**Options**:

**`"local"`** - Print directly to local printer

- Requires: SumatraPDF installed (Windows)
- Uses: `pdf-to-printer` npm package
- Sends to: Default Windows printer

**`"email"`** - Send PDF via email to network printer

- Requires: SMTP credentials in `.env`
- Uses: Nodemailer
- Sends to: Email address specified in `PRINTER_EMAIL`

**Example**:

```json
{
  "printMode": "local"
}
```

**Choosing Print Mode**:

- ✅ **Local**: Fast, simple, works offline
- ✅ **Email**: Network printers, remote printing, print queues

---

## PDF Layout Configuration

### `pdfLayout` Object

**Type**: `object`

**Purpose**: Customize PDF appearance

**Structure**:

```json
{
  "pdfLayout": {
    "logo": null,
    "fontSize": 10,
    "columns": [ ... ]
  }
}
```

### Layout Properties

#### `logo`

Path to logo image file to display at top of PDF.

**Type**: `string | null`

**Default**: `null` (no logo)

**Supported Formats**: PNG, JPG

**Example**:

```json
{
  "pdfLayout": {
    "logo": "./assets/company-logo.png"
  }
}
```

**Sizing**: Logo is automatically resized to fit (max 100x50 pixels)

**Placement**: Centered at top of first page

---

#### `fontSize`

Base font size for PDF text.

**Type**: `number` (min: 1)

**Default**: `10`

**Unit**: Points

**Example**:

```json
{
  "pdfLayout": {
    "fontSize": 12
  }
}
```

**Recommendations**:

- **8-9**: Small, fits more data
- **10**: Default, balanced
- **12**: Larger, more readable

**Note**: Header text is automatically larger (relative to this value)

---

#### `columns`

Array of column definitions for the attendee table.

**Type**: `Array<ColumnDefinition>`

**Structure**:

```json
{
  "columns": [
    {
      "id": "name",
      "header": "Name",
      "width": 140
    }
  ]
}
```

**ColumnDefinition Properties**:

##### `id` (required)

Data field to display.

**Type**: `string`

**Available IDs**:

- `"name"` - Full name (lastName, firstName)
- `"phone"` - Phone number
- `"signUpDate"` - Registration date
- `"fee"` - Fee amount
- `"status"` - Payment status (Paid/Owing/No Fee)
- Any other field from Hello Club API attendee object

##### `header` (required)

Column header text.

**Type**: `string`

**Example**: `"Name"`, `"Phone"`, `"Registered"`

##### `width` (required)

Column width in points.

**Type**: `number`

**Unit**: Points (1/72 inch)

**Example**: `140`

**Tips**:

- Total width should be ≤ 500 for A4 page with margins
- Name column: 120-160 points
- Phone column: 80-100 points
- Date column: 80-100 points
- Fee column: 50-70 points
- Status column: 80-100 points

### Default Column Configuration

```json
{
  "columns": [
    { "id": "name", "header": "Name", "width": 140 },
    { "id": "phone", "header": "Phone", "width": 100 },
    { "id": "signUpDate", "header": "Signed up", "width": 100 },
    { "id": "fee", "header": "Fee", "width": 60 },
    { "id": "status", "header": "Status", "width": 90 }
  ]
}
```

**Total Width**: 490 points (fits A4 with margins)

### Custom Column Examples

#### Minimal Layout

```json
{
  "columns": [
    { "id": "name", "header": "Name", "width": 200 },
    { "id": "phone", "header": "Contact", "width": 150 }
  ]
}
```

#### Detailed Layout

```json
{
  "columns": [
    { "id": "name", "header": "Attendee", "width": 120 },
    { "id": "phone", "header": "Phone", "width": 85 },
    { "id": "email", "header": "Email", "width": 120 },
    { "id": "signUpDate", "header": "Registered", "width": 75 },
    { "id": "status", "header": "Status", "width": 80 }
  ]
}
```

## Email Configuration

### Full Email Example

```json
{
  "printMode": "email",
  "email": {
    "to": "printer@company.com",
    "from": "events@company.com",
    "transport": {
      "host": "smtp.gmail.com",
      "port": 587,
      "secure": false,
      "auth": {
        "user": "events@company.com",
        "pass": "app-password-here"
      }
    }
  }
}
```

**Note**: This email config in `config.json` is **deprecated**. Use `.env` variables instead (see [Email Printing Variables](#email-printing-variables)).

## Advanced Configuration

### Multiple Event Categories

```json
{
  "categories": ["Basketball - Adults", "Basketball - Youth", "Volleyball - All Ages", "Tennis - Tournaments"]
}
```

### Aggressive Scheduling

For high-volume or fast-changing events:

```json
{
  "fetchWindowHours": 12,
  "serviceRunIntervalHours": 0.5,
  "preEventQueryMinutes": 2
}
```

**This configuration**:

- Checks for events every 12 hours
- Re-fetches event list every 30 minutes
- Prints 2 minutes before event start

### Conservative Scheduling

For stable schedules with few last-minute changes:

```json
{
  "fetchWindowHours": 168,
  "serviceRunIntervalHours": 24,
  "preEventQueryMinutes": 30
}
```

**This configuration**:

- Looks ahead 1 week
- Re-fetches list daily
- Prints 30 minutes early

## Configuration Examples

### Example 1: Local Printing, Single Category

```json
{
  "categories": ["NBA - Junior Events"],
  "preEventQueryMinutes": 5,
  "fetchWindowHours": 24,
  "serviceRunIntervalHours": 1,
  "outputFilename": "junior-basketball.pdf",
  "printMode": "local",
  "pdfLayout": {
    "logo": null,
    "fontSize": 10,
    "columns": [
      { "id": "name", "header": "Player Name", "width": 160 },
      { "id": "phone", "header": "Parent Phone", "width": 110 },
      { "id": "status", "header": "Paid", "width": 90 }
    ]
  }
}
```

**Use Case**: Basketball club printing attendance for drop-in sessions

---

### Example 2: Email Printing, Multiple Categories

```json
{
  "categories": ["Pickleball - Beginner", "Pickleball - Intermediate", "Pickleball - Advanced"],
  "preEventQueryMinutes": 10,
  "fetchWindowHours": 48,
  "serviceRunIntervalHours": 2,
  "outputFilename": "pickleball-attendance.pdf",
  "printMode": "email",
  "pdfLayout": {
    "logo": "./assets/club-logo.png",
    "fontSize": 11,
    "columns": [
      { "id": "name", "header": "Player", "width": 140 },
      { "id": "phone", "header": "Phone", "width": 100 },
      { "id": "fee", "header": "Drop-in Fee", "width": 70 },
      { "id": "status", "header": "Status", "width": 80 }
    ]
  }
}
```

**Use Case**: Sports facility with network printer at front desk

---

### Example 3: Minimal Configuration (All Defaults)

```json
{
  "categories": []
}
```

**Behavior with Defaults**:

- Process ALL event categories
- Print 5 minutes before event
- Look ahead 24 hours
- Check for events every hour
- Print via email
- Use default PDF layout
- Save as `attendees.pdf`

---

## Configuration Validation

### Validation on Startup

The application validates `config.json` against the Joi schema when it starts.

**Valid Configuration**: Application starts normally

**Invalid Configuration**: Application exits with error message

### Example Error Messages

```
Invalid configuration in config.json:
  "preEventQueryMinutes" must be greater than or equal to 1

Invalid configuration in config.json:
  "printMode" must be one of [local, email]

Invalid configuration in config.json:
  "columns[0].width" is required
```

### How to Fix Validation Errors

1. Read the error message carefully
2. Open `config.json` in an editor
3. Fix the indicated field
4. Save the file
5. Restart the application

### Testing Your Configuration

```bash
# Test configuration without running service
node src/index.js --help

# If config is valid, you'll see the help message
# If config is invalid, you'll see validation errors
```

---

**Last Updated**: 2024-12-20
