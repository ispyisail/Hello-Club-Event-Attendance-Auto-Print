@echo off
REM ============================================================================
REM Hello Club Event Attendance - View Logs
REM ============================================================================
REM Opens log files in Notepad
REM ============================================================================

echo.
echo Which log would you like to view?
echo.
echo 1. Activity Log (normal operations)
echo 2. Error Log (errors only)
echo 3. Both logs (side by side)
echo.

choice /C 123 /N /M "Enter your choice (1-3): "

if errorlevel 3 goto both
if errorlevel 2 goto errors
if errorlevel 1 goto activity

:activity
cd ..
if exist activity.log (
    notepad activity.log
) else (
    echo No activity log found yet. Run the service first.
    pause
)
goto end

:errors
cd ..
if exist error.log (
    notepad error.log
) else (
    echo No error log found yet.
    pause
)
goto end

:both
cd ..
if exist activity.log start notepad activity.log
if exist error.log start notepad error.log
if not exist activity.log echo No activity log found
if not exist error.log echo No error log found
goto end

:end
