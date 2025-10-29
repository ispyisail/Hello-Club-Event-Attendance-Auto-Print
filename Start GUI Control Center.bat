@echo off
REM Hello Club - GUI Control Center Launcher
REM This starts the unified web-based control center

echo ================================================================================
echo Hello Club - GUI Control Center
echo ================================================================================
echo.
echo Starting unified web interface...
echo.
echo Features:
echo   - Real-time service monitoring
echo   - Service control (start/stop/restart)
echo   - Configuration editor
echo   - Live log viewer with auto-refresh
echo   - Health monitoring and metrics
echo   - Circuit breaker management
echo   - Dead letter queue viewer
echo   - Tools and utilities
echo   - NSSM setup wizard
echo.
echo The GUI will open in your default web browser.
echo Press Ctrl+C to stop the server.
echo.
echo ================================================================================
echo.

REM Start the GUI server
node src/index.js gui

REM If Node.js is not found
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to start GUI server
    echo.
    echo Common issues:
    echo   1. Node.js not installed - Download from https://nodejs.org/
    echo   2. Dependencies not installed - Run: npm install
    echo   3. Port 3000 already in use - Close other applications using that port
    echo.
    pause
    exit /b 1
)
