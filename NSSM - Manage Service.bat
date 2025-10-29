@echo off
REM NSSM Service Management Menu
REM REQUIRES ADMINISTRATOR PRIVILEGES for some operations

echo ================================================================================
echo Hello Club Event Attendance Auto-Print
echo NSSM Service Management
echo ================================================================================
echo.

REM Check if NSSM exists
set "NSSM_EXE=%~dp0nssm\nssm-2.24\win64\nssm.exe"
if not exist "%NSSM_EXE%" (
    echo ERROR: NSSM not found!
    echo Please run "NSSM - Step 1 - Download NSSM.bat" first
    pause
    exit /b 1
)

:MENU
cls
echo ================================================================================
echo Hello Club - Service Management Menu
echo ================================================================================
echo.

REM Check service status
"%NSSM_EXE%" status HelloClubAttendance >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "delims=" %%i in ('"%NSSM_EXE%" status HelloClubAttendance') do set SERVICE_STATUS=%%i
    echo Service Status: %SERVICE_STATUS%
) else (
    echo Service Status: NOT INSTALLED
    set SERVICE_STATUS=NOT INSTALLED
)

echo.
echo ================================================================================
echo.
echo Available Actions:
echo.
echo   1. Start Service
echo   2. Stop Service
echo   3. Restart Service
echo   4. View Service Status (detailed)
echo   5. Edit Service Configuration (GUI)
echo   6. View Service Logs
echo   7. Uninstall Service
echo   8. Open Windows Services
echo   9. Exit
echo.
echo ================================================================================
echo.

set /p choice="Enter your choice (1-9): "

if "%choice%"=="1" goto START
if "%choice%"=="2" goto STOP
if "%choice%"=="3" goto RESTART
if "%choice%"=="4" goto STATUS
if "%choice%"=="5" goto EDIT
if "%choice%"=="6" goto LOGS
if "%choice%"=="7" goto UNINSTALL
if "%choice%"=="8" goto SERVICES_GUI
if "%choice%"=="9" goto EXIT

echo Invalid choice. Please try again.
timeout /t 2 >nul
goto MENU

:START
echo.
echo Starting service...
"%NSSM_EXE%" start HelloClubAttendance
if %ERRORLEVEL% EQU 0 (
    echo [OK] Service started successfully
) else (
    echo [ERROR] Failed to start service
    echo Check error.log for details
)
echo.
pause
goto MENU

:STOP
echo.
echo Stopping service...
"%NSSM_EXE%" stop HelloClubAttendance
if %ERRORLEVEL% EQU 0 (
    echo [OK] Service stopped successfully
) else (
    echo [ERROR] Failed to stop service
)
echo.
pause
goto MENU

:RESTART
echo.
echo Restarting service...
"%NSSM_EXE%" restart HelloClubAttendance
if %ERRORLEVEL% EQU 0 (
    echo [OK] Service restarted successfully
) else (
    echo [ERROR] Failed to restart service
)
echo.
pause
goto MENU

:STATUS
echo.
echo ================================================================================
echo Service Status (Detailed)
echo ================================================================================
echo.
"%NSSM_EXE%" status HelloClubAttendance
echo.
echo Service Configuration:
echo --------------------------------------------------------------------------------
"%NSSM_EXE%" get HelloClubAttendance DisplayName
"%NSSM_EXE%" get HelloClubAttendance Description
"%NSSM_EXE%" get HelloClubAttendance Application
"%NSSM_EXE%" get HelloClubAttendance AppDirectory
"%NSSM_EXE%" get HelloClubAttendance Start
echo.
pause
goto MENU

:EDIT
echo.
echo Opening service configuration GUI...
echo.
echo This allows you to edit:
echo   - Application path
echo   - Arguments
echo   - Environment variables
echo   - Log file locations
echo   - Startup settings
echo.
"%NSSM_EXE%" edit HelloClubAttendance
echo.
echo Configuration updated.
echo Restart the service for changes to take effect.
echo.
pause
goto MENU

:LOGS
echo.
echo ================================================================================
echo Service Logs
echo ================================================================================
echo.
echo Select log to view:
echo   1. Activity Log (stdout)
echo   2. Error Log (stderr)
echo   3. Both (tail -f)
echo   4. Back to menu
echo.
set /p logchoice="Enter choice (1-4): "

if "%logchoice%"=="1" (
    if exist "%~dp0activity.log" (
        notepad "%~dp0activity.log"
    ) else (
        echo activity.log not found
        pause
    )
)

if "%logchoice%"=="2" (
    if exist "%~dp0error.log" (
        notepad "%~dp0error.log"
    ) else (
        echo error.log not found
        pause
    )
)

if "%logchoice%"=="3" (
    echo.
    echo Showing last 50 lines of activity.log (Press Ctrl+C to exit)
    echo.
    if exist "%~dp0activity.log" (
        powershell -command "Get-Content '%~dp0activity.log' -Tail 50 -Wait"
    ) else (
        echo activity.log not found
        pause
    )
)

goto MENU

:UNINSTALL
echo.
echo ================================================================================
echo Uninstall Service
echo ================================================================================
echo.
echo WARNING: This will remove the Windows service.
echo Your data (database, logs, backups) will NOT be deleted.
echo.
set /p confirm="Are you sure you want to uninstall? (Y/N): "

if /i not "%confirm%"=="Y" (
    echo Uninstall cancelled.
    pause
    goto MENU
)

echo.
echo Stopping service...
"%NSSM_EXE%" stop HelloClubAttendance
timeout /t 2 /nobreak >nul

echo Removing service...
"%NSSM_EXE%" remove HelloClubAttendance confirm

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Service uninstalled successfully
    echo.
    echo Your data has been preserved:
    echo   - events.db
    echo   - activity.log, error.log
    echo   - backups folder
    echo   - config.json, .env
) else (
    echo.
    echo [ERROR] Failed to uninstall service
)

echo.
pause
goto MENU

:SERVICES_GUI
echo.
echo Opening Windows Services...
start services.msc
timeout /t 2 >nul
goto MENU

:EXIT
echo.
echo Exiting...
exit /b 0
