"""
In-process SQLite implementation of the application's ``DatabaseConnection``
interface, used ONLY by the automated GUI test-suite.

The desktop app talks to a hosted SQLite Cloud database through
``database.connection``.  Tests must never touch that live database, so this
class speaks the same small interface (``fetch_all`` / ``fetch_one`` /
``execute`` / ``executemany`` / ``transaction`` / ``last_insert_id``) against a
throwaway local ``sqlite3`` file.  Because every query in the app is plain
SQLite, the same repositories/services/views work unmodified.
"""
from __future__ import annotations

import sqlite3
import threading
from contextlib import contextmanager
from typing import Any, Iterator, Sequence

from database.connection import DatabaseConnection
from utils.exceptions import DatabaseError


class LocalSqliteConnection(DatabaseConnection):
    def __init__(self, path: str):
        self._path = str(path)
        self._lock = threading.RLock()
        # isolation_level=None => autocommit outside explicit BEGIN..COMMIT,
        # matching the per-statement autocommit behaviour of the cloud driver.
        self._conn = sqlite3.connect(
            self._path, check_same_thread=False, isolation_level=None
        )
        self._conn.execute("PRAGMA busy_timeout = 10000")
        self._conn.execute("PRAGMA foreign_keys = OFF")
        self._transaction_conn: sqlite3.Connection | None = None
        self._transaction_depth = 0

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------
    def _target(self) -> sqlite3.Connection:
        return self._transaction_conn if self._transaction_conn is not None else self._conn

    def _raise(self, exc: sqlite3.Error, sql: str) -> None:
        raise DatabaseError(f"{exc} | sql={sql}") from exc

    @staticmethod
    def _columns(cursor) -> list[str]:
        return [d[0] for d in cursor.description] if cursor.description else []

    # ------------------------------------------------------------------
    # DatabaseConnection interface
    # ------------------------------------------------------------------
    def execute(self, sql: str, params: Sequence[Any] = (), return_cursor: bool = False):
        with self._lock:
            conn = self._target()
            try:
                cursor = conn.execute(sql, params)
            except sqlite3.Error as exc:
                self._raise(exc, sql)
            if return_cursor:
                return cursor
            try:
                return cursor.rowcount
            except Exception:
                return None

    def executemany(self, sql: str, seq_of_params: Sequence[Sequence[Any]]):
        with self._lock:
            conn = self._target()
            try:
                cursor = conn.executemany(sql, seq_of_params)
            except sqlite3.Error as exc:
                self._raise(exc, sql)
            return cursor

    def fetch_all(self, sql: str, params: Sequence[Any] = ()) -> list[dict]:
        with self._lock:
            conn = self._target()
            try:
                cursor = conn.execute(sql, params)
                rows = cursor.fetchall()
            except sqlite3.Error as exc:
                self._raise(exc, sql)
            if not rows:
                return []
            cols = self._columns(cursor)
            return [dict(zip(cols, row)) for row in rows]

    def fetch_one(self, sql: str, params: Sequence[Any] = ()) -> dict | None:
        with self._lock:
            conn = self._target()
            try:
                cursor = conn.execute(sql, params)
                row = cursor.fetchone()
            except sqlite3.Error as exc:
                self._raise(exc, sql)
            if row is None:
                return None
            cols = self._columns(cursor)
            return dict(zip(cols, row))

    def last_insert_id(self) -> int:
        with self._lock:
            conn = self._target()
            try:
                cur = conn.execute("SELECT last_insert_rowid()")
                return cur.fetchone()[0]
            except sqlite3.Error as exc:
                self._raise(exc, "SELECT last_insert_rowid()")

    @contextmanager
    def transaction(self) -> Iterator["DatabaseConnection"]:
        with self._lock:
            is_root = self._transaction_conn is None
            conn = self._conn
            if is_root:
                conn.execute("BEGIN")
                self._transaction_conn = conn
                self._transaction_depth = 1
            else:
                self._transaction_depth += 1
                conn.execute(f"SAVEPOINT sp_{self._transaction_depth}")

            try:
                yield self
            except Exception as exc:
                try:
                    if is_root:
                        conn.execute("ROLLBACK")
                    else:
                        conn.execute(f"ROLLBACK TO SAVEPOINT sp_{self._transaction_depth}")
                        conn.execute(f"RELEASE SAVEPOINT sp_{self._transaction_depth}")
                except Exception:
                    pass
                raise
            else:
                if is_root:
                    conn.execute("COMMIT")
                else:
                    conn.execute(f"RELEASE SAVEPOINT sp_{self._transaction_depth}")
            finally:
                if is_root:
                    self._transaction_conn = None
                    self._transaction_depth = 0
                else:
                    self._transaction_depth -= 1

    def close(self) -> None:
        try:
            self._conn.close()
        except Exception:
            pass

    @property
    def path(self) -> str:
        return self._path
