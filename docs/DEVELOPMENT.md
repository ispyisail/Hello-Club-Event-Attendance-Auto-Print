# Development Guide

> Guide for developers contributing to Hello Club Event Attendance Auto-Print

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Debugging](#debugging)
- [Contributing](#contributing)
- [Release Process](#release-process)

## Development Setup

### Prerequisites

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **Git** - [Download](https://git-scm.com/)
3. **Code Editor** - VS Code recommended
4. **Raspberry Pi** (optional) - For testing production deployment

**Platform Notes:**

- Development can be done on any OS (Windows, macOS, Linux)
- Primary deployment target is Raspberry Pi 5 with Linux
- Legacy Windows deployment docs available in [`docs/legacy/`](./legacy/)

### Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print.git
cd Hello-Club-Event-Attendance-Auto-Print

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
# Edit .env and add your test API key

# 4. Create test config
cp config.json config.test.json
# Edit config.test.json with test categories

# 5. Run tests to verify setup
npm test
```

### Development Dependencies

```json
{
  "dependencies": {
    "better-sqlite3": "^11.7.0", // SQLite database
    "axios": "^1.7.9", // HTTP client
    "pdfkit": "^0.15.1", // PDF generation
    "express": "^4.21.2", // Web dashboard
    "ws": "^8.18.0", // WebSocket server
    "winston": "^3.17.0", // Logging
    "nodemailer": "^6.9.17", // Email service
    "joi": "^17.13.3" // Configuration validation
  },
  "devDependencies": {
    "jest": "^30.1.3", // Testing framework
    "eslint": "^9.17.0", // Code linting
    "prettier": "^3.4.2" // Code formatting
  }
}
```

**Legacy Dependencies** (Windows only, not needed for Pi development):

- `electron` - Windows tray app (deprecated)
- `electron-builder` - Tray app packaging (deprecated)
- `node-windows` - Windows service wrapper (deprecated)

### IDE Setup (VS Code)

**Recommended Extensions**:

- ESLint
- Prettier
- Jest
- GitLens
- JavaScript (ES6) code snippets

**.vscode/settings.json** (create if needed):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "javascript.validate.enable": true,
  "files.eol": "\n",
  "eslint.validate": ["javascript"]
}
```

**.vscode/launch.json** (debugging configuration):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Run Service",
      "program": "${workspaceFolder}/src/index.js",
      "args": ["start-service"],
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Run Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Run Dashboard",
      "program": "${workspaceFolder}/web-dashboard/server.js",
      "console": "integratedTerminal"
    }
  ]
}
```

## Project Structure

```
hello-club-event-attendance/
├── src/                          # Application source code
│   ├── core/                     # Core business logic
│   │   ├── api-client.js         # Hello Club API integration
│   │   ├── database.js           # SQLite database layer
│   │   ├── functions.js          # Event processing logic
│   │   ├── service.js            # Scheduler & job management
│   │   └── migrations/           # Database migrations
│   │
│   ├── services/                 # Supporting services
│   │   ├── email-service.js      # SMTP email sending
│   │   ├── logger.js             # Winston logging
│   │   ├── pdf-generator.js      # PDF creation
│   │   └── cups-printer.js       # CUPS printing (Linux)
│   │
│   ├── utils/                    # Utilities and helpers
│   │   ├── args-parser.js        # CLI argument parsing
│   │   ├── config-schema.js      # Configuration validation
│   │   └── cache.js              # In-memory cache
│   │
│   └── index.js                  # Application entry point
│
├── web-dashboard/                # Web dashboard
│   ├── server.js                 # Express + WebSocket server
│   ├── connection-tests.js       # API/Email/Print tests
│   ├── middleware/
│   │   └── auth.js               # Authentication
│   ├── routes/
│   │   └── api.js                # REST API endpoints
│   └── public/                   # Frontend assets
│       ├── index.html
│       ├── js/app.js
│       └── css/styles.css
│
├── setup/                        # Raspberry Pi setup scripts
│   ├── pi-configure.sh           # System hardening
│   ├── pi-install-app.sh         # Application installation
│   └── helloclub.service         # systemd service file
│
├── tests/                        # Unit tests (Jest)
│   ├── api-client.test.js
│   ├── email-service.test.js
│   ├── functions.test.js
│   ├── pdf-generator.test.js
│   └── service.test.js
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md           # System architecture
│   ├── RASPBERRY-PI-SETUP.md     # Pi setup guide
│   ├── WEB-DASHBOARD.md          # Dashboard guide
│   └── legacy/                   # Archived Windows docs
│
├── .env                          # Environment variables (gitignored)
├── .env.example                  # Environment template
├── config.json                   # Application configuration
├── package.json                  # Node.js project manifest
└── README.md                     # Project overview
```

### Module Responsibilities

| Module          | Purpose                    | Dependencies           |
| --------------- | -------------------------- | ---------------------- |
| `api-client`    | Hello Club API calls       | axios, logger          |
| `database`      | SQLite management          | better-sqlite3, logger |
| `functions`     | Event processing           | All core + services    |
| `service`       | Scheduling & orchestration | functions, database    |
| `logger`        | Winston logging            | winston                |
| `email-service` | SMTP sending               | nodemailer, logger     |
| `pdf-generator` | PDF creation               | pdfkit                 |
| `config-schema` | Config validation          | joi                    |
| `args-parser`   | CLI parsing                | yargs                  |
| `cups-printer`  | CUPS printing (Linux)      | child_process          |
| `web-dashboard` | Express + WebSocket UI     | express, ws            |

## Development Workflow

### Running Locally

**Option 1: Direct Execution**

```bash
# Fetch events once
node src/index.js fetch-events

# Process pending events
node src/index.js process-schedule

# Run continuous service (foreground)
node src/index.js start-service
```

**Option 2: npm Scripts**

```bash
# Start service in foreground
npm start

# Start web dashboard
npm run dashboard

# Fetch events
npm run fetch-events

# Run tests
npm test

# Run linter
npm run lint

# Format code
npm run format
```

**Option 3: Development Mode with Nodemon**

```bash
# Install nodemon globally
npm install -g nodemon

# Run with auto-restart on file changes
nodemon src/index.js start-service

# Or run dashboard with auto-restart
nodemon web-dashboard/server.js
```

### Web Dashboard Development

**Running Dashboard Standalone**:

```bash
# Terminal 1: Run main service
npm start

# Terminal 2: Run dashboard with auto-reload
nodemon web-dashboard/server.js
```

**Accessing Dashboard**:

- Local: `http://localhost:3000`
- Username/password from `.env` file

**Dashboard API Endpoints**:
See [WEB-DASHBOARD.md](./WEB-DASHBOARD.md) for full API documentation.

### Database Development

**Inspect Database**:

```bash
# Install sqlite3 CLI
# macOS: brew install sqlite3
# Ubuntu/Debian: sudo apt-get install sqlite3
# Windows: Download from sqlite.org

# Open database
sqlite3 events.db

# Query events
SELECT * FROM events;
SELECT * FROM scheduled_jobs;

# View schema
.schema

# Exit
.quit
```

**Reset Database** (for testing):

```bash
# Backup first
cp events.db events.db.backup

# Delete database
rm events.db

# Run service to recreate
node src/index.js start-service
```

**Database Migrations**:

Migrations are in `src/core/migrations/` with numeric prefixes:

1. Create migration file: `src/core/migrations/002_add_column.js`
2. Export `up` and `down` SQL:

   ```javascript
   const up = `
     ALTER TABLE events ADD COLUMN retryCount INTEGER DEFAULT 0;
   `;

   const down = `
     ALTER TABLE events DROP COLUMN retryCount;
   `;

   module.exports = { up, down };
   ```

3. Migrations run automatically on service start

### Raspberry Pi Testing

**Test on Real Hardware**:

```bash
# 1. Build tarball of your changes
npm pack

# 2. Copy to Raspberry Pi
scp hello-club-event-attendance-*.tgz pi@helloclub-pi.local:/tmp/

# 3. SSH to Pi
ssh pi@helloclub-pi.local

# 4. Extract and install
cd /opt/helloclub/app
sudo systemctl stop helloclub
sudo -u helloclub tar -xzf /tmp/hello-club-event-attendance-*.tgz --strip-components=1
sudo -u helloclub npm install --production
sudo systemctl start helloclub

# 5. Monitor logs
journalctl -u helloclub -f
```

**Remote Development**:

```bash
# Use VS Code Remote SSH extension
# Connect to: pi@helloclub-pi.local
# Edit files directly on Pi
# Use terminal in VS Code to run commands
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run coverage

# Run specific test file
npx jest tests/functions.test.js

# Run tests matching pattern
npx jest --testNamePattern="should fetch events"

# Watch mode (re-run on changes)
npx jest --watch

# Verbose output
npx jest --verbose
```

### Writing Tests

**Test Structure**:

```javascript
// tests/example.test.js
describe('Module Name', () => {
  beforeEach(() => {
    // Setup before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('functionName', () => {
    it('should do something specific', async () => {
      // Arrange
      const input = { id: 123 };

      // Act
      const result = await functionUnderTest(input);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(123);
    });
  });
});
```

**Mocking Example**:

```javascript
// Mock external modules
jest.mock('../src/core/api-client');
const { getEventDetails } = require('../src/core/api-client');

// Mock implementation
getEventDetails.mockResolvedValue({
  id: 123,
  name: 'Test Event',
});

// Verify mock was called
expect(getEventDetails).toHaveBeenCalledWith(123);
```

**Database Mocking**:

```javascript
jest.mock('../src/core/database');
const { getDb } = require('../src/core/database');

beforeEach(() => {
  const mockStmt = {
    run: jest.fn(() => ({ changes: 1 })),
    all: jest.fn(() => []),
    get: jest.fn(() => null),
  };

  const mockDb = {
    prepare: jest.fn(() => mockStmt),
    transaction: jest.fn((fn) => fn),
    exec: jest.fn(),
  };

  getDb.mockReturnValue(mockDb);
});
```

### Test Coverage Goals

- **Core modules**: 80%+ coverage (functions.js, service.js)
- **Service modules**: 70%+ coverage (email-service.js, pdf-generator.js)
- **Utilities**: 90%+ coverage (config-schema.js, cache.js)

**Check Coverage**:

```bash
npm run coverage
# Open coverage/lcov-report/index.html in browser
```

## Code Style

### General Guidelines

- ✅ Use modern JavaScript (ES6+)
- ✅ Async/await over callbacks
- ✅ Descriptive variable and function names
- ✅ Comments for complex logic only
- ✅ JSDoc comments for all exported functions
- ✅ Keep functions small and focused (< 50 lines)
- ❌ No unused variables or imports
- ❌ No console.log (use logger instead)

### Naming Conventions

**Files**: `kebab-case.js`

```
api-client.js
pdf-generator.js
connection-tests.js
```

**Functions**: `camelCase`

```javascript
function fetchEventDetails() {}
async function processEvent() {}
```

**Classes**: `PascalCase`

```javascript
class PdfGenerator {}
class CupsPrinter {}
```

**Constants**: `UPPER_SNAKE_CASE`

```javascript
const API_KEY = process.env.API_KEY;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 10000, 20000];
```

**Private functions**: Prefix with underscore

```javascript
function _calculateDelay() {} // Private helper
function _validateInput() {} // Private helper
```

### JSDoc Comments

**All exported functions** must have JSDoc:

```javascript
/**
 * Fetches event details from the Hello Club API.
 * @param {string} eventId - The ID of the event to fetch
 * @returns {Promise<Object|null>} Event object or null if not found
 * @throws {Error} If API request fails
 */
async function getEventDetails(eventId) {
  // Implementation
}
```

**Classes**:

```javascript
/**
 * Generates PDF attendee lists for events.
 */
class PdfGenerator {
  /**
   * Creates an instance of PdfGenerator.
   * @param {Object} event - The event object
   * @param {Array<Object>} attendees - Array of attendees
   * @param {Object} layout - PDF layout configuration
   */
  constructor(event, attendees, layout) {
    // Implementation
  }
}
```

### Error Handling

**Always use try-catch for async operations**:

```javascript
async function riskyOperation() {
  try {
    const result = await apiCall();
    return result;
  } catch (error) {
    logger.error('Operation failed:', error);
    throw error; // Re-throw or handle gracefully
  }
}
```

**Provide context in errors**:

```javascript
throw new Error(`Failed to process event ${eventId}: ${error.message}`);
```

**Use dedicated error handler for API**:

```javascript
const { handleApiError } = require('./api-client');

try {
  await api.get('/event');
} catch (error) {
  handleApiError(error, 'fetching events');
}
```

## Debugging

### Logging

**Use the logger, not console.log**:

```javascript
const logger = require('./services/logger');

logger.info('Starting event processing');
logger.warn('API rate limit approaching');
logger.error('Failed to process event:', error);
```

**Log Levels**:

- `info` - Normal operations (default)
- `warn` - Recoverable issues
- `error` - Failures and exceptions
- `debug` - Detailed debugging (set LOG_LEVEL=debug)

**Best Practices**:

```javascript
// Good: Provides context
logger.info(`Processing event ${eventId} with ${attendees.length} attendees`);

// Bad: Not enough context
logger.info('Processing event');

// Good: Error with object
logger.error('Failed to send email:', error);

// Bad: Error without object
logger.error('Failed to send email');
```

### VS Code Debugging

Set breakpoints in VS Code and press F5 to debug using launch configurations from [IDE Setup](#ide-setup-vs-code).

**Debug Service**:

1. Set breakpoints in `src/core/functions.js`
2. Press F5 → Select "Run Service"
3. Service runs with debugger attached

**Debug Tests**:

1. Set breakpoints in test files
2. Press F5 → Select "Run Tests"
3. Tests run with debugger attached

### Debugging on Raspberry Pi

**Option 1: View Logs Remotely**

```bash
# SSH to Pi
ssh pi@helloclub-pi.local

# Follow logs
tail -f /opt/helloclub/app/activity.log
journalctl -u helloclub -f
```

**Option 2: Remote Debugging**

```bash
# On Pi: Start service with inspect flag
node --inspect=0.0.0.0:9229 /opt/helloclub/app/src/index.js start-service

# On Dev Machine: Connect with Chrome DevTools
# Open: chrome://inspect
# Add: helloclub-pi.local:9229
```

**Option 3: VS Code Remote SSH**

1. Install "Remote - SSH" extension
2. Connect to `pi@helloclub-pi.local`
3. Open `/opt/helloclub/app`
4. Debug normally with F5

## Contributing

### Contribution Workflow

1. **Fork the repository**

2. **Create a feature branch**

   ```bash
   git checkout -b feature/my-new-feature
   ```

3. **Make your changes**
   - Write code
   - Add tests
   - Update documentation

4. **Test your changes**

   ```bash
   npm test
   npm run lint
   ```

5. **Commit your changes**

   ```bash
   git commit -m "feat: add feature description"
   ```

6. **Push to your fork**

   ```bash
   git push origin feature/my-new-feature
   ```

7. **Create Pull Request**
   - Go to GitHub
   - Click "New Pull Request"
   - Describe your changes
   - Reference any related issues

### Commit Message Guidelines

**Format**:

```
<type>: <subject>

<body>

<footer>
```

**Types**:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples**:

```
feat: add webhook notification support

Add webhook notifications for event processing completion.
Includes retry logic and configurable timeout.

Closes #42

---

fix: correct PDF column width calculation

Previous calculation didn't account for page margins.
Now properly calculates available width.

---

docs: update configuration guide with webhook examples

Add examples for webhook configuration and payload format.

---

test: add tests for webhook delivery

Covers success, failure, and retry scenarios.
```

### Pull Request Checklist

- [ ] Tests pass (`npm test`)
- [ ] Linter passes (`npm run lint`)
- [ ] Code follows style guidelines
- [ ] JSDoc comments added for new functions
- [ ] Documentation updated
- [ ] No `console.log` statements
- [ ] Commit messages are clear
- [ ] PR description explains changes

## Release Process

### Version Numbering

We use [Semantic Versioning](https://semver.org/):

- `MAJOR.MINOR.PATCH` (e.g., `2.1.3`)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

### Creating a Release

1. **Update version in package.json**

   ```json
   {
     "version": "2.1.0"
   }
   ```

2. **Update CHANGELOG.md**

   ```markdown
   ## [2.1.0] - 2025-02-15

   ### Added

   - New feature description

   ### Fixed

   - Bug fix description

   ### Changed

   - Improvement description
   ```

3. **Commit version bump**

   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore: bump version to 2.1.0"
   ```

4. **Create git tag**

   ```bash
   git tag v2.1.0
   git push origin main
   git push origin v2.1.0
   ```

5. **Create GitHub release**
   - Go to GitHub → Releases → New Release
   - Select tag `v2.1.0`
   - Title: `v2.1.0 - Release Name`
   - Describe changes (copy from CHANGELOG)
   - Attach any release artifacts

### Pre-release Checklist

- [ ] All tests pass on all platforms
- [ ] Documentation is up-to-date
- [ ] CHANGELOG.md is updated
- [ ] Version bumped in package.json
- [ ] No breaking changes in MINOR releases
- [ ] Migration guide written for breaking changes
- [ ] Tested on Raspberry Pi 5
- [ ] Dashboard tested in multiple browsers

---

## Platform-Specific Development

### Raspberry Pi Development

**Quick Setup for Pi Testing**:

```bash
# Setup script installs everything
curl -fsSL https://raw.githubusercontent.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/main/setup/pi-install-app.sh | sudo bash
```

**Manual Pi Setup**:
See [RASPBERRY-PI-SETUP.md](./RASPBERRY-PI-SETUP.md)

### Cross-Platform Considerations

**File Paths**:

```javascript
// Good: Use path.join
const dbPath = path.join(__dirname, '..', 'events.db');

// Bad: Hardcoded path separator
const dbPath = __dirname + '/../events.db';
```

**Line Endings**:

- Use LF (`\n`) for all files
- Configure git: `git config --global core.autocrlf input`
- VS Code setting: `"files.eol": "\n"`

**Environment Variables**:

```javascript
// Good: Use process.env with defaults
const port = parseInt(process.env.PORT) || 3000;

// Good: Validate environment
const apiKey = process.env.API_KEY;
if (!apiKey) throw new Error('API_KEY required');
```

---

## Legacy Windows Development

> **Note**: Windows development is no longer recommended for new features. Focus development on Raspberry Pi/Linux platform.

For Windows-specific development documentation (Electron tray app, node-windows service, Inno Setup installer), see:

- [**Windows Development Guide**](./legacy/WINDOWS-DEVELOPMENT.md) - Windows-specific setup and build instructions
- [**Build Installer**](./legacy/BUILD-INSTALLER.md) - Creating Windows installers
- [**Tray App Development**](./legacy/TRAY-APP-GUIDE.md) - Electron tray application development

---

## Getting Help

**Questions**: Open a GitHub Discussion

**Bugs**: Open a GitHub Issue

**Security Issues**: Email (see package.json)

**Documentation**: Check [docs/INDEX.md](./INDEX.md)

---

**Last Updated**: 2025-02-10

**Primary Platform**: Raspberry Pi 5 / Linux

**Development Focus**: Cross-platform with Pi optimization
