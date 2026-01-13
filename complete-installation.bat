@echo off
echo =========================================
echo Completing Hello Club Installation
echo =========================================
echo.

REM Try LocalAppData first (new default location)
set "INSTALL_DIR=%LOCALAPPDATA%\Hello Club Event Attendance"
if exist "%INSTALL_DIR%" (
    echo Found installation in user folder: %INSTALL_DIR%
    goto :found
)

REM Try Program Files (legacy location for existing installations)
set "INSTALL_DIR=C:\Program Files\Hello Club Event Attendance"
if exist "%INSTALL_DIR%" (
    echo Found installation in Program Files: %INSTALL_DIR%
    goto :found
)

REM Not found in either location
echo ERROR: Installation directory not found!
echo.
echo Searched in:
echo   - %LOCALAPPDATA%\Hello Club Event Attendance (new default)
echo   - C:\Program Files\Hello Club Event Attendance (legacy)
echo.
echo Please ensure the application is installed first.
pause
exit /b 1

:found
cd /d "%INSTALL_DIR%"
if errorlevel 1 (
    echo ERROR: Could not change to installation directory!
    pause
    exit /b 1
)

echo Installing dependencies...
call npm install
if errorlevel 1 (
    echo.
    echo ERROR: npm install failed!
    echo Make sure you have internet connection and npm is installed.
    pause
    exit /b 1
)

echo.
echo Creating .env configuration file...
if exist .env (
    echo .env file already exists, skipping...
) else (
    if exist .env.example (
        copy .env.example .env
        echo .env file created from template
    ) else (
        echo WARNING: .env.example not found!
    )
)

echo.
echo =========================================
echo Installation completed successfully!
echo =========================================
echo.
echo Next steps:
echo 1. Edit the .env file with your API key and SMTP settings
echo 2. Run the tray monitor or install the service
echo.
pause
