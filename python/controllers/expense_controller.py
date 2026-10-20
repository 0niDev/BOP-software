"""Controller for Expenses - translates service errors to UI messages."""
from __future__ import annotations

from models.expense import Expense, ExpenseCategory
from services.expense_service import ExpenseService
from utils.exceptions import ERPException
from utils.logger import get_logger

logger = get_logger(__name__)


class ExpenseController:
    def __init__(self, expense_service: ExpenseService | None = None):
        self.service = expense_service or ExpenseService()

    # ======================================================================
    # Categories
    # ======================================================================

    def list_categories(self) -> tuple[list[ExpenseCategory], str | None]:
        try:
            categories = self.service.list_categories()
            return categories, None
        except ERPException as exc:
            return [], str(exc)
        except Exception:
            logger.exception("Unexpected error listing categories")
            return [], "An unexpected error occurred."

    def create_category(self, name: str, account_id: int | None = None) -> tuple[bool, str | None]:
        try:
            self.service.create_category(name, account_id)
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error creating category")
            return False, "An unexpected error occurred."

    def update_category(self, category_id: int, name: str, account_id: int | None, is_active: bool) -> tuple[bool, str | None]:
        try:
            self.service.update_category(category_id, name, account_id, is_active)
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error updating category")
            return False, "An unexpected error occurred."

    def delete_category(self, category_id: int) -> tuple[bool, str | None]:
        try:
            self.service.delete_category(category_id)
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error deleting category")
            return False, "An unexpected error occurred."

    # ======================================================================
    # Expenses
    # ======================================================================

    def create_expense(
        self,
        voucher_number: str,
        category_id: int,
        expense_date: str,
        amount: float,
        payment_method: str,
        bank_account_id: int | None = None,
        cheque_id: int | None = None,
        description: str | None = None,
    ) -> tuple[bool, str | None]:
        try:
            self.service.create_expense(
                voucher_number=voucher_number,
                category_id=category_id,
                expense_date=expense_date,
                amount=amount,
                payment_method=payment_method,
                bank_account_id=bank_account_id,
                cheque_id=cheque_id,
                description=description,
            )
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error creating expense")
            return False, "An unexpected error occurred."

    def list_expenses(
        self,
        date_from: str | None = None,
        date_to: str | None = None,
        category_id: int | None = None,
    ) -> tuple[list[dict], str | None]:
        try:
            expenses = self.service.list_expenses(
                date_from=date_from,
                date_to=date_to,
                category_id=category_id,
            )
            return expenses, None
        except ERPException as exc:
            return [], str(exc)
        except Exception:
            logger.exception("Unexpected error listing expenses")
            return [], "An unexpected error occurred."

    def get_expense(self, expense_id: int) -> tuple[Expense | None, str | None]:
        try:
            expense = self.service.get_expense(expense_id)
            return expense, None
        except ERPException as exc:
            return None, str(exc)
        except Exception:
            logger.exception("Unexpected error getting expense")
            return None, "An unexpected error occurred."

    def delete_expense(self, expense_id: int) -> tuple[bool, str | None]:
        try:
            self.service.delete_expense(expense_id)
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error deleting expense")
            return False, "An unexpected error occurred."

    def get_monthly_summary(self, year: int, month: int) -> tuple[dict | None, str | None]:
        try:
            summary = self.service.get_monthly_summary(year, month)
            print(f"📊 Controller: Summary = {summary}")  # Debug
            return summary, None
        except ERPException as exc:
            return None, str(exc)
        except Exception:
            logger.exception("Unexpected error getting summary")
            return None, "An unexpected error occurred."