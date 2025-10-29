# NSSM Download and Installation Script
# This PowerShell script downloads NSSM and extracts it to the project folder

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "NSSM (Non-Sucking Service Manager) Installer" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"
$nssmVersion = "2.24"
$nssmUrl = "https://nssm.cc/release/nssm-$nssmVersion.zip"
$projectRoot = Split-Path -Parent $PSScriptRoot
$nssmFolder = Join-Path $projectRoot "nssm"
$tempZip = Join-Path $env:TEMP "nssm.zip"

Write-Host "Project Root: $projectRoot" -ForegroundColor Gray
Write-Host "NSSM Folder: $nssmFolder" -ForegroundColor Gray
Write-Host ""

# Check if NSSM is already installed
$nssmExe = Join-Path $nssmFolder "nssm-$nssmVersion\win64\nssm.exe"
if (Test-Path $nssmExe) {
    Write-Host "NSSM is already installed!" -ForegroundColor Green
    Write-Host "Location: $nssmExe" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To reinstall, delete the 'nssm' folder and run this script again." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 0
}

Write-Host "Downloading NSSM version $nssmVersion..." -ForegroundColor Yellow
Write-Host "URL: $nssmUrl" -ForegroundColor Gray
Write-Host ""

try {
    # Download NSSM
    Invoke-WebRequest -Uri $nssmUrl -OutFile $tempZip -UseBasicParsing
    Write-Host "[OK] Downloaded successfully" -ForegroundColor Green

    # Extract NSSM
    Write-Host ""
    Write-Host "Extracting NSSM..." -ForegroundColor Yellow

    if (Test-Path $nssmFolder) {
        Remove-Item $nssmFolder -Recurse -Force
    }

    Expand-Archive -Path $tempZip -DestinationPath $nssmFolder -Force
    Write-Host "[OK] Extracted successfully" -ForegroundColor Green

    # Verify extraction
    if (Test-Path $nssmExe) {
        Write-Host ""
        Write-Host "================================================================================" -ForegroundColor Green
        Write-Host "NSSM Installation Complete!" -ForegroundColor Green
        Write-Host "================================================================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "NSSM Location:" -ForegroundColor Cyan
        Write-Host "  $nssmExe" -ForegroundColor White
        Write-Host ""
        Write-Host "Next Steps:" -ForegroundColor Cyan
        Write-Host "  1. Close this window" -ForegroundColor White
        Write-Host "  2. Right-click 'NSSM - Install Service.bat'" -ForegroundColor White
        Write-Host "  3. Select 'Run as administrator'" -ForegroundColor White
        Write-Host ""
        Write-Host "================================================================================" -ForegroundColor Green
    } else {
        throw "NSSM executable not found after extraction"
    }

    # Cleanup
    Remove-Item $tempZip -Force -ErrorAction SilentlyContinue

} catch {
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Red
    Write-Host "Error During Installation" -ForegroundColor Red
    Write-Host "================================================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check your internet connection" -ForegroundColor White
    Write-Host "  2. Try disabling antivirus temporarily" -ForegroundColor White
    Write-Host "  3. Download manually from: https://nssm.cc/download" -ForegroundColor White
    Write-Host "  4. Extract to: $nssmFolder" -ForegroundColor White
    Write-Host ""
    Write-Host "================================================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
