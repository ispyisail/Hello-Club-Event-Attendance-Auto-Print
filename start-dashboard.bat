@echo off
REM Start the Hello Club Web Dashboard
REM This provides a Windows-friendly GUI for monitoring the service

echo Starting Hello Club Dashboard...
echo.
node src/index.js dashboard
pause
