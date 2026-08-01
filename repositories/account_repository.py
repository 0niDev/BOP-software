"""Data access for the Chart of Accounts, including running-balance lookups."""
from __future__ import annotations

from repositories.base_repository import BaseRepository
from utils.exceptions import DuplicateRecordError


class AccountRepository(BaseRepository):
    table_name = "accounts"

    def find_by_code(self, account_code: str, company_id: int = 1) -> dict | None:
        cache_key = self._get_cache_key("find_by_code", account_code, company_id)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached
        
        result = self.db.fetch_one(
            "SELECT * FROM accounts WHERE account_code = ? AND company_id = ?",
            (account_code, company_id),
        )
        if result:
            self._set_cached(cache_key, result)
        return result

    def code_exists(self, account_code: str, company_id: int = 1, exclude_id: int | None = None) -> bool:
        sql = "SELECT id FROM accounts WHERE account_code = ? AND company_id = ?"
        params: tuple = (account_code, company_id)
        if exclude_id is not None:
            sql += " AND id != ?"
            params += (exclude_id,)
        return self.db.fetch_one(sql, params) is not None

    def find_all_for_company(self, company_id: int = 1, active_only: bool = True) -> list[dict]:
        cache_key = self._get_cache_key("find_all_for_company", company_id, active_only)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached
        
        sql = "SELECT * FROM accounts WHERE company_id = ?"
        params: tuple = (company_id,)
        if active_only:
            sql += " AND is_active = 1"
        sql += " ORDER BY account_code"
        result = self.db.fetch_all(sql, params)
        self._set_cached(cache_key, result)
        return result

    def find_by_type(self, account_type: str, company_id: int = 1) -> list[dict]:
        cache_key = self._get_cache_key("find_by_type", account_type, company_id)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached
        
        result = self.db.fetch_all(
            "SELECT * FROM accounts WHERE account_type = ? AND company_id = ? "
            "AND is_active = 1 ORDER BY account_code",
            (account_type, company_id),
        )
        self._set_cached(cache_key, result)
        return result

    def find_children(self, parent_account_id: int) -> list[dict]:
        cache_key = self._get_cache_key("find_children", parent_account_id)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached
        
        result = self.db.fetch_all(
            "SELECT * FROM accounts WHERE parent_account_id = ? ORDER BY account_code",
            (parent_account_id,),
        )
        self._set_cached(cache_key, result)
        return result

    def get_current_balance(self, account_id: int) -> float:
        """
        Current balance = sum(debits) - sum(credits) for debit-normal
        accounts (ASSET/EXPENSE), or the mirror image for credit-normal
        accounts (LIABILITY/EQUITY/REVENUE), read directly from posted
        journal_entry_lines.

        Note: `accounts.opening_balance` is NOT added here. It is a
        display/reference field only -- AccountService posts every
        non-zero opening balance as its own OPENING journal entry (see
        AccountService._post_opening_balance) so it already flows
        through journal_entry_lines. Adding the column value on top
        would double-count it.
        """
        cache_key = self._get_cache_key("get_current_balance", account_id)
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached
        
        account = self.get_by_id(account_id)
        totals = self.db.fetch_one(
            """
            SELECT COALESCE(SUM(debit), 0) AS total_debit,
                   COALESCE(SUM(credit), 0) AS total_credit
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            WHERE jel.account_id = ? AND je.is_posted = 1
            """,
            (account_id,),
        )
        debit_total = totals["total_debit"]
        credit_total = totals["total_credit"]

        debit_normal = account["account_type"] in ("ASSET", "EXPENSE")
        if debit_normal:
            balance = debit_total - credit_total
        else:
            balance = credit_total - debit_total
        
        self._set_cached(cache_key, balance)
        return balance

    def insert_unique(self, data: dict) -> int:
        if self.code_exists(data["account_code"], data.get("company_id", 1)):
            raise DuplicateRecordError(
                f"Account code '{data['account_code']}' already exists."
            )
        return self.insert(data)
