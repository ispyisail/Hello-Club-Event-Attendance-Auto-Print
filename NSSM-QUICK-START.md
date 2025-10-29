# NSSM Quick Start Guide

Complete GUI-based Windows service installation for Hello Club Event Attendance Auto-Print.

---

## 🚀 Installation (3 Easy Steps)

### **Step 1: Download NSSM** (No admin required)
Double-click: **`NSSM - Step 1 - Download NSSM.bat`**

✅ Downloads NSSM v2.24
✅ Extracts to `nssm/` folder
✅ Takes ~30 seconds

---

### **Step 2: Install Service** (Requires admin)
Right-click: **`NSSM - Step 2 - Install Service.bat`** → **Run as administrator**

✅ Installs Windows service
✅ Configures auto-start
✅ Starts service immediately
✅ Takes ~10 seconds

---

### **Step 3: Verify Installation**
Double-click: **`Start Dashboard.bat`**

✅ Opens http://localhost:3030
✅ Shows service status
✅ Displays event statistics

---

## ✅ You're Done!

The service is now:
- ✅ Running in the background
- ✅ Will start automatically with Windows
- ✅ Will restart automatically if it crashes
- ✅ Logging to `activity.log` and `error.log`

---

## 🎛️ Managing the Service

### **GUI Management**
Double-click: **`NSSM - Manage Service.bat`**

Provides menu for:
1. Start Service
2. Stop Service
3. Restart Service
4. View Status
5. Edit Configuration
6. View Logs
7. Uninstall Service
8. Open Windows Services

---

### **Windows Services GUI**
1. Press `Win + R`
2. Type `services.msc`
3. Find "Hello Club Event Attendance"
4. Right-click for options

---

### **Command Line** (Optional)
```cmd
# Start service
net start HelloClubAttendance

# Stop service
net stop HelloClubAttendance

# Check status
sc query HelloClubAttendance
```

---

## 📊 Monitoring

### **Web Dashboard**
Double-click: **`Start Dashboard.bat`**
- Real-time service status
- Event statistics
- Health checks
- Auto-refreshes every 30 seconds

### **Log Files**
Double-click: **`View Logs.bat`**
- View activity log
- View error log
- View status file
- Live tail option

---

## 🔧 Configuration

### **Edit Service Settings (GUI)**
1. Double-click `NSSM - Manage Service.bat`
2. Select option `5. Edit Service Configuration`
3. NSSM GUI opens with tabs:
   - **Application**: Path, arguments, directory
   - **Details**: Name, description, startup type
   - **Log on**: User account
   - **Dependencies**: Required services
   - **Process**: Priority, affinity
   - **Shutdown**: Timeout settings
   - **Exit actions**: What to do on exit
   - **I/O**: Log file locations
   - **File rotation**: Log rotation settings
   - **Environment**: Environment variables

4. Make changes in GUI
5. Click "Edit service"
6. Restart service for changes to take effect

---

## 🔄 Updating the Application

When you update the code (git pull, etc.):

```cmd
# 1. Stop service
net stop HelloClubAttendance

# 2. Update code
git pull
npm install

# 3. Start service
net start HelloClubAttendance
```

**OR use the GUI:**
1. Double-click `NSSM - Manage Service.bat`
2. Select `2. Stop Service`
3. Update your code
4. Select `1. Start Service`

**No reinstall required!** 🎉

---

## 🗑️ Uninstalling

### **Method 1: GUI (Easiest)**
1. Double-click `NSSM - Manage Service.bat`
2. Select `7. Uninstall Service`
3. Confirm when prompted

### **Method 2: Command Line**
Run as Administrator:
```cmd
nssm\nssm-2.24\win64\nssm.exe stop HelloClubAttendance
nssm\nssm-2.24\win64\nssm.exe remove HelloClubAttendance confirm
```

**Your data is preserved** (database, logs, backups, config)

---

## 🐛 Troubleshooting

### **Service Won't Start**

**Check Status:**
1. Double-click `NSSM - Manage Service.bat`
2. Select `4. View Service Status`

**Check Logs:**
1. Double-click `View Logs.bat`
2. Select `2. Error Log`

**Common Issues:**
- ❌ Missing `.env` file → Create `.env` with `API_KEY`
- ❌ Invalid `config.json` → Validate JSON syntax
- ❌ Node.js not found → Reinstall Node.js
- ❌ Port 3030 in use → Change port in config

**Test Manually:**
```cmd
# Stop service
net stop HelloClubAttendance

# Run manually to see errors
node src/index.js start-service
```

---

### **Service Keeps Crashing**

**View Error Log:**
```cmd
type error.log
```

