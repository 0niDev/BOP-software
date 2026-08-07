"""Business rules for the Chart of Accounts (creation, validation, hierarchy)."""
from __future__ import annotations

from database.connection import DatabaseConnection, get_db
from models.account import Account
from models.enums import AccountType, VoucherType
from repositories.account_repository import AccountRepository
from utils.exceptions import ValidationError
from utils.logger import get_logger

logger = get_logger(__name__)


class AccountService:
    """
    Note on opening balances: setting a non-zero `opening_balance` on an
    account by itself would leave the ledger unbalanced (an asset going
    up with nothing crediting it). To keep the accounting equation valid
    at all times, every non-zero opening balance is immediately posted
    as an OPENING journal entry against the system "Retained Earnings"
    account (3100), mirroring how real double-entry bookkeeping records
    opening/trial balances during initial setup.
    """

    def __init__(self, db: DatabaseConnection | None = None):
        self.db = db or get_db()
        self.repo = AccountRepository(self.db)

    def create_account(
        self,
        account_code: str,
        account_name: str,
        account_type: AccountType | str,  # ← Allow both
        parent_account_id: int | None = None,
        opening_balance: float = 0.0,
        account_subtype: str | None = None,
        company_id: int = 1,
    ) -> Account:
        logger.debug(f"[AccountService] create_account called: code={account_code}, name={account_name}, type={account_type}, parent={parent_account_id}, opening_balance={opening_balance}")
        account_code = account_code.strip()
        account_name = account_name.strip()
        if not account_code:
            logger.error("[AccountService] Validation failed: empty account code")
            raise ValidationError("Account code is required.")
        if not account_name:
            logger.error("[AccountService] Validation failed: empty account name")
            raise ValidationError("Account name is required.")

        # Convert to enum if string
        if isinstance(account_type, str):
            from models.enums import AccountType
            account_type = AccountType(account_type)
            logger.debug(f"[AccountService] Converted account_type string to enum: {account_type}")

        if parent_account_id is not None:
            parent = self.repo.find_by_id(parent_account_id)
            if parent is None:
                logger.error(f"[AccountService] Validation failed: parent account {parent_account_id} not found")
                raise ValidationError("Selected parent account does not exist.")
            if parent["account_type"] != account_type.value:
                logger.error(f"[AccountService] Validation failed: parent account type mismatch (parent={parent['account_type']}, child={account_type.value})")
                raise ValidationError(
                    "A sub-account must have the same account type as its parent."
                )
            logger.debug(f"[AccountService] Parent account validated: {parent_account_id}")

        account = Account(
            account_code=account_code,
            account_name=account_name,
            account_type=account_type,
            parent_account_id=parent_account_id,
            opening_balance=opening_balance,
            account_subtype=account_subtype,
            company_id=company_id,
        )

        with self.db.transaction():
            new_id = self.repo.insert_unique(account.to_insert_dict())
            account.id = new_id
            logger.debug(f"[AccountService] Account inserted with ID: {new_id}")
            if opening_balance:
                logger.debug(f"[AccountService] Non-zero opening balance detected, posting journal entry")
                self._post_opening_balance(account, company_id)

        logger.info(f"[AccountService] Created account {account_code} - {account_name} (id={new_id})")
        return account

    def _post_opening_balance(self, account: Account, company_id: int) -> None:
        # Imported lazily to avoid a circular import (accounting_service
        # itself depends on AccountRepository, not on AccountService).
        from accounting.system_accounts import SystemAccountCodes, SystemAccountResolver
        from services.accounting_service import AccountingService, JournalLine
        import datetime as _dt

        logger.debug(f"[AccountService] _post_opening_balance called for account {account.account_code} with balance {account.opening_balance}")
        
        accounting = AccountingService(self.db)
        resolver = SystemAccountResolver(self.db, company_id)
        equity_account_id = resolver.id_for(SystemAccountCodes.RETAINED_EARNINGS)
        
        logger.debug(f"[AccountService] Equity account ID resolved to: {equity_account_id}")

        # If this account IS the equity account, skip -- avoids a
        # self-referencing entry when seeding equity's own opening balance.
        if account.id == equity_account_id:
            logger.debug(f"[AccountService] Skipping - this account IS the equity account")
            return

        debit_normal = account.account_type.normal_balance_is_debit
        amount = abs(account.opening_balance)
        increases_balance = account.opening_balance > 0
        
        logger.debug(f"[AccountService] debit_normal={debit_normal}, amount={amount}, increases_balance={increases_balance}")

        if debit_normal:
            this_line = JournalLine(account_id=account.id, debit=amount) if increases_balance \
                else JournalLine(account_id=account.id, credit=amount)
            equity_line = JournalLine(account_id=equity_account_id, credit=amount) if increases_balance \
                else JournalLine(account_id=equity_account_id, debit=amount)
        else:
            this_line = JournalLine(account_id=account.id, credit=amount) if increases_balance \
                else JournalLine(account_id=account.id, debit=amount)
            equity_line = JournalLine(account_id=equity_account_id, debit=amount) if increases_balance \
                else JournalLine(account_id=equity_account_id, credit=amount)
        
        logger.debug(f"[AccountService] Created journal lines: this_line={this_line}, equity_line={equity_line}")

        accounting.post_journal_entry(
            voucher_type=VoucherType.OPENING,
            entry_date=_dt.date.today().isoformat(),
            lines=[this_line, equity_line],
            narration=f"Opening balance for {account.account_code} - {account.account_name}",
            source_table="accounts",
            source_id=account.id,
            company_id=company_id,
        )
        
        logger.info(f"[AccountService] Opening balance journal entry posted for account {account.account_code}")

    def update_account(
        self,
        account_id: int,
        account_name: str,
        opening_balance: float,
        parent_account_id: int | None,
        is_active: bool = True,
    ) -> None:
        existing = self.repo.get_by_id(account_id)
        if existing["is_system_account"] and not is_active:
            raise ValidationError("System accounts cannot be deactivated.")
        if not account_name.strip():
            raise ValidationError("Account name is required.")
        self.repo.update(
            account_id,
            {
                "account_name": account_name.strip(),
                "opening_balance": opening_balance,
                "parent_account_id": parent_account_id,
                "is_active": int(is_active),
            },
        )
        logger.info("Updated account id=%s", account_id)

    def deactivate_account(self, account_id: int) -> None:
        account = self.repo.get_by_id(account_id)
        if account["is_system_account"]:
            raise ValidationError("System accounts cannot be deactivated.")
        children = self.repo.find_children(account_id)
        if any(c["is_active"] for c in children):
            raise ValidationError("Cannot deactivate an account that has active sub-accounts.")
        self.repo.deactivate(account_id)
        logger.info("Deactivated account id=%s", account_id)

    def get_account(self, account_id: int) -> Account:
        return Account.from_row(self.repo.get_by_id(account_id))

    def list_accounts(self, company_id: int = 1, active_only: bool = True) -> list[Account]:
        logger.debug(f"[AccountService] list_accounts called: company_id={company_id}, active_only={active_only}")
        cache_key = self.repo._get_cache_key("list_accounts", company_id, active_only)
        cached = self.repo._get_cached(cache_key)
        if cached is not None:
            logger.debug(f"[AccountService] Cache hit for {cache_key}")
            return cached
        
        rows = self.repo.find_all_for_company(company_id, active_only)
        logger.debug(f"[AccountService] Found {len(rows)} accounts from database")
        accounts = [Account.from_row(r) for r in rows]
        
        # Batch fetch all balances in a SINGLE query instead of N+1 queries
        if accounts:
            account_ids = [acc.id for acc in accounts]
            placeholders = ", ".join("?" for _ in account_ids)
            
            # Get all balances at once with a single JOIN query
            balances_data = self.db.fetch_all(f"""
                SELECT 
                    jel.account_id,
                    COALESCE(SUM(jel.debit), 0) AS total_debit,
                    COALESCE(SUM(jel.credit), 0) AS total_credit
                FROM journal_entry_lines jel
                JOIN journal_entries je ON je.id = jel.journal_entry_id
                WHERE jel.account_id IN ({placeholders}) AND je.is_posted = 1
                GROUP BY jel.account_id
            """, account_ids)
            
            logger.debug(f"[AccountService] Fetched balances for {len(balances_data)} accounts")
            
            # Create a lookup map for balances
            balance_map = {}
            for row in balances_data:
                acc_id = row["account_id"]
                # We need account type to determine normal balance
                acc_obj = next((a for a in accounts if a.id == acc_id), None)
                if acc_obj:
                    debit_normal = acc_obj.account_type in ("ASSET", "EXPENSE")
                    if debit_normal:
                        balance_map[acc_id] = row["total_debit"] - row["total_credit"]
                    else:
                        balance_map[acc_id] = row["total_credit"] - row["total_debit"]
                    logger.debug(f"[AccountService] Account {acc_id} ({acc_obj.account_code}): balance={balance_map[acc_id]} (debit_normal={debit_normal})")
            
            # Assign balances to accounts
            for acc in accounts:
                acc.current_balance = balance_map.get(acc.id, 0.0)
        
        self.repo._set_cached(cache_key, accounts)
        logger.debug(f"[AccountService] list_accounts returning {len(accounts)} accounts")
        return accounts

    def list_by_type(self, account_type: AccountType, company_id: int = 1) -> list[Account]:
        rows = self.repo.find_by_type(account_type.value, company_id)
        return [Account.from_row(r) for r in rows]

    def get_balance(self, account_id: int) -> float:
        return self.repo.get_current_balance(account_id)
