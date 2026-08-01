"""Controller for the Chart of Accounts screen."""
from __future__ import annotations

from models.account import Account
from models.enums import AccountType
from services.account_service import AccountService
from utils.exceptions import ERPException
from utils.logger import get_logger

logger = get_logger(__name__)


class AccountController:
    def __init__(self, account_service: AccountService | None = None):
        self.service = account_service or AccountService()

    def list_accounts(self, active_only: bool = True) -> tuple[list[Account], str | None]:
        try:
            return self.service.list_accounts(active_only=active_only), None
        except ERPException as exc:
            return [], str(exc)
        except Exception:
            logger.exception("Unexpected error listing accounts")
            return [], "An unexpected error occurred while loading accounts."

    def create_account(
        self,
        account_code: str,
        account_name: str,
        account_type: str | AccountType,  # ← Allow both string and enum
        parent_account_id: int | None,
        opening_balance: float,
    ) -> tuple[bool, str | None]:
        """Attempts to create account."""
        try:
            # Convert to enum if string
            if isinstance(account_type, str):
                from models.enums import AccountType
                account_type = AccountType(account_type)
            
            self.service.create_account(
                account_code=account_code,
                account_name=account_name,
                account_type=account_type,
                parent_account_id=parent_account_id,
                opening_balance=opening_balance,
            )
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error creating account")
            return False, "An unexpected error occurred while creating the account."

    def update_account(
        self,
        account_id: int,
        account_name: str,
        opening_balance: float,
        parent_account_id: int | None,
        is_active: bool,
    ) -> tuple[bool, str | None]:
        try:
            self.service.update_account(
                account_id, account_name, opening_balance, parent_account_id, is_active
            )
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error updating account")
            return False, "An unexpected error occurred while updating the account."

    def deactivate_account(self, account_id: int) -> tuple[bool, str | None]:
        try:
            self.service.deactivate_account(account_id)
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error deactivating account")
            return False, "An unexpected error occurred."
