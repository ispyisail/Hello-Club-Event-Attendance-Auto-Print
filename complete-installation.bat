@echo off
echo =========================================
echo Completing Hello Club Installation
echo =========================================
echo.

cd /d "C:\Program Files\Hello Club Event Attendance"
if errorlevel 1 (
    echo ERROR: Installation directory not found!
    echo Please ensure the application is installed first.
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
