@echo off
REM Check the health and status of the Hello Club Service

node src/index.js health-check
pause
