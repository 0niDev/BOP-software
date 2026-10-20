@echo off
setlocal EnableExtensions
title BOP ERP (Web) - Setup

REM ===========================================================================
REM  One-time setup for the web application on a fresh Windows machine.
REM
REM  - installs Node.js 22+ (via winget) when it is missing or too old
REM  - installs the npm dependencies for the API and the React client
REM  - creates web\.env from .env.example (local SQLite by default)
REM  - verifies the installation with the HTTP smoke test
REM  - optionally seeds demo data and starts the app
REM
REM  Double-click this file, or run web\setup.bat from a command prompt.
REM ===========================================================================

cd /d "%~dp0"
set "WEB_DIR=%~dp0"
if "%WEB_DIR:~-1%"=="\" set "WEB_DIR=%WEB_DIR:~0,-1%"
set "ENV_FILE=%WEB_DIR%\.env"
set "ENV_TEMPLATE=%WEB_DIR%\.env.example"

echo ============================================================
echo    BOP ERP (WEB) - SETUP
echo ============================================================
echo   Folder: %WEB_DIR%
echo.

REM --- 1/5: Node.js 22+ ------------------------------------------------------
echo [1/5] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 goto :install_node
node -e "const m=Number(process.versions.node.split('.')[0]); process.exit(m>=22?0:1)" >nul 2>&1
if errorlevel 1 goto :install_node
echo       Node.js found:
node --version
goto :node_ready

:install_node
echo       Node.js 22 or newer is required and was not found.
echo       Installing the Node.js LTS release with winget...
where winget >nul 2>&1
if errorlevel 1 goto :no_winget
echo.
echo       A Windows permission prompt may appear. Approve it.
echo.
where node >nul 2>&1
if errorlevel 1 (
    winget install --id OpenJS.NodeJS.LTS -e --silent --source winget --accept-package-agreements --accept-source-agreements
) else (
    winget upgrade --id OpenJS.NodeJS.LTS -e --silent --source winget --accept-package-agreements --accept-source-agreements
)
REM The installer updates the machine PATH, not this already-open console.
set "PATH=%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs;%LOCALAPPDATA%\Programs\nodejs;%APPDATA%\npm;%PATH%"
where node >nul 2>&1
if errorlevel 1 goto :node_failed
node -e "const m=Number(process.versions.node.split('.')[0]); process.exit(m>=22?0:1)" >nul 2>&1
if errorlevel 1 goto :node_failed
echo       Installed:
node --version
goto :node_ready

:no_winget
echo.
echo [X] winget is not available on this machine, so Node.js cannot be
echo     installed automatically.
echo     Install Node.js 22 LTS or newer from https://nodejs.org/en/download
echo     then run setup.bat again.
echo.
start "" https://nodejs.org/en/download
pause
exit /b 1

:node_failed
echo.
echo [X] Node.js is still not available. If it was just installed, close this
echo     window and run setup.bat again so the new PATH is picked up.
echo     Otherwise install Node.js 22 LTS or newer from
echo     https://nodejs.org/en/download and run setup.bat again.
echo.
pause
exit /b 1

:node_ready
echo.

REM --- 2/5: web\.env ---------------------------------------------------------
echo [2/5] Configuring web\.env...
if exist "%ENV_FILE%" (
    echo       web\.env already exists - leaving it untouched.
) else (
    if not exist "%ENV_TEMPLATE%" goto :no_template
    copy /y "%ENV_TEMPLATE%" "%ENV_FILE%" >nul
    if errorlevel 1 goto :env_failed
    echo       Created web\.env from .env.example (local SQLite database).
)
echo.
echo       The default configuration uses a local SQLite database, which
echo       works without any credentials.
choice /c YN /m "      Configure the hosted SQLite Cloud database now (opens Notepad)"
if errorlevel 2 goto :env_local
notepad "%ENV_FILE%"
echo.
echo       Set ERP_DB_ENGINE=sqlitecloud and fill in SQLITE_CLOUD_URL.
echo       Save and close Notepad, then press any key here.
pause >nul
findstr /b /c:"ERP_DB_ENGINE=sqlitecloud" "%ENV_FILE%" >nul
if errorlevel 1 (
    echo       [!] ERP_DB_ENGINE is not sqlitecloud - the app will use the local
    echo           SQLite database at ERP_LOCAL_DB.
) else (
    findstr /b /c:"SQLITE_CLOUD_URL=sqlitecloud" "%ENV_FILE%" >nul
    if errorlevel 1 (
        echo       [!] SQLITE_CLOUD_URL does not look like a sqlitecloud:// URL.
        echo           Edit web\.env before starting the app.
    ) else (
        echo       Hosted SQLite Cloud database configured.
    )
)
:env_local
echo.

REM --- 3/5: dependencies -----------------------------------------------------
echo [3/5] Installing dependencies (this can take a few minutes)...
call npm ci --no-audit --no-fund
if errorlevel 1 goto :npm_failed
echo       Dependencies installed.
echo.

REM --- 4/5: verify -----------------------------------------------------------
echo [4/5] Verifying the installation with the HTTP smoke test...
call npm run smoke
if errorlevel 1 goto :smoke_failed
echo.

REM --- 5/5: optional demo data ----------------------------------------------
echo [5/5] Demo data
findstr /b /c:"ERP_DB_ENGINE=local" "%ENV_FILE%" >nul
if errorlevel 1 (
    echo       Using the hosted database - no demo data is added.
    goto :done
)
choice /c YN /m "      Seed the local database with demo data"
if errorlevel 2 goto :done
call npm run seed
if errorlevel 1 (
    echo       [!] Demo data could not be seeded. The app still works; you can
    echo           retry later with: npm run seed
)
echo.

:done
echo ============================================================
echo    SETUP COMPLETE
echo ============================================================
echo.
echo   Start in development:   cd web  ^&^&  npm run dev
echo                           then open http://localhost:5173
echo   Production deployment:  web\deploy\windows\deploy.bat
echo                           (runbook: web\DEPLOYMENT.md)
echo.
choice /c YN /m "Start the app now"
if errorlevel 2 goto :end
call npm run dev
goto :end

:no_template
echo [X] web\.env.example is missing. Restore it from the repository and retry.
goto :fail
:env_failed
echo [X] Could not create web\.env.
goto :fail
:npm_failed
echo.
echo [X] npm ci failed. Check the messages above (network/proxy or a broken
echo     package-lock.json), then run setup.bat again.
goto :fail
:smoke_failed
echo.
echo [X] The smoke test failed, so the installation is not complete.
echo     Review the output above, fix the cause, then run setup.bat again.
goto :fail

:fail
echo.
pause
exit /b 1

:end
echo.
pause
exit /b 0
