@echo off
setlocal EnableExtensions
title BOP ERP (Web) - Start

REM ===========================================================================
REM  Daily start file for Windows.
REM
REM  - pulls the latest code from git (skipped when offline or not a repo;
REM    never stashes or discards local changes - it asks instead)
REM  - checks that the npm dependencies are installed (installs them if not,
REM    or if the update changed package-lock.json)
REM  - creates web\.env from .env.example when it is missing
REM  - pulls the latest data from the cloud maindb.db into data\erp.sqlite
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

REM --- 1/5: update from git ---------------------------------------------------
REM The repository root is one level above this web directory.
set "REPO_ROOT=%~dp0.."
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"

echo [1/5] Checking for updates...
where git >nul 2>&1
if errorlevel 1 goto :no_git
if not exist "%REPO_ROOT%\.git" goto :no_git

set "OLD_HEAD="
for /f %%H in ('git -C "%REPO_ROOT%" rev-parse HEAD 2^>nul') do set "OLD_HEAD=%%H"
if not defined OLD_HEAD goto :no_git

REM fetch alone tests connectivity: if it fails (offline) we still start.
git -C "%REPO_ROOT%" fetch
if errorlevel 1 (
    echo       [!] Update check failed - starting with the current code.
    goto :deps
)
git -C "%REPO_ROOT%" pull --ff-only
if errorlevel 1 goto :pull_failed

set "NEW_HEAD="
for /f %%H in ('git -C "%REPO_ROOT%" rev-parse HEAD 2^>nul') do set "NEW_HEAD=%%H"
if not defined NEW_HEAD goto :deps
if "%OLD_HEAD%"=="%NEW_HEAD%" goto :deps
echo       Updated to the latest code.
REM Reinstall packages when the update touched the lockfile.
git -C "%REPO_ROOT%" diff --name-only %OLD_HEAD% %NEW_HEAD% | findstr /c:"package-lock.json" >nul
if not errorlevel 1 set "FORCE_INSTALL=1"
goto :deps

:no_git
echo       No git or not a git checkout - skipping the update.
goto :deps

:pull_failed
echo.
echo [X] git pull failed - local changes conflict with the latest code.
echo     Current local changes:
git -C "%REPO_ROOT%" status --short
echo.
echo     Continue with the current (older) code, or cancel and fix it first,
echo     e.g. "git stash" and then run start.bat again.
choice /c CA /m "      Continue anyway"
if errorlevel 2 goto :pull_abort
goto :deps

:pull_abort
echo.
pause
exit /b 1

REM --- 2/5: dependencies ------------------------------------------------------
:deps
echo [2/5] Checking npm packages...
if defined FORCE_INSTALL goto :install
if not exist node_modules goto :install
REM Health-check the actual dev tools: npm ls only looks at top-level packages,
REM so a truncated node_modules (bundle loads, then ERR_MODULE_NOT_FOUND) would
REM slip through. Loading concurrently catches any broken dep it needs.
call npx --no-install concurrently --version >nul 2>&1
if errorlevel 1 goto :install
echo       All packages are installed.
goto :env

:install
echo       Installing packages (missing, broken, or changed by the update - this can take a few minutes)...
REM npm ci wipes node_modules and installs exactly what package-lock.json says,
REM so a half-copied tree cannot survive. Fall back to install if the lockfile
REM and package.json disagree.
call npm ci --no-audit --no-fund
if errorlevel 1 call npm install --no-audit --no-fund
if errorlevel 1 goto :npm_failed

:env
REM --- 3/5: configuration ----------------------------------------------------
if exist .env goto :sync
if not exist .env.example goto :sync
copy /y .env.example .env >nul
if errorlevel 1 goto :env_failed
echo       Created web\.env from .env.example (local SQLite database).
goto :sync

:env_failed
echo [X] Could not create web\.env. Copy .env.example to .env manually and retry.
goto :fail

REM --- 4/5: pull the latest data from the cloud maindb.db --------------------
REM  Remote wins at startup: the pull goes to a temp file and only replaces
REM  data\erp.sqlite after it passes its integrity check, so an offline start
REM  keeps the local data. Local writes made since the last replica push are
REM  discarded here (they were already pushed if the previous run had time).
:sync
echo [4/5] Pulling the latest data from maindb.db...
if not exist data mkdir data
del /q "data\erp.startup.sqlite*" 2>nul
node scripts\pull-cloud.mjs --out data\erp.startup.sqlite
if errorlevel 1 goto :sync_failed
move /y data\erp.startup.sqlite data\erp.sqlite >nul
if errorlevel 1 goto :sync_failed
REM  A leftover -wal/-shm from the replaced file corrupts the new one on open.
del /q data\erp.sqlite-wal 2>nul
del /q data\erp.sqlite-shm 2>nul
echo       Local data refreshed from the cloud.
goto :run

:sync_failed
echo       [!] Pull failed - starting with the existing local data.
del /q "data\erp.startup.sqlite*" 2>nul
goto :run

REM --- 5/5: start ------------------------------------------------------------
:run
echo.
echo [5/5] Starting API (http://localhost:4000) and client (http://localhost:5173)...
echo       The browser opens automatically when the client is ready.
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
