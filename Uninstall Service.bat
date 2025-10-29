@echo off
REM Hello Club - Windows Service Uninstaller
REM This batch file removes the Windows service
REM REQUIRES ADMINISTRATOR PRIVILEGES

echo ================================================================================
echo Hello Club Event Attendance Auto-Print
echo Windows Service Uninstaller
echo ================================================================================
echo.
echo This will remove the Hello Club Windows service.
echo The service will no longer start automatically with Windows.
echo.
echo NOTE: Your data (database, logs, backups) will NOT be deleted.
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

echo.
echo Uninstalling service...
echo.

node uninstall-service.js

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================================================
    echo Uninstallation Complete!
    echo ================================================================================
    echo.
    echo The HelloClubAttendance service has been removed.
    echo.
    echo Your data has been preserved:
    echo   - events.db
    echo   - activity.log, error.log
    echo   - backups folder
    echo   - config.json, .env
    echo.
    echo You can still run the application manually:
    echo   node src/index.js start-service
    echo.
) else (
    echo.
    echo ================================================================================
    echo Uninstallation Failed!
    echo ================================================================================
    echo.
    echo Please ensure you ran this file as Administrator:
    echo   1. Right-click "Uninstall Service.bat"
    echo   2. Select "Run as administrator"
    echo.
)

pause
