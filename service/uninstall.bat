@echo off
REM Hello Club Event Attendance - Complete Uninstaller
REM This batch file elevates privileges and removes all components

setlocal enabledelayedexpansion

cd /d "%~dp0\.."

REM Check for admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    REM Not admin - create elevated launcher script and elevate
    set "ADMIN_SCRIPT=%TEMP%\uninstall_elevated_%RANDOM%.cmd"

    REM Create the elevated launcher batch file
    (
        echo @echo off
        echo cd /d "%CD%"
        echo echo.
        echo echo ╔════════════════════════════════════════════════════════════════════╗
        echo echo ║    Hello Club Event Attendance - Complete Uninstall Started      ║
        echo echo ╚════════════════════════════════════════════════════════════════════╝
        echo echo.
        echo echo ✓ Running with Administrator privileges
        echo echo.
        echo node service\uninstall.js
        echo if %%errorlevel%% neq 0 (
        echo     echo.
        echo     echo ✗ Uninstallation failed!
        echo     echo Please check the error messages above.
        echo     echo.
        echo     echo Press any key to close this window...
        echo     pause ^>nul
        echo     exit /b %%errorlevel%%
        echo ^)
        echo echo.
        echo echo ═══════════════════════════════════════════════════════════════════════
        echo echo ✓ Uninstallation completed successfully!
        echo echo ═══════════════════════════════════════════════════════════════════════
        echo echo.
        echo echo Please verify the uninstallation details above, then close this window.
        echo echo.
        echo echo Press any key to close this window...
        echo pause ^>nul
    ) > "!ADMIN_SCRIPT!"

    REM Elevate using VBS script (silent, no password prompt)
    cscript.exe //nologo "service\elevate.vbs" "!ADMIN_SCRIPT!"

    REM Clean up temp script after a delay (give it time to start)
    timeout /t 1 /nobreak >nul
    if exist "!ADMIN_SCRIPT!" del /f /q "!ADMIN_SCRIPT!" >nul 2>&1
    exit /b 0
)

REM Already running as admin - run the uninstaller directly
echo.
echo ╔════════════════════════════════════════════════════════════════════╗
echo ║    Hello Club Event Attendance - Complete Uninstall Started      ║
echo ╚════════════════════════════════════════════════════════════════════╝
echo.
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
