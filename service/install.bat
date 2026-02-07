@echo off
REM Hello Club Event Attendance - Complete Installer
REM This batch file elevates privileges and runs the complete installer

setlocal enabledelayedexpansion

REM Get the directory of this script
for /f "delims=" %%i in ('cd') do set "current_dir=%%i"
cd /d "%~dp0\.."

REM Check for admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ╔════════════════════════════════════════════════════════════════════╗
    echo ║                  Administrator Privileges Required                ║
    echo ╚════════════════════════════════════════════════════════════════════╝
    echo.
    echo This installer needs to:
    echo   • Install a Windows Service
    echo   • Modify Windows Registry for auto-start
    echo.
    echo Requesting elevation...
    echo.

    REM Re-run this script with admin privileges
    powershell -Command "Start-Process cmd -ArgumentList '/c cd /d \"%CD%\" && node service\install-complete.js' -Verb RunAs"
    exit /b %errorlevel%
)

REM Already running as admin - run the installer
echo.
echo ╔════════════════════════════════════════════════════════════════════╗
echo ║      Hello Club Event Attendance - Complete Installation         ║
echo ╚════════════════════════════════════════════════════════════════════╝
echo.
echo Running with Administrator privileges...
echo.

node service\install-complete.js

if %errorlevel% neq 0 (
    echo.
    echo ✗ Installation failed!
    echo Please check the error messages above.
    pause
    exit /b %errorlevel%
)

echo.
echo ✓ Installation completed successfully!
pause
