# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- ESLint configuration for code quality enforcement
- Prettier configuration for consistent code formatting
- Husky and lint-staged for pre-commit hooks
- GitHub Actions CI/CD pipeline
- Dependabot configuration for automated dependency updates
- SECURITY.md with vulnerability reporting guidelines
- `.nvmrc` to pin Node.js version
- `.editorconfig` for consistent editor settings
- Jest configuration with coverage thresholds
- Comprehensive package.json metadata (author, repository, keywords)

### Changed
- Updated LICENSE with actual copyright holder name
- Removed email credentials from config.json (now uses .env only)
- Enhanced .env.example with better documentation

### Security
- Fixed Electron security issues (context isolation enabled)
- Removed hardcoded email credentials from config.json
- Added npm audit checks to CI pipeline
- Implemented automated dependency security scanning

## [1.0.0] - 2025-12-20

### Added
- Automated event fetching from Hello Club API
- Smart scheduling system for event processing
- Professional PDF generation for attendee lists
- Windows Service integration with auto-start
- Electron-based system tray monitoring app
- SQLite database for event queue management
- Email printing support via SMTP
- Local printing support via pdf-to-printer
- Comprehensive documentation (10+ markdown files)
- Unit tests with Jest (20+ tests)
- Inno Setup installer for easy deployment
- Configuration validation with Joi
- Winston logging with rotation
- Category-based event filtering
- Configurable PDF layouts

### Features
- **Core Functionality**
  - Fetch events within configurable time windows
  - Process events N minutes before start time
  - Generate clean, printable PDFs
  - Print locally or via email

- **Windows Service**
  - Always-running background service
  - Auto-restart on failure
  - Configurable run intervals
  - Heartbeat logging

- **System Tray**
  - Color-coded status indicators (green/yellow/red)
  - Service control (start/stop/restart)
  - Log viewer interface
  - Desktop notifications
  - Real-time monitoring

- **Developer Experience**
  - Modular architecture
  - Comprehensive JSDoc comments
  - Type-safe configuration
  - Robust error handling

### Documentation
- README.md with quick start guide
- ARCHITECTURE.md for system design
- API.md for module reference
- CONFIGURATION.md for settings
- DEVELOPMENT.md for contributors
- WINDOWS-SERVICE-SETUP.md for installation
- TRAY-APP-GUIDE.md for monitoring
- INSTALLER-USER-GUIDE.md for deployment
- TESTING-GUIDE.md for test documentation
- TROUBLESHOOTING.md for common issues

## [0.1.0] - Initial Development

### Added
- Initial project structure
- Basic event fetching functionality
- Simple PDF generation
- Command-line interface

---

## Release Notes Format

Each release includes:
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements

[Unreleased]: https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/releases/tag/v1.0.0
[0.1.0]: https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/releases/tag/v0.1.0
