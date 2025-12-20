@echo off
REM ============================================================================
REM Prepare a new release
REM ============================================================================
REM This script helps you prepare and publish a new release
REM ============================================================================

echo.
echo ========================================================================
echo   Prepare New Release - Hello Club Event Attendance
echo ========================================================================
echo.

REM Check if we're on main branch
for /f "tokens=*" %%a in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%a
if not "%BRANCH%"=="main" (
    echo WARNING: You are not on the main branch!
    echo Current branch: %BRANCH%
    echo.
    choice /C YN /M "Continue anyway"
    if errorlevel 2 exit /b 1
)

REM Check for uncommitted changes
git diff-index --quiet HEAD --
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: You have uncommitted changes!
    echo Please commit or stash your changes before releasing.
    echo.
    git status --short
    echo.
    pause
    exit /b 1
)

echo Current version in package.json:
for /f "tokens=2 delims=:, " %%a in ('findstr /C:"\"version\"" package.json') do set CURRENT_VERSION=%%a
set CURRENT_VERSION=%CURRENT_VERSION:"=%
echo   %CURRENT_VERSION%
echo.

echo What type of release is this?
echo.
echo 1. Patch (bug fixes)          - %CURRENT_VERSION% -^> increment last number
echo 2. Minor (new features)       - %CURRENT_VERSION% -^> increment middle number
echo 3. Major (breaking changes)   - %CURRENT_VERSION% -^> increment first number
echo 4. Custom version
echo.

choice /C 1234 /N /M "Enter your choice (1-4): "
set CHOICE=%ERRORLEVEL%

if %CHOICE%==1 (
    npm version patch --no-git-tag-version
) else if %CHOICE%==2 (
    npm version minor --no-git-tag-version
) else if %CHOICE%==3 (
    npm version major --no-git-tag-version
) else if %CHOICE%==4 (
    set /p NEW_VERSION="Enter new version (e.g., 1.2.3): "
    npm version %NEW_VERSION% --no-git-tag-version
)

REM Get new version
for /f "tokens=2 delims=:, " %%a in ('findstr /C:"\"version\"" package.json') do set NEW_VERSION=%%a
set NEW_VERSION=%NEW_VERSION:"=%

echo.
echo New version: %NEW_VERSION%
echo.

REM Update CHANGELOG.md
echo Opening CHANGELOG.md for you to add release notes...
echo.
echo Please add your changes under the [Unreleased] section.
echo When done, save and close the file.
echo.
pause

notepad CHANGELOG.md

echo.
echo Did you update CHANGELOG.md?
choice /C YN /M "Continue"
if errorlevel 2 exit /b 1

echo.
echo [1/5] Running tests...
call npm test
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Tests failed! Fix them before releasing.
    pause
    exit /b 1
)

echo.
echo [2/5] Running linter...
call npm run lint
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Linting issues found!
    choice /C YN /M "Continue anyway"
    if errorlevel 2 exit /b 1
)

echo.
echo [3/5] Building portable package...
call npm run build:portable
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to build portable package!
    pause
    exit /b 1
)

echo.
echo [4/5] Creating git commit and tag...
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v%NEW_VERSION%"
git tag -a "v%NEW_VERSION%" -m "Release v%NEW_VERSION%"

echo.
echo [5/5] Ready to publish!
echo.
echo ========================================================================
echo   Release Summary
echo ========================================================================
echo.
echo   Version: v%NEW_VERSION%
echo   Branch: %BRANCH%
echo   Commit:
git log -1 --oneline
echo.
echo ========================================================================
echo.
echo Next steps:
echo   1. Review the changes above
echo   2. Push the commit and tag to GitHub:
echo      git push origin main
echo      git push origin v%NEW_VERSION%
echo   3. GitHub Actions will automatically:
echo      - Run tests
echo      - Build portable ZIP
echo      - Create GitHub Release
echo      - Attach ZIP to release
echo.
echo ========================================================================
echo.

choice /C YN /M "Push to GitHub now"
if errorlevel 2 goto :end

echo.
echo Pushing to GitHub...
git push origin %BRANCH%
git push origin v%NEW_VERSION%

echo.
echo ========================================================================
echo   Release Published!
echo ========================================================================
echo.
echo GitHub Actions is now building the release.
echo Check progress at:
echo   https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/actions
echo.
echo Release will be available at:
echo   https://github.com/ispyisail/Hello-Club-Event-Attendance-Auto-Print/releases/tag/v%NEW_VERSION%
echo.

:end
pause
