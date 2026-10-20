"""Controller for recurring expense items (Pay Items feature)."""
from __future__ import annotations

from models.expense import ExpenseItem
from services.expense_item_service import ExpenseItemService
from utils.exceptions import ERPException
from utils.logger import get_logger

logger = get_logger(__name__)


class ExpenseItemController:
    def __init__(self, service: ExpenseItemService | None = None):
        self.service = service or ExpenseItemService()

    def list_items(self, category_id: int) -> tuple[list[ExpenseItem], str | None]:
        try:
            return self.service.list_items(category_id), None
        except ERPException as exc:
            return [], str(exc)
        except Exception:
            logger.exception("Unexpected error listing expense items")
            return [], "An unexpected error occurred."

    def create_item(
        self, category_id: int, name: str, amount: float | None = None
    ) -> tuple[ExpenseItem | None, str | None]:
        try:
            return self.service.create_item(category_id, name, amount), None
        except ERPException as exc:
            return None, str(exc)
        except Exception:
            logger.exception("Unexpected error creating expense item")
            return None, "An unexpected error occurred."

    def update_item(
        self, item_id: int, name: str | None = None, amount: float | None = None
    ) -> tuple[bool, str | None]:
        try:
            self.service.update_item(item_id, name, amount)
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error updating expense item")
            return False, "An unexpected error occurred."

    def delete_item(self, item_id: int) -> tuple[bool, str | None]:
        try:
            self.service.delete_item(item_id)
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error deleting expense item")
            return False, "An unexpected error occurred."

    def pay_items(
        self,
        company_id: int,
        category_id: int,
        selections: list[dict],
        payment_method: str,
        expense_date: str,
        created_by: int | None = None,
    ) -> tuple[list[str] | None, str | None]:
        try:
            vouchers = self.service.pay_items(
                company_id,
                category_id,
                selections,
                payment_method,
                expense_date,
                created_by,
            )
            return vouchers, None
        except ERPException as exc:
            return None, str(exc)
        except Exception:
            logger.exception("Unexpected error paying expense items")
            return None, "An unexpected error occurred."
