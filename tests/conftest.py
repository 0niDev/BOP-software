"""
Shared fixtures for the automated test-suite.

Every test runs against a fresh throwaway LOCAL SQLite database seeded with the
real migrations (same as a first app launch) - never the live cloud DB.
Tests call the exact controller/service functions the UI buttons invoke.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

TESTS_DIR = Path(__file__).resolve().parent
ROOT = TESTS_DIR.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
# `tests` must also be importable so `from helpers... import` works.
if str(TESTS_DIR) not in sys.path:
    sys.path.insert(0, str(TESTS_DIR))

# Make sure a stray get_db()/create_connection() can never reach the hosted
# database during a test session.
os.environ.setdefault("ERP_DB_ENGINE", "sqlitecloud")
os.environ.setdefault(
    "SQLITE_CLOUD_URL", "sqlitecloud://127.0.0.1:1/DO-NOT-CONNECT?apikey=none"
)


def _seed_fresh_db(path: str):
    from database.migrations.migrator import Migrator
    from database.migrations.add_material_cost_columns import run_column_migration
    from database.migrations.add_expense_items import run_expense_items_migration
    from database.migrations.add_temp_bom import run_temp_bom_migration
    from helpers.local_connection import LocalSqliteConnection

    conn = LocalSqliteConnection(path)
    Migrator(conn).run()
    run_column_migration(conn)
    run_expense_items_migration(conn)
    run_temp_bom_migration(conn)
    return conn


@pytest.fixture()
def qa_db(tmp_path, monkeypatch):
    """Fresh local DB + point the whole app (get_db) at it."""
    from database import connection as dbconn
    from helpers.local_connection import LocalSqliteConnection

    path = tmp_path / "qa.db"
    conn = _seed_fresh_db(str(path))
    monkeypatch.setattr(dbconn, "_db_instance", conn)
    monkeypatch.setattr(dbconn, "close_db", lambda: None)

    def _local_create_connection(config=None):
        return conn

    monkeypatch.setattr(dbconn, "create_connection", _local_create_connection)
    yield conn
    try:
        conn.close()
    except Exception:
        pass


@pytest.fixture()
def auth(qa_db):
    """Real login via AuthService (what the Login button runs)."""
    from authentication.auth_service import AuthService

    service = AuthService()
    user = service.login("admin", "admin123")
    return service, user


@pytest.fixture()
def admin_user_id(qa_db):
    """id of the seeded admin user, to pass as created_by."""
    return qa_db.fetch_one("SELECT id FROM users WHERE username='admin'")["id"]


@pytest.fixture(autouse=True)
def _clear_app_caches():
    """Per-test fresh DB => drop every cached row that belongs to a previous DB."""
    from repositories.base_repository import BaseRepository
    from utils.cache_manager import SessionCache, _global_cache

    BaseRepository._cache.clear()
    SessionCache().clear()
    _global_cache.clear()
    yield
    BaseRepository._cache.clear()
    SessionCache().clear()
    _global_cache.clear()


@pytest.fixture(autouse=True)
def _cwd(AppSettings_is_ci=None):
    """Ensure we operate from the project root regardless of how pytest is launched."""
    import os
    os.chdir(str(ROOT))
    yield