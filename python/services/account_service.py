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
        logger.debug(f"AccountService.create_account() called: code={account_code}, name={account_name}, type={account_type}, parent_id={parent_account_id}, opening_balance={opening_balance}")
        account_code = account_code.strip()
        account_name = account_name.strip()
        if not account_code:
            logger.error("AccountService.create_account() validation failed: account_code is empty")
            raise ValidationError("Account code is required.")
        if not account_name:
            logger.error("AccountService.create_account() validation failed: account_name is empty")
            raise ValidationError("Account name is required.")

        # Convert to enum if string
        if isinstance(account_type, str):
            from models.enums import AccountType
            account_type = AccountType(account_type)
            logger.debug(f"AccountService.create_account() converted account_type string to enum: {account_type}")

        if parent_account_id is not None:
            parent = self.repo.find_by_id(parent_account_id)
            if parent is None:
                logger.error(f"AccountService.create_account() validation failed: parent account {parent_account_id} not found")
                raise ValidationError("Selected parent account does not exist.")
            if parent["account_type"] != account_type.value:
                logger.error(f"AccountService.create_account() validation failed: parent type mismatch - parent type={parent['account_type']}, new type={account_type.value}")
                raise ValidationError(
                    "A sub-account must have the same account type as its parent."
                )
            logger.debug(f"AccountService.create_account() parent account validated: id={parent_account_id}")

        account = Account(
            account_code=account_code,
            account_name=account_name,
            account_type=account_type,
            parent_account_id=parent_account_id,
            opening_balance=opening_balance,
            account_subtype=account_subtype,
            company_id=company_id,
        )
        logger.debug(f"AccountService.create_account() Account object created: {account}")

        with self.db.transaction():
            new_id = self.repo.insert_unique(account.to_insert_dict())
            account.id = new_id
            logger.info(f"AccountService.create_account() inserted account with id={new_id}")
            if opening_balance:
                logger.info(f"AccountService.create_account() posting opening balance for account id={new_id}, amount={opening_balance}")
                self._post_opening_balance(account, company_id)
            else:
                logger.debug(f"AccountService.create_account() no opening balance to post (opening_balance={opening_balance})")

        logger.info("Created account %s - %s (id=%s)", account_code, account_name, new_id)
        return account

    def _post_opening_balance(self, account: Account, company_id: int) -> None:
        # Imported lazily to avoid a circular import (accounting_service
        # itself depends on AccountRepository, not on AccountService).
        from accounting.system_accounts import SystemAccountCodes, SystemAccountResolver
        from services.accounting_service import AccountingService, JournalLine
        import datetime as _dt

        logger.debug(f"AccountService._post_opening_balance() called for account id={account.id}, code={account.account_code}, opening_balance={account.opening_balance}")
        accounting = AccountingService(self.db)
        resolver = SystemAccountResolver(self.db, company_id)
        equity_account_id = resolver.id_for(SystemAccountCodes.RETAINED_EARNINGS)
        logger.debug(f"AccountService._post_opening_balance() resolved equity_account_id={equity_account_id}")

        # If this account IS the equity account, skip -- avoids a
        # self-referencing entry when seeding equity's own opening balance.
        if account.id == equity_account_id:
            logger.warning(f"AccountService._post_opening_balance() skipping - account {account.id} IS the equity account")
            return

        debit_normal = account.account_type.normal_balance_is_debit
        amount = abs(account.opening_balance)
        increases_balance = account.opening_balance > 0
        logger.debug(f"AccountService._post_opening_balance() debit_normal={debit_normal}, amount={amount}, increases_balance={increases_balance}")

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

        logger.debug(f"AccountService._post_opening_balance() posting journal entry with lines: this_line={this_line}, equity_line={equity_line}")
        accounting.post_journal_entry(
            voucher_type=VoucherType.OPENING,
            entry_date=_dt.date.today().isoformat(),
            lines=[this_line, equity_line],
            narration=f"Opening balance for {account.account_code} - {account.account_name}",
            source_table="accounts",
            source_id=account.id,
            company_id=company_id,
        )
        logger.info(f"AccountService._post_opening_balance() journal entry posted successfully for account {account.id}")

    def update_account(
        self,
        account_id: int,
        account_name: str,
        opening_balance: float,
        parent_account_id: int | None,
        is_active: bool = True,
    ) -> None:
        logger.debug(f"AccountService.update_account() called: account_id={account_id}, account_name={account_name}, opening_balance={opening_balance}, parent_account_id={parent_account_id}")
        existing = self.repo.get_by_id(account_id)
        if existing is None:
            logger.error(f"AccountService.update_account() account {account_id} not found")
            raise ValidationError("Account not found.")
        if existing["is_system_account"] and not is_active:
            logger.error(f"AccountService.update_account() cannot deactivate system account {account_id}")
            raise ValidationError("System accounts cannot be deactivated.")
        if not account_name.strip():
            logger.error(f"AccountService.update_account() account_name is empty")
            raise ValidationError("Account name is required.")
        
        old_opening = existing["opening_balance"]
        logger.debug(f"AccountService.update_account() old_opening={old_opening}, new_opening={opening_balance}, diff={abs(opening_balance - old_opening)}")
        
        self.repo.update(
            account_id,
            {
                "account_name": account_name.strip(),
                "opening_balance": opening_balance,
                "parent_account_id": parent_account_id,
                "is_active": int(is_active),
            },
        )
        logger.info(f"AccountService.update_account() updated account id={account_id} in database")
        
        # If opening balance changed, create an adjusting journal entry
        if abs(opening_balance - old_opening) > 0.01:
            logger.info(f"AccountService.update_account() opening balance changed, creating adjusting entry for account {account_id}")
            self._adjust_opening_balance(account_id, opening_balance, old_opening, existing["company_id"])
        else:
            logger.debug(f"AccountService.update_account() opening balance unchanged (diff={abs(opening_balance - old_opening)}), skipping adjustment")
        
        logger.info("Updated account id=%s", account_id)

    def _adjust_opening_balance(self, account_id: int, new_balance: float, old_balance: float, company_id: int) -> None:
        """Create adjusting journal entry when opening balance changes."""
        from accounting.system_accounts import SystemAccountCodes, SystemAccountResolver
        from services.accounting_service import AccountingService, JournalLine
        from models.enums import AccountType
        import datetime as _dt
        
        logger.debug(f"AccountService._adjust_opening_balance() called: account_id={account_id}, old_balance={old_balance}, new_balance={new_balance}")
        accounting = AccountingService(self.db)
        resolver = SystemAccountResolver(self.db, company_id)
        equity_account_id = resolver.id_for(SystemAccountCodes.RETAINED_EARNINGS)
        logger.debug(f"AccountService._adjust_opening_balance() resolved equity_account_id={equity_account_id}")
        
        adjustment = new_balance - old_balance
        if abs(adjustment) < 0.01:
            logger.debug(f"AccountService._adjust_opening_balance() adjustment too small ({adjustment}), skipping")
            return
        
        account = self.repo.get_by_id(account_id)
        if not account:
            logger.error(f"AccountService._adjust_opening_balance() account {account_id} not found")
            raise ValidationError("Account not found.")
        
        # Convert account_type string to enum if needed
        account_type = account["account_type"]
        if isinstance(account_type, str):
            account_type = AccountType(account_type)
        
        debit_normal = account_type.normal_balance_is_debit
        amount = abs(adjustment)
        logger.debug(f"AccountService._adjust_opening_balance() account_type={account_type}, debit_normal={debit_normal}, adjustment={adjustment}, amount={amount}")
        
        # Determine direction of adjustment
        if adjustment > 0:
            # Increasing the balance
            if debit_normal:
                this_line = JournalLine(account_id=account_id, debit=amount)
                equity_line = JournalLine(account_id=equity_account_id, credit=amount)
            else:
                this_line = JournalLine(account_id=account_id, credit=amount)
                equity_line = JournalLine(account_id=equity_account_id, debit=amount)
        else:
            # Decreasing the balance
            if debit_normal:
                this_line = JournalLine(account_id=account_id, credit=amount)
                equity_line = JournalLine(account_id=equity_account_id, debit=amount)
            else:
                this_line = JournalLine(account_id=account_id, debit=amount)
                equity_line = JournalLine(account_id=equity_account_id, credit=amount)
        
        logger.debug(f"AccountService._adjust_opening_balance() posting adjusting journal entry: this_line={this_line}, equity_line={equity_line}")
        accounting.post_journal_entry(
            voucher_type=VoucherType.OPENING,
            entry_date=_dt.date.today().isoformat(),
            lines=[this_line, equity_line],
            narration=f"Adjustment to opening balance for {account['account_code']} - {account['account_name']}",
            source_table="accounts",
            source_id=account_id,
            company_id=company_id,
        )
        logger.info(f"AccountService._adjust_opening_balance() adjusting entry posted successfully for account {account_id}")

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
        cache_key = self.repo._get_cache_key("list_accounts", company_id, active_only)
        cached = self.repo._get_cached(cache_key)
        if cached is not None:
            return cached
        
        rows = self.repo.find_all_for_company(company_id, active_only)
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
            
            # Assign balances to accounts
            for acc in accounts:
                acc.current_balance = balance_map.get(acc.id, 0.0)
        
        self.repo._set_cached(cache_key, accounts)
        return accounts

    def list_by_type(self, account_type: AccountType, company_id: int = 1) -> list[Account]:
        rows = self.repo.find_by_type(account_type.value, company_id)
        return [Account.from_row(r) for r in rows]

    def get_balance(self, account_id: int) -> float:
        return self.repo.get_current_balance(account_id)
