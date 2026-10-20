@echo off
title Pharmaceutical ERP - Setup
color 0A

echo ============================================================
echo    PHARMACEUTICAL ERP & ACCOUNTING SYSTEM
echo    INSTALLER
echo ============================================================
echo.

:: Check if Python is installed
echo [1/5] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ❌ Python is NOT installed!
    echo.
    echo Please install Python 3.9 or higher from:
    echo https://www.python.org/downloads/
    echo.
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

python --version
echo ✅ Python is installed
echo.

:: Check Python version
echo [2/5] Checking Python version...
python -c "import sys; exit(0) if sys.version_info >= (3,9) else exit(1)"
if errorlevel 1 (
    echo ❌ Python 3.9 or higher is required!
    echo.
    pause
    exit /b 1
)
echo ✅ Python version is compatible
echo.

:: Install dependencies
echo [3/5] Installing dependencies...
echo This may take a few minutes...
echo.

pip install --upgrade pip
pip install -r requirements.txt

if errorlevel 1 (
    echo.
    echo ❌ Failed to install dependencies!
    echo.
    echo Try running: pip install PySide6 openpyxl beautifulsoup4
    echo.
    pause
    exit /b 1
)

echo ✅ Dependencies installed
echo.

:: Create necessary directories
echo [4/5] Creating directories...
if not exist "data" mkdir data
if not exist "backups" mkdir backups
if not exist "logs" mkdir logs
echo ✅ Directories created
echo.

:: Run migrations
echo [5/5] Initializing database...
python -c "from database.connection import get_db; from database.migrations.migrator import run_migrations; run_migrations(get_db())"
if errorlevel 1 (
    echo.
    echo ❌ Failed to initialize database!
    echo.
    pause
    exit /b 1
)
echo ✅ Database initialized
echo.

:: Create desktop shortcut
echo [6/6] Creating desktop shortcut...
set SCRIPT_PATH=%cd%\run.bat
set SHORTCUT_PATH=%USERPROFILE%\Desktop\PharmaERP.lnk

echo Set oWS = WScript.CreateObject("WScript.Shell") > CreateShortcut.vbs
echo Set oLink = oWS.CreateShortcut("%SHORTCUT_PATH%") >> CreateShortcut.vbs
echo oLink.TargetPath = "%SCRIPT_PATH%" >> CreateShortcut.vbs
echo oLink.WorkingDirectory = "%cd%" >> CreateShortcut.vbs
echo oLink.Description = "Pharmaceutical ERP" >> CreateShortcut.vbs
echo oLink.Save >> CreateShortcut.vbs
cscript //nologo CreateShortcut.vbs
del CreateShortcut.vbs
echo ✅ Desktop shortcut created
echo.

echo ============================================================
echo    ✅ INSTALLATION COMPLETE!
echo ============================================================
echo.
echo 🚀 You can now run the application:
echo    - Double-click the "PharmaERP" icon on your desktop
echo    - Or run: python main.py
echo.
echo 🔑 Default Login:
echo    Username: admin
echo    Password: admin123
echo.
echo ⚠️  Please change the default password after first login!
echo.
echo Press any key to exit...
pause >nul
exit /b 0