# Building Standalone Executable

This guide shows you how to build Hello Club as a standalone Windows executable (.exe) that **does not require Node.js** to be installed.

---

## Table of Contents
- [Overview](#overview)
- [Why Build an Executable?](#why-build-an-executable)
- [Prerequisites](#prerequisites)
- [Building the Executable](#building-the-executable)
- [Creating Distribution Package](#creating-distribution-package)
- [Distributing to End Users](#distributing-to-end-users)
- [Using the Executable](#using-the-executable)
- [Troubleshooting](#troubleshooting)
- [Technical Details](#technical-details)

---

## Overview

The executable build process uses **pkg** to bundle:
- Node.js runtime
- All application code
- All npm dependencies
- Native modules (better-sqlite3, etc.)

Into a single `.exe` file that runs on any Windows computer without requiring Node.js installation.

---

## Why Build an Executable?

### **Advantages:**
✅ **No Node.js required** - End users don't need to install Node.js
✅ **Easy distribution** - Single file (+ config files)
✅ **Professional** - Looks and feels like a native Windows app
✅ **Simplified deployment** - Just copy and run
✅ **Version control** - Bundle specific Node.js version

### **Disadvantages:**
❌ **Large file size** - ~80-100MB (includes Node.js runtime)
❌ **Build time** - Takes 2-5 minutes to build
❌ **Harder to debug** - Can't easily inspect bundled code
❌ **Platform-specific** - Need separate builds for Windows/Linux/Mac

---

## Prerequisites

### **For Building** (Developer Machine):
1. ✅ **Node.js installed** (v16 or higher)
2. ✅ **npm installed** (comes with Node.js)
3. ✅ **All dependencies installed**: `npm install`
4. ✅ **~200MB free disk space** (for build process)

### **For Running** (End User Machine):
1. ✅ **Windows 10 or later** (64-bit)
2. ❌ **Node.js NOT required**
3. ✅ **~100MB free disk space**

---

## Building the Executable

### **Method 1: GUI (Easiest)**

**Step 1: Double-click**
```
Double-click: "Build Executable.bat"
```

The script will:
- Check prerequisites
- Install pkg if needed
- Build the executable
- Create `dist/hello-club.exe`

**Time:** 2-5 minutes

---

### **Method 2: Command Line**

```cmd
# Install dependencies if needed
npm install

# Build for Windows only
npm run build

# Build for all platforms
npm run build:all
```

**Output:**
- Windows: `dist/hello-club.exe`
- Linux: `dist/hello-club-linux`
- macOS: `dist/hello-club-macos`

---

## Creating Distribution Package

### **Method 1: GUI (Recommended)**

After building the executable:

```
Double-click: "Build Distribution Package.bat"
```

This creates a complete distribution folder with:
- ✅ `hello-club.exe`
- ✅ `.env.example`
- ✅ `config.json.example`
- ✅ Documentation files
- ✅ Batch file shortcuts
- ✅ Folder structure
- ✅ ZIP archive (for easy distribution)

**Output:** `dist/HelloClub-Portable/` and `dist/HelloClub-Portable.zip`

---

### **Method 2: Manual**

```cmd
# Create folder
mkdir dist\HelloClub-Portable

# Copy exe
copy dist\hello-club.exe dist\HelloClub-Portable\

# Copy example files
copy .env.example dist\HelloClub-Portable\
copy config.json.example dist\HelloClub-Portable\

# Copy docs
copy README.md dist\HelloClub-Portable\
```

---

## Distributing to End Users

### **What to Distribute:**

**Option A: ZIP File (Recommended)**
```
dist/HelloClub-Portable.zip
```
- Single file to download
- Extracts to complete working folder
- Easy to email or host

**Option B: Folder**
```
dist/HelloClub-Portable/
```
- Can be copied directly to USB drive
- Portable - no installation needed

---

### **End User Instructions:**

Include these steps:

1. **Extract ZIP** (if using ZIP)
2. **Copy `.env.example` to `.env`**
3. **Edit `.env`** - Add your `API_KEY`
4. **Copy `config.json.example` to `config.json`**
5. **Edit `config.json`** - Configure settings
6. **Run:** Double-click `Start Service.bat`

**That's it!** No Node.js installation required.

---

## Using the Executable

### **Available Commands:**

All normal commands work with the `.exe`:

```cmd
# Start service
hello-club.exe start-service

# Fetch events
hello-club.exe fetch-events

# Process schedule
hello-club.exe process-schedule

# Start dashboard
hello-club.exe dashboard

# Health check
hello-club.exe health-check

# View all commands
hello-club.exe --help
```

---

### **Running as Windows Service:**

#### **Method 1: NSSM (Recommended)**

1. Download NSSM from https://nssm.cc/
2. Run as Administrator:
   ```cmd
   nssm install HelloClubAttendance
   ```
3. In the GUI:
   - **Path:** `C:\path\to\hello-club.exe`
   - **Startup directory:** `C:\path\to\folder`
   - **Arguments:** `start-service`
4. Click "Install service"

#### **Method 2: sc command**

Run as Administrator:
```cmd
sc create HelloClubAttendance binPath= "C:\full\path\to\hello-club.exe start-service" start= auto DisplayName= "Hello Club Attendance"
sc description HelloClubAttendance "Automatically prints event attendance lists"
sc start HelloClubAttendance
```

---

## Troubleshooting

### **Build Issues**

#### **"pkg not found"**
```cmd
npm install --save-dev pkg
```

#### **"Out of memory" during build**
```cmd
# Increase Node.js memory
set NODE_OPTIONS=--max_old_space_size=4096
npm run build
```

#### **Antivirus blocking build**
- Temporarily disable antivirus
- Or add exception for `node_modules\.bin\pkg.exe`

#### **Build fails with native module errors**
This is expected for some modules. The build should still succeed.
```
> Warning: Cannot resolve 'x'
```
These warnings are usually safe to ignore.

---

### **Runtime Issues**

#### **"Cannot find module 'better-sqlite3'"**
This means the native module wasn't bundled correctly.

**Solution:**
```json
// In package.json, ensure pkg.assets includes:
"assets": [
  "node_modules/better-sqlite3/**/*"
]
```

#### **Executable is huge (>200MB)**
This is normal. The exe includes:
- Node.js runtime (~50MB)
- All dependencies (~30MB)
- Native modules (~20MB)
- Your code (~1MB)

**To reduce size:**
```cmd
# Use upx to compress (optional)
upx --best dist\hello-club.exe
```

Note: This may trigger antivirus warnings.

---

### **Distribution Issues**

#### **"Windows protected your PC"**
Users may see SmartScreen warning:

**Solution:**
1. Click "More info"
2. Click "Run anyway"

**To prevent this:**
- Sign the executable with a code signing certificate
- Or instruct users on the workaround

#### **Antivirus flags executable**
Some antivirus programs flag packaged Node.js apps.

**Solutions:**
- Submit to antivirus vendors for whitelisting
- Sign with code signing certificate
- Host on trusted platform (users download less likely to be flagged)

---

## Technical Details

### **Build Configuration**

The build is configured in `package.json`:

```json
{
  "bin": "src/index.js",
  "pkg": {
    "targets": ["node18-win-x64"],
    "outputPath": "dist",
    "assets": [
      "src/**/*.js",
      "node_modules/better-sqlite3/**/*",
      "node_modules/node-windows/**/*"
    ],
    "scripts": ["src/**/*.js"]
  }
}
```

### **How pkg Works**

1. **Analyzes** your code to find all `require()` statements
2. **Bundles** all required files
3. **Compiles** a Node.js runtime
4. **Packages** everything into single executable
5. **Extracts** files to temp folder at runtime

---

### **Native Modules**

Native modules (like `better-sqlite3`) require special handling:

**At Build Time:**
- pkg bundles the native `.node` files
- Assets directive includes the entire module folder

**At Runtime:**
- Executable extracts `.node` files to temp folder
- Node.js loads from temp location

**Verified Working:**
- ✅ better-sqlite3 (SQLite)
- ✅ axios (HTTP client)
- ✅ nodemailer (Email)
- ✅ pdfkit (PDF generation)
- ✅ winston (Logging)

**May Require Testing:**
- ⚠️ pdf-to-printer (printer integration)
- ⚠️ node-windows (service management)

---

### **File System Layout**

When executable runs, it creates:

```
C:\path\to\hello-club.exe  (executable)
│
├── .env                   (user creates)
├── config.json            (user creates)
├── events.db              (created by app)
├── activity.log           (created by app)
├── error.log              (created by app)
├── status.json            (created by app)
├── metrics.json           (created by app)
├── dead-letter-queue.json (created by app)
├── backups\               (created by app)
└── .pdf-cache\            (created by app)
```

The exe itself remains unchanged - all data is external.

---

### **Environment Variables**

The executable still uses `.env` file:

**Works:** ✅
```
.env file in same folder as .exe
```

**Also Works:** ✅
```cmd
set API_KEY=your_key
hello-club.exe start-service
```

---

## Comparison: Node.js vs Executable

| Feature | Node.js Version | Executable Version |
|---------|----------------|-------------------|
| **Requires Node.js** | ✅ Yes | ❌ No |
| **File Size** | ~5MB (code only) | ~100MB (includes runtime) |
| **Startup Time** | Fast | Slightly slower |
| **Debugging** | Easy | Harder |
| **Distribution** | Complex | Simple |
| **Updates** | `git pull` | Replace .exe |
| **Platform** | Cross-platform | Platform-specific |
| **For Developers** | ✅ Recommended | Optional |
| **For End Users** | Complex setup | ✅ Simple |

---

## Recommended Distribution Strategy

### **For Technical Users:**
Distribute the **Node.js version** with instructions to:
1. Install Node.js
2. Clone repository
3. Run `npm install`
4. Configure and run

**Advantages:**
- Easy to update
- Smaller download
- Better for customization

### **For Non-Technical Users:**
Distribute the **Executable version**:
1. Provide ZIP file
2. Include simple setup guide
3. Pre-configure what you can

**Advantages:**
- No technical knowledge required
- One-click operation
- Professional appearance

---

## Build Checklist

Before distributing:

- [ ] Test exe on clean Windows machine (no Node.js)
- [ ] Verify all commands work
- [ ] Test service installation
- [ ] Check dashboard loads
- [ ] Verify PDF printing works
- [ ] Test email sending (if used)
- [ ] Confirm database operations work
- [ ] Check log files are created
- [ ] Test backup functionality
- [ ] Verify circuit breakers work
- [ ] Review file size (should be ~80-100MB)
- [ ] Create example `.env` and `config.json`
- [ ] Write clear setup instructions
- [ ] Include troubleshooting guide
- [ ] Consider code signing certificate

---

## Support for End Users

Provide these support resources:

1. **Quick Start Guide** - QUICK-START-EXE.md (auto-generated)
2. **Troubleshooting** - Common issues and solutions
3. **Contact** - How to get help
4. **Updates** - How to get new versions

---

## Automated Builds (Optional)

### **GitHub Actions**

Add to `.github/workflows/build-exe.yml`:

```yaml
name: Build Executable

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: hello-club-exe
          path: dist/hello-club.exe
```

This builds the exe automatically when you create a release tag.

---

## Summary

**To build and distribute:**

```cmd
# 1. Build executable
Double-click "Build Executable.bat"

# 2. Create distribution package
Double-click "Build Distribution Package.bat"

# 3. Distribute
dist/HelloClub-Portable.zip
```

**End users:**
```cmd
# 1. Extract ZIP
# 2. Configure .env and config.json
# 3. Double-click "Start Service.bat"
```

**That's it!** 🚀

Your application is now a professional standalone executable that anyone can run without technical knowledge.