**Check Windows Event Viewer:**
1. Press `Win + X` → Event Viewer
2. Windows Logs → Application
3. Look for "HelloClubAttendance" errors

**Increase Log Detail:**
Edit `.env` and add:
```
LOG_TO_CONSOLE=true
NODE_ENV=development
```

Restart service.

---

### **"NSSM not found" Error**

**Solution:**
Run `NSSM - Step 1 - Download NSSM.bat` first

**Manual Download:**
1. Visit https://nssm.cc/download
2. Download NSSM 2.24
3. Extract to `nssm/` folder in project root

---

## 📁 File Structure

After installation:
```
Hello-Club-Event-Attendance-Auto-Print/
├── nssm/                              # NSSM installation
│   ├── nssm-2.24/
│   │   └── win64/
│   │       └── nssm.exe              # NSSM executable
│   └── download-nssm.ps1             # Download script
├── NSSM - Step 1 - Download NSSM.bat # Download NSSM
├── NSSM - Step 2 - Install Service.bat # Install service
├── NSSM - Manage Service.bat          # Manage service
├── Start Dashboard.bat                # View dashboard
├── View Logs.bat                      # View logs
├── activity.log                       # Service output
├── error.log                          # Service errors
├── events.db                          # Database
└── config.json                        # Configuration
```

---

## 🎯 NSSM Service Configuration

### **Current Settings:**
| Setting | Value |
|---------|-------|
| **Service Name** | HelloClubAttendance |
| **Display Name** | Hello Club Event Attendance |
| **Startup Type** | Automatic (starts with Windows) |
| **Application** | node.exe |
| **Arguments** | src/index.js start-service |
| **Working Directory** | Project root |
| **Stdout Log** | activity.log |
| **Stderr Log** | error.log |
| **Log Rotation** | Enabled (10MB limit) |
| **Environment** | NODE_ENV=production |
| **Exit Action** | Restart (5 second delay) |
| **Throttle** | 10 seconds |

### **Auto-Restart Behavior:**
- Service crashes → Wait 5 seconds → Restart
- Multiple crashes → Wait 10 seconds between attempts
- Infinite retries (service will always try to restart)

---

## 🆚 NSSM vs node-windows

| Feature | NSSM | node-windows |
|---------|------|--------------|
| **Setup** | 2 batch files | 1 batch file |
| **Configuration** | GUI + CLI | Code only |
| **Updates** | Just restart | Must reinstall |
| **Log Rotation** | Built-in | Manual |
| **Reliability** | Excellent ⭐⭐⭐⭐⭐ | Good ⭐⭐⭐⭐ |
| **Production Use** | Recommended ✅ | Okay |

**You chose NSSM - excellent choice!** 🎉

---

## 📞 Quick Reference

### **First Time Setup:**
```
1. NSSM - Step 1 - Download NSSM.bat
2. NSSM - Step 2 - Install Service.bat (as admin)
3. Start Dashboard.bat (to verify)
```

### **Daily Use:**
- **Monitor**: Start Dashboard.bat → http://localhost:3030
- **View Logs**: View Logs.bat
- **Manage**: NSSM - Manage Service.bat

### **After Code Updates:**
```
Stop → Update Code → Start (no reinstall needed!)
```

### **Help:**
- Check error.log
- Run manually: node src/index.js start-service
- Check Event Viewer (Application logs)

---

## ✨ Advanced Features

### **Custom Environment Variables**
1. Open `NSSM - Manage Service.bat`
2. Select `5. Edit Service Configuration`
3. Go to "Environment" tab
4. Add variables (one per line):
   ```
   NODE_ENV=production
   LOG_LEVEL=debug
   CUSTOM_VAR=value
   ```

### **Run Under Different User**
1. Open `NSSM - Manage Service.bat`
2. Select `5. Edit Service Configuration`
3. Go to "Log on" tab
4. Select "This account"
5. Enter username and password

### **Startup Delay**
1. Open `NSSM - Manage Service.bat`
2. Select `5. Edit Service Configuration`
3. Go to "Process" tab
4. Set "Startup delay" (milliseconds)

### **CPU Affinity**
1. Open `NSSM - Manage Service.bat`
2. Select `5. Edit Service Configuration`
3. Go to "Process" tab
4. Set CPU affinity mask

---

## 🎉 Success!

Your Hello Club application is now running as a professional Windows service with:
- ✅ Auto-start on Windows boot
- ✅ Auto-restart on failure
- ✅ Log file rotation
- ✅ GUI management tools
- ✅ Production-ready reliability

**The service is running 24/7 in the background!** 🚀

Need help? Check the logs or run the service manually for debugging.
