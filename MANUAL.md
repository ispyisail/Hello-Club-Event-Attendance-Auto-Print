# Operating Manual: Hello Club Attendee Printer

## 1. Overview

This command-line tool automates the generation of event attendee lists from the Hello Club API. It uses an efficient, two-stage process to minimize API usage and ensure the final printout is highly accurate.

The system works in two stages:
1.  **Stage 1: Fetching Events**: The tool first queries the Hello Club API for all events occurring within a set time frame (e.g., the next 24 hours) and stores them in a local database. This is done with the `fetch-events` command.
2.  **Stage 2: Processing and Printing**: The tool then constantly monitors the local database. When a stored event is about to begin (e.g., 5 minutes before its start time), it performs a final, up-to-the-minute query for that specific event's attendees and generates a printable PDF. This is done with the `process-schedule` command.

This manual provides instructions on how to install, configure, and operate the tool.

---

## 2. Installation

1.  Ensure you have [Node.js](https://nodejs.org/) installed on your system.
2.  Open a command prompt or terminal in the project directory.
3.  Install the required packages by running the command:
    ```bash
    npm install
    ```

---

## 3. Configuration

The tool is configured using two files: `.env` for your secret API key and `config.json` for all other settings.

### 3.1. API Key (`.env` file)

This file stores your private Hello Club API key and email settings.

1.  Create a file named `.env` in the project directory.
2.  Add your API key to the file in the following format. `API_KEY` is always required. The email-related variables are only needed if you intend to use the `email` print mode.
    ```
    # Required for API access
    API_KEY=your_key_here

    # Required for Email Printing Mode
    PRINTER_EMAIL=your_printer_email_address@domain.com
    SMTP_USER=your_email_address
    SMTP_PASS=your_email_app_password
    EMAIL_FROM=your_email_address
    ```

### 3.2. Main Settings (`config.json` file)

This file controls the main behavior of the script. Default values are used if a setting is not present.

```json
{
  "categories": ["NBA - Junior Events"],
  "fetchWindowHours": 24,
  "preEventQueryMinutes": 5,
  "outputFilename": "attendees.pdf",
  "pdfLayout": { ... }
}
```

*   `"categories"`: An array of event category names. The `fetch-events` command will only store events that match one of the categories in this list. If the list is empty (`[]`), it will store all upcoming events.
*   `"fetchWindowHours"`: A number representing the time window in hours to look ahead for events when you run `fetch-events`. Default is `24`.
*   `"preEventQueryMinutes"`: A number representing how many minutes before an event's start time the `process-schedule` command should query for the final attendee list and generate the printout. Default is `5`.
*   `"outputFilename"`: The default name of the PDF file that will be generated.

### 3.3. PDF Layout (`pdfLayout` object)

This section within `config.json` controls the appearance of the generated PDF. You can add, remove, or reorder columns.

```json
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
```
*   `"logo"`: The full file path to an image to display as a logo (e.g., `"C:\\Users\\YourName\\logo.png"`). Use `null` to disable.
*   `"fontSize"`: The base font size for text.
*   `"columns"`: An array defining the table columns. The `"id"` must match a data field from the Hello Club API.

---

## 4. Running the Application

The application is run from the command line using one of two commands.

### 4.1. `fetch-events` Command

This command finds and stores upcoming events. It should be run periodically.

**Usage:**
```bash
node index.js fetch-events [options]
```

**Options:**
*   `--category "Category Name"` or `-c "Category Name"`: Temporarily overrides the `categories` in `config.json`. Use the flag multiple times for multiple categories.
*   `--fetch-window-hours <hours>` or `--fwh <hours>`: Temporarily overrides the `fetchWindowHours` in `config.json`.

### 4.2. `process-schedule` Command

This command processes stored events that are about to start. It should be run frequently.

**Usage:**
```bash
node index.js process-schedule [options]
```

**Options:**
*   `--pre-event-query-minutes <minutes>` or `-w <minutes>`: Temporarily overrides the `preEventQueryMinutes` in `config.json`.
*   `--output <filename>` or `-o <filename>`: Temporarily changes the name of the output file.
*   `--print-mode <mode>` or `-p <mode>`: Sets the print mode (`local` or `email`), overriding the config.
*   `--help` or `-h`: Displays a list of all available commands and options.

### 4.3. `start-service` Command

This is the primary command for running the application as a continuous, long-running service. It combines the functionality of `fetch-events` and `process-schedule` into a single, automated process. The service will periodically fetch new events and constantly monitor the schedule to process and print attendee lists as they become due.

**Usage:**
```bash
node index.js start-service [options]
```

**Options:**
This command accepts all options available to the `fetch-events` and `process-schedule` commands. For example, you can start the service with a custom category and print mode like this:
```bash
node index.js start-service --category "My Events" -p email
```

---

## 5. Running the Application as a Service

To achieve full automation, the application must be run as a persistent service. The recommended way is to use the `start-service` command with a process manager like `pm2`. Alternatively, you can use the native task scheduler of your operating system.

### 5.1. Method 1: Using Windows Task Scheduler

To achieve automation on Windows without a process manager, you can create **two separate scheduled tasks** to run the `fetch-events` and `process-schedule` commands independently. Note that this method is less efficient than using the unified `start-service` command.

### Task 1: Fetch Events (Periodic)
1.  Open **Task Scheduler** and **Create Task...** (not Basic Task).
2.  **Name:** "Hello Club - Fetch Events".
3.  **Trigger:** Create a new trigger. Set it to run **Daily** and repeat the task **every 1 hour** (or your desired interval) indefinitely.
4.  **Action:** Create a new action.
    *   **Program/script:** Full path to `node.exe`.
    *   **Add arguments:** `index.js fetch-events`
    *   **Start in:** Full path to your project directory.

### Task 2: Process Schedule (Frequent)
1.  Open **Task Scheduler** and **Create Task...**.
2.  **Name:** "Hello Club - Process Schedule".
3.  **Trigger:** Create a new trigger. Set it to run **Daily** and repeat the task **every 1 minute** (or your desired interval) indefinitely.
4.  **Action:** Create a new action.
    *   **Program/script:** Full path to `node.exe`.
    *   **Add arguments:** `index.js process-schedule`
    *   **Start in:** Full path to your project directory.

### 5.2. Method 2: Using PM2 (Recommended)

PM2 is a production process manager for Node.js applications with a built-in load balancer. It allows you to keep applications alive forever, to reload them without downtime, and to facilitate common system admin tasks.

**1. Install PM2**

If you don't have PM2 installed, you can install it globally using `npm`:
```bash
npm install pm2 -g
```

**2. Start the Service**

Navigate to the project directory and use the following command to start the application with PM2. This command uses the `start-service` instruction, which runs the entire fetch and process cycle continuously.
```bash
pm2 start npm --name "hello-club-service" -- run start
```
This command tells PM2 to use `npm` to run the `start` script from your `package.json` file. The `--name` flag assigns a custom name to your process, making it easier to manage.

**3. Managing the Service**

Here are some common commands for managing your service with PM2:

*   **List all running processes:**
    ```bash
    pm2 list
    ```
*   **View logs for your service:**
    ```bash
    pm2 logs hello-club-service
    ```
*   **Restart the service:**
    ```bash
    pm2 restart hello-club-service
    ```
*   **Stop the service:**
    ```bash
    pm2 stop hello-club-service
    ```
*   **Delete the service from PM2's list:**
    ```bash
    pm2 delete hello-club-service
    ```

Using PM2 is the recommended way to run this application in a production environment as it provides robustness and easy management.

---

## 6. Troubleshooting

*   **Error: "401 Unauthorized"**: Your `API_KEY` in the `.env` file is incorrect or has expired.
*   **Message: "No new events to store"**: The `fetch-events` command ran but did not find any new events that matched your category filters within the `fetchWindowHours`.
*   **Message: "No events to process"**: The `process-schedule` command ran but no stored events were scheduled to start within the `preEventQueryMinutes`.
*   **Database is never populated**: Ensure you are running the `fetch-events` command and that your category filters in `config.json` are correct.
*   **Events are not being printed**: Ensure you are running the `process-schedule` command frequently. Check that `preEventQueryMinutes` is set to a reasonable value.
