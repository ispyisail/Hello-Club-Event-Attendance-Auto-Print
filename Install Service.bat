@echo off
REM Hello Club - Windows Service Installer
REM This batch file installs the application as a Windows service
REM REQUIRES ADMINISTRATOR PRIVILEGES

echo ================================================================================
echo Hello Club Event Attendance Auto-Print
echo Windows Service Installer
echo ================================================================================
echo.
echo This will install Hello Club as a Windows service that:
echo   - Starts automatically when Windows boots
echo   - Runs in the background
echo   - Restarts automatically if it crashes
echo.
echo IMPORTANT: You must run this as Administrator!
echo.
pause

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules\" (
    echo ERROR: Dependencies not installed
    echo Please run: npm install
    pause
    exit /b 1
)

REM Check if config.json exists
if not exist "config.json" (
    echo ERROR: config.json not found
    echo Please create config.json before installing the service
    pause
    exit /b 1
)

REM Check if .env exists
if not exist ".env" (
    echo ERROR: .env file not found
    echo Please create .env with your API_KEY before installing the service
    pause
    exit /b 1
)

echo.
echo Installing service...
echo.

node install-service.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================================================
    echo Installation Complete!
    echo ================================================================================
    echo.
    echo Next steps:
    echo   1. Open Windows Services: Press Win+R, type "services.msc"
    echo   2. Find "HelloClubAttendance" in the list
    echo   3. The service is now running and will start with Windows
    echo.
    echo To view the dashboard:
    echo   - Double-click "Start Dashboard.bat"
    echo   - Open browser to http://localhost:3030
    echo.
) else (
    echo.
    echo ================================================================================
    echo Installation Failed!
    echo ================================================================================
    echo.
    echo Please ensure you ran this file as Administrator:
    echo   1. Right-click "Install Service.bat"
    echo   2. Select "Run as administrator"
    echo.
)

pause
