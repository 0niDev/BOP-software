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
        logger.debug("AccountController initializing")
        self.service = account_service or AccountService()
        logger.debug("AccountController initialized with service")

    def list_accounts(self, active_only: bool = True) -> tuple[list[Account], str | None]:
        logger.debug(f"AccountController.list_accounts() called with active_only={active_only}")
        try:
            accounts = self.service.list_accounts(active_only=active_only)
            logger.debug(f"AccountController.list_accounts() returned {len(accounts)} accounts")
            return accounts, None
        except ERPException as exc:
            logger.error(f"AccountController.list_accounts() ERPException: {exc}")
            return [], str(exc)
        except Exception:
            logger.exception("AccountController.list_accounts() unexpected error")
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
        logger.debug(f"AccountController.create_account() called: code={account_code}, name={account_name}, type={account_type}, opening_balance={opening_balance}")
        try:
            # Convert to enum if string
            if isinstance(account_type, str):
                from models.enums import AccountType
                account_type = AccountType(account_type)
                logger.debug(f"AccountController.create_account() converted type to enum: {account_type}")
            
            self.service.create_account(
                account_code=account_code,
                account_name=account_name,
                account_type=account_type,
                parent_account_id=parent_account_id,
                opening_balance=opening_balance,
            )
            logger.info(f"AccountController.create_account() success for {account_code}")
            return True, None
        except ERPException as exc:
            logger.error(f"AccountController.create_account() ERPException: {exc}")
            return False, str(exc)
        except Exception:
            logger.exception("AccountController.create_account() unexpected error")
            return False, "An unexpected error occurred while creating the account."

    def update_account(
        self,
        account_id: int,
        account_name: str,
        opening_balance: float,
        parent_account_id: int | None,
        is_active: bool,
    ) -> tuple[bool, str | None]:
        logger.debug(f"AccountController.update_account() called: id={account_id}, name={account_name}, opening_balance={opening_balance}")
        try:
            self.service.update_account(
                account_id, account_name, opening_balance, parent_account_id, is_active
            )
            logger.info(f"AccountController.update_account() success for id={account_id}")
            return True, None
        except ERPException as exc:
            logger.error(f"AccountController.update_account() ERPException: {exc}")
            return False, str(exc)
        except Exception:
            logger.exception("AccountController.update_account() unexpected error")
            return False, "An unexpected error occurred while updating the account."

    def deactivate_account(self, account_id: int) -> tuple[bool, str | None]:
        logger.debug(f"AccountController.deactivate_account() called for id={account_id}")
        try:
            self.service.deactivate_account(account_id)
            logger.info(f"AccountController.deactivate_account() success for id={account_id}")
            return True, None
        except ERPException as exc:
            logger.error(f"AccountController.deactivate_account() ERPException: {exc}")
            return False, str(exc)
        except Exception:
            logger.exception("AccountController.deactivate_account() unexpected error")
            return False, "An unexpected error occurred."

    def get_balance(self, account_id: int) -> tuple[float, str | None]:
        """Get the current balance for an account."""
        logger.debug(f"AccountController.get_balance() called for id={account_id}")
        try:
            result = self.service.get_balance(account_id)
            logger.debug(f"AccountController.get_balance() returned {result}")
            return result, None
        except ERPException as exc:
            logger.error(f"AccountController.get_balance() ERPException: {exc}")
            return 0.0, str(exc)
        except Exception:
            logger.exception("AccountController.get_balance() unexpected error")
            return 0.0, "An unexpected error occurred while fetching the balance."
