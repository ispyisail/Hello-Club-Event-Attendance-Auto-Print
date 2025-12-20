# Development Guide

> Guide for developers contributing to Hello Club Event Attendance Auto-Print

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style](#code-style)
- [Debugging](#debugging)
- [Building](#building)
- [Contributing](#contributing)
- [Release Process](#release-process)

## Development Setup

### Prerequisites

1. **Node.js 16+** - [Download](https://nodejs.org/)
2. **Git** - [Download](https://git-scm.com/)
3. **Visual Studio Build Tools** (Windows) - For native modules
4. **Code Editor** - VS Code recommended

### Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print.git
cd Hello-Club-Event-Attendance-Auto-Print

# 2. Install dependencies
npm install

# 3. Create .env file
copy .env.example .env
# Edit .env and add your test API key

# 4. Create test config
copy config.json config.test.json
# Edit config.test.json with test categories

# 5. Run tests to verify setup
npm test
```

### Development Dependencies

```json
{
  "devDependencies": {
    "electron": "^39.2.7",          // Tray app framework
    "electron-builder": "^26.0.12",  // Tray app packaging
    "jest": "^30.1.3",               // Testing framework
    "pkg": "^5.8.1"                  // Standalone executable builder
  }
}
```

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
  "files.eol": "\n"
}
```

## Project Structure

```
hello-club-event-attendance/
├── src/                          # Source code
│   ├── core/                     # Core business logic
│   │   ├── api-client.js         # API integration
│   │   ├── database.js           # Database layer
│   │   ├── functions.js          # Event processing
│   │   └── service.js            # Scheduler
│   ├── services/                 # Supporting services
│   │   ├── email-service.js      # Email sending
│   │   ├── logger.js             # Logging
│   │   └── pdf-generator.js      # PDF creation
│   ├── utils/                    # Utilities
│   │   ├── args-parser.js        # CLI parsing
│   │   └── config-schema.js      # Config validation
│   └── index.js                  # Entry point
│
├── service/                      # Windows Service
│   ├── install.js                # Service installer
│   ├── uninstall.js              # Service uninstaller
│   └── status.js                 # Status checker
│
├── tray-app/                     # System tray app
│   ├── main.js                   # Electron main process
│   ├── log-viewer.html           # Log viewer UI
│   └── icons/                    # Tray icons
│
├── installer/                    # Inno Setup installer
│   └── setup.iss                 # Installer script
│
├── tests/                        # Unit tests
│   ├── functions.test.js
│   └── pdf-generator.test.js
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── CONFIGURATION.md
│   └── this file
│
└── migrations/                   # Database migrations
    └── 001-initial-schema.sql
```

### Module Responsibilities

| Module | Purpose | Dependencies |
|--------|---------|--------------|
| `api-client` | Hello Club API calls | axios, logger |
| `database` | SQLite management | better-sqlite3, logger |
| `functions` | Event processing | All core + services |
| `service` | Scheduling & orchestration | functions, database, logger |
| `logger` | Winston logging | winston |
| `email-service` | SMTP sending | nodemailer, logger |
| `pdf-generator` | PDF creation | pdfkit |
| `config-schema` | Config validation | joi |
| `args-parser` | CLI parsing | yargs |

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

# Fetch events
npm run fetch-events

# Run tests
npm test
```

**Option 3: Development Mode**
```bash
# Install nodemon for auto-restart
npm install -g nodemon

# Run with auto-restart on file changes
nodemon src/index.js start-service
```

### Tray App Development

```bash
# Run tray app
npm run tray

# Build tray app
npm run tray:build

# Output: dist/Hello Club Service Monitor.exe
```

### Service Development

**Don't install the service during development!** Use direct execution instead.

If you need to test as a service:
```bash
# Install service (admin required)
npm run service:install

# Check status
npm run service:status

# Uninstall when done
npm run service:uninstall
```

**Hot reload during service development**:
1. Make code changes
2. Restart service: `npm run service:restart` (in admin cmd)
3. Check logs: `type activity.log`

### Database Development

**Inspect database**:
```bash
# Install sqlite3 CLI
npm install -g sqlite3

# Open database
sqlite3 events.db

# Query events
SELECT * FROM events;

# Reset database (for testing)
.quit
del events.db
```

**Database migrations** (manual process):
1. Create migration SQL file in `migrations/`
2. Update `database.js` to run migration
3. Test migration on fresh database
4. Document migration in `migrations/README.md`

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
```

### Writing Tests

**Test Structure**:
```javascript
describe('Module Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should do something specific', async () => {
    // Arrange
    const input = { ... };

    // Act
    const result = await functionUnderTest(input);

    // Assert
    expect(result).toBe(expectedValue);
  });
});
```

**Mocking Example**:
```javascript
jest.mock('../src/core/api-client');
const { getEventDetails } = require('../src/core/api-client');

getEventDetails.mockResolvedValue({
  id: 123,
  name: 'Test Event'
});
```

### Test Coverage Goals

- **Core modules**: 80%+ coverage
- **Service modules**: 70%+ coverage
- **Utilities**: 90%+ coverage

**Check coverage**:
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
- ✅ Keep functions small and focused
- ❌ No unused variables or imports
- ❌ No console.log (use logger instead)

### Naming Conventions

**Files**: `kebab-case.js`
```
api-client.js
pdf-generator.js
```

**Functions**: `camelCase`
```javascript
function fetchEventDetails() { }
async function processEvent() { }
```

**Classes**: `PascalCase`
```javascript
class PdfGenerator { }
```

**Constants**: `UPPER_SNAKE_CASE`
```javascript
const API_KEY = process.env.API_KEY;
const MAX_RETRIES = 3;
```

**Private functions**: Prefix with underscore
```javascript
function _calculateDelay() { }  // Private helper
```

### JSDoc Comments

**All exported functions** must have JSDoc:

```javascript
/**
 * Fetches event details from the Hello Club API.
 * @param {number} eventId - The ID of the event to fetch
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
    throw error;  // Re-throw or handle
  }
}
```

**Provide context in errors**:
```javascript
throw new Error(`Failed to process event ${eventId}: ${error.message}`);
```

**Log errors before throwing**:
```javascript
catch (error) {
  logger.error('Failed to send email:', error);
  throw new Error('Email sending failed');
}
```

## Debugging

### Logging

**Use the logger, not console.log**:
```javascript
const logger = require('./services/logger');

logger.info('Starting event processing');
logger.warn('API rate limit approaching');
logger.error('Failed to process event', error);
```

**Log levels**:
- `info` - Normal operations
- `warn` - Recoverable issues
- `error` - Failures and exceptions

### VS Code Debugging

**.vscode/launch.json**:
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
    }
  ]
}
```

**Set breakpoints** in VS Code and press F5 to debug.

### Debugging Windows Service

**Option 1: Run in foreground**
```bash
node src/index.js start-service
```

**Option 2: Attach to running service**
1. Add to `src/index.js`: `--inspect=9229`
2. Restart service
3. In VS Code: Debug → Attach to Node Process

**Option 3: Check logs**
```bash
type activity.log
type error.log
```

## Building

### Building Tray App

```bash
# Build portable executable
npm run tray:build

# Output: dist/Hello Club Service Monitor.exe
# Can run without Node.js installed
```

### Building Installer

**Prerequisites**:
- Install [Inno Setup 6](https://jrsoftware.org/isdl.php)

**Build**:
```bash
cd installer
build-installer.bat

# Output: ../dist/HelloClubEventAttendance-Setup-1.0.0.exe
```

**Manual build**:
1. Open `installer/setup.iss` in Inno Setup Compiler
2. Click "Compile"
3. Installer created in `dist/`

### Creating Standalone Executable (Optional)

```bash
# Build single .exe (experimental)
npx pkg package.json

# Outputs binaries for each platform
```

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
   ```

5. **Commit your changes**
   ```bash
   git commit -m "Add feature: description"
   ```

6. **Push to your fork**
   ```bash
   git push origin feature/my-new-feature
   ```

7. **Create Pull Request**
   - Go to GitHub
   - Click "New Pull Request"
   - Describe your changes

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
feat: add support for multiple printers

fix: correct PDF column width calculation

docs: update configuration guide with email examples

test: add tests for event scheduling logic
```

### Pull Request Checklist

- [ ] Tests pass (`npm test`)
- [ ] Code follows style guidelines
- [ ] JSDoc comments added
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] Commit messages are clear
- [ ] PR description explains changes

## Release Process

### Version Numbering

We use [Semantic Versioning](https://semver.org/):
- `MAJOR.MINOR.PATCH` (e.g., `1.2.3`)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

### Creating a Release

1. **Update version in package.json**
   ```json
   {
     "version": "1.2.0"
   }
   ```

2. **Update CHANGELOG.md**
   ```markdown
   ## [1.2.0] - 2024-12-20
   ### Added
   - New feature description
   ### Fixed
   - Bug fix description
   ```

3. **Commit version bump**
   ```bash
   git commit -am "chore: bump version to 1.2.0"
   ```

4. **Create git tag**
   ```bash
   git tag v1.2.0
   git push origin v1.2.0
   ```

5. **Build installer**
   ```bash
   cd installer
   build-installer.bat
   ```

6. **Create GitHub release**
   - Go to GitHub → Releases → New Release
   - Select tag `v1.2.0`
   - Upload installer from `dist/`
   - Describe changes

### Pre-release Checklist

- [ ] All tests pass
- [ ] Documentation is up-to-date
- [ ] CHANGELOG.md is updated
- [ ] Version bumped in package.json
- [ ] Installer builds successfully
- [ ] Installer tested on clean Windows machine
- [ ] Service installs and runs correctly
- [ ] Tray app functions properly

---

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open a GitHub Issue
- **Security Issues**: Email (see package.json)

---

**Last Updated**: 2024-12-20
