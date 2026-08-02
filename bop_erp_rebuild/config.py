# Core Application Configuration
import os
from pathlib import Path

# Base directory
BASE_DIR = Path(__file__).resolve().parent

# SQLiteCloud Configuration
SQLITECLOUD_URL = os.getenv("SQLITECLOUD_URL", "sqlitecloud://user:password@host:port/database")
SQLITECLOUD_API_KEY = os.getenv("SQLITECLOUD_API_KEY", "")

# Application Settings
APP_NAME = "BOP Nutraceuticals ERP"
APP_VERSION = "1.0.0"
COMPANY_NAME = "BOP Nutraceuticals Pvt Ltd"

# Security
PASSWORD_SALT_ROUNDS = 200000  # PBKDF2 iterations
SESSION_TIMEOUT_MINUTES = 30

# Cache Settings
CACHE_TTL_SECONDS = 30

# Report Settings
REPORTS_DIR = BASE_DIR / "reports_output"
REPORTS_DIR.mkdir(exist_ok=True)

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE = BASE_DIR / "erp.log"
