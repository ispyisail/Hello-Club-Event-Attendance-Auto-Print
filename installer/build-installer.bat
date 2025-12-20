@echo off
REM Build the Hello Club Event Attendance installer
REM This script automates the build process

echo.
echo ============================================================
echo   Building Hello Club Event Attendance Installer
echo ============================================================
echo.

REM Check if Inno Setup is installed
set INNO_PATH="C:\Program Files (x86)\Inno Setup 6\ISCC.exe"

if not exist %INNO_PATH% (
    echo ERROR: Inno Setup not found at %INNO_PATH%
    echo.
    echo Please install Inno Setup from:
    echo https://jrsoftware.org/isdl.php
    echo.
    pause
    exit /b 1
)

echo [1/4] Checking prerequisites...

REM Check if icons exist
if not exist "..\tray-app\icons\icon-green.ico" (
    echo WARNING: icon-green.ico not found
    echo Creating icons...
    cd ..\tray-app
    node create-icons.js
    node create-icon-ico.js
    cd ..\installer
)

echo       ✓ Icons ready
echo.

echo [2/4] Preparing files...

REM Create dist directory if it doesn't exist
if not exist "..\dist" (
    mkdir "..\dist"
)

echo       ✓ Dist directory ready
echo.

echo [3/4] Compiling installer...
echo       This may take 30-60 seconds...
echo.

REM Run Inno Setup compiler
%INNO_PATH% setup.iss

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [4/4] Build successful!
    echo.
    echo ============================================================
    echo   Installer created successfully!
    echo ============================================================
    echo.
    echo Location: dist\HelloClubEventAttendance-Setup-1.0.0.exe
    echo.

    REM Show file info
    for %%I in (..\dist\HelloClubEventAttendance-Setup-*.exe) do (
        echo File name: %%~nxI
        echo File size: %%~zI bytes
    )

    echo.
    echo The installer is ready for distribution!
    echo.

    REM Ask to open dist folder
    choice /C YN /M "Do you want to open the dist folder"
    if errorlevel 2 goto :end
    explorer ..\dist
) else (
    echo.
    echo ============================================================
    echo   Build FAILED
    echo ============================================================
    echo.
    echo Please check the error messages above.
    echo Common issues:
    echo   - Missing files in [Files] section
    echo   - Syntax errors in setup.iss
    echo   - Incorrect file paths
    echo.
    pause
    exit /b 1
)

:end
echo.
pause
