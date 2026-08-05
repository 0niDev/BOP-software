"""
Central application configuration for SQLite Cloud-optimized ERP.

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
BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
DATA_DIR: Path = BASE_DIR / "data"
LOG_DIR: Path = BASE_DIR / "logs"
BACKUP_DIR: Path = BASE_DIR / "backups"
ASSETS_DIR: Path = BASE_DIR / "assets"

for _dir in (DATA_DIR, LOG_DIR, BACKUP_DIR, ASSETS_DIR):
    _dir.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class DatabaseConfig:
    """
    Database connection configuration optimized for SQLite Cloud.
    
    Connection Pool Settings:
    - min_connections: Minimum connections to keep warm (10)
    - max_connections: Maximum connections in pool (50)
    - connection_timeout: Timeout for acquiring connection (30s)
    - idle_timeout: Close idle connections after (300s)
    
    Performance Settings:
    - query_timeout: Max time for query execution (60s)
    - retry_attempts: Number of retries on failure (3)
    - retry_delay: Initial delay between retries (0.1s)
    """
    engine: str = field(default_factory=lambda: os.getenv("ERP_DB_ENGINE", "sqlitecloud"))
    
    # SQLite Cloud (primary - network)
    sqlite_cloud_url: str = field(
        default_factory=lambda: os.getenv("SQLITE_CLOUD_URL", "")
    )
    
    # SQLite (local fallback)
    sqlite_path: str = field(
        default_factory=lambda: os.getenv("ERP_DB_PATH", str(DATA_DIR / "erp.db"))
    )
    
    # Connection Pool Settings - Optimized for 10+ concurrent users
    min_connections: int = field(default_factory=lambda: int(os.getenv("ERP_DB_POOL_MIN", "10")))
    max_connections: int = field(default_factory=lambda: int(os.getenv("ERP_DB_POOL_MAX", "50")))
    connection_timeout: float = field(default_factory=lambda: float(os.getenv("ERP_DB_POOL_TIMEOUT", "30")))
    idle_timeout: float = field(default_factory=lambda: float(os.getenv("ERP_DB_IDLE_TIMEOUT", "300")))
    
    # Query & Retry Settings - Optimized for network latency (50-200ms)
    query_timeout: float = field(default_factory=lambda: float(os.getenv("ERP_DB_QUERY_TIMEOUT", "60")))
    retry_attempts: int = field(default_factory=lambda: int(os.getenv("ERP_DB_RETRY_ATTEMPTS", "3")))
    retry_delay: float = field(default_factory=lambda: float(os.getenv("ERP_DB_RETRY_DELAY", "0.1")))
    retry_max_delay: float = field(default_factory=lambda: float(os.getenv("ERP_DB_RETRY_MAX_DELAY", "10")))
    
    # Performance Monitoring
    slow_query_threshold_ms: int = field(default_factory=lambda: int(os.getenv("ERP_DB_SLOW_QUERY_MS", "100")))
    enable_query_logging: bool = field(default_factory=lambda: os.getenv("ERP_DB_LOG_QUERIES", "true").lower() == "true")
    
    # Standard settings
    foreign_keys: bool = True
    host: str = field(default_factory=lambda: os.getenv("ERP_DB_HOST", "localhost"))
    port: int = field(default_factory=lambda: int(os.getenv("ERP_DB_PORT", "5432")))
    name: str = field(default_factory=lambda: os.getenv("ERP_DB_NAME", "pharma_erp"))
    user: str = field(default_factory=lambda: os.getenv("ERP_DB_USER", ""))
    password: str = field(default_factory=lambda: os.getenv("ERP_DB_PASSWORD", ""))


@dataclass(frozen=True)
class LoggingConfig:
    level: str = field(default_factory=lambda: os.getenv("ERP_LOG_LEVEL", "INFO"))
    log_file: str = field(default_factory=lambda: str(LOG_DIR / "erp.log"))
    max_bytes: int = 5 * 1024 * 1024
    backup_count: int = 5
    fmt: str = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    
    # Additional logging for performance monitoring
    log_slow_queries: bool = True
    slow_query_threshold_ms: int = 100


@dataclass(frozen=True)
class CacheConfig:
    """
    Multi-level cache configuration.
    
    L1 Cache: In-memory, per-process, fastest (microseconds)
    L2 Cache: Disk-based, shared across processes, slower (milliseconds)
    L3 Cache: Distributed (Redis), shared across nodes, slowest (tens of ms)
    """
    # L1 Cache Settings
    l1_enabled: bool = True
    l1_max_size: int = 10000  # Maximum items in L1 cache
    l1_ttl_seconds: int = 60  # Default TTL for L1 cache
    
    # L2 Cache Settings (disk-based using SQLite)
    l2_enabled: bool = True
    l2_path: str = field(default_factory=lambda: str(DATA_DIR / "cache.db"))
    l2_max_size_mb: int = 100
    l2_ttl_seconds: int = 300  # 5 minutes for L2 cache
    
    # L3 Cache Settings (distributed - Redis compatible)
    l3_enabled: bool = False
    l3_host: str = "localhost"
    l3_port: int = 6379
    l3_ttl_seconds: int = 600  # 10 minutes for L3 cache
    
    # Cache Invalidation
    invalidate_on_write: bool = True
    batch_invalidation: bool = True


@dataclass(frozen=True)
class BackupConfig:
    backup_dir: str = field(default_factory=lambda: str(BACKUP_DIR))
    auto_backup_enabled: bool = True
    auto_backup_interval_hours: int = 24
    keep_last_n_backups: int = 14
    compression_enabled: bool = True


@dataclass(frozen=True)
class PerformanceConfig:
    """Performance tuning parameters."""
    # Batch operation settings
    batch_insert_size: int = 100  # Rows per batch insert
    batch_update_size: int = 100
    batch_delete_size: int = 100
    
    # Pagination settings
    default_page_size: int = 50
    max_page_size: int = 500
    
    # Loading thresholds
    progressive_render_threshold: int = 100  # Items before progressive rendering kicks in
    skeleton_display_delay_ms: int = 200  # Show skeleton after this delay
    
    # Connection health
    connection_health_check_interval: int = 60  # Seconds between health checks
    connection_max_age: int = 3600  # Max age of connection before refresh


@dataclass(frozen=True)
class AppConfig:
    app_name: str = "BOP nutraceuticals accounts software"
    app_version: str = "2.0.0-rebuild"
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)
    cache: CacheConfig = field(default_factory=CacheConfig)
    backup: BackupConfig = field(default_factory=BackupConfig)
    performance: PerformanceConfig = field(default_factory=PerformanceConfig)
    default_currency: str = "PKR"
    date_format: str = "yyyy-MM-dd"


# Singleton accessor
_config: AppConfig | None = None


def get_config() -> AppConfig:
    global _config
    if _config is None:
        _config = AppConfig()
    return _config


def reset_config() -> None:
    """Reset config singleton - useful for testing."""
    global _config
    _config = None
