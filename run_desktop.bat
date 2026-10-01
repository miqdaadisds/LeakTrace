@echo off
title LeakTrace - Cryptographic Attribution and Provenance System (SIH26237)
echo ===============================================================================
echo  LeakTrace: Cryptographic Attribution and Provenance System (SIH26237)
echo  Ministry of Defence / WESEE
echo ===============================================================================
echo.
echo Initializing secure standalone desktop enclave...
cd /d "%~dp0\frontend"

if not exist "dist\index.html" (
    echo Building frontend production assets...
    call npm.cmd run build
)

echo Starting LeakTrace desktop application...
call npx.cmd electron electron\main.cjs
