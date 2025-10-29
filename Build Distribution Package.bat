@echo off
REM Create Distribution Package
REM This creates a complete package ready for distribution

echo ================================================================================
echo Hello Club Event Attendance Auto-Print
echo Distribution Package Builder
echo ================================================================================
echo.

REM Check if exe exists
if not exist "dist\hello-club.exe" (
    echo ERROR: Executable not found!
    echo.
    echo Please run "Build Executable.bat" first to create the .exe file.
    echo.
    pause
    exit /b 1
)

echo Creating distribution package...
echo.

REM Create distribution folder
set "DIST_FOLDER=dist\HelloClub-Portable"
if exist "%DIST_FOLDER%" (
    echo Removing old distribution folder...
    rmdir /s /q "%DIST_FOLDER%"
)

echo Creating folder structure...
mkdir "%DIST_FOLDER%"
mkdir "%DIST_FOLDER%\backups"
mkdir "%DIST_FOLDER%\src"

REM Copy executable
echo Copying executable...
copy "dist\hello-club.exe" "%DIST_FOLDER%\hello-club.exe" >nul

REM Copy GUI assets (needed for GUI functionality)
echo Copying GUI assets...
if exist "src\gui" (
    xcopy "src\gui" "%DIST_FOLDER%\src\gui" /E /I /Q >nul
    echo - GUI assets copied
) else (
    echo - Warning: GUI assets not found, GUI command will not work
)

REM Create example configuration files
echo Creating example configuration files...

REM Create .env.example
(
echo # Hello Club API Configuration
echo # Copy this file to .env and fill in your values
echo.
echo # Required: Your Hello Club API key
echo API_KEY=your_api_key_here
echo.
echo # Optional: API base URL (leave default unless told otherwise)
echo # API_BASE_URL=https://api.helloclub.com
echo.
echo # Email Configuration (required if using printMode: "email")
echo PRINTER_EMAIL=your_printer_email@example.com
echo SMTP_HOST=smtp.gmail.com
echo SMTP_PORT=587
echo SMTP_USER=your_email@gmail.com
echo SMTP_PASS=your_app_password
echo EMAIL_FROM=your_email@gmail.com
echo.
echo # Optional: Logging
echo # LOG_TO_CONSOLE=true
echo # NODE_ENV=production
) > "%DIST_FOLDER%\.env.example"

REM Create config.json.example
(
echo {
echo   "categories": [],
echo   "fetchWindowHours": 168,
echo   "preEventQueryMinutes": 60,
echo   "outputFilename": "attendance.pdf",
echo   "printMode": "local",
echo   "serviceRunIntervalHours": 24,
echo   "pdfLayout": {
echo     "title": "Event Attendance",
echo     "fontSize": 10,
echo     "margin": 50
echo   }
echo }
) > "%DIST_FOLDER%\config.json.example"

REM Copy documentation
echo Copying documentation...
if exist "README.md" copy "README.md" "%DIST_FOLDER%\README.md" >nul
if exist "WINDOWS-SERVICE-SETUP.md" copy "WINDOWS-SERVICE-SETUP.md" "%DIST_FOLDER%\WINDOWS-SERVICE-SETUP.md" >nul
if exist "NSSM-QUICK-START.md" copy "NSSM-QUICK-START.md" "%DIST_FOLDER%\NSSM-QUICK-START.md" >nul
if exist "GUI-README.md" copy "GUI-README.md" "%DIST_FOLDER%\GUI-README.md" >nul
if exist "GUI-WITH-EXE.md" copy "GUI-WITH-EXE.md" "%DIST_FOLDER%\GUI-WITH-EXE.md" >nul
if exist "BUILDING-EXECUTABLE.md" copy "BUILDING-EXECUTABLE.md" "%DIST_FOLDER%\BUILDING-EXECUTABLE.md" >nul

