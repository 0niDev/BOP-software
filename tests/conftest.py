"""
Shared fixtures for the integration test-suite.

Every test runs against a fresh throwaway LOCAL SQLite database seeded with the
real migrations (same as a first app launch) - never the live SQLite Cloud DB.
Tests call the exact controller/service functions the UI buttons invoke.
"""
from __future__ import annotations

import io
import logging
import os
import sys
from pathlib import Path

import pytest

TESTS_DIR = Path(__file__).resolve().parent
LOG_OUTPUT_DIR = TESTS_DIR / "_logs"
LOG_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Make the project root importable no matter how pytest is launched.
ROOT = TESTS_DIR.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Make sure a stray get_db()/create_connection() can never reach the hosted
# database during a test session.
os.environ["ERP_DB_ENGINE"] = "sqlitecloud"
os.environ["SQLITE_CLOUD_URL"] = "sqlitecloud://127.0.0.1:1/DO-NOT-CONNECT?apikey=none"


def _tolerant_console() -> None:
    # Several app modules `print()` emoji/debug text.  On a cp1252 Windows
    # console that raises UnicodeEncodeError inside the printing thread.  Make
    # the std streams replace un-encodable chars instead of crashing.
    for stream in (sys.stdout, sys.stderr):
        if stream is None:
            continue
        try:
            stream.reconfigure(errors="backslashreplace")
        except Exception:
            pass


_tolerant_console()


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
    """Real login via AuthController (what the Login button runs)."""
    from controllers.auth_controller import AuthController

    controller = AuthController()
    user, error = controller.login("admin", "admin123")
    assert user is not None and not error, f"login failed: {error}"
    return controller, user


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
def _capture_logs(request):
    """Write every ERP log line emitted during a test to tests/_logs/<node>.log."""
    root = logging.getLogger("erp")
    buf = io.StringIO()
    handler = logging.StreamHandler(buf)
    handler.setFormatter(
        logging.Formatter("%(asctime)s | %(levelname)-8s | %(name)s | %(message)s")
    )
    root.addHandler(handler)
    yield
    root.removeHandler(handler)
    node = request.node.nodeid.replace("/", "_").replace("\\", "_").replace("::", "__")
    path = LOG_OUTPUT_DIR / f"{node}.log"
    text = buf.getvalue()
    lines = text.splitlines()
    if len(lines) > 8000:
        lines = lines[-8000:]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


from helpers.local_connection import LocalSqliteConnection  # noqa: E402
