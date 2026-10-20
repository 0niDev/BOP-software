@echo off
setlocal EnableExtensions
title BOP ERP - Install Windows service

REM ===========================================================================
REM  Installs the ERP API (which also serves the built React client) as a
REM  Windows service named BOP-ERP, using NSSM.
REM
REM  Prerequisites: Node.js 22+ x64, NSSM on PATH, and a completed build
REM  (`deploy.bat` does the build). Run this script as Administrator.
REM ===========================================================================

set "SERVICE_NAME=BOP-ERP"

REM This script lives in <web>\deploy\windows
set "DEPLOY_DIR=%~dp0"
for %%I in ("%DEPLOY_DIR%..\..") do set "WEB_DIR=%%~fI"
for %%I in ("%WEB_DIR%\..") do set "REPO_ROOT=%%~fI"
set "SERVER_DIR=%WEB_DIR%\server"
set "LOG_DIR=%WEB_DIR%\logs"

echo ============================================================
echo    BOP ERP - INSTALL WINDOWS SERVICE
echo ============================================================
echo   Repo:     %REPO_ROOT%
echo   Web app:  %WEB_DIR%
echo   Service:  %SERVICE_NAME%
echo.

REM --- administrator check ---------------------------------------------------
net session >nul 2>&1
if errorlevel 1 (
    echo [X] This script must be run as Administrator.
    echo     Right-click the file and choose "Run as administrator".
    echo.
    pause
    exit /b 1
)

REM --- prerequisites ---------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
    echo [X] Node.js was not found on PATH.
    echo     Install Node.js 22 LTS from https://nodejs.org/ and reopen this window.
    echo.
    pause
    exit /b 1
)

node -e "const m=Number(process.versions.node.split('.')[0]); if(!(m>=22)){console.error('Node '+process.versions.node+' is too old; this app needs 22 or newer (node:sqlite).');process.exit(1)}"
if errorlevel 1 (
    echo.
    echo [X] Node.js 22 or newer is required.
    echo.
    pause
    exit /b 1
)

where nssm >nul 2>&1
if errorlevel 1 (
    echo [X] NSSM was not found on PATH.
    echo     Download it from https://nssm.cc/download, put nssm.exe on PATH
    echo     ^(for example in C:\Windows\System32^), then run this again.
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

if not exist "%SERVER_DIR%\dist\index.js" (
    echo [X] The server has not been built yet.
    echo     Run deploy.bat first, then install the service.
    echo.
    pause
    exit /b 1
)

REM --- locate node.exe (first match wins; no goto, which is unreliable
REM     inside a for block) ---------------------------------------------------
set "NODE_EXE="
for /f "delims=" %%I in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%I"
if not defined NODE_EXE (
    echo [X] Could not resolve the path to node.exe.
    echo.
    pause
    exit /b 1
)

REM Read PORT from web\.env (default 4000).
set "PORT=4000"
for /f "usebackq tokens=2 delims==" %%P in (`findstr /b /c:"PORT=" "%WEB_DIR%\.env"`) do set "PORT=%%P"

REM --- refuse to clobber an existing service --------------------------------
sc query "%SERVICE_NAME%" >nul 2>&1
if not errorlevel 1 (
    echo [!] The service "%SERVICE_NAME%" already exists.
    choice /c YN /m "    Reinstall it"
    if errorlevel 2 (
        echo     Nothing changed.
        pause
        exit /b 0
    )
    echo     Stopping and removing the existing service...
    nssm stop "%SERVICE_NAME%" >nul 2>&1
    nssm remove "%SERVICE_NAME%" confirm >nul 2>&1
)

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo.
echo [1/4] Registering the service...
nssm install "%SERVICE_NAME%" "%NODE_EXE%" "dist\index.js"
if errorlevel 1 goto :failed

echo [2/4] Configuring it...
nssm set "%SERVICE_NAME%" AppDirectory "%SERVER_DIR%"
nssm set "%SERVICE_NAME%" DisplayName "BOP Nutraceuticals ERP"
nssm set "%SERVICE_NAME%" Description "BOP ERP API and web client (Node.js)"
nssm set "%SERVICE_NAME%" Start SERVICE_AUTO_START
REM Logs: NSSM captures stdout/stderr, so the [bootstrap]/[server] lines land here.
nssm set "%SERVICE_NAME%" AppStdout "%LOG_DIR%\erp-out.log"
nssm set "%SERVICE_NAME%" AppStderr "%LOG_DIR%\erp-error.log"
nssm set "%SERVICE_NAME%" AppRotateFiles 1
nssm set "%SERVICE_NAME%" AppRotateBytes 10485760
REM Restart on any exit; the app shuts down cleanly on Ctrl+C (SIGINT).
nssm set "%SERVICE_NAME%" AppExit Default Restart
nssm set "%SERVICE_NAME%" AppRestartDelay 5000
nssm set "%SERVICE_NAME%" AppStopMethodConsole 1500

echo [3/4] Starting it...
nssm start "%SERVICE_NAME%"
if errorlevel 1 goto :failed

echo [4/4] Firewall rule for TCP %PORT%...
REM No parentheses in the rule name: it keeps the netsh call safe inside this
REM parenthesised block on every cmd build.
set "RULE_NAME=%SERVICE_NAME%-%PORT%"
netsh advfirewall firewall show rule name="%RULE_NAME%" >nul 2>&1
if errorlevel 1 (
    choice /c YN /m "    Open TCP port %PORT% so other machines can reach the app"
    if errorlevel 2 (
        echo     Skipped. The app is reachable on this machine only.
    ) else (
        netsh advfirewall firewall add rule name="%RULE_NAME%" dir=in action=allow protocol=TCP localport=%PORT% >nul
        if errorlevel 1 (
            echo     [!] Could not add the firewall rule.
        ) else (
            echo     Added: allow inbound TCP %PORT%.
        )
    )
) else (
    echo     Rule already exists.
)

echo.
echo ============================================================
echo    SERVICE INSTALLED
echo ============================================================
echo   Start / stop:  nssm start %SERVICE_NAME%   /   nssm stop %SERVICE_NAME%
echo   Logs:          %LOG_DIR%\erp-out.log  and  erp-error.log
echo   Open:          http://localhost:%PORT%
echo.
echo   Before go-live, change the admin password and create real user
echo   accounts - see DEPLOYMENT.md.
echo.
pause
exit /b 0

:failed
echo.
echo [X] The service could not be installed. Check the output above.
echo     NSSM errors are usually a wrong node.exe path or missing permissions.
echo.
pause
exit /b 1
