@echo off
REM Start the Hello Club Service
REM This starts the background service that automatically prints event attendee lists

echo Starting Hello Club Service...
echo.
echo The service will run in the background and automatically:
echo   - Fetch upcoming events every hour
echo   - Print attendee lists before events start
echo.
echo Press Ctrl+C to stop the service.
echo.
node src/index.js start-service
pause
