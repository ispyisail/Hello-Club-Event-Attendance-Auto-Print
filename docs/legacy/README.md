# Legacy Documentation

This folder contains documentation for legacy Windows-based deployment that is no longer actively maintained.

## Migration Notice

**The project has migrated from Windows to Raspberry Pi as of version 1.3.0.**

For current deployment instructions, see:

- [RASPBERRY-PI-SETUP.md](../RASPBERRY-PI-SETUP.md) - Raspberry Pi deployment (recommended)
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Complete deployment guide for all platforms

## Legacy Windows Documentation

The following documentation is kept for reference but may be outdated:

- **BUILD-INSTALLER.md** - Building Windows installers (Inno Setup)
- **INSTALLER-USER-GUIDE.md** - Using the Windows installer
- **TRAY-APP-GUIDE.md** - Windows system tray application
- **WINDOWS-SERVICE-SETUP.md** - Windows service installation

### Why We Migrated

The project moved to Raspberry Pi for:

- ✅ Always-on server deployment
- ✅ Lower power consumption
- ✅ Better suited for headless operation
- ✅ Web dashboard for remote management
- ✅ systemd service management
- ✅ Standard Linux deployment patterns

### Windows Support Status

- ❌ **Windows Service** - No longer maintained
- ❌ **System Tray App** - No longer maintained
- ❌ **Inno Setup Installer** - No longer maintained
- ⚠️ **Manual Installation** - May still work with `node src/index.js start-service`

If you need Windows support, consider:

1. Using an older release (v1.2.0 or earlier)
2. Running the Node.js script directly without the service
3. Using WSL2 (Windows Subsystem for Linux) to run the Linux version

---

**Last Updated:** 2025-02-09 (Migration to Raspberry Pi)
