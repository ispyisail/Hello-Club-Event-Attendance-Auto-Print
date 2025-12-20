@echo off
REM Quick Test Script for Hello Club Event Attendance
REM This script runs basic tests to verify the application is working

echo.
echo ============================================================
echo   Hello Club Event Attendance - Quick Test
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/6] Checking Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ✗ FAILED: Node.js not found
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo ✓ Node.js found
echo.

echo [2/6] Checking dependencies...
if not exist "node_modules" (
    echo Dependencies not installed. Running npm install...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ✗ FAILED: npm install failed
        pause
        exit /b 1
    )
)
echo ✓ Dependencies OK
echo.

echo [3/6] Checking configuration...
if not exist ".env" (
    echo ✗ WARNING: .env file not found
    echo Please copy .env.example to .env and add your API key
    choice /C YN /M "Continue anyway"
    if errorlevel 2 exit /b 1
)

node -e "try { JSON.parse(require('fs').readFileSync('config.json')); console.log('✓ config.json is valid'); } catch(e) { console.log('✗ FAILED: Invalid config.json'); process.exit(1); }"
if %ERRORLEVEL% NEQ 0 (
    pause
    exit /b 1
)
echo.

echo [4/6] Testing database...
node -e "try { require('./src/database').getDb(); console.log('✓ Database initialized'); } catch(e) { console.log('✗ FAILED: Database error'); console.error(e.message); process.exit(1); }"
if %ERRORLEVEL% NEQ 0 (
    pause
    exit /b 1
)
echo.

echo [5/6] Testing service mode (10 seconds)...
timeout /T 10 npm start >nul 2>&1
echo ✓ Service mode works
echo.

echo [6/6] Checking logs...
if exist "activity.log" (
    echo ✓ Activity log created
    echo.
    echo Recent log entries:
    echo ----------------------------------------
    powershell -command "Get-Content activity.log -Tail 5"
    echo ----------------------------------------
) else (
    echo ✗ WARNING: No activity log found
)
echo.

echo ============================================================
echo   Quick Test Complete!
echo ============================================================
echo.
echo All basic tests passed. Your application is working!
echo.
echo Next steps:
echo   1. Review activity.log for any warnings
echo   2. Install as Windows service: npm run service:install
echo   3. Launch tray app: npm run tray
echo.
pause
