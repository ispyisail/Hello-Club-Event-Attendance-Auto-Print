@echo off
REM ============================================================================
REM Hello Club Event Attendance - Build Portable ZIP Package
REM ============================================================================
REM Creates a ZIP file with all necessary files for portable distribution
REM Excludes development files, logs, and sensitive data
REM ============================================================================

echo.
echo ========================================================================
echo   Building Portable ZIP Package
echo ========================================================================
echo.

REM Check for PowerShell (needed for ZIP creation)
powershell -Command "Write-Host 'PowerShell available'" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: PowerShell is required but not available
    pause
    exit /b 1
)

echo [1/3] Preparing files...

REM Create temp directory for packaging
if exist "..\temp-portable" rmdir /S /Q "..\temp-portable"
mkdir "..\temp-portable"

REM Copy essential files
echo       Copying application files...
xcopy "..\src" "..\temp-portable\src\" /E /I /Q >nul
xcopy "..\tests" "..\temp-portable\tests\" /E /I /Q >nul
xcopy "..\tray-app" "..\temp-portable\tray-app\" /E /I /Q >nul
xcopy "..\service" "..\temp-portable\service\" /E /I /Q >nul
xcopy "..\docs" "..\temp-portable\docs\" /E /I /Q >nul
xcopy "..\migrations" "..\temp-portable\migrations\" /E /I /Q >nul
xcopy "..\portable" "..\temp-portable\portable\" /E /I /Q >nul

REM Copy configuration files
echo       Copying configuration files...
copy "..\package.json" "..\temp-portable\" >nul
copy "..\package-lock.json" "..\temp-portable\" >nul
copy "..\config.json" "..\temp-portable\" >nul
copy "..\.env.example" "..\temp-portable\" >nul
copy "..\LICENSE" "..\temp-portable\" >nul
copy "..\README.md" "..\temp-portable\" >nul
copy "..\CHANGELOG.md" "..\temp-portable\" >nul
copy "..\SECURITY.md" "..\temp-portable\" >nul
copy "..\.gitignore" "..\temp-portable\" >nul
copy "..\.nvmrc" "..\temp-portable\" >nul
copy "..\.editorconfig" "..\temp-portable\" >nul
copy "..\.eslintrc.js" "..\temp-portable\" >nul
copy "..\.eslintignore" "..\temp-portable\" >nul
copy "..\.prettierrc" "..\temp-portable\" >nul
copy "..\.prettierignore" "..\temp-portable\" >nul
copy "..\jest.config.js" "..\temp-portable\" >nul

echo       Files copied successfully!
echo.

echo [2/3] Creating ZIP archive...

REM Get version from package.json
for /f "tokens=2 delims=:, " %%a in ('findstr /C:"\"version\"" ..\package.json') do set VERSION=%%a
set VERSION=%VERSION:"=%

REM Create output directory
if not exist "..\dist" mkdir "..\dist"

REM Create ZIP using PowerShell
set OUTPUT_FILE=..\dist\HelloClubEventAttendance-Portable-v%VERSION%.zip
if exist "%OUTPUT_FILE%" del "%OUTPUT_FILE%"

powershell -Command "Compress-Archive -Path '..\temp-portable\*' -DestinationPath '%OUTPUT_FILE%' -CompressionLevel Optimal"

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to create ZIP file
    rmdir /S /Q "..\temp-portable"
    pause
    exit /b 1
)

echo       ZIP created successfully!
echo.

echo [3/3] Cleaning up...
rmdir /S /Q "..\temp-portable"
echo       Cleanup complete!
echo.

echo ========================================================================
echo   Build Complete!
echo ========================================================================
echo.
echo   Package: HelloClubEventAttendance-Portable-v%VERSION%.zip
echo   Location: dist\
echo.

REM Get file size
for %%I in ("%OUTPUT_FILE%") do set SIZE=%%~zI
set /a SIZE_MB=SIZE/1024/1024
echo   Size: %SIZE_MB% MB
echo.

echo   This portable package includes:
echo   - All source code
echo   - Configuration files
echo   - Documentation
echo   - Easy-to-use launcher scripts
echo   - No dependencies bundled (npm install required)
echo.
echo   Users will need to:
echo   1. Extract the ZIP file
echo   2. Run portable\1-SETUP.bat
echo   3. Configure .env file
echo   4. Run portable\2-START-SERVICE.bat
echo.

choice /C YN /M "Do you want to open the dist folder"
if not errorlevel 2 explorer ..\dist

echo.
echo Distribution package ready!
echo.
pause
