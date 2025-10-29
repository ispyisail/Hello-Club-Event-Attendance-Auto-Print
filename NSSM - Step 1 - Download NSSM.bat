@echo off
REM NSSM Download Script
REM Downloads and installs NSSM to the project folder

echo ================================================================================
echo Hello Club Event Attendance Auto-Print
echo NSSM Download and Installation
echo ================================================================================
echo.
echo This will download NSSM (Non-Sucking Service Manager) v2.24
echo.
echo NSSM will be installed to: %~dp0nssm\
echo.
echo NO ADMINISTRATOR PRIVILEGES REQUIRED for this step
echo.
pause

REM Check if PowerShell is available
where powershell >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: PowerShell is not available
    echo Please install PowerShell or download NSSM manually from https://nssm.cc/
    pause
    exit /b 1
)

REM Run PowerShell script
echo.
echo Running download script...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0nssm\download-nssm.ps1"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================================================
    echo Download Complete!
    echo ================================================================================
    echo.
    echo Next step: Run "NSSM - Step 2 - Install Service.bat" as Administrator
    echo.
) else (
    echo.
    echo ================================================================================
    echo Download Failed!
    echo ================================================================================
    echo.
    echo Please try again or download manually from https://nssm.cc/download
    echo.
)

pause
