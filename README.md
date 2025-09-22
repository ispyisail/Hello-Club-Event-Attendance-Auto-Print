# Hello Club - Event Attendee Printout

## Description

This command-line tool provides a robust, two-stage process for automatically generating and printing attendee lists for upcoming events from the Hello Club API. It is designed to be efficient by minimizing API calls while ensuring the final attendee list is as up-to-date as possible.

The workflow is split into two main commands:
1.  **`fetch-events`**: This command queries the Hello Club API for all upcoming events within a configurable time window (e.g., the next 24 hours). It then stores these events in a local database. This command is designed to be run periodically (e.g., once every hour).
2.  **`process-schedule`**: This command checks the local database for stored events that are about to start. When an event is within a configurable time window (e.g., 5 minutes from its start time), it makes one final API call to get the latest attendee list and generates a printable PDF. This command is designed to be run frequently (e.g., once every minute).

This two-stage approach ensures that the Hello Club API is not queried excessively, while the final printout is generated just moments before the event begins, capturing last-minute sign-ups.

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (which includes npm)

## Installation

1. Clone the repository or download the files to a directory on your computer.
2. Open a command prompt or terminal in the project directory.
3. Install the required npm packages by running the following command:
    ```bash
    npm install
    ```

## Configuration

There are two configuration files you need to set up:

### 1. API Key & Email Configuration (`.env` file)

This file stores your Hello Club API key and the settings for email printing.

1. Create a file named `.env` in the root of the project directory.
2. Add your configuration to the file in the following format. The `API_KEY` is always required. The other variables are only needed if you use the `email` print mode.

    ```
    # Required for API access
    API_KEY=your_hello_club_api_key

    # Required for Email Printing Mode (Defaults are for Gmail)
    PRINTER_EMAIL=your_printer_email_address@domain.com
    SMTP_USER=your_gmail_username_or_app_password
    SMTP_PASS=your_gmail_app_password
    EMAIL_FROM=sender_address@example.com
    ```

### 2. Event & Print Settings (`config.json` file)

This file allows you to specify the default behavior for the script. Command-line options will always override the settings in this file.

Example `config.json`:
```json
{
  "categories": ["NBA - Junior Events", "Pickleball"],
  "fetchWindowHours": 24,
  "preEventQueryMinutes": 5,
  "outputFilename": "attendees.pdf",
  "pdfLayout": {
    "logo": null,
    "fontSize": 10,
    "columns": [
      { "id": "name", "header": "Name", "width": 140 },
      { "id": "phone", "header": "Phone", "width": 100 },
      { "id": "signUpDate", "header": "Signed up", "width": 100 },
      { "id": "fee", "header": "Fee", "width": 60 },
      { "id": "status", "header": "Status", "width": 90 }
    ]
  }
}
```
- `categories`: A list of event category names to process.
- `fetchWindowHours`: The time window in hours to look ahead for upcoming events when running `fetch-events`. (Default: 24)
- `preEventQueryMinutes`: The time in minutes before an event starts to perform the final query for attendees. This is used by `process-schedule`. (Default: 5)
- `outputFilename`: The default name for the generated PDF file. (Default: "attendees.pdf")
- `pdfLayout`: Configuration for the PDF's appearance.

## Project Structure

- `index.js`: The main entry point of the application.
- `functions.js`: Contains the core logic for fetching data, processing events, and generating the output.
- `database.js`: Manages the connection and setup for the local SQLite database.
- `args-parser.js`: Configures and parses command-line arguments using `yargs`.
- `config-schema.js`: Defines the validation schema for the `config.json` file.
- `pdf-generator.js`: A class responsible for creating the PDF document.
- `email-service.js`: Handles sending emails with attachments.
- `logger.js`: Sets up a logger for application activity and errors.

## Running the Script Manually

The script operates using two distinct commands. You must run them separately.

### 1. Fetching and Storing Events
This command finds upcoming events and saves them to the local database.

```bash
node index.js fetch-events
```

**Options:**
- `--category "Category Name"` (or `-c`): Specify an event category to filter by, overriding the config file. Can be used multiple times.
- `--fetch-window-hours <hours>` (or `--fwh`): Specify the time window in hours to look for events, overriding the config file.

### 2. Processing and Printing Events
This command checks the database for events that are about to start and prints the attendee list.

```bash
node index.js process-schedule
```

**Options:**
- `--pre-event-query-minutes <minutes>` (or `-w`): Set the time window in minutes before an event starts to trigger the printout, overriding the config file.
- `--output <filename>` (or `-o`): Define the name of the output PDF file.
- `--print-mode <mode>` (or `-p`): Choose the printing method: `email` or `local`.

## Scheduling the Script

To fully automate the tool, you must schedule **two separate tasks**.

### Task 1: Fetch Events (Run Periodically)

This task runs `fetch-events` to keep the local event list up-to-date.
- **Frequency:** Every 1 to 4 hours is usually sufficient.
- **Command:** `node index.js fetch-events`

### Task 2: Process Schedule (Run Frequently)

This task runs `process-schedule` to check if any events are due for printing.
- **Frequency:** Every 1 to 5 minutes.
- **Command:** `node index.js process-schedule`

### Example: Scheduling on Windows using Task Scheduler

You would create two separate tasks.

**Task 1: "Hello Club - Fetch Events"**
- **Trigger:** Daily, repeat task every **1 hour**.
- **Action:**
    - Program/script: `C:\Program Files\nodejs\node.exe`
    - Add arguments: `index.js fetch-events`
    - Start in: `C:\path\to\your\project`

**Task 2: "Hello Club - Process Schedule"**
- **Trigger:** Daily, repeat task every **1 minute**.
- **Action:**
    - Program/script: `C:\Program Files\nodejs\node.exe`
    - Add arguments: `index.js process-schedule`
    - Start in: `C:\path\to\your\project`

## Running as a Service (Windows, macOS, & Linux)

For a more robust, long-term solution, it is recommended to run the application as a background service. This ensures it's always running and will restart automatically if the server reboots. The best way to do this for a Node.js application is with a process manager called **PM2**.

### 1. Install PM2
If you don't have PM2 installed, open your terminal or command prompt and run:
```bash
npm install pm2 -g
```

### 2. Start the Service
Navigate to the project directory and use the following command to start the application with PM2. This single command replaces the need for two separate scheduled tasks.

```bash
pm2 start index.js --name "hello-club-service" -- start-service
```
- `pm2 start index.js`: Tells PM2 to run the `index.js` file.
- `--name "hello-club-service"`: Gives the process a memorable name.
- `-- start-service`: This is a crucial part. The `--` tells `pm2` to pass the `start-service` argument to `index.js`.

### 3. Enable Automatic Startup
To ensure the service starts when your computer boots, run the following command and follow the on-screen instructions. PM2 will generate the necessary scripts for your specific operating system (Windows, macOS, or Linux).

```bash
pm2 startup
```
You may need to copy and paste a command that PM2 gives you.

### 4. Saving the Process List
After enabling startup, you need to save the current process list so PM2 knows what to restart.
```bash
pm2 save
```

### Managing the Service
Here are some common commands for managing the service:
- **Check status:** `pm2 status`
- **View logs:** `pm2 logs hello-club-service`
- **Stop the service:** `pm2 stop hello-club-service`
- **Restart the service:** `pm2 restart hello-club-service`
- **Delete the service:** `pm2 delete hello-club-service`
