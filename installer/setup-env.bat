@echo off
REM Setup environment configuration wizard
REM This script helps users configure their API keys and settings

echo.
echo ============================================================
echo   Hello Club Event Attendance - Configuration Wizard
echo ============================================================
echo.
echo This wizard will help you set up your configuration.
echo.

cd /d "%~dp0"

REM Check if .env already exists
if exist ".env" (
    echo Configuration file .env already exists.
    choice /C YN /M "Do you want to reconfigure it"
    if errorlevel 2 goto :skip
)

echo.
echo Please enter your configuration details:
echo.

REM Get API Key
set /p API_KEY="Hello Club API Key: "
if "%API_KEY%"=="" (
    echo ERROR: API Key is required
    pause
    exit /b 1
)

REM Get Printer Email
set /p PRINTER_EMAIL="Printer Email Address (optional, press Enter to skip): "

REM Get SMTP settings if printer email provided
if not "%PRINTER_EMAIL%"=="" (
    echo.
    echo SMTP Configuration for Email Printing:
    set /p SMTP_USER="SMTP Username (e.g., your Gmail): "
    set /p SMTP_PASS="SMTP Password or App Password: "
    set /p SMTP_HOST="SMTP Host (default: smtp.gmail.com): "
    set /p SMTP_PORT="SMTP Port (default: 587): "

    if "%SMTP_HOST%"=="" set SMTP_HOST=smtp.gmail.com
    if "%SMTP_PORT%"=="" set SMTP_PORT=587
    if "%EMAIL_FROM%"=="" set EMAIL_FROM=%SMTP_USER%
)

REM Create .env file
echo # Required for API access > .env
echo API_KEY=%API_KEY% >> .env
echo. >> .env

if not "%PRINTER_EMAIL%"=="" (
    echo # Required for Email Printing Mode >> .env
    echo PRINTER_EMAIL=%PRINTER_EMAIL% >> .env
    echo SMTP_USER=%SMTP_USER% >> .env
    echo SMTP_PASS=%SMTP_PASS% >> .env
    echo EMAIL_FROM=%EMAIL_FROM% >> .env
    echo SMTP_HOST=%SMTP_HOST% >> .env
    echo SMTP_PORT=%SMTP_PORT% >> .env
)

echo.
echo Configuration saved to .env file!
echo.

:skip
echo.
echo You can edit config.json to customize other settings like:
echo - Event categories to filter
echo - Fetch window hours
echo - Service run interval
echo.
echo Would you like to open config.json now?
choice /C YN /M "Open config.json for editing"
if errorlevel 2 goto :end
notepad config.json

:end
echo.
echo Configuration complete!
pause
