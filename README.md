# Hello Club - Event Attendee Printout

## Description

This command-line tool provides a robust, automated solution for generating and printing attendee lists for upcoming events from the Hello Club API. It is designed to be efficient by minimizing API calls while ensuring the final attendee list is as up-to-date as possible.

## Features

- **Automated Event Fetching**: Automatically finds upcoming events within a configurable time window.
- **Just-in-Time Attendee Lists**: Fetches the final attendee list moments before an event starts to capture last-minute sign-ups.
- **Efficient API Usage**: A two-stage process reduces the load on the Hello Club API.
- **PDF Generation**: Creates a clean, printable PDF of the attendee list.
- **Flexible Printing**: Supports printing to local printers or sending the PDF to a printer's email address.
- **Highly Configurable**: Customize event categories, time windows, PDF layout, and more.
- **Run as a Service**: Designed to run continuously in the background using a process manager like PM2.

## How It Works

The tool can be run as a continuous service or as two separate, scheduled commands.

### The Two-Stage Process

The core logic is split into two stages to ensure efficiency and accuracy:

1.  **`fetch-events`**: This command queries the Hello Club API for all upcoming events within a configurable time window (e.g., the next 24 hours). It then stores these events in a local database. This command is designed to be run periodically (e.g., once every hour).
2.  **`process-schedule`**: This command checks the local database for stored events that are about to start. When an event is within a configurable time window (e.g., 5 minutes from its start time), it makes one final API call to get the latest attendee list and generates a printable PDF. This command is designed to be run frequently (e.g., once every minute).

### The `start-service` Command

For ease of use, the `start-service` command combines both stages into a single, long-running process. It will periodically fetch events and constantly monitor the schedule to process printouts automatically. This is the recommended way to run the application.

## Getting Started

This guide will get you up and running quickly. For more detailed information, please refer to the sections below.

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print.git
    cd Hello-Club-Event-Attendance-Auto-Print
    ```

2.  **Configure Environment**
    Create a `.env` file in the project root. You can copy the example file to get started:
    ```bash
    cp .env.example .env
    ```
    Now, edit the `.env` file and add your Hello Club `API_KEY`.

3.  **Install Dependencies**
    ```bash
    npm install
    ```

4.  **Run the Service**
    The easiest way to run the application is to use the `start-service` command, which handles everything automatically.
    ```bash
    npm start
    ```
    The service will now be running in the foreground. For production use, it is recommended to run this as a background service using a process manager like PM2 (see "Running as a Service" below).

---

## Installation

### Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js**: This project is built on Node.js. You can download it from [https://nodejs.org/](https://nodejs.org/).
- **npm**: The Node Package Manager is included with Node.js and is used to manage the project's dependencies.
- **Git**: You will need Git to clone the repository. You can download it from [https://git-scm.com/](https://git-scm.com/).

### Build Tools for `sqlite3`

One of this project's dependencies (`sqlite3`) may need to be compiled from source, which requires a build toolchain.

- **Python**: Required by the `node-gyp` build tool. You can download it from [https://www.python.org/](https://www.python.org/).
- **C++ Compiler**:
    - **Windows:** Install the "Desktop development with C++" workload from the [Visual Studio Installer](https://visualstudio.microsoft.com/downloads/).
    - **macOS:** Install the Xcode Command Line Tools by running `xcode-select --install`.
    - **Linux:** Install a compiler like GCC (e.g., `sudo apt install build-essential`).

> **Important for Python 3.12+ Users:** The `distutils` module has been removed from Python 3.12 and newer, which can cause an error when `node-gyp` tries to build `sqlite3`. To fix this, you must manually install `setuptools`:
>
> ```bash
> pip install setuptools
> ```

### Local Printing Requirements

To print PDFs directly to a physical printer (`--print-mode local`), you may need additional software:

-   **Windows:** You must install **SumatraPDF**. You can download it from [https://www.sumatrapdfreader.org/free-pdf-reader](https://www.sumatrapdfreader.org/free-pdf-reader).
-   **macOS/Linux:** A printer must be configured through the system's printing service (e.g., CUPS).

### Installation Steps

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print.git
    ```

2.  **Navigate to the project directory:**
    ```bash
    cd Hello-Club-Event-Attendance-Auto-Print
    ```

3.  **Install the dependencies:**
    ```bash
    npm install
    ```

## Configuration

The tool is configured using two files: `.env` for secrets and `config.json` for settings.

### 1. API Key & Email (`.env` file)

This file stores your Hello Club API key and email settings for the email print mode.

