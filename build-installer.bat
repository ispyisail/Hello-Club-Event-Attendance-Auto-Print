@echo off
REM Quick build script for Windows users
REM This is a convenience wrapper around npm run build:installer

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║   Hello Club Event Attendance - Installer Builder         ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ npm is not installed or not in PATH
    pause
    exit /b 1
)

REM Run the build script
echo Running installer build...
echo.
npm run build:installer

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Build completed successfully!
    echo Check the dist/ folder for the installer
) else (
    echo.
    echo ❌ Build failed!
    echo Check the error messages above
)

echo.
pause
