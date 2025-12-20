================================================================================
  Hello Club Event Attendance - Portable Version
================================================================================

This is a portable version that runs without installation!

================================================================================
  Quick Start Guide
================================================================================

STEP 1: First Time Setup
-------------------------
Run: 1-SETUP.bat

This will:
  - Check for Node.js (required)
  - Install all dependencies
  - Create configuration file (.env)
  - Guide you through API key setup

STEP 2: Configure Your Credentials
-----------------------------------
Edit the .env file (use 7-EDIT-CONFIG.bat) and add:
  - API_KEY = Your Hello Club API key
  - PRINTER_EMAIL = Your printer's email (for email mode)
  - SMTP credentials (for email mode)

STEP 3: Run the Application
----------------------------
You have two options:

Option A: Background Service (Recommended)
  Run: 2-START-SERVICE.bat
  - Keeps a console window open
  - Service runs in the background
  - Press Ctrl+C to stop

Option B: System Tray Monitor
  Run: 3-START-TRAY.bat
  - Shows icon in system tray
  - Visual status indicator
  - Can control service from tray menu

TIP: Run BOTH for the best experience!

================================================================================
  All Available Scripts
================================================================================

1-SETUP.bat             First-time setup (run once)
2-START-SERVICE.bat     Start background service
3-START-TRAY.bat        Start system tray monitor
4-FETCH-EVENTS-NOW.bat  Manually fetch events (testing)
5-VIEW-LOGS.bat         View activity and error logs
6-RUN-TESTS.bat         Run unit tests
7-EDIT-CONFIG.bat       Edit configuration files

================================================================================
  How It Works
================================================================================

1. Service fetches upcoming events from Hello Club API every hour
2. Events are stored in a local SQLite database (events.db)
3. 5 minutes before each event starts, the service:
   - Fetches the latest attendee list
   - Generates a PDF with the attendee names
   - Prints the PDF (locally or via email)
4. System tray app shows real-time status and notifications

================================================================================
  Configuration Files
================================================================================

.env
  - API credentials and secrets
  - NEVER commit this to version control
  - Use .env.example as a template

config.json
  - Application settings
  - Event categories to monitor
  - PDF layout and styling
  - Printing preferences

================================================================================
  System Requirements
================================================================================

Required:
  - Windows 10 or later
  - Node.js 16.x or later (download from https://nodejs.org/)
  - 500 MB free disk space
  - Internet connection

Optional:
  - SumatraPDF (for local printing)
  - SMTP account (for email printing)

================================================================================
  Portable vs Installed Version
================================================================================

Portable Version (this):
  ✓ No installation required
  ✓ Run from any folder or USB drive
  ✓ Easy to move or delete
  ✓ Manual start/stop
  ✗ Doesn't auto-start with Windows
  ✗ Requires console window open
  ✗ Not installed as Windows Service

Installed Version:
  ✓ Runs as Windows Service
  ✓ Auto-starts with Windows
  ✓ No console window needed
  ✓ Professional installation
  ✗ Requires administrator rights
  ✗ Uses Program Files folder

================================================================================
  Troubleshooting
================================================================================

"Node.js is not installed"
  → Download and install from https://nodejs.org/
  → Make sure to restart your terminal after installing

"Failed to install dependencies"
  → Check your internet connection
  → Try running: npm install --verbose
  → Check firewall/antivirus settings

"401 Unauthorized" errors
  → Your API key is invalid or expired
  → Check .env file for correct API_KEY
  → Get a new key from Hello Club

Service won't start
  → Check .env file exists and has API_KEY
  → Check logs: 5-VIEW-LOGS.bat
  → Run tests: 6-RUN-TESTS.bat

Tray app won't open
  → Make sure dependencies are installed
  → Try: npm run tray from command line
  → Check error messages in console

PDF not printing
  → Local mode: Install SumatraPDF
  → Email mode: Check SMTP credentials in .env
  → Test with: 4-FETCH-EVENTS-NOW.bat

================================================================================
  File Structure
================================================================================

portable/               → Launcher scripts (you are here)
src/                    → Application source code
  core/                 → Core business logic
  services/             → Supporting services
  utils/                → Utilities
tests/                  → Unit tests
tray-app/               → Electron system tray app
docs/                   → Documentation
config.json             → Application settings
.env                    → Secrets (created by setup)
events.db               → Event database (created on first run)
activity.log            → Activity log (created on first run)
error.log               → Error log (created when errors occur)

================================================================================
  Advanced Usage
================================================================================

Running from Command Line:
  cd /path/to/this/folder
  node src/index.js fetch-events       (fetch events once)
  node src/index.js process-schedule   (process pending events)
  node src/index.js start-service      (run as service)
  node src/index.js --help             (show all commands)

Environment Variables:
  NODE_ENV=production    (disable debug logging)
  NODE_ENV=development   (enable verbose logging)

Running Tests:
  npm test               (run all tests)
  npm run coverage       (run with coverage report)

Code Quality:
  npm run lint           (check code quality)
  npm run format         (format all code)
  npm run validate       (lint + test)

================================================================================
  Updating the Portable Version
================================================================================

When a new version is released:

1. Download the new portable package
2. Extract to a NEW folder
3. Copy these files from your OLD folder:
   - .env (your credentials)
   - config.json (your settings)
   - events.db (your event database)
4. Run 1-SETUP.bat in the new folder
5. Delete the old folder

================================================================================
  Moving to Installed Version
================================================================================

If you later want to install it permanently:

1. Stop the portable service (Ctrl+C in console)
2. Navigate to installer/ folder
3. Run build-installer.bat to create installer
4. Run the installer
5. During installation, provide same credentials from your .env file

Your event database and logs can be copied to the installed location.

================================================================================
  Support & Documentation
================================================================================

Full Documentation: docs/ folder
  - ARCHITECTURE.md - System design
  - CONFIGURATION.md - Detailed settings
  - TROUBLESHOOTING.md - Common issues
  - And more...

GitHub Issues:
  https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/issues

================================================================================
  License
================================================================================

MIT License - See LICENSE file for details

================================================================================
  Tips for Best Experience
================================================================================

✓ Keep the portable folder in a permanent location (not Desktop)
✓ Run both the service and tray app for full functionality
✓ Check logs regularly: 5-VIEW-LOGS.bat
✓ Backup your .env and config.json files
✓ Update to new versions when released
✓ Test with 4-FETCH-EVENTS-NOW.bat before relying on automation

================================================================================

Enjoy using Hello Club Event Attendance!

For more help, see the docs/ folder or visit the GitHub repository.

================================================================================
