# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Legacy Windows documentation organization in `docs/legacy/` folder
- Raspberry Pi 5 focus throughout all documentation
- systemd service troubleshooting and management
- CUPS printing configuration and troubleshooting (Linux)
- SSH connection troubleshooting for Raspberry Pi
- Web dashboard feature documentation
- Remote development workflow for Raspberry Pi
- Cross-platform development considerations
- Platform-specific testing procedures

### Changed

- **BREAKING DOCUMENTATION**: Primary platform is now Raspberry Pi 5, Windows is legacy
- **ARCHITECTURE.md**: Complete rewrite for Raspberry Pi/systemd architecture
  - Replaced Windows Service section with systemd service documentation
  - Replaced Electron Tray App section with Web Dashboard documentation
  - Removed Inno Setup installer architecture
  - Added CUPS printing architecture (Linux)
  - Updated design decisions to reflect Pi deployment
  - Added systemd security hardening documentation
- **INDEX.md**: Reorganized documentation index
  - Raspberry Pi documentation now prominently featured
  - Windows-specific docs moved to "Legacy Documentation" section
  - Updated "Getting Started" to prioritize Raspberry Pi setup
  - Removed Windows docs from main documentation tables
  - Added clear platform notes and migration guidance
- **TROUBLESHOOTING.md**: Reorganized troubleshooting guide
  - New "Raspberry Pi / Linux Issues" section at the top
  - systemd service troubleshooting (status, crashes, restarts)
  - CUPS printing troubleshooting
  - Web dashboard troubleshooting
  - SSH connection issues
  - Linux file permissions and ownership
  - Moved Windows-specific troubleshooting to "Legacy" section
- **DEVELOPMENT.md**: Refocused on cross-platform development
  - Removed Windows-specific prerequisites (Visual Studio Build Tools)
  - Removed Electron tray app development section
  - Removed Windows service development section
  - Removed Windows installer building section
  - Added Raspberry Pi testing and deployment workflow
  - Added remote development via SSH
  - Marked `node-windows`, `electron`, `electron-builder` as legacy dependencies
- **README.md**: Updated for Raspberry Pi focus
  - Clarified `node-windows` and `electron` are legacy Windows-only dependencies
  - Replaced "Using the Installer" section with "Legacy Windows Installation"
  - Updated "Configuration" section to focus on web dashboard
  - Changed "Settings GUI in tray app" references to web dashboard
  - Updated "Dashboard Features" section (removed tray app terminology)
  - Reorganized documentation links to de-emphasize Windows docs
  - Updated acknowledgments to feature Raspberry Pi Foundation and Express

### Removed

- Windows Service (node-windows) references from main documentation
- Electron Tray App documentation from main sections
- Inno Setup installer guides from primary docs
- Visual Studio Build Tools setup instructions
- SumatraPDF printing instructions from main troubleshooting
- Windows-centric architecture diagrams

### Deprecated

- Windows deployment (still supported but no longer recommended)
- Electron tray application (archived, web dashboard recommended)
- Windows Service wrapper (archived, systemd recommended)
- Inno Setup installer (archived for legacy Windows users)

### Documentation

- All Windows-specific documentation moved to `docs/legacy/` folder
- Added clear "Platform Note" throughout docs indicating Raspberry Pi is recommended
- Added migration guidance from Windows to Raspberry Pi
- Updated all code examples to use Linux commands (systemctl, journalctl, tail)
- Updated file paths to Linux locations (`/opt/helloclub/app/`)
- Added "Legacy Platform Users" sections with links to archived docs
- Incremented documentation version to 2.0.0 (Raspberry Pi focused)

### Migration Notes

- Existing Windows users (v1.0.x) can continue using Windows with legacy documentation
- New deployments should use Raspberry Pi 5 for better reliability and lower cost
- Windows-specific docs remain available in `docs/legacy/` folder
- Migration guide available in RASPBERRY-PI-SETUP.md

### Fixed

### Security

## [1.1.0] - 2025-12-21

### Added

- ESLint configuration for code quality enforcement
- Prettier configuration for consistent code formatting
- Husky and lint-staged for pre-commit hooks
- GitHub Actions CI/CD pipeline with installer building
- Dependabot configuration for automated dependency updates
- SECURITY.md with vulnerability reporting guidelines
- `.nvmrc` to pin Node.js version
- `.editorconfig` for consistent editor settings
- Jest configuration with coverage thresholds
- Comprehensive package.json metadata (author, repository, keywords)
- `complete-installation.bat` helper script for post-install setup with auto-detection of install location
- Comprehensive v1.1.0 testing checklist (docs/V1.1.0-TESTING-CHECKLIST.md)
- Migration guide for users upgrading from v1.0.x

### Changed

- **BREAKING**: Default installation location changed from `C:\Program Files` to `%LOCALAPPDATA%` (user folder)
- **BREAKING**: Windows service installation is now **optional** and **unchecked by default**
- Installer no longer requires administrator privileges for standard installation (admin only needed for optional Windows service)
- Updated LICENSE with actual copyright holder name
- Removed email credentials from config.json (now uses .env only)
- Enhanced .env.example with better documentation
- Updated all documentation to reflect non-admin installation process
- Improved installer welcome message to clarify admin requirements
- Application can now run using only the tray monitor without the Windows service

### Fixed

- SMTP Port field visibility in installer configuration wizard
- Email config page description reduced to properly show SMTP Port input field
- `complete-installation.bat` now detects both LocalAppData and Program Files installations
- Added `contents: write` permission to GitHub Actions workflow for automated release creation

### Security

- Fixed Electron security issues (context isolation enabled)
- Removed hardcoded email credentials from config.json
- Added npm audit checks to CI pipeline
- Implemented automated dependency security scanning
- Reduced privilege requirements - standard users can now install without admin rights

### Documentation

- Updated README.md with non-admin installation instructions and upgrade guide
- Updated INSTALLER-USER-GUIDE.md with new installation paths and options
- Updated ARCHITECTURE.md with both standard and legacy deployment paths
- Updated installer/README.md with v1.1.0 build instructions
- Added comprehensive testing checklist for v1.1.0 features
- Clarified Windows service is optional throughout all documentation

### Migration Notes

- Existing v1.0.x installations in Program Files continue to work
- New installations default to LocalAppData folder (no admin required)
- Users can migrate by uninstalling old version and reinstalling (preserves config)
- Both installation paths are supported for backward compatibility

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

[Unreleased]: https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/releases/tag/v1.1.0
[1.0.0]: https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/releases/tag/v1.0.0
[0.1.0]: https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/releases/tag/v0.1.0
