@echo off
setlocal enabledelayedexpansion
title TraceLeak - Cryptographic Attribution and Provenance System (SIH26237)

echo ===============================================================================
echo  TraceLeak: Cryptographic Attribution and Provenance System (SIH26237)
echo  Ministry of Defence / WESEE
echo ===============================================================================
echo.

cd /d "%~dp0\frontend"

:: Enforce deterministic offline dependency verification
if not exist "node_modules\.bin\electron.cmd" (
    echo [ERROR] Pinned local Electron runtime not found in frontend\node_modules.
    echo [ERROR] Dynamic runtime package downloads are strictly prohibited by security policy.
    echo [ERROR] Please install dependencies offline or via 'npm install' before launching.
    pause
    exit /b 1
)

:: Build production assets if missing
if not exist "dist\index.html" (
    echo Building frontend production assets...
    call npm.cmd run build
    if errorlevel 1 (
        echo [ERROR] Frontend asset build failed.
        pause
        exit /b 1
    )
)

echo Starting TraceLeak standalone desktop application using pinned local runtime...
call "node_modules\.bin\electron.cmd" electron\main.cjs
