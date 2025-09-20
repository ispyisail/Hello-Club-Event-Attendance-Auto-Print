# Operating Manual: Hello Club Attendee Printer

## 1. Overview

This command-line tool automatically finds the next upcoming event from the Hello Club API, retrieves its full attendee list, and generates a printable sign-up sheet in PDF format. It is designed to be run manually or automatically on a schedule.

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

This file stores your private Hello Club API key.

1.  Create a file named `.env` in the project directory.
2.  Add your API key to the file in the following format, replacing `your_key_here` with your actual key:
    ```
    API_KEY=your_key_here
    ```

### 3.2. Main Settings (`config.json` file)

This file controls the main behavior of the script.

```json
{
  "categories": ["NBA - Junior Events"],
  "printWindowMinutes": 15,
  "outputFilename": "attendees.pdf",
  "pdfLayout": { ... }
}
```

*   `"categories"`: An array of event category names. The script will only look for events that match one of the categories in this list. If the list is empty (`[]`), it will find the next upcoming event regardless of category.

*   `"printWindowMinutes"`: A number representing the time window in minutes. The script will only generate a printout if the found event is starting within this many minutes from the current time.

*   `"outputFilename"`: The name of the file that will be generated. The file extension will be automatically changed based on the format.

### 3.3. PDF Layout (`pdfLayout` object)

This section within `config.json` gives you full control over the appearance of the generated PDF.

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

*   `"logo"`: Set this to the full file path of an image (e.g., `"C:\\Users\\YourName\\logo.png"`) to display a logo at the top of the PDF. Set to `null` to disable.

*   `"fontSize"`: Controls the base font size for the text in the document.

*   `"columns"`: An array that defines the columns of the attendee table. You can add, remove, or re-order the items in this array.
    *   `"id"`: The data field from Hello Club to use for the column. Common values include:
        *   `name` (full name)
        *   `firstName`
        *   `lastName`
        *   `email`
        *   `phone`
        *   `signUpDate`
        *   `isPaid` (true/false)
        *   `hasFee` (true/false)
        *   `status` (a formatted string: "Paid", "Owing", or "No Fee")
        *   `notes`
    *   `"header"`: The title to display for the column.
    *   `"width"`: A number controlling the column's width.

---

## 4. Running the Application

You can run the application from the command line.

### 4.1. Basic Execution

To run the script with the settings from your `config.json` file, simply use:

```bash
node index.js
```

### 4.2. Command-Line Arguments (Overrides)

You can override the settings from `config.json` for a single run by using command-line flags.

*   `--category "Category Name"` or `-c "Category Name"`
    *   Temporarily uses a different category filter. You can use this flag multiple times for multiple categories.
    *   Example: `node index.js -c "Adult Classes" -c "Junior Events"`

*   `--window <minutes>` or `-w <minutes>`
    *   Temporarily changes the time window.
    *   Example: `node index.js --window 60`

*   `--output <filename>` or `-o <filename>`
    *   Temporarily changes the name of the output file.
    *   Example: `node index.js --output special_event.pdf`

*   `--help` or `-h`
    *   Displays a list of all available command-line options.

---

## 5. Scheduling on Windows

You can use Windows Task Scheduler to run the script automatically at regular intervals (e.g., every 15 minutes).

1.  Open **Task Scheduler**.
2.  Click **Create Basic Task...**.
3.  Give the task a name (e.g., "Hello Club Printout") and click **Next**.
4.  Choose **Daily** as the trigger and click **Next**.
5.  Configure the action:
    *   **Program/script:** Enter the full path to `node.exe` (you can find this by running `where node` in a command prompt).
    *   **Add arguments (optional):** Enter `index.js`.
    *   **Start in (optional):** Enter the full path to your project directory (e.g., `C:\Projects\Hello Club - Print out`).
6.  Click **Next**, then check the box to "Open the Properties dialog" and click **Finish**.
7.  In the **Triggers** tab, edit the trigger.
8.  Under "Advanced settings", check **Repeat task every** and set it to **15 minutes** (or your desired interval) for a duration of **Indefinitely**.
9.  Click **OK** to save.

---

## 6. Troubleshooting

*   **Error: "401 Unauthorized"**: This means your `API_KEY` in the `.env` file is incorrect or has expired.
*   **Message: "No upcoming events found"**: This means no events were found that match the `categories` in your `config.json` file within the search window.
*   **Logo not appearing on PDF**: Ensure the file path in the `logo` property of `pdfLayout` is correct and uses double backslashes (e.g., `C:\\path\\to\\logo.png`).
