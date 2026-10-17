@echo off
setlocal EnableExtensions
title BOP ERP - Deploy

REM ===========================================================================
REM  Builds and deploys the ERP on this machine.
REM
REM  Usage:
REM    deploy.bat                 pull, install, typecheck, test, build, restart
REM    deploy.bat --skip-tests    skip the test suite (fast hotfix)
REM    deploy.bat --skip-pull     do not touch git (deploy the working tree)
REM
REM  If the service is not installed yet the build still runs; install it with
REM  install-service.bat (as Administrator).
REM ===========================================================================

set "SERVICE_NAME=BOP-ERP"
set "SKIP_TESTS="
set "SKIP_PULL="
if /i "%~1"=="--skip-tests" set "SKIP_TESTS=1"
if /i "%~2"=="--skip-tests" set "SKIP_TESTS=1"
if /i "%~1"=="--skip-pull" set "SKIP_PULL=1"
if /i "%~2"=="--skip-pull" set "SKIP_PULL=1"

set "DEPLOY_DIR=%~dp0"
for %%I in ("%DEPLOY_DIR%..\..") do set "REPO_ROOT=%%~fI"
set "WEB_DIR=%REPO_ROOT%\web"

echo ============================================================
echo    BOP ERP - DEPLOY
echo ============================================================
echo   Repo: %REPO_ROOT%
if defined SKIP_TESTS echo   Mode: skipping tests
if defined SKIP_PULL echo   Mode: skipping git pull
echo.

REM --- prerequisites ---------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 (
    echo [X] Node.js was not found on PATH. Install Node.js 22 LTS.
    echo.
    pause
    exit /b 1
)

node -e "const m=Number(process.versions.node.split('.')[0]); if(!(m>=22)){console.error('Node '+process.versions.node+' is too old; this app needs 22 or newer.');process.exit(1)}"
if errorlevel 1 (
    echo [X] Node.js 22 or newer is required.
    echo.
    pause
    exit /b 1
)

if not exist "%WEB_DIR%\.env" (
    echo [X] %WEB_DIR%\.env does not exist.
    echo     Copy web\.env.example to web\.env and fill it in before deploying.
    echo.
    pause
    exit /b 1
)

REM --- optional pull ---------------------------------------------------------
if defined SKIP_PULL goto :after_pull
if not exist "%REPO_ROOT%\.git" (
    echo [!] Not a git checkout; skipping pull.
    goto :after_pull
)
echo [1/7] Pulling the latest main...
git -C "%REPO_ROOT%" pull --ff-only
if errorlevel 1 (
    echo.
    echo [X] git pull failed. Resolve it manually, then deploy again.
    echo.
    pause
    exit /b 1
)
goto :after_pull_printed

:after_pull
echo [1/7] Skipping pull.

:after_pull_printed
REM --- install ---------------------------------------------------------------
echo.
echo [2/7] Installing dependencies...
pushd "%WEB_DIR%"
if exist "package-lock.json" (
    call npm ci
) else (
    call npm install
)
if errorlevel 1 (
    popd
    echo.
    echo [X] Dependency installation failed.
    echo.
    pause
    exit /b 1
)

echo.
echo [3/7] Typechecking...
call npm run typecheck
if errorlevel 1 (
    popd
    echo.
    echo [X] Typecheck failed. Nothing was deployed.
    echo.
    pause
    exit /b 1
)

if defined SKIP_TESTS goto :after_tests
echo.
echo [4/7] Running the test suite...
call npm test
if errorlevel 1 (
    popd
    echo.
    echo [X] Tests failed. Nothing was deployed.
    echo     To deploy anyway (not recommended): deploy.bat --skip-tests
    echo.
    pause
    exit /b 1
)
goto :after_tests_printed

:after_tests
echo.
echo [4/7] Skipping tests.

:after_tests_printed
REM --- stop the service before replacing the build ----------------------------
sc query "%SERVICE_NAME%" >nul 2>&1
if errorlevel 1 (
    echo.
    echo [!] The "%SERVICE_NAME%" service is not installed; building only.
    goto :after_stop
)
echo.
echo [5/7] Stopping the service...
nssm stop "%SERVICE_NAME%" >nul 2>&1

:after_stop
REM --- build -----------------------------------------------------------------
echo.
echo [6/7] Building the server and the client...
call npm run build
if errorlevel 1 (
    popd
    echo.
    echo [X] Build failed. The service was left stopped - fix and re-run.
    echo.
    pause
    exit /b 1
)
popd

REM --- restart ---------------------------------------------------------------
sc query "%SERVICE_NAME%" >nul 2>&1
if errorlevel 1 (
    echo.
    echo [7/7] Build complete. Install the service with deploy\windows\install-service.bat
    echo.
    pause
    exit /b 0
)

echo.
echo [7/7] Starting the service...
nssm start "%SERVICE_NAME%"
if errorlevel 1 (
    echo.
    echo [X] The service failed to start. Check the log:
    echo     %REPO_ROOT%\logs\erp-error.log
    echo.
    pause
    exit /b 1
)

REM --- health check ----------------------------------------------------------
set "PORT=4000"
for /f "usebackq tokens=2 delims==" %%P in (`findstr /b /c:"PORT=" "%WEB_DIR%\.env"`) do set "PORT=%%P"

echo.
where curl.exe >nul 2>&1
if errorlevel 1 (
    echo [!] curl.exe is unavailable; verify manually: http://localhost:%PORT%/api/health
) else (
    echo Waiting for the service to answer...
    for /l %%A in (1,1,15) do (
        if not defined HEALTH_OK (
            curl.exe -fsS -o nul "http://127.0.0.1:%PORT%/api/health" >nul 2>&1
            if not errorlevel 1 (
                set "HEALTH_OK=1"
            ) else (
                timeout /t 1 /nobreak >nul
            )
        )
    )
    if defined HEALTH_OK (
        echo     Health check OK: http://localhost:%PORT%/api/health
    ) else (
        echo     [!] No healthy answer yet. Check %REPO_ROOT%\logs\erp-error.log
    )
)

echo.
echo ============================================================
echo    DEPLOY COMPLETE
echo ============================================================
echo   Open: http://localhost:%PORT%
echo   Logs: %REPO_ROOT%\logs\erp-out.log  /  erp-error.log
echo.
pause
exit /b 0
