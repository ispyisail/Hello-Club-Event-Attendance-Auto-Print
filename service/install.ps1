# Hello Club Event Attendance - Complete Installer (PowerShell)
# This script elevates privileges and runs the complete installer
#
# Usage:
#   Right-click on this file → Run with PowerShell
#   Or: powershell -ExecutionPolicy Bypass -File service/install.ps1

# Check if running as Administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Display header
function Show-Header {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║   Hello Club Event Attendance - Complete Installer (PowerShell)   ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

# Check if admin, if not, re-run as admin
if (-not (Test-Administrator)) {
    Show-Header
    Write-Host "🔐 Administrator Privileges Required" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "This installer needs to:"
    Write-Host "  • Install a Windows Service"
    Write-Host "  • Modify Windows Registry for auto-start"
    Write-Host ""
    Write-Host "Requesting elevation..." -ForegroundColor Cyan
    Write-Host ""

    # Get the script path
    $scriptPath = $PSCommandPath
    if (-not $scriptPath) {
        $scriptPath = $MyInvocation.MyCommand.Path
    }

    # Re-run as admin
    $arguments = "-NoExit -ExecutionPolicy Bypass -File `"$scriptPath`""
    Start-Process PowerShell -ArgumentList $arguments -Verb RunAs

    exit
}

# Running as admin - proceed with installation
Show-Header
Write-Host "✓ Running with Administrator privileges" -ForegroundColor Green
Write-Host ""

# Get project root
$scriptPath = $PSScriptRoot
$projectRoot = Split-Path -Parent $scriptPath

Write-Host "📂 Project Location: $projectRoot" -ForegroundColor Gray
Write-Host ""

# Change to project directory
Set-Location $projectRoot

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "⚠️  node_modules not found. Running npm install..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ npm install failed. Please run 'npm install' manually." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Run the complete installer
Write-Host "🚀 Starting installation..." -ForegroundColor Cyan
Write-Host ""

node service\install-complete.js

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "✗ Installation failed! Please check the error messages above." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "✓ Installation completed successfully!" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to exit"
