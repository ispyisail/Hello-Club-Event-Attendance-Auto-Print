@echo off
REM ============================================================================
REM Hello Club Event Attendance - Edit Configuration
REM ============================================================================
REM Opens configuration files for editing
REM ============================================================================

echo.
echo Which configuration file would you like to edit?
echo.
echo 1. .env (API credentials and secrets)
echo 2. config.json (Application settings)
echo 3. Both files
echo.

choice /C 123 /N /M "Enter your choice (1-3): "

if errorlevel 3 goto both
if errorlevel 2 goto config
if errorlevel 1 goto env

:env
cd ..
if exist .env (
    notepad .env
) else (
    echo .env file not found. Run 1-SETUP.bat first.
    pause
)
goto end

:config
cd ..
notepad config.json
goto end

:both
cd ..
if exist .env start notepad .env
start notepad config.json
goto end

:end
