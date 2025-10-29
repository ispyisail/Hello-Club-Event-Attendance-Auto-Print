# GUI Control Center with Standalone Executable

This guide explains how the GUI Control Center works with the standalone `.exe` file and how to distribute it.

---

## 🎯 Overview

The GUI Control Center works seamlessly with both:
- **Node.js installation** (development mode)
- **Standalone executable** (distribution mode)

The application **automatically detects** which mode it's running in and adjusts paths accordingly.

---

## 📦 What's Included in the Executable

When you build the executable with `Build Executable.bat`, the following are bundled:

### **Bundled Inside .exe:**
- ✅ Node.js runtime (v18)
- ✅ All JavaScript source code
- ✅ All npm dependencies (express, socket.io, etc.)
- ✅ SQLite native bindings (better-sqlite3)

### **Extracted to Filesystem (Needed at Runtime):**
- ✅ `src/gui/public/` - HTML, CSS, JavaScript files
- ✅ Socket.io client library (`/socket.io/socket.io.js`)

---

## 🏗️ How It Works

### **Path Detection**

The GUI server automatically detects if it's running as an executable:

```javascript
// From src/gui-server.js
const IS_PKG = typeof process.pkg !== 'undefined';
const GUI_PUBLIC_PATH = IS_PKG
    ? path.join(process.cwd(), 'src', 'gui', 'public')
    : path.join(__dirname, 'gui', 'public');
```

### **Running as Node.js:**
```
project/
├── src/
│   └── gui/
│       └── public/
│           ├── index.html
│           ├── css/style.css
│           └── js/app.js
└── node_modules/
    └── socket.io/
```

### **Running as Executable:**
```
HelloClub-Portable/
├── hello-club.exe        <- Bundled with Node.js + code
└── src/
    └── gui/
        └── public/
            ├── index.html    <- Must be present!
            ├── css/style.css
            └── js/app.js
```

---

## 📋 Building for Distribution

### **Step 1: Build the Executable**

Run:
```cmd
Build Executable.bat
```

This creates: `dist/hello-club.exe`

### **Step 2: Create Distribution Package**

Run:
```cmd
Build Distribution Package.bat
```

This creates: `dist/HelloClub-Portable/` with:
- ✅ `hello-club.exe` - Standalone executable
- ✅ `src/gui/public/` - GUI assets (HTML, CSS, JS)
- ✅ Configuration examples (`.env.example`, `config.json.example`)
- ✅ Documentation (README.md, GUI-README.md, etc.)
- ✅ Batch file shortcuts (`Start GUI.bat`, `Start Service.bat`, etc.)
- ✅ Empty folders (`backups/`)

### **Step 3: Test the Package**

```cmd
cd dist\HelloClub-Portable

# Copy examples to actual config files
copy .env.example .env
copy config.json.example config.json

# Edit .env with your API_KEY
notepad .env

# Test the GUI
Start GUI.bat
```

Then open: http://localhost:3000

---

## 🚀 Distribution Instructions

### **For End Users:**

