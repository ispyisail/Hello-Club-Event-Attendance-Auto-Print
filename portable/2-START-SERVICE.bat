@echo off
REM ============================================================================
REM Hello Club Event Attendance - Start Service (Console Mode)
REM ============================================================================
REM Runs the service in a console window (not as Windows Service)
REM Keep this window open while the service is running
REM Press Ctrl+C to stop the service
REM ============================================================================

echo.
echo ========================================================================
echo   Hello Club Event Attendance - Service Console
echo ========================================================================
echo.
echo Starting service in console mode...
echo Press Ctrl+C to stop the service
echo.
echo Service will:
echo   - Fetch events every hour
echo   - Process events 5 minutes before start time
echo   - Generate and print PDFs automatically
echo.
echo ========================================================================
echo.

cd ..
node src/index.js start-service
