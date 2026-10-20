"""Data access for Banking."""
from __future__ import annotations

from repositories.base_repository import BaseRepository


class BankAccountRepository(BaseRepository):
    table_name = "bank_accounts"

    def find_all_for_company(self, company_id: int = 1, active_only: bool = True) -> list[dict]:
        sql = "SELECT * FROM bank_accounts WHERE company_id = ?"
        params = [company_id]
        if active_only:
            sql += " AND is_active = 1"
        sql += " ORDER BY bank_name"
        return self.db.fetch_all(sql, tuple(params))

    def find_by_account_id(self, account_id: int) -> dict | None:
        return self.db.fetch_one(
            "SELECT * FROM bank_accounts WHERE account_id = ?",
            (account_id,)
        )
    def find_by_account_number(self, account_number: str, company_id: int = 1) -> dict | None:
        """Find bank account by account number."""
        return self.db.fetch_one(
            "SELECT * FROM bank_accounts WHERE account_number = ? AND company_id = ?",
            (account_number, company_id)
        )


class BankTransactionRepository(BaseRepository):
    table_name = "bank_transactions"

    def find_by_bank_account(self, bank_account_id: int) -> list[dict]:
        return self.db.fetch_all(
            "SELECT * FROM bank_transactions WHERE bank_account_id = ? ORDER BY transaction_date DESC",
            (bank_account_id,)
        )


class ChequeRepository(BaseRepository):
    table_name = "cheques"

    def find_by_party(self, party_id: int) -> list[dict]:
        return self.db.fetch_all(
            "SELECT * FROM cheques WHERE party_id = ? ORDER BY cheque_date DESC",
            (party_id,)
        )

    def find_by_status(self, status: str) -> list[dict]:
        return self.db.fetch_all(
            "SELECT * FROM cheques WHERE status = ? ORDER BY cheque_date DESC",
            (status,)
        )

    def find_all_for_company(self, company_id: int = 1) -> list[dict]:
        return self.db.fetch_all(
            "SELECT * FROM cheques WHERE company_id = ? ORDER BY cheque_date DESC",
            (company_id,)
        )




