@echo off
REM Hello Club Tray App Launcher
setlocal enabledelayedexpansion
set "PROJ_DIR=C:\Projects\Hello-Club-Event-Attendance-Auto-Print"
cd /d "!PROJ_DIR!"
start "" cmd /c "!PROJ_DIR!\node_modules\.bin\electron.cmd" "!PROJ_DIR!\tray-app\main.js"
exit /b 0
