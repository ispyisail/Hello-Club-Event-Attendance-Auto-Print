@echo off
REM Install Node.js dependencies for Hello Club Event Attendance
REM This script is called by the installer

echo Installing Node.js dependencies...
echo This may take several minutes. Please wait...
echo.

cd /d "%~dp0"

REM Check if npm is available
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm not found in PATH
    echo Please install Node.js from https://nodejs.org/
    exit /b 1
)

REM Install production dependencies
call npm install --production --loglevel=error

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Dependencies installed successfully!
    exit /b 0
) else (
    echo.
    echo ERROR: Failed to install dependencies
    echo You may need to run "npm install" manually
    exit /b 1
)