1. **Extract the ZIP** to any folder (e.g., `C:\HelloClub\`)

2. **Configure the application:**
   ```cmd
   # Copy example files
   copy .env.example .env
   copy config.json.example config.json

   # Edit with your details
   notepad .env
   notepad config.json
   ```

3. **Start the GUI:**
   - Double-click: `Start GUI.bat`
   - Or run: `hello-club.exe gui`

4. **Open browser:**
   - Navigate to: http://localhost:3000

5. **Install as Windows Service** (optional):
   - Follow Setup Wizard in GUI
   - Or read: NSSM-QUICK-START.md

---

## ⚙️ Configuration for Executable

### **pkg Configuration (package.json):**

```json
{
  "pkg": {
    "assets": [
      "src/**/*.js",
      "src/gui/public/**/*",        // GUI assets
      "node_modules/socket.io/**/*", // Socket.io
      "node_modules/engine.io/**/*", // Engine.io
      "node_modules/better-sqlite3/**/*"
    ]
  }
}
```

This tells `pkg` to extract these files to the filesystem at runtime.

---

## 🔍 Troubleshooting

### **Issue: "Cannot GET /" or blank page**

**Cause:** GUI assets not found

**Solution:**
1. Ensure `src/gui/public/` folder exists next to `hello-club.exe`
2. Check folder structure:
   ```
   HelloClub-Portable/
   ├── hello-club.exe
   └── src/
       └── gui/
           └── public/
               ├── index.html
               ├── css/style.css
               └── js/app.js
   ```

### **Issue: "Socket.io client not loading"**

**Cause:** Socket.io client library not accessible

**Solution:** Socket.io serves `/socket.io/socket.io.js` automatically. Ensure:
1. `node_modules/socket.io/**/*` is in pkg assets
2. No firewall blocking port 3000

### **Issue: "ENOENT: no such file or directory"**

**Cause:** Application trying to access files inside the .exe

**Solution:** Check if the file should be in `pkg.assets` in package.json

### **Issue: "Module not found"**

**Cause:** Missing dependency or not bundled correctly

**Solution:**
1. Ensure dependency is in `package.json` dependencies (not devDependencies)
2. Rebuild executable: `npm run build`

---

## 📝 Files Required for GUI to Work

### **Minimum Required Structure:**

```
HelloClub-Portable/
├── hello-club.exe                      <- The executable (required)
├── src/                                <- Required for GUI
│   └── gui/
│       └── public/
│           ├── index.html              <- Main page
│           ├── css/
│           │   └── style.css           <- Styling
│           └── js/
│               └── app.js              <- Client-side logic
├── .env                                <- Your configuration
├── config.json                         <- Settings
└── Start GUI.bat                       <- Convenience launcher
```

### **Optional Files:**

```
├── README.md                           <- Documentation
├── GUI-README.md                       <- GUI guide
├── NSSM-QUICK-START.md                <- Service setup
├── Start Service.bat                   <- Service launcher
└── backups/                            <- Backup folder
```

---

## 🎯 Testing Checklist

Before distributing, test the following:

### **Basic Functionality:**
- [ ] Extract distribution package to clean folder
- [ ] Copy `.env.example` to `.env` and add `API_KEY`
- [ ] Copy `config.json.example` to `config.json`
- [ ] Run `hello-club.exe gui` or double-click `Start GUI.bat`
- [ ] GUI opens at http://localhost:3000
- [ ] Connection status shows "Connected" (green)
- [ ] All 8 tabs load correctly

### **GUI Features:**
- [ ] Dashboard shows service status
- [ ] Service Control can start/stop service (if installed)
- [ ] Configuration editor loads config.json
- [ ] Logs tab shows activity.log
- [ ] Monitoring tab shows circuit breakers
- [ ] Tools tab allows event fetching
- [ ] Setup Wizard displays correctly
- [ ] About tab shows version info

### **Real-time Updates:**
- [ ] Connection indicator is green
- [ ] Status updates every 5 seconds
- [ ] Logs auto-refresh when enabled
- [ ] Service status changes reflect immediately

### **Executable-Specific:**
- [ ] No "Node.js not found" errors
- [ ] Works on clean Windows machine (no Node.js)
- [ ] All paths resolve correctly
- [ ] Static files (HTML, CSS, JS) load
- [ ] Socket.io connection establishes

---

## 🚢 Deployment Scenarios

### **Scenario 1: Single Computer**

1. Extract to `C:\HelloClub\`
2. Configure `.env` and `config.json`
3. Run `Start GUI.bat`
4. Use GUI for all operations

### **Scenario 2: Windows Service**

1. Extract to `C:\HelloClub\`
2. Configure `.env` and `config.json`
3. Install service via NSSM:
   ```cmd
   nssm install HelloClubAttendance C:\HelloClub\hello-club.exe
   # Set startup directory: C:\HelloClub\
   # Set arguments: start-service
   ```
4. Start service
5. Use GUI to monitor: `hello-club.exe gui`

### **Scenario 3: Multiple Computers**

1. Build distribution package once
2. Create ZIP: `dist\HelloClub-Portable.zip`
3. Distribute ZIP to all computers
4. Each computer:
   - Extract ZIP
   - Configure their own `.env` and `config.json`
   - Run `Start GUI.bat` or install service

---

## 💡 Best Practices

### **For Developers:**

1. **Always test executable before distributing:**
   ```cmd
   npm run build
   Build Distribution Package.bat
   cd dist\HelloClub-Portable
   hello-club.exe gui
   ```

2. **Keep GUI assets external:**
   - Don't try to bundle HTML/CSS inside exe
   - pkg assets extraction is reliable

3. **Update package.json when adding GUI files:**
   ```json
   "assets": [
     "src/gui/public/**/*"  // Include all GUI files
   ]
   ```

### **For End Users:**

1. **Keep folder structure intact:**
   - Don't move `hello-club.exe` without `src/` folder
   - Keep everything together

2. **Use batch files for convenience:**
   - `Start GUI.bat` - GUI interface
   - `Start Service.bat` - Service mode
   - `Health Check.bat` - Quick status check

3. **Check logs if issues:**
   - `error.log` - Error details
   - `activity.log` - What happened
   - GUI Logs tab - Live view

---

## 📊 Size Considerations

### **Typical Sizes:**

- `hello-club.exe`: ~45-50 MB (Node.js runtime + code + dependencies)
- `src/gui/public/`: ~15 KB (HTML + CSS + JS)
- Total distribution: ~50 MB uncompressed, ~20 MB as ZIP

### **What Makes It Large:**

- Node.js runtime (~40 MB)
- better-sqlite3 native bindings (~5 MB)
- Express + Socket.io (~3 MB)

### **Optimization Tips:**

1. **Remove unused dependencies** before building
2. **Use production builds** only
3. **Don't include dev dependencies**

---

## 🔐 Security Notes

### **For Distribution:**

1. **Don't include `.env` with real credentials**
   - Include `.env.example` only
   - Users create their own `.env`

2. **Document required permissions:**
   - File system access
   - Network access (ports 3000, 3030, 9090)
   - Printer access (if using local printing)

3. **Antivirus false positives:**
   - Executable may trigger warnings
   - Sign executable if possible
   - Document known false positives

---

## 📚 Related Documentation

- **GUI-README.md** - Complete GUI user guide
- **BUILDING-EXECUTABLE.md** - Detailed build instructions
- **NSSM-QUICK-START.md** - Windows service setup
- **README.md** - Main application documentation

---

## ❓ FAQ

### **Q: Do users need Node.js installed?**
A: No! The executable is standalone and includes Node.js runtime.

### **Q: Can I move the .exe without the src/ folder?**
A: No. The GUI requires `src/gui/public/` files to be accessible.

### **Q: Why is the executable so large?**
A: It includes the entire Node.js runtime (~40MB) for portability.

### **Q: Can I run multiple instances?**
A: Yes, but use different ports:
```cmd
hello-club.exe gui --port 3001
hello-club.exe gui --port 3002
```

### **Q: Does it work on Linux/Mac?**
A: Not yet. Currently Windows-only. Use `build:all` for cross-platform builds.

### **Q: Can I customize the GUI?**
A: Yes! Edit files in `src/gui/public/` and rebuild.

---

## ✅ Summary

The GUI Control Center works perfectly with the standalone executable by:

1. ✅ **Automatically detecting** execution mode (Node.js vs exe)
2. ✅ **Adjusting paths** dynamically based on mode
3. ✅ **Extracting assets** (HTML, CSS, JS) to filesystem via pkg
4. ✅ **Bundling dependencies** (Express, Socket.io) inside exe
5. ✅ **Requiring minimal external files** (just src/gui/public/)

**Distribution is simple:**
1. Run `Build Distribution Package.bat`
2. ZIP the `dist/HelloClub-Portable` folder
3. Distribute - users just extract and run!

**No Node.js installation required for end users!** 🎉
