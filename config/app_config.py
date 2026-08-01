"""
Central application configuration.

All paths, environment-dependent values and tunables live here so that
no other module hardcodes a file path, connection string or constant.
Values can be overridden by environment variables, which makes it easy
to run the same code base in dev/test/prod or point it at a different
database engine later (MySQL/PostgreSQL) without touching business logic.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

# ---------------------------------------------------------------------------
# Base directories
# ---------------------------------------------------------------------------
BASE_DIR: Path = Path(__file__).resolve().parent.parent
DATA_DIR: Path = BASE_DIR / "data"
LOG_DIR: Path = BASE_DIR / "logs"
BACKUP_DIR: Path = BASE_DIR / "backups"
ASSETS_DIR: Path = BASE_DIR / "assets"

for _dir in (DATA_DIR, LOG_DIR, BACKUP_DIR, ASSETS_DIR):
    _dir.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class DatabaseConfig:
    """
    Database connection configuration.
    
    Supported engines:
    - sqlite: Local SQLite file (single-user)
    - sqlitecloud: SQLite Cloud (multi-user over network)
    - mysql: MySQL/MariaDB
    - postgresql: PostgreSQL
    """
    engine: str = field(default_factory=lambda: os.getenv("ERP_DB_ENGINE", "sqlite"))
    
    # SQLite (local)
    sqlite_path: str = field(
        default_factory=lambda: os.getenv("ERP_DB_PATH", str(DATA_DIR / "erp.db"))
    )
    
    # SQLite Cloud (network)
    sqlite_cloud_url: str = field(
        default_factory=lambda: os.getenv("SQLITE_CLOUD_URL", "")
    )
    
    # MySQL / PostgreSQL
    host: str = field(default_factory=lambda: os.getenv("ERP_DB_HOST", "localhost"))
    port: int = field(default_factory=lambda: int(os.getenv("ERP_DB_PORT", "5432")))
    name: str = field(default_factory=lambda: os.getenv("ERP_DB_NAME", "pharma_erp"))
    user: str = field(default_factory=lambda: os.getenv("ERP_DB_USER", ""))
    password: str = field(default_factory=lambda: os.getenv("ERP_DB_PASSWORD", ""))
    
    foreign_keys: bool = True


@dataclass(frozen=True)
class LoggingConfig:
    level: str = field(default_factory=lambda: os.getenv("ERP_LOG_LEVEL", "INFO"))
    log_file: str = field(default_factory=lambda: str(LOG_DIR / "erp.log"))
    max_bytes: int = 5 * 1024 * 1024
    backup_count: int = 5
    fmt: str = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"


@dataclass(frozen=True)
class BackupConfig:
    backup_dir: str = field(default_factory=lambda: str(BACKUP_DIR))
    auto_backup_enabled: bool = True
    auto_backup_interval_hours: int = 24
    keep_last_n_backups: int = 14


@dataclass(frozen=True)
class AppConfig:
    app_name: str = "BOP nutraceuticals accounts software"
    app_version: str = "1.0.0"
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    backup: BackupConfig = field(default_factory=BackupConfig)
    default_currency: str = "PKR"
    date_format: str = "yyyy-MM-dd"


# Singleton accessor -- import get_config() everywhere instead of
# constructing AppConfig() directly, so the whole app shares one config.
_config: AppConfig | None = None


def get_config() -> AppConfig:
    global _config
    if _config is None:
        _config = AppConfig()
    return _config