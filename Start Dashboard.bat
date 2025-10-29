@echo off
REM Hello Club - Dashboard Launcher
REM Starts the web-based dashboard GUI

echo ================================================================================
echo Hello Club Event Attendance Auto-Print
echo Dashboard Launcher
echo ================================================================================
echo.
echo Starting web dashboard...
echo.
echo The dashboard will open in your browser at: http://localhost:3030
echo.
echo Dashboard features:
echo   - Real-time service status
echo   - Event statistics
echo   - Health checks
echo   - Auto-refreshes every 30 seconds
echo.
echo Press Ctrl+C to stop the dashboard server
echo.
echo ================================================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Start the dashboard
node src/index.js dashboard

pause
