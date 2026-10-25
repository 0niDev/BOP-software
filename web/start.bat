@echo off
setlocal EnableExtensions
title BOP ERP (Web) - Start

REM ===========================================================================
REM  Daily start file for Windows.
REM
REM  - checks that the npm dependencies are installed (installs them if not)
REM  - creates web\.env from .env.example when it is missing
REM  - starts the API + client (npm run dev)
REM  - opens the app in the default browser once the client answers
REM
REM  Double-click this file. Ctrl+C in this window stops the app.
REM  For a fresh machine use setup.bat instead (installs Node.js too).
REM ===========================================================================

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 goto :no_node
where npm >nul 2>&1
if errorlevel 1 goto :no_node

REM --- 1/3: dependencies -----------------------------------------------------
echo [1/3] Checking npm packages...
if not exist node_modules goto :install
REM Health-check the actual dev tools: npm ls only looks at top-level packages,
REM so a truncated node_modules (bundle loads, then ERR_MODULE_NOT_FOUND) would
REM slip through. Loading concurrently catches any broken dep it needs.
call npx --no-install concurrently --version >nul 2>&1
if errorlevel 1 goto :install
echo       All packages are installed.
goto :env

:install
echo       Broken or missing packages - reinstalling (this can take a few minutes)...
REM npm ci wipes node_modules and installs exactly what package-lock.json says,
REM so a half-copied tree cannot survive. Fall back to install if the lockfile
REM and package.json disagree.
call npm ci --no-audit --no-fund
if errorlevel 1 call npm install --no-audit --no-fund
if errorlevel 1 goto :npm_failed

:env
REM --- 2/3: configuration ----------------------------------------------------
if exist .env goto :run
if not exist .env.example goto :run
copy /y .env.example .env >nul
if errorlevel 1 goto :env_failed
echo       Created web\.env from .env.example (local SQLite database).
goto :run

:env_failed
echo [X] Could not create web\.env. Copy .env.example to .env manually and retry.
goto :fail

REM --- 3/3: start ------------------------------------------------------------
:run
echo.
echo [2/3] Starting API (http://localhost:4000) and client (http://localhost:5173)...
echo [3/3] The browser opens automatically when the client is ready.
echo.
echo       Press Ctrl+C in this window to stop the app.
echo.

REM Background waiter: opens the browser as soon as Vite answers on 5173.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 180;$i++){try{Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:5173 | Out-Null; Start-Process 'http://localhost:5173'; break}catch{Start-Sleep 1}}"

call npm run dev
goto :end

:no_node
echo.
echo [X] Node.js / npm was not found on this machine.
echo     Install Node.js 22 LTS or newer from https://nodejs.org/en/download
echo     (or run setup.bat, which installs it automatically).
echo.
start "" https://nodejs.org/en/download
pause
exit /b 1

:npm_failed
echo.
echo [X] npm install failed. Check the messages above (network/proxy) and retry.
goto :fail

:fail
pause
exit /b 1

:end
echo.
echo App stopped.
pause
exit /b 0
