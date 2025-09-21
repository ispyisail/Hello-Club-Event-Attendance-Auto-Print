# Hello Club - Next Event Attendee Printout

## Description

This command-line tool automatically finds the next upcoming event from the Hello Club API, retrieves its full attendee list, and formats it into a printable sign-up sheet in PDF format. The script is designed to be run on a schedule to automatically print the attendee list for specific events shortly before they start.

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

### 1. API Key & Email Configuration (.env file)

This file stores your Hello Club API key and the settings for email printing.

1. Create a file named `.env` in the root of the project directory.
2. Add your configuration to the file in the following format. The `API_KEY` is always required. The other variables are only needed if you use the `--print-mode email` option.

    ```
    # Required for API access
    API_KEY=your_hello_club_api_key

    # Required for Email Printing Mode (Defaults are for Gmail)
    PRINTER_EMAIL=your_printer_email_address@domain.com
    SMTP_USER=your_gmail_username_or_app_password
    SMTP_PASS=your_gmail_app_password
    EMAIL_FROM=sender_address@example.com

    # Optional: Override if not using Gmail
    # SMTP_HOST=smtp.example.com
    # SMTP_PORT=587
    ```

    - Replace `your_hello_club_api_key` with your actual API key.
    - `PRINTER_EMAIL`: The email address of your Epson Connect enabled printer.
    - `SMTP_USER` / `SMTP_PASS`: Your Gmail username and an **App Password**. **Important:** Due to Google's security policies, you cannot use your regular Gmail password here. You must generate an "App Password" for this application inside your Google Account settings.
    - `EMAIL_FROM`: The address the email will be sent from. Can often be the same as `SMTP_USER`.

### 2. Event Categories (config.json file)

This file allows you to specify which event categories the script should process.

1. The `config.json` file is already created in the project directory.
2. You can edit this file to add or change the list of category names. The script will only generate printouts for events that match one of the categories in this file.

    Example `config.json`:
    ```json
    {
      "categories": ["NBA - Junior Events", "Pickleball"]
    }
    ```

## Running the Script Manually

To run the script manually, open a command prompt or terminal in the project directory and run the following command:

```bash
node index.js
```

### Command-Line Options

You can customize the script's behavior using the following optional flags:

- `--print-mode` (or `-p`): Choose the printing method.
  - `email` (default): Sends the PDF to a configured email address (ideal for cloud printers).
  - `local`: Prints to a locally connected printer.
- `--category` (or `-c`): Specify an event category to override the config file. Can be used multiple times.
- `--window` (or `-w`): Set the time window in minutes to check for events, overriding the config file.
- `--output` (or `-o`): Define the name of the output PDF file, overriding the config file.

Example using email printing:
```bash
node index.js --print-mode email
```

The script will then:
1. Find the next upcoming event that matches the categories in your `config.json`.
2. Check if the event is starting within the next 15 minutes.
3. If it is, it will generate a PDF file named `attendees.pdf` and either send it to your default printer or email it, based on the selected print mode.
4. If no event is starting soon, it will log a message to the console.

## Scheduling the Script

You can run this script automatically on a schedule using different methods depending on your operating system or hosting environment.

### Windows (Using Task Scheduler)

You can use the Windows Task Scheduler to run the script automatically at regular intervals.

#### 1. Create a Basic Task
1. Press the **Windows Key**, type **Task Scheduler**, and press Enter.
2. In the "Actions" pane on the right, click **Create Basic Task...**.
3. Name the task (e.g., "Hello Club Printout") and click **Next**.
4. Choose **Daily** for the trigger, then click **Next**.
5. Leave the start date as today and set the recur option to **1** days. Click **Next**.
6. For the action, select **Start a program** and click **Next**.

#### 2. Configure the Action
1.  **Program/script:** Enter the full path to your `node.exe`. You can find this by opening Command Prompt and running `where node`. It will likely be something like `C:\Program Files\nodejs\node.exe`.
2.  **Add arguments (optional):** Enter `index.js`.
3.  **Start in (optional):** Enter the full path to your project directory: `C:\Projects\Hello Club - Print out`. This is a crucial step to ensure the script can find all its related files.

#### 3. Set the Repeat Interval
1.  Click **Next**, then check the box that says "Open the Properties dialog for this task when I click Finish", and click **Finish**.
2.  In the "Properties" window, go to the **Triggers** tab.
3.  Select the trigger and click **Edit**.
4.  Under "Advanced settings", check the box for **Repeat task every** and set it to **15 minutes**.
5.  Set the duration to **Indefinitely**.
6.  Click **OK** on all open windows to save the changes.

The script will now run automatically every 15 minutes and generate the printout when a relevant event is about to start.

### Azure (Using a WebJob)

When deploying the application to an **Azure App Service**, you can use a **WebJob** to run the script on a schedule. This is the cloud equivalent of the Windows Task Scheduler.

#### 1. Prepare Your Project for the WebJob
Azure WebJobs needs to know what command to run.
1. Create a new file in your project's root directory named `run.cmd`.
2. Add the following line to the file:
    ```cmd
    node index.js
    ```
This tells the WebJob to execute your main script with Node.js.

#### 2. Deploy and Configure
1. Deploy your application code (including the new `run.cmd` file) to an Azure App Service.
2. In the Azure Portal, navigate to your App Service.
3. From the left-hand menu, select **WebJobs**.
4. Click **+ Add**.
5. **Name:** Give your WebJob a name (e.g., "hello-club-scheduler").
6. **Type:** Select **Triggered**.
7. **Triggers:** Select **Scheduled**.
8. **CRON Expression:** Enter a CRON expression for your desired schedule. To run every 15 minutes, use: `0 */15 * * * *`.
9. Click **OK** to create the WebJob.

The script will now be executed by Azure every 15 minutes. Note that for this to work, the App Service plan must have the "Always On" setting enabled.
