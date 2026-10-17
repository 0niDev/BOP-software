@echo off
setlocal EnableExtensions
title BOP ERP - Run in foreground

REM ===========================================================================
REM  Runs the built server in this console window, with exactly the same
REM  configuration the Windows service uses (web\.env). Useful for a first
REM  trial run or to watch startup errors, which the service hides in a log.
REM
REM  Ctrl+C stops it. Run deploy.bat first so dist\ exists.
REM ===========================================================================

set "DEPLOY_DIR=%~dp0"
for %%I in ("%DEPLOY_DIR%..\..") do set "REPO_ROOT=%%~fI"
set "WEB_DIR=%REPO_ROOT%\web"
set "SERVER_DIR=%WEB_DIR%\server"

if not exist "%SERVER_DIR%\dist\index.js" (
    echo [X] No build found at %SERVER_DIR%\dist\index.js
    echo     Run deploy.bat first.
    echo.
    pause
    exit /b 1
)

if not exist "%WEB_DIR%\.env" (
    echo [X] %WEB_DIR%\.env does not exist.
    echo     Copy web\.env.example to web\.env and fill it in first.
    echo.
    pause
    exit /b 1
)

echo Starting the ERP from %SERVER_DIR% ...
echo (the app reads %WEB_DIR%\.env, the same file the service uses)
echo.
cd /d "%SERVER_DIR%"
node dist\index.js

echo.
echo The server exited. Press any key to close.
pause >nul
exit /b 0
