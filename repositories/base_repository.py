"""
Generic base repository.

Every entity-specific repository (AccountRepository, ItemRepository,
PartyRepository, ...) extends this class and gets consistent CRUD,
consistent error handling, and a single injected DatabaseConnection --
so switching the underlying engine later means changing
database/connection.py only, never any repository.
"""
from __future__ import annotations

from typing import Any, Generic, TypeVar

from database.connection import DatabaseConnection, get_db
from utils.exceptions import DatabaseError, RecordNotFoundError
from utils.logger import get_logger

T = TypeVar("T")

logger = get_logger(__name__)


class BaseRepository(Generic[T]):
    #: Must be overridden by subclasses with the physical table name.
    table_name: str = ""
    #: Primary key column name.
    pk_column: str = "id"

    def __init__(self, db: DatabaseConnection | None = None):
        if not self.table_name:
            raise ValueError(f"{self.__class__.__name__} must define table_name")
        self.db = db or get_db()
        self.logger = get_logger(self.__class__.__module__)

    # ------------------------------------------------------------------
    # Generic CRUD
    # ------------------------------------------------------------------
    def find_by_id(self, record_id: int) -> dict | None:
        return self.db.fetch_one(
            f"SELECT * FROM {self.table_name} WHERE {self.pk_column} = ?", (record_id,)
        )

    def get_by_id(self, record_id: int) -> dict:
        row = self.find_by_id(record_id)
        if row is None:
            raise RecordNotFoundError(
                f"{self.table_name} record with id={record_id} not found"
            )
        return row

    def find_all(self, active_only: bool = False, order_by: str | None = None) -> list[dict]:
        sql = f"SELECT * FROM {self.table_name}"
        if active_only:
            sql += " WHERE is_active = 1"
        if order_by:
            sql += f" ORDER BY {order_by}"
        return self.db.fetch_all(sql)

    def insert(self, data: dict[str, Any]) -> int:
        columns = list(data.keys())
        placeholders = ", ".join("?" for _ in columns)
        col_list = ", ".join(columns)
        sql = f"INSERT INTO {self.table_name} ({col_list}) VALUES ({placeholders})"
        try:
            self.db.execute(sql, tuple(data.values()))
            return self.db.last_insert_id()
        except DatabaseError:
            self.logger.exception("Insert failed on %s", self.table_name)
            raise

    def update(self, record_id: int, data: dict[str, Any]) -> None:
        if not data:
            return
        set_clause = ", ".join(f"{col} = ?" for col in data.keys())
        sql = f"UPDATE {self.table_name} SET {set_clause} WHERE {self.pk_column} = ?"
        try:
            self.db.execute(sql, tuple(data.values()) + (record_id,))
        except DatabaseError:
            self.logger.exception("Update failed on %s id=%s", self.table_name, record_id)
            raise

    def delete(self, record_id: int) -> None:
        """Physical delete -- prefer `deactivate` for business entities."""
        self.db.execute(
            f"DELETE FROM {self.table_name} WHERE {self.pk_column} = ?", (record_id,)
        )

    def deactivate(self, record_id: int) -> None:
        """Soft delete -- preserves history/ledger integrity."""
        self.update(record_id, {"is_active": 0})

    def exists(self, record_id: int) -> bool:
        return self.find_by_id(record_id) is not None

    def count(self, where_clause: str = "", params: tuple = ()) -> int:
        sql = f"SELECT COUNT(*) c FROM {self.table_name}"
        if where_clause:
            sql += f" WHERE {where_clause}"
        row = self.db.fetch_one(sql, params)
        return row["c"] if row else 0