1.  Create a file named `.env` in the root of the project directory.
2.  Add your configuration to the file. `API_KEY` is always required. The other variables are only needed if you use the `email` print mode.

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
  "serviceRunIntervalHours": 1,
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
- `categories`: A list of event category names to process. An empty list `[]` processes all categories.
- `fetchWindowHours`: How many hours to look ahead for upcoming events. (Default: 24)
- `preEventQueryMinutes`: How many minutes before an event starts to perform the final query for attendees. (Default: 5)
- `serviceRunIntervalHours`: How often (in hours) the `start-service` command should re-fetch the list of upcoming events. (Default: 1)
- `outputFilename`: The default name for the generated PDF file. (Default: "attendees.pdf")
- `pdfLayout`: Configuration for the PDF's appearance. The `"id"` for a column must match a data field from the Hello Club API.

## Usage

The application can be run using one of three commands.

### `fetch-events`

Finds and stores upcoming events. Should be run periodically if not using the `start-service` command.

**Usage:**
```bash
node src/index.js fetch-events [options]
```

**Options:**
- `--category "Category Name"` (`-c`): Overrides the `categories` in `config.json`. Use the flag multiple times for multiple categories.
- `--fetch-window-hours <hours>` (`--fwh`): Overrides the `fetchWindowHours` in `config.json`.

### `process-schedule`

Processes stored events that are about to start. Should be run frequently if not using the `start-service` command.

**Usage:**
```bash
node src/index.js process-schedule [options]
```

**Options:**
- `--pre-event-query-minutes <minutes>` (`-w`): Overrides the `preEventQueryMinutes` in `config.json`.
- `--output <filename>` (`-o`): Overrides the `outputFilename` in `config.json`.
- `--print-mode <mode>` (`-p`): Sets the print mode (`local` or `email`).

### `start-service`

Runs the entire fetch and process cycle continuously. **This is the recommended command for automation.**

**Usage:**
```bash
node src/index.js start-service [options]
```
This command accepts all options available to `fetch-events` and `process-schedule`.

## Running as a Service (Automation)

To achieve full automation, the application should be run as a persistent background service.

### Method 1: Using PM2 (Recommended)

PM2 is a production process manager for Node.js applications that keeps your service alive.

**1. Install PM2**
If you don't have PM2 installed, install it globally using `npm`:
```bash
npm install pm2 -g
```

**2. Start the Service**
Navigate to the project directory and use the following command to start the application with PM2.
```bash
pm2 start src/index.js --name "hello-club-service" -- -- start-service
```
- `pm2 start src/index.js`: Tells PM2 to execute the main script at `src/index.js`. Using the script file directly is more reliable than using `npm` across different platforms.
- `--name "hello-club-service"`: Gives the process a memorable name.
- `-- -- start-service`: The double dash (`--`) separates `pm2` options from your script's arguments. `start-service` is the command passed to your application.

**3. Enable Automatic Startup**
To ensure the service restarts when your computer reboots, run this command and follow the on-screen instructions:
```bash
pm2 startup
```

**4. Save the Process List**
Save the current process list so PM2 knows what to restart on boot:
```bash
pm2 save
```

**5. Managing the Service**
- **Check status:** `pm2 status`
- **View logs:** `pm2 logs hello-club-service`
- **Stop the service:** `pm2 stop hello-club-service`
- **Restart the service:** `pm2 restart hello-club-service`
- **Delete the service:** `pm2 delete hello-club-service`

### Method 2: Using Windows Task Scheduler (Alternative)

If you are on Windows and prefer not to use PM2, you can schedule two separate tasks.

**Task 1: Fetch Events (Run Periodically)**
- **Frequency:** Every 1 to 4 hours.
- **Action:**
    - Program/script: `C:\Program Files\nodejs\node.exe`
    - Add arguments: `src/index.js fetch-events`
    - Start in: `C:\path\to\your\project`

**Task 2: Process Schedule (Run Frequently)
- **Frequency:** Every 1 to 5 minutes.
- **Action:**
    - Program/script: `C:\Program Files\nodejs\node.exe`
    - Add arguments: `src/index.js process-schedule`
    - Start in: `C:\path\to\your\project`

## Testing

To run the automated tests, use the following command:
```bash
npm test
```

To see the test coverage, run:
```bash
npm run coverage
```

## Troubleshooting

- **Error: "401 Unauthorized"**: Your `API_KEY` in the `.env` file is incorrect or has expired.
- **Message: "No new events to store"**: The `fetch-events` command ran but did not find any new events that matched your category filters within the `fetchWindowHours`.
- **Message: "No events to process"**: The `process-schedule` command ran but no stored events were scheduled to start within the `preEventQueryMinutes`.
- **Database is never populated**: Ensure you are running the `fetch-events` command (or the `start-service` command) and that your category filters in `config.json` are correct.
- **Events are not being printed**: Ensure you are running the `process-schedule` command frequently (or the `start-service` command). Check that `preEventQueryMinutes` is set to a reasonable value.
