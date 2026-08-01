"""
Lookup helper for the fixed system-account codes seeded by the migrator
(see database/migrations/migrator.py -> SYSTEM_ACCOUNTS).

Other services (sales, purchases, banking, manufacturing, expenses)
resolve the account they need to post against by *code*, never by a
hardcoded numeric id, since ids can differ between environments while
codes are guaranteed by the seed data.
"""
from __future__ import annotations

from database.connection import DatabaseConnection, get_db
from repositories.account_repository import AccountRepository
from utils.exceptions import ConfigurationError


class SystemAccountCodes:
    CASH_IN_HAND = "1000"
    BANK_ACCOUNTS = "1010"
    ACCOUNTS_RECEIVABLE = "1100"
    INVENTORY_RAW_MATERIALS = "1200"
    INVENTORY_PACKING_MATERIALS = "1210"
    INVENTORY_FINISHED_GOODS = "1220"
    WITHHOLDING_TAX_RECEIVABLE = "1300"
    ACCOUNTS_PAYABLE = "2000"
    SALES_TAX_PAYABLE = "2100"
    WITHHOLDING_TAX_PAYABLE = "2200"
    OWNERS_EQUITY = "3000"
    RETAINED_EARNINGS = "3100"
    SALES_REVENUE = "4000"
    SALES_RETURNS = "4100"
    COST_OF_GOODS_SOLD = "5000"
    PURCHASE_RETURNS = "5100"
    MANUFACTURING_WASTAGE_EXPENSE = "5200"
    INVENTORY_LOSS_EXPENSE = "5300"
    GENERAL_ADMIN_EXPENSE = "6000"


class SystemAccountResolver:
    """Resolves system account codes to their database id, with caching."""

    def __init__(self, db: DatabaseConnection | None = None, company_id: int = 1):
        self.db = db or get_db()
        self.company_id = company_id
        self._repo = AccountRepository(self.db)
        self._cache: dict[str, int] = {}

    def id_for(self, code: str) -> int:
        if code in self._cache:
            return self._cache[code]
        account = self._repo.find_by_code(code, self.company_id)
        if account is None:
            raise ConfigurationError(
                f"Required system account '{code}' is missing. "
                "Run database migrations to seed the default chart of accounts."
            )
        self._cache[code] = account["id"]
        return account["id"]
