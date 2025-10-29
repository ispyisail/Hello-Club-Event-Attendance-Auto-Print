@echo off
REM Hello Club - Log Viewer
REM Opens log files in Notepad

echo ================================================================================
echo Hello Club Event Attendance Auto-Print
echo Log Viewer
echo ================================================================================
echo.
echo Select which log to view:
echo.
echo   1. Activity Log (all operations)
echo   2. Error Log (errors only)
echo   3. Status File (service status)
echo   4. View in Command Prompt (live tail)
echo   5. Exit
echo.
echo ================================================================================
echo.

set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" (
    if exist "activity.log" (
        echo Opening activity.log...
        notepad activity.log
    ) else (
        echo activity.log not found!
        pause
    )
)

if "%choice%"=="2" (
    if exist "error.log" (
        echo Opening error.log...
        notepad error.log
    ) else (
        echo error.log not found!
        pause
    )
)

if "%choice%"=="3" (
    if exist "status.json" (
        echo Opening status.json...
        notepad status.json
    ) else (
        echo status.json not found!
        pause
    )
)

if "%choice%"=="4" (
    echo.
    echo Showing last 50 lines of activity.log...
    echo Press Ctrl+C to exit
    echo.
    if exist "activity.log" (
        REM PowerShell command to tail the file
        powershell -command "Get-Content activity.log -Tail 50 -Wait"
    ) else (
        echo activity.log not found!
        pause
    )
)

if "%choice%"=="5" (
    exit
)
