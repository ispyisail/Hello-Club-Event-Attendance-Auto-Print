# 🎉 Hello Club Event Attendance v1.1.0 Release Notes

**Release Date:** December 21, 2025

## 🌟 What's New

Version 1.1.0 is a **minor release** focused on **accessibility and ease of installation**. This release makes it possible for users to install and run the application **without administrator privileges**, making deployment easier in restricted environments.

---

## 🔑 Key Highlights

### 1. **No Administrator Rights Required!** 🎯

The biggest change in v1.1.0 is that the installer **no longer requires administrator privileges** for standard installation.

- ✅ Installs to your user folder (`%LOCALAPPDATA%\Hello Club Event Attendance`)
- ✅ No UAC prompts for standard installation
- ✅ Perfect for users without admin access
- ⚙️ Administrator rights only needed if you want the optional Windows service

**Why this matters:** Users in corporate environments or shared computers can now install and use the application without needing IT approval or admin access.

### 2. **Windows Service is Now Optional** ⚡

The Windows service is no longer installed by default. You can choose:

**Option A: Tray Monitor Only (No Admin)**
- Runs when you're logged in
- Lightweight and simple
- No administrator privileges required
- Perfect for personal use

**Option B: With Windows Service (Requires Admin)**
- Runs in the background 24/7
- Operates even when logged out
- Auto-starts on Windows boot
- Ideal for unattended operation

**Default:** Service installation is **unchecked** in the installer.

### 3. **Fixed SMTP Port Field Visibility** 📧

The SMTP Port configuration field is now properly visible in the installer wizard. Previously, a long description was hiding this important field.

---

## 📦 Installation Changes

### **For New Users:**

1. Download `HelloClubEventAttendance-Setup-1.1.0.exe`
2. **Double-click to run** (no right-click → Run as Administrator needed!)
3. Follow the wizard
4. Optionally check "Install Windows service" if you want 24/7 operation (requires admin)

### **For Existing v1.0.x Users:**

Your current installation continues to work! No action required.

**If you want to migrate to the new location:**
1. Uninstall v1.0.x (preserves your `.env` and `config.json`)
2. Install v1.1.0
3. Copy your configuration files if needed

Both installation paths are supported for backward compatibility.

---

## 📋 Full Changelog

### **Added**
- ✨ ESLint and Prettier for code quality
- 🔄 Husky pre-commit hooks for consistency
- 🤖 GitHub Actions CI/CD with automated installer builds
- 🔒 Dependabot for security updates
- 📝 Comprehensive v1.1.0 testing checklist
- 🛠️ `complete-installation.bat` helper script with auto-detection
- 📖 Migration guide for v1.0.x users

### **Changed (Breaking)**
- 🚨 **Installation location:** `C:\Program Files` → `%LOCALAPPDATA%`
- 🚨 **Service installation:** Required → Optional (unchecked by default)
- 🔓 **Admin rights:** Required → Optional (only for Windows service)

### **Changed (Non-Breaking)**
- 📚 Updated all documentation for non-admin installation
- 💬 Improved installer messages and descriptions
- 🎨 Better user experience throughout

### **Fixed**
- ✅ SMTP Port field now visible in installer
- ✅ `complete-installation.bat` detects both install locations
- ✅ GitHub Actions permissions for release creation
- ✅ Email config page description sizing

### **Security**
- 🔒 Electron security improvements (context isolation)
- 🛡️ Automated security scanning in CI
- 🔐 Reduced privilege requirements

### **Documentation**
- 📝 All docs updated for v1.1.0 changes
- 📖 Added upgrade/migration guides
- ✅ New comprehensive testing checklist

---

## 🧪 Testing

Before releasing, we recommend testing:

**High Priority:**
- ✅ Non-admin installation works without UAC prompts
- ✅ SMTP Port field is visible in installer
- ✅ Service installation works when checkbox is checked
- ✅ Application runs correctly without service

**Medium Priority:**
- ✅ Upgrade from v1.0.x preserves configuration
- ✅ Backward compatibility with Program Files location
- ✅ `complete-installation.bat` detects both paths

See `docs/V1.1.0-TESTING-CHECKLIST.md` for complete testing guide.

---

## 📥 Download

### **Installer**
- **Filename:** `HelloClubEventAttendance-Setup-1.1.0.exe`
- **Size:** ~150 MB
- **Download:** [GitHub Releases](https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/releases/tag/v1.1.0)

### **Requirements**
- Windows 10 or later
- Node.js 14.x or later
- 500 MB free disk space
- Administrator privileges (only for optional Windows service)

---

## 🔄 Upgrade Path

| Current Version | Action Required | Notes |
|----------------|----------------|-------|
| **v1.0.x** | Optional | Can continue using current installation or migrate |
| **v0.x** | Recommended | Significant improvements since initial releases |
| **New Install** | N/A | Follow standard installation process |

---

## 🐛 Known Issues

None at this time. If you encounter issues:
1. Check `docs/TROUBLESHOOTING.md`
2. Review logs via tray icon → View Logs
3. Report issues on [GitHub](https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/issues)

---

## 💡 Tips for This Release

**For Users Without Admin Rights:**
- Install normally - no admin needed!
- Use tray monitor mode (works great for single-user scenarios)
- Can still process events automatically while logged in

**For Users With Admin Rights:**
- Check "Install Windows service" during setup
- Enjoy 24/7 unattended operation
- Service auto-restarts on failure

**For Upgrading Users:**
- Your configuration is preserved
- No breaking changes to functionality
- Can keep using Program Files location if preferred

---

## 🙏 Thank You

Special thanks to all users who provided feedback on installation challenges. This release is a direct response to requests for easier installation in restricted environments.

---

## 📚 Documentation

- **README.md** - Quick start guide
- **CHANGELOG.md** - Full change history
- **docs/V1.1.0-TESTING-CHECKLIST.md** - Testing guide
- **docs/INSTALLER-USER-GUIDE.md** - Detailed installation instructions
- **docs/TROUBLESHOOTING.md** - Common issues

---

## 🚀 What's Next?

Future releases may include:
- Additional print output formats
- Enhanced scheduling options
- Web-based configuration interface
- Multi-user support

Stay tuned for updates!

---

**Questions or Issues?**
- 📖 Check the documentation in the `docs/` folder
- 🐛 Report bugs on [GitHub Issues](https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/issues)
- 💬 Join discussions on GitHub

---

**Made with ❤️ for Hello Club users**

*Automated event management made simple.*
