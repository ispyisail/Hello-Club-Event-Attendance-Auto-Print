@echo off
REM Hello Club Event Attendance - Complete Uninstaller
REM This batch file elevates privileges and removes all components

setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════════════════════════╗
echo ║    Hello Club Event Attendance - Complete Uninstall Started      ║
echo ╚════════════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0\.."

REM Check for admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo 🔐 Administrator Privileges Required
    echo.
    echo This uninstaller needs to:
    echo   • Remove Windows Service
    echo   • Remove Registry entries
    echo   • Delete launcher files
    echo.
    echo A Windows Security prompt will appear.
    echo Please click YES to allow the uninstallation.
    echo.
    echo Requesting elevation...
    echo.
    timeout /t 2 /nobreak
    echo.

    REM Create a temporary admin launcher script
    set "ADMIN_SCRIPT=%TEMP%\uninstall_admin_%RANDOM%.cmd"
    (
        echo @echo off
        echo cd /d "%CD%"
        echo node service\uninstall.js
        echo pause
    ) > "!ADMIN_SCRIPT!"

    REM Run with admin privileges using runas (more reliable than powershell)
    REM Note: This will show UAC prompt which is expected
    runas /noprofile /user:%USERNAME% "cmd /k !ADMIN_SCRIPT!"

    REM Clean up temp script
    if exist "!ADMIN_SCRIPT!" del /f /q "!ADMIN_SCRIPT!"
    exit /b 0
)

REM Already running as admin - run the uninstaller
echo ✓ Running with Administrator privileges
echo.

node service\uninstall.js

if %errorlevel% neq 0 (
    echo.
    echo ✗ Uninstallation failed!
    echo Please check the error messages above.
    echo.
    echo Press any key to close this window...
    pause >nul
    exit /b %errorlevel%
)

echo.
echo ═══════════════════════════════════════════════════════════════════════
echo ✓ Uninstallation completed successfully!
echo ═══════════════════════════════════════════════════════════════════════
echo.
echo Please verify the uninstallation details above, then close this window.
echo.
echo Press any key to close this window...
pause >nul
