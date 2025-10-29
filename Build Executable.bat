@echo off
REM Build Hello Club as Windows Executable
REM This creates a standalone .exe that doesn't require Node.js

echo ================================================================================
echo Hello Club Event Attendance Auto-Print
echo Executable Builder
echo ================================================================================
echo.
echo This will create a standalone Windows executable that:
echo   - Does NOT require Node.js to be installed
echo   - Bundles all dependencies
echo   - Can be distributed as a single .exe file
echo.
echo Build process takes 2-5 minutes depending on your system.
echo.
pause

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is required to BUILD the executable
    echo Please install Node.js from https://nodejs.org/
    echo.
    echo Note: End users will NOT need Node.js to RUN the exe
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules\" (
    echo ERROR: Dependencies not installed
    echo Running: npm install
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Check if pkg is installed
if not exist "node_modules\pkg\" (
    echo Installing pkg (executable builder)...
    call npm install --save-dev pkg
)

echo.
echo ================================================================================
echo Building Executable...
echo ================================================================================
echo.
echo Target: Windows x64
echo Output: dist\hello-club.exe
echo.

REM Create dist directory if it doesn't exist
if not exist "dist\" mkdir dist

REM Run pkg to build the executable
call npm run build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================================================
    echo Build Successful!
    echo ================================================================================
    echo.
    echo Executable created: dist\hello-club.exe
    echo.

    REM Show file size
    for %%I in ("dist\hello-club.exe") do echo File size: %%~zI bytes

    echo.
    echo Next steps:
    echo   1. Run "Build Distribution Package.bat" to create distributable package
    echo   2. OR test directly: dist\hello-club.exe --help
    echo.
    echo Note: The .exe still needs .env and config.json in the same folder
    echo.
    echo ================================================================================
) else (
    echo.
    echo ================================================================================
    echo Build Failed!
    echo ================================================================================
    echo.
    echo Common issues:
    echo   - Antivirus blocking (temporarily disable)
    echo   - Insufficient disk space (need ~200MB)
    echo   - Corrupted node_modules (try: npm clean-install)
    echo.
    echo ================================================================================
)

echo.
pause
