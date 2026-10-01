# NISHAN-PQ: Standalone Desktop Launcher (SIH26237)
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host " NISHAN-PQ: Cryptographic Attribution & Provenance System (SIH26237)" -ForegroundColor Cyan
Write-Host " Ministry of Defence / WESEE" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Initializing secure standalone desktop enclave..." -ForegroundColor Yellow

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$scriptDir\frontend"

if (-not (Test-Path "dist\index.html")) {
    Write-Host "Building frontend assets..." -ForegroundColor Yellow
    & cmd.exe /c "npm.cmd run build"
}

Write-Host "Launching desktop application (Electron + Silent Python Worker)..." -ForegroundColor Green
& cmd.exe /c "npx.cmd electron electron/main.cjs"
