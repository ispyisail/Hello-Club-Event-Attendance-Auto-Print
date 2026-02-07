@echo off
REM Hello Club Event Attendance - Complete Installer
REM This batch file elevates privileges and runs the complete installer

setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════════════════════════╗
echo ║      Hello Club Event Attendance - Complete Installation         ║
echo ╚════════════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0\.."

REM Check for admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo 🔐 Administrator Privileges Required
    echo.
    echo This installer needs to:
    echo   • Install a Windows Service
    echo   • Modify Windows Registry for auto-start
    echo.
    echo A Windows Security prompt will appear.
    echo Please click YES to allow the installation.
    echo.
    echo Requesting elevation...
    echo.
    timeout /t 2 /nobreak
    echo.

    REM Create a temporary admin launcher script
    set "ADMIN_SCRIPT=%TEMP%\install_admin_%RANDOM%.cmd"
    (
        echo @echo off
        echo cd /d "%CD%"
        echo node service\install-complete.js
        echo pause
    ) > "!ADMIN_SCRIPT!"

    REM Run with admin privileges using runas (more reliable than powershell)
    REM Note: This will show UAC prompt which is expected
    runas /noprofile /user:%USERNAME% "cmd /k !ADMIN_SCRIPT!"

    REM Clean up temp script
    if exist "!ADMIN_SCRIPT!" del /f /q "!ADMIN_SCRIPT!"
    exit /b 0
)

REM Already running as admin - run the installer
echo ✓ Running with Administrator privileges
echo.

node service\install-complete.js

if %errorlevel% neq 0 (
    echo.
    echo ✗ Installation failed!
    echo Please check the error messages above.
    echo.
    echo Press any key to close this window...
    pause >nul
    exit /b %errorlevel%
)

echo.
echo ═══════════════════════════════════════════════════════════════════════
echo ✓ Installation completed successfully!
echo ═══════════════════════════════════════════════════════════════════════
echo.
echo Please verify the installation details above, then close this window.
echo.
echo Press any key to close this window...
pause >nul
