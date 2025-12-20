@echo off
REM Start the Hello Club Tray Monitor
REM This script launches the Electron tray application

cd /d "%~dp0\.."

REM Check if node_modules exists
if not exist "node_modules" (
    echo ERROR: Dependencies not installed
    echo Please run: npm install
    pause
    exit /b 1
)

REM Start the tray app
start "" npm run tray
