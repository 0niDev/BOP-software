@echo off
setlocal EnableExtensions
title BOP ERP - Uninstall Windows service

REM ===========================================================================
REM  Stops and removes the BOP-ERP Windows service. The application files, the
REM  database and the logs are left untouched. Run as Administrator.
REM ===========================================================================

set "SERVICE_NAME=BOP-ERP"

echo ============================================================
echo    BOP ERP - UNINSTALL WINDOWS SERVICE
echo ============================================================
echo.

net session >nul 2>&1
if errorlevel 1 (
    echo [X] This script must be run as Administrator.
    echo.
    pause
    exit /b 1
)

where nssm >nul 2>&1
if errorlevel 1 (
    echo [X] NSSM was not found on PATH; it is needed to remove the service.
    echo.
    pause
    exit /b 1
)

sc query "%SERVICE_NAME%" >nul 2>&1
if errorlevel 1 (
    echo The service "%SERVICE_NAME%" is not installed. Nothing to do.
    echo.
    pause
    exit /b 0
)

choice /c YN /m "Stop and remove the service"
if errorlevel 2 (
    echo Cancelled.
    echo.
    pause
    exit /b 0
)

echo Stopping...
nssm stop "%SERVICE_NAME%"

echo Removing...
nssm remove "%SERVICE_NAME%" confirm
if errorlevel 1 (
    echo.
    echo [X] Could not remove the service. Is it still running?
    echo.
    pause
    exit /b 1
)

echo.
echo Service removed. Database, backups and logs were not touched.
echo.
pause
exit /b 0
