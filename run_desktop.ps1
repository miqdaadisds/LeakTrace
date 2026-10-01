# LeakTrace: Standalone Desktop Launcher (SIH26237)
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host " LeakTrace: Cryptographic Attribution and Provenance System (SIH26237)" -ForegroundColor Cyan
Write-Host " Ministry of Defence / WESEE" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$scriptDir\frontend"

# Verify pinned local Electron runtime exists
$electronCmd = Join-Path (Get-Location) "node_modules\.bin\electron.cmd"
if (-not (Test-Path $electronCmd)) {
    Write-Host "[ERROR] Pinned local Electron runtime not found at: $electronCmd" -ForegroundColor Red
    Write-Host "[ERROR] Dynamic runtime package downloads are strictly prohibited by security policy." -ForegroundColor Red
    Write-Host "[ERROR] Please install dependencies offline or via 'npm install' before launching." -ForegroundColor Red
    exit 1
}

# Verify built frontend assets
if (-not (Test-Path "dist\index.html")) {
    Write-Host "Building frontend assets..." -ForegroundColor Yellow
    & cmd.exe /c "npm.cmd run build"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Frontend build failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Launching LeakTrace desktop application using pinned local binary..." -ForegroundColor Green
& cmd.exe /c "`"$electronCmd`" electron\main.cjs"
