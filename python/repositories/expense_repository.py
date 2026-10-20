"""Data access for Expenses."""
from __future__ import annotations

from repositories.base_repository import BaseRepository
from utils.exceptions import DuplicateRecordError


class ExpenseCategoryRepository(BaseRepository):
    table_name = "expense_categories"

    def find_by_name(self, name: str, company_id: int = 1) -> dict | None:
        return self.db.fetch_one(
            "SELECT * FROM expense_categories WHERE name = ? AND company_id = ?",
            (name, company_id),
        )

    def find_all_for_company(self, company_id: int = 1, active_only: bool = True) -> list[dict]:
        sql = "SELECT * FROM expense_categories WHERE company_id = ?"
        params = [company_id]
        if active_only:
            sql += " AND is_active = 1"
        sql += " ORDER BY name"
        return self.db.fetch_all(sql, tuple(params))

    def insert_unique(self, data: dict) -> int:
        if self.find_by_name(data["name"], data.get("company_id", 1)):
            raise DuplicateRecordError(
                f"Expense category '{data['name']}' already exists."
            )
        return self.insert(data)


class ExpenseRepository(BaseRepository):
    table_name = "expenses"

    def find_by_number(self, voucher_number: str, company_id: int = 1) -> dict | None:
        return self.db.fetch_one(
            "SELECT * FROM expenses WHERE voucher_number = ? AND company_id = ?",
            (voucher_number, company_id),
        )

    def number_exists(self, voucher_number: str, company_id: int = 1, exclude_id: int | None = None) -> bool:
        sql = "SELECT id FROM expenses WHERE voucher_number = ? AND company_id = ?"
        params = (voucher_number, company_id)
        if exclude_id is not None:
            sql += " AND id != ?"
            params += (exclude_id,)
        return self.db.fetch_one(sql, params) is not None

    def find_all_for_company(
        self,
        company_id: int = 1,
        date_from: str | None = None,
        date_to: str | None = None,
        category_id: int | None = None,
    ) -> list[dict]:
        sql = """
            SELECT e.*, ec.name as category_name
            FROM expenses e
            JOIN expense_categories ec ON ec.id = e.category_id
            WHERE e.company_id = ?
        """
        params = [company_id]

        if date_from:
            sql += " AND e.expense_date >= ?"
            params.append(date_from)
        if date_to:
            sql += " AND e.expense_date <= ?"
            params.append(date_to)
        if category_id:
            sql += " AND e.category_id = ?"
            params.append(category_id)

        sql += " ORDER BY e.expense_date DESC, e.id DESC"
        return self.db.fetch_all(sql, tuple(params))

    def insert_unique(self, data: dict) -> int:
        if self.number_exists(data["voucher_number"], data.get("company_id", 1)):
            raise DuplicateRecordError(
                f"Voucher number '{data['voucher_number']}' already exists."
            )
        return self.insert(data)