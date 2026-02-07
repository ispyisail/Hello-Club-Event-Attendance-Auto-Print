@echo off
REM Hello Club Event Attendance - Complete Uninstaller
REM This batch file elevates privileges and removes all components

setlocal enabledelayedexpansion

cd /d "%~dp0\.."

REM Check for admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ╔════════════════════════════════════════════════════════════════════╗
    echo ║                  Administrator Privileges Required                ║
    echo ╚════════════════════════════════════════════════════════════════════╝
    echo.
    echo This uninstaller needs to:
    echo   • Remove Windows Service
    echo   • Remove Registry entries
    echo   • Delete launcher files
    echo.
    echo Requesting elevation...
    echo.

    powershell -Command "Start-Process cmd -ArgumentList '/c cd /d \"%CD%\" && node service\uninstall.js' -Verb RunAs"
    exit /b %errorlevel%
)

REM Already running as admin - run the uninstaller
echo.
echo ╔════════════════════════════════════════════════════════════════════╗
echo ║    Hello Club Event Attendance - Complete Uninstall Started      ║
echo ╚════════════════════════════════════════════════════════════════════╝
echo.
echo Running with Administrator privileges...
echo.

node service\uninstall.js

if %errorlevel% neq 0 (
    echo.
    echo ✗ Uninstallation failed!
    echo Please check the error messages above.
    pause
    exit /b %errorlevel%
)

echo.
echo ✓ Uninstallation completed successfully!
pause