REM Create quick start guide for exe
(
echo # Hello Club - Portable Executable Version
echo.
echo This is a portable version of Hello Club that does NOT require Node.js.
echo.
echo ## Quick Start
echo.
echo 1. Copy `.env.example` to `.env`
echo 2. Edit `.env` and add your `API_KEY`
echo 3. Copy `config.json.example` to `config.json`
echo 4. Edit `config.json` to configure your preferences
echo 5. Run: `hello-club.exe start-service`
echo.
echo ## Commands
echo.
echo ```cmd
echo # Start the service
echo hello-club.exe start-service
echo.
echo # Fetch events
echo hello-club.exe fetch-events
echo.
echo # Process events
echo hello-club.exe process-schedule
echo.
echo # Start legacy web dashboard
echo hello-club.exe dashboard
echo.
echo # Start GUI Control Center ^(Recommended^)
echo hello-club.exe gui
echo.
echo # View all commands
echo hello-club.exe --help
echo ```
echo.
echo ## Windows Service Installation
echo.
echo ### Option 1: Using NSSM ^(Recommended^)
echo.
echo 1. Download NSSM from https://nssm.cc/download
echo 2. Extract to a folder
echo 3. Run as Administrator:
echo.
echo ```cmd
echo nssm install HelloClubAttendance
echo ```
echo.
echo 4. In the GUI:
echo    - Path: `C:\path\to\hello-club.exe`
echo    - Startup directory: `C:\path\to\this\folder`
echo    - Arguments: `start-service`
echo.
echo 5. Click "Install service"
echo.
echo ### Option 2: Using sc command
echo.
echo Run as Administrator:
echo.
echo ```cmd
echo sc create HelloClubAttendance binPath= "C:\path\to\hello-club.exe start-service" start= auto
echo sc start HelloClubAttendance
echo ```
echo.
echo ## Files Created During Operation
echo.
echo - `events.db` - SQLite database with event data
echo - `activity.log` - Application logs
echo - `error.log` - Error logs only
echo - `status.json` - Service status information
echo - `backups/` - Automated backups
echo - `.pdf-cache/` - Temporary PDF cache
echo - `dead-letter-queue.json` - Failed jobs queue
echo - `metrics.json` - Performance metrics
echo.
echo ## Troubleshooting
echo.
echo **Service won't start:**
echo - Check `.env` has valid `API_KEY`
echo - Verify `config.json` is valid JSON
echo - Check `error.log` for details
echo.
echo **"Node.js not found" error:**
echo - You don't need Node.js! The .exe is standalone.
echo - If you see this error, it's a bug - please report it.
echo.
echo **Permission errors:**
echo - Run as Administrator
echo - Check antivirus isn't blocking
echo.
echo ## Distribution
echo.
echo This entire folder can be copied to other Windows computers.
echo No installation required - just copy and run!
echo.
echo ## Support
echo.
echo For issues, check:
echo 1. error.log
echo 2. Run: `hello-club.exe health-check`
echo 3. View dashboard: `hello-club.exe dashboard`
echo.
) > "%DIST_FOLDER%\QUICK-START-EXE.md"

REM Create batch file shortcuts for exe
(
echo @echo off
echo hello-club.exe start-service
echo pause
) > "%DIST_FOLDER%\Start Service.bat"

(
echo @echo off
echo echo Starting GUI Control Center...
echo echo.
echo echo Open your browser to: http://localhost:3000
echo echo.
echo hello-club.exe gui
echo pause
) > "%DIST_FOLDER%\Start GUI.bat"

(
echo @echo off
echo hello-club.exe dashboard
echo pause
) > "%DIST_FOLDER%\Start Dashboard (Legacy).bat"

(
echo @echo off
echo hello-club.exe --help
echo pause
) > "%DIST_FOLDER%\Show Commands.bat"

(
echo @echo off
echo hello-club.exe health-check
echo pause
) > "%DIST_FOLDER%\Health Check.bat"

echo.
echo ================================================================================
echo Distribution Package Created!
echo ================================================================================
echo.
echo Location: %DIST_FOLDER%
echo.
echo Package contents:
echo   - hello-club.exe (standalone executable)
echo   - src\gui\ (GUI Control Center assets)
echo   - .env.example (configuration template)
echo   - config.json.example (settings template)
echo   - QUICK-START-EXE.md (getting started guide)
echo   - README.md (full documentation)
echo   - WINDOWS-SERVICE-SETUP.md (service installation guide)
echo   - NSSM-QUICK-START.md (NSSM guide)
echo   - Batch file shortcuts (Start GUI, Start Service, Dashboard, etc.)
echo   - backups\ folder (for automated backups)
echo.
echo This folder can be:
echo   - Zipped and distributed
echo   - Copied to other Windows computers
echo   - Run without installing Node.js
echo.
echo Size:
for /f "tokens=3" %%a in ('dir "%DIST_FOLDER%" ^| find "File(s)"') do echo   Files: %%a bytes

REM Create a zip file if possible
where powershell >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Creating ZIP archive...
    powershell -command "Compress-Archive -Path '%DIST_FOLDER%' -DestinationPath 'dist\HelloClub-Portable.zip' -Force"
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo [OK] ZIP created: dist\HelloClub-Portable.zip
        for %%I in ("dist\HelloClub-Portable.zip") do echo ZIP size: %%~zI bytes
    )
)

echo.
echo ================================================================================
echo.
echo Ready for distribution!
echo.
pause
