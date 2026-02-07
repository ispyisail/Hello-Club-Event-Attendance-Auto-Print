# Hello Club Event Attendance - Complete Uninstaller (PowerShell)
#
# Usage:
#   Right-click on this file → Run with PowerShell
#   Or: powershell -ExecutionPolicy Bypass -File service/uninstall.ps1

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
  Write-Host "║  Hello Club Event Attendance - Complete Uninstaller (PowerShell)  ║" -ForegroundColor Cyan
  Write-Host "╚════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
  Write-Host ""
}

# Check if admin, if not, re-run as admin
if (-not (Test-Administrator)) {
  Show-Header
  Write-Host "🔐 Administrator Privileges Required" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "This uninstaller needs to:"
  Write-Host "  • Remove Windows Service"
  Write-Host "  • Remove Registry entries"
  Write-Host "  • Delete launcher files"
  Write-Host ""
  Write-Host "Requesting elevation..." -ForegroundColor Cyan
  Write-Host ""

  $scriptPath = $PSCommandPath
  if (-not $scriptPath) {
    $scriptPath = $MyInvocation.MyCommand.Path
  }

  $arguments = "-NoExit -ExecutionPolicy Bypass -File `"$scriptPath`""
  Start-Process PowerShell -ArgumentList $arguments -Verb RunAs

  exit
}

# Running as admin - proceed with uninstallation
Show-Header
Write-Host "✓ Running with Administrator privileges" -ForegroundColor Green
Write-Host ""

$scriptPath = $PSScriptRoot
$projectRoot = Split-Path -Parent $scriptPath

Write-Host "📂 Project Location: $projectRoot" -ForegroundColor Gray
Write-Host ""

Set-Location $projectRoot

Write-Host "🚀 Starting uninstallation..." -ForegroundColor Cyan
Write-Host ""

node service\uninstall.js

if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "✗ Uninstallation failed! Please check the error messages above." -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

Write-Host ""
Write-Host "✓ Uninstallation completed successfully!" -ForegroundColor Green
Write-Host ""
Read-Host "Press Enter to exit"
