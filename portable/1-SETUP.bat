@echo off
REM ============================================================================
REM Hello Club Event Attendance - Portable Setup
REM ============================================================================
REM This script sets up the portable version for first-time use
REM ============================================================================

echo.
echo ========================================================================
echo   Hello Club Event Attendance - Portable Version Setup
echo ========================================================================
echo.

REM Check for Node.js
echo [1/4] Checking for Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js 16.x or later from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo       Node.js found:
node --version
echo.

REM Check for npm
echo [2/4] Checking for npm...
npm --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: npm is not available!
    pause
    exit /b 1
)

echo       npm found:
npm --version
echo.

REM Install dependencies
echo [3/4] Installing dependencies...
echo       This may take 2-5 minutes depending on your internet speed...
echo.

cd ..
npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to install dependencies!
    echo Please check your internet connection and try again.
    echo.
    pause
    exit /b 1
)

echo.
echo       Dependencies installed successfully!
echo.

REM Create .env file if it doesn't exist
echo [4/4] Checking configuration...
if not exist ".env" (
    echo       Creating .env file from template...
    copy .env.example .env >nul
    echo       .env file created!
    echo.
    echo =====================================================
    echo   IMPORTANT: Configure your API credentials
    echo =====================================================
    echo.
    echo   Please edit the .env file and add:
    echo   1. Your Hello Club API key
    echo   2. Email/SMTP settings (if using email printing)
    echo.

    choice /C YN /M "Do you want to open .env now"
    if not errorlevel 2 notepad .env
) else (
    echo       .env file already exists
)

echo.
echo ========================================================================
echo   Setup Complete!
echo ========================================================================
echo.
echo What to do next:
echo   1. Edit .env file with your API credentials
echo   2. (Optional) Edit config.json for advanced settings
echo   3. Run "2-START-SERVICE.bat" to start the background service
echo   4. Run "3-START-TRAY.bat" to open the system tray monitor
echo.
echo For help, see portable\README.txt
echo.
pause
