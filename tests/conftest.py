"""
Shared pytest fixtures for the BOP-software test suite.

Design notes:
- The DB engine is controlled via env vars (ERP_DB_ENGINE / SQLITE_CLOUD_URL)
  and MUST be set before any application module that touches get_db() is
  imported, because config.app_config caches its singleton on first use.
- Never import main.py, seed_data.py or database/auto_backup.py in tests:
  they forcibly overwrite ERP_DB_ENGINE to 'sqlitecloud'.
- Repositories cache aggressively (L1/L2/L3). An autouse fixture clears all
  caches between tests so assertions always read fresh data.
"""
from __future__ import annotations

import os
import re
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# ---------------------------------------------------------------------------
# DB engine configuration -- must run before any app module import
# ---------------------------------------------------------------------------
TEST_DB_ENGINE = os.environ.get("ERP_DB_ENGINE", "sqlitecloud")
os.environ["ERP_DB_ENGINE"] = TEST_DB_ENGINE

if not os.environ.get("SQLITE_CLOUD_URL"):
    # Extract the connection string embedded in main.py so tests don't
    # hardcode credentials that are already version-controlled.
    _main_src = (ROOT / "main.py").read_text(encoding="utf-8")
    _m = re.search(r"os\.environ\['SQLITE_CLOUD_URL'\]\s*=\s*'([^']+)'", _main_src)
    if _m:
        os.environ["SQLITE_CLOUD_URL"] = _m.group(1)

import pytest  # noqa: E402


# ---------------------------------------------------------------------------
# Session-scoped database
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def db():
    """Live database connection with schema ensured (idempotent migrations)."""
    from database.connection import get_db, close_db
    from database.migrations.migrator import run_migrations

    conn = get_db()
    run_migrations(conn)
    yield conn
    close_db()


# ---------------------------------------------------------------------------
# Cache isolation -- autouse so every test sees fresh data
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def clean_caches():
    """Clear repository/session/global caches before and after each test."""
    from utils.cache_manager import CacheManager, SessionCache
    from utils.event_bus import EventBus
    from repositories.base_repository import BaseRepository

    CacheManager.clear_all()
    SessionCache().clear()
    EventBus().clear()
    BaseRepository._cache.clear()
    BaseRepository._session_cache = None
    yield
    CacheManager.clear_all()
    SessionCache().clear()
    EventBus().clear()
    BaseRepository._cache.clear()


# ---------------------------------------------------------------------------
# Unique test-data helpers (safe against a shared live database)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def unique_code():
    """Return a factory producing unique, easy-to-identify test codes."""
    def _factory(prefix: str = "TST") -> str:
        return f"{prefix}-{uuid.uuid4().hex[:10].upper()}"
    return _factory


@pytest.fixture
def cleanup_registry():
    """Track created entity ids per test for reliable teardown."""
    created = {"parties": [], "items": [], "purchase_invoices": [], "sales_invoices": [], "journal_ids": []}
    yield created


# ---------------------------------------------------------------------------
# GUI fixtures -- only created when a test requests them
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def qapp():
    """Offscreen QApplication for Qt widget tests."""
    os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
    from PySide6.QtWidgets import QApplication
    app = QApplication.instance() or QApplication([])
    yield app
