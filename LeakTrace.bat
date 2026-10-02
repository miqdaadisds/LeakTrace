@echo off
title LeakTrace
cd /d "%~dp0\frontend"
call npm.cmd run app
pause
