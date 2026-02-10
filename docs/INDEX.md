# Documentation Index

Complete documentation for the Hello Club Event Attendance Auto-Print system.

---

## 🚀 Getting Started

**New to the project?** Start here:

1. **[README.md](../README.md)** - Project overview and quick start
2. **[RASPBERRY-PI-SETUP.md](./RASPBERRY-PI-SETUP.md)** - ⭐ **Recommended:** Complete Raspberry Pi setup guide
3. **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production deployment instructions
4. **[CONFIGURATION.md](./CONFIGURATION.md)** - Configure the application
5. **[WEB-DASHBOARD.md](./WEB-DASHBOARD.md)** - Use the web dashboard
6. **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Fix common issues

> **💡 Platform Note:** This project is optimized for **Raspberry Pi 5** with systemd service management. Windows deployment is no longer recommended but remains supported via legacy documentation (see [Legacy Documentation](#-legacy-documentation) below).

---

## 📖 User Documentation

### Installation & Setup

| Document                                         | Description                              | Platform        |
| ------------------------------------------------ | ---------------------------------------- | --------------- |
| [RASPBERRY-PI-SETUP.md](./RASPBERRY-PI-SETUP.md) | Complete Raspberry Pi setup from scratch | Raspberry Pi ⭐ |
| [DEPLOYMENT.md](./DEPLOYMENT.md)                 | Production deployment guide              | All platforms   |

### Configuration & Usage

| Document                               | Description                           | Audience  |
| -------------------------------------- | ------------------------------------- | --------- |
| [CONFIGURATION.md](./CONFIGURATION.md) | Detailed configuration reference      | All users |
| [WEB-DASHBOARD.md](./WEB-DASHBOARD.md) | Web dashboard guide and API reference | All users |

### Support

| Document                                   | Description                   | Audience  |
| ------------------------------------------ | ----------------------------- | --------- |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common problems and solutions | All users |

---

## 🔧 Developer Documentation

### Architecture & Design

| Document                             | Description                             | Purpose                |
| ------------------------------------ | --------------------------------------- | ---------------------- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture and design patterns | Understanding codebase |
| [API.md](./API.md)                   | Module and function reference           | API documentation      |

### Development Setup

| Document                               | Description                            | Purpose                 |
| -------------------------------------- | -------------------------------------- | ----------------------- |
| [DEVELOPMENT.md](./DEVELOPMENT.md)     | Developer setup and contribution guide | Contributing to project |
| [TESTING-GUIDE.md](./TESTING-GUIDE.md) | Testing strategy and guidelines        | Writing tests           |

### Release Process

| Document                                   | Description                   | Purpose             |
| ------------------------------------------ | ----------------------------- | ------------------- |
| [RELEASE-PROCESS.md](./RELEASE-PROCESS.md) | Release checklist and process | Publishing releases |

---

## 📝 Code Guidelines

### Coding Standards (`.claude/rules/`)

| Document                                                    | Description                            | When to Use                 |
| ----------------------------------------------------------- | -------------------------------------- | --------------------------- |
| [code-style.md](../.claude/rules/code-style.md)             | JavaScript style guide and conventions | Writing any code            |
| [api-client.md](../.claude/rules/api-client.md)             | API client patterns and error handling | Working with Hello Club API |
| [database.md](../.claude/rules/database.md)                 | Database patterns and migrations       | Working with SQLite         |
| [service-patterns.md](../.claude/rules/service-patterns.md) | Service scheduling and job patterns    | Working with scheduler      |
| [web-dashboard.md](../.claude/rules/web-dashboard.md)       | Web dashboard development patterns     | Working on dashboard        |
| [testing.md](../.claude/rules/testing.md)                   | Testing conventions and patterns       | Writing tests               |

---

## 📂 Quick Reference by Topic

### API Integration

- [API.md](./API.md) - Module reference
- [api-client.md](../.claude/rules/api-client.md) - Client patterns
- [CONFIGURATION.md](./CONFIGURATION.md) - API configuration

### Database

- [database.md](../.claude/rules/database.md) - Database patterns
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Database schema

### Web Dashboard

- [WEB-DASHBOARD.md](./WEB-DASHBOARD.md) - User guide
- [web-dashboard.md](../.claude/rules/web-dashboard.md) - Development patterns
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Dashboard deployment

### Service & Scheduling

- [service-patterns.md](../.claude/rules/service-patterns.md) - Scheduling patterns
- [DEPLOYMENT.md](./DEPLOYMENT.md) - systemd service (Linux)
- [RASPBERRY-PI-SETUP.md](./RASPBERRY-PI-SETUP.md) - Service configuration

### PDF Generation & Printing

- [API.md](./API.md) - PDF generator module
- [CONFIGURATION.md](./CONFIGURATION.md) - Print configuration
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Print issues

### Testing

- [TESTING-GUIDE.md](./TESTING-GUIDE.md) - Testing guide
- [testing.md](../.claude/rules/testing.md) - Test patterns
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Running tests

### Security

- [RASPBERRY-PI-SETUP.md](./RASPBERRY-PI-SETUP.md) - System hardening
- [WEB-DASHBOARD.md](./WEB-DASHBOARD.md) - Dashboard security
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Security best practices

---

## 🎯 Documentation by Role

### End Users (Raspberry Pi)

**Recommended for new deployments:**

1. [RASPBERRY-PI-SETUP.md](./RASPBERRY-PI-SETUP.md) - Hardware setup
2. [WEB-DASHBOARD.md](./WEB-DASHBOARD.md) - Using dashboard
3. [CONFIGURATION.md](./CONFIGURATION.md) - Configuring events
4. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Fixing issues

### System Administrators

**Production Deployment:**

1. [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment
2. [CONFIGURATION.md](./CONFIGURATION.md) - Configuration reference
3. [WEB-DASHBOARD.md](./WEB-DASHBOARD.md) - Dashboard management
4. [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Advanced troubleshooting

**Raspberry Pi Specific:**

- [RASPBERRY-PI-SETUP.md](./RASPBERRY-PI-SETUP.md) - System setup and hardening
- [DEPLOYMENT.md](./DEPLOYMENT.md#raspberry-pi-5-deployment-recommended) - systemd service

### Developers & Contributors

**Getting Started:**

1. [README.md](../README.md) - Project overview
2. [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
3. [DEVELOPMENT.md](./DEVELOPMENT.md) - Dev environment setup
4. [code-style.md](../.claude/rules/code-style.md) - Coding standards

**Working on Features:**

1. Review relevant `.claude/rules/*.md` patterns
2. [API.md](./API.md) - Module reference
3. [TESTING-GUIDE.md](./TESTING-GUIDE.md) - Write tests
4. [DEVELOPMENT.md](./DEVELOPMENT.md) - Submit PR

**Releasing:**

1. [TESTING-GUIDE.md](./TESTING-GUIDE.md) - Run full test suite
2. [RELEASE-PROCESS.md](./RELEASE-PROCESS.md) - Release checklist

---

## 🔍 Finding Information

### By File Type

**Markdown Documentation (`docs/`):**

- User guides, setup instructions, reference material
- Read these for understanding how to use the system

**Code Guidelines (`.claude/rules/`):**

- Coding patterns, best practices, conventions
- Follow these when writing code

**Code Documentation (`src/`):**

- JSDoc comments in source files
- API documentation for functions and modules

### Search Tips

**Finding specific topics:**

```bash
# Search all documentation
grep -r "search term" docs/ .claude/rules/

# Search markdown files only
grep -r "search term" --include="*.md" .

# Find file by name
find . -name "*keyword*.md"
```

**Common search terms:**

- "API" - API integration and usage
- "configuration" - Settings and config files
- "error" - Error handling and troubleshooting
- "test" - Testing information
- "security" - Security and hardening
- "backup" - Backup and restore procedures

---

## 🗂️ Legacy Documentation

**Windows Platform Support (Archived)**

Previous versions (v1.0.x) supported Windows as the primary platform using node-windows service wrapper and Electron tray application. Starting with v2.0, the project has migrated to Raspberry Pi with systemd service management and web dashboard.

Windows deployment is **no longer recommended** but remains supported via manual installation. All Windows-specific documentation has been archived in the `legacy/` folder.

### Legacy Windows Documentation

| Document                                                             | Description                              | Status   |
| -------------------------------------------------------------------- | ---------------------------------------- | -------- |
| [legacy/WINDOWS-SERVICE-SETUP.md](./legacy/WINDOWS-SERVICE-SETUP.md) | Windows service installation             | Archived |
| [legacy/TRAY-APP-GUIDE.md](./legacy/TRAY-APP-GUIDE.md)               | Windows system tray application guide    | Archived |
| [legacy/INSTALLER-USER-GUIDE.md](./legacy/INSTALLER-USER-GUIDE.md)   | Windows installer user guide             | Archived |
| [legacy/BUILD-INSTALLER.md](./legacy/BUILD-INSTALLER.md)             | Building Windows installers (Inno Setup) | Archived |
| [legacy/README.md](./legacy/README.md)                               | Overview of legacy Windows platform      | Archived |

**Note for Windows Users:**

- If you're currently running on Windows (v1.0.x), you can continue to use it with the legacy documentation
- For new deployments, we strongly recommend Raspberry Pi for better reliability, lower cost, and 24/7 operation
- Migration guide from Windows to Raspberry Pi: See [RASPBERRY-PI-SETUP.md](./RASPBERRY-PI-SETUP.md)

---

## 📋 Documentation Standards

### File Organization

```
docs/                      # User and admin documentation
  ├── INDEX.md            # This file
  ├── *.md                # Topic-specific guides (current platform)
  ├── legacy/             # Archived Windows documentation
  │   ├── README.md
  │   └── *.md
  └── releases/           # Release notes

.claude/rules/             # Code patterns and guidelines
  ├── code-style.md       # General coding standards
  ├── api-client.md       # API-specific patterns
  └── ...

README.md                  # Project overview
CHANGELOG.md              # Version history
```

### Naming Conventions

- **ALL-CAPS.md** - Major documentation files
- **kebab-case.md** - Code guidelines and patterns
- **PascalCase.md** - API/module references

### Writing Guidelines

1. **Start with purpose** - What is this doc for?
2. **Provide context** - Who is the audience?
3. **Use examples** - Show, don't just tell
4. **Keep it updated** - Update docs with code changes
5. **Link related docs** - Help users find more info
6. **Use consistent formatting** - Follow markdown standards

---

## 🆘 Need Help?

### Documentation Issues

If you can't find what you need:

1. Check the [README.md](../README.md) overview
2. Use this index to find relevant docs
3. Search documentation files for keywords
4. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
5. [Open an issue](https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/issues)

### Contributing to Documentation

Found a gap in documentation? Please contribute!

1. Read [DEVELOPMENT.md](./DEVELOPMENT.md)
2. Write or improve documentation
3. Submit a pull request
4. Help others understand the project

---

## 📅 Keeping Documentation Current

**When to update docs:**

- ✅ Adding new features
- ✅ Changing existing behavior
- ✅ Fixing bugs that affect usage
- ✅ Discovering common issues
- ✅ Updating dependencies
- ✅ Changing configuration options

**What to update:**

- User guides if behavior changes
- API docs if signatures change
- Code patterns if best practices evolve
- Troubleshooting if new issues found
- README for major changes

---

**Last Updated:** 2025-02-10

**Documentation Version:** 2.0.0 (Raspberry Pi focused)

**Primary Platform:** Raspberry Pi 5 with Raspberry Pi OS Lite 64-bit
