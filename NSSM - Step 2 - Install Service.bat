@echo off
REM NSSM Service Installation Script
REM REQUIRES ADMINISTRATOR PRIVILEGES

echo ================================================================================
echo Hello Club Event Attendance Auto-Print
echo NSSM Service Installation
echo ================================================================================
echo.
echo This will install Hello Club as a Windows service using NSSM.
echo.
echo IMPORTANT: You must run this as Administrator!
echo.
pause

REM Check if NSSM exists
set "NSSM_EXE=%~dp0nssm\nssm-2.24\win64\nssm.exe"
if not exist "%NSSM_EXE%" (
    echo ERROR: NSSM not found!
    echo.
    echo Please run "NSSM - Step 1 - Download NSSM.bat" first
    echo.
    pause
    exit /b 1
)

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if config.json exists
if not exist "%~dp0config.json" (
    echo ERROR: config.json not found
    echo Please create config.json before installing the service
    pause
    exit /b 1
)

REM Check if .env exists
if not exist "%~dp0.env" (
    echo ERROR: .env file not found
    echo Please create .env with your API_KEY before installing the service
    pause
    exit /b 1
)

REM Get Node.js path
for /f "delims=" %%i in ('where node') do set NODE_PATH=%%i

REM Get project path
set "PROJECT_PATH=%~dp0"
set "PROJECT_PATH=%PROJECT_PATH:~0,-1%"

echo.
echo Configuration:
echo   NSSM: %NSSM_EXE%
echo   Node.js: %NODE_PATH%
echo   Project: %PROJECT_PATH%
echo.
echo Installing service...
echo.

REM Check if service already exists
"%NSSM_EXE%" status HelloClubAttendance >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Service already exists!
    echo.
    set /p REINSTALL="Do you want to reinstall? (Y/N): "
    if /i not "%REINSTALL%"=="Y" (
        echo Installation cancelled.
        pause
        exit /b 0
    )

    echo Stopping existing service...
    "%NSSM_EXE%" stop HelloClubAttendance
    timeout /t 2 /nobreak >nul

    echo Removing existing service...
    "%NSSM_EXE%" remove HelloClubAttendance confirm
    timeout /t 2 /nobreak >nul
)

REM Install service
"%NSSM_EXE%" install HelloClubAttendance "%NODE_PATH%" "%PROJECT_PATH%\src\index.js" start-service

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to install service
    echo Please ensure you are running as Administrator
    pause
    exit /b 1
)

REM Configure service display name and description
"%NSSM_EXE%" set HelloClubAttendance DisplayName "Hello Club Event Attendance"
"%NSSM_EXE%" set HelloClubAttendance Description "Automatically fetches and prints event attendance lists from Hello Club"

REM Set startup directory
"%NSSM_EXE%" set HelloClubAttendance AppDirectory "%PROJECT_PATH%"

REM Set startup type to automatic
"%NSSM_EXE%" set HelloClubAttendance Start SERVICE_AUTO_START

REM Configure log files
"%NSSM_EXE%" set HelloClubAttendance AppStdout "%PROJECT_PATH%\activity.log"
"%NSSM_EXE%" set HelloClubAttendance AppStderr "%PROJECT_PATH%\error.log"

REM Enable log file rotation (10MB)
"%NSSM_EXE%" set HelloClubAttendance AppStdoutCreationDisposition 4
"%NSSM_EXE%" set HelloClubAttendance AppStderrCreationDisposition 4
"%NSSM_EXE%" set HelloClubAttendance AppRotateFiles 1
"%NSSM_EXE%" set HelloClubAttendance AppRotateBytes 10485760

REM Set environment variable
"%NSSM_EXE%" set HelloClubAttendance AppEnvironmentExtra NODE_ENV=production

REM Configure service recovery (auto-restart on failure)
"%NSSM_EXE%" set HelloClubAttendance AppExit Default Restart
"%NSSM_EXE%" set HelloClubAttendance AppRestartDelay 5000
"%NSSM_EXE%" set HelloClubAttendance AppThrottle 10000

REM Start the service
echo.
echo Starting service...
"%NSSM_EXE%" start HelloClubAttendance

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================================================
    echo Service Installed Successfully!
    echo ================================================================================
    echo.
    echo Service Name: HelloClubAttendance
    echo Display Name: Hello Club Event Attendance
    echo Status: Running
    echo.
    echo The service will automatically start when Windows boots.
    echo.
    echo Management:
    echo   - View status: Double-click "Start Dashboard.bat"
    echo   - View logs: Double-click "View Logs.bat"
    echo   - Manage service: Double-click "NSSM - Manage Service.bat"
    echo   - Windows Services: Press Win+R, type "services.msc"
    echo.
    echo Service is now running in the background!
    echo ================================================================================
) else (
    echo.
    echo ================================================================================
    echo Service Installation Failed!
    echo ================================================================================
    echo.
    echo The service was installed but failed to start.
    echo.
    echo Please check:
    echo   1. config.json is valid
    echo   2. .env file contains valid API_KEY
    echo   3. View error.log for details
    echo.
    echo You can start the service manually from services.msc
    echo ================================================================================
)

echo.
pause
