@echo off
title TraceLeak
cd /d "%~dp0\frontend"
call npm.cmd run app
pause
