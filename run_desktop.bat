@echo off
title NISHAN-PQ: Cryptographic Attribution & Provenance Enclave (SIH26237)
echo ===============================================================================
echo  NISHAN-PQ: Cryptographic Attribution & Provenance System (SIH26237)
echo  Ministry of Defence / WESEE
echo ===============================================================================
echo.
echo Initializing secure standalone desktop enclave...
cd /d "%~dp0\frontend"

if not exist "dist\index.html" (
    echo Building frontend production assets...
    call npm.cmd run build
)

echo Starting desktop application with silent background cryptographic worker...
call npx.cmd electron electron/main.cjs
