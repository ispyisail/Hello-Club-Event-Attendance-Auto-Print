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

### 1. API Key (.env file)

This file stores your Hello Club API key.

1. Create a file named `.env` in the root of the project directory.
2. Add your API key to the file in the following format:

    ```
    API_KEY=your_hello_club_api_key
    ```
    Replace `your_hello_club_api_key` with your actual API key.

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

The script will then:
1. Find the next upcoming event that matches the categories in your `config.json`.
2. Check if the event is starting within the next 15 minutes.
3. If it is, it will generate a PDF file named `attendees.pdf` and send it to your default printer.
4. If no event is starting soon, it will log a message to the console.

## Scheduling the Script on Windows

You can use the Windows Task Scheduler to run the script automatically at regular intervals.

### 1. Create a Basic Task

1. Press the **Windows Key**, type **Task Scheduler**, and press Enter.
2. In the "Actions" pane on the right, click **Create Basic Task...**.
3. Name the task (e.g., "Hello Club Printout") and click **Next**.
4. Choose **Daily** for the trigger, then click **Next**.
5. Leave the start date as today and set the recur option to **1** days. Click **Next**.
6. For the action, select **Start a program** and click **Next**.

### 2. Configure the Action

1.  **Program/script:** Enter the full path to your `node.exe`. You can find this by opening Command Prompt and running `where node`. It will likely be something like `C:\Program Files\nodejs\node.exe`.
2.  **Add arguments (optional):** Enter `index.js`.
3.  **Start in (optional):** Enter the full path to your project directory: `C:\Projects\Hello Club - Print out`.

### 3. Set the Repeat Interval

1.  Click **Next**, then check the box that says "Open the Properties dialog for this task when I click Finish", and click **Finish**.
2.  In the "Properties" window, go to the **Triggers** tab.
3.  Select the trigger and click **Edit**.
4.  Under "Advanced settings", check the box for **Repeat task every** and set it to **15 minutes**.
5.  Set the duration to **Indefinitely**.
6.  Click **OK** on all open windows to save the changes.

The script will now run automatically every 15 minutes and generate the printout when a relevant event is about to start.
