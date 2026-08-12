"""Business rules for recurring expense items and bulk payment (Pay Items)."""
from __future__ import annotations

from datetime import datetime

from database.connection import DatabaseConnection, get_db
from models.expense import ExpenseItem
from repositories.expense_item_repository import ExpenseItemRepository
from repositories.expense_repository import ExpenseRepository
from repositories.account_repository import AccountRepository
from repositories.journal_repository import JournalRepository
from services.expense_service import ExpenseService
from utils.exceptions import ValidationError
from utils.logger import get_logger

logger = get_logger(__name__)


class ExpenseItemService:
    """Manage per-category recurring expense items and pay them in bulk."""

    def __init__(self, db: DatabaseConnection | None = None):
        self.db = db or get_db()
        self.repo = ExpenseItemRepository(self.db)
        self.expense_repo = ExpenseRepository(self.db)
        self.account_repo = AccountRepository(self.db)
        self.expense_service = ExpenseService(self.db)
        self.journal_repo = JournalRepository(self.db)

    # ======================================================================
    # Item CRUD
    # ======================================================================

    def list_items(self, category_id: int, company_id: int = 1) -> list[ExpenseItem]:
        rows = self.repo.find_all_for_company(company_id, category_id=category_id)
        return [ExpenseItem.from_row(r) for r in rows]

    def create_item(
        self,
        category_id: int,
        name: str,
        amount: float | None = None,
        company_id: int = 1,
    ) -> ExpenseItem:
        name = (name or "").strip()
        if not name:
            raise ValidationError("Item name is required.")
        if amount is not None and amount < 0:
            raise ValidationError("Amount cannot be negative.")
        item = ExpenseItem(
            category_id=category_id, name=name, amount=amount, company_id=company_id
        )
        item.id = self.repo.insert_unique(item.to_dict())
        return item

    def update_item(
        self,
        item_id: int,
        name: str | None = None,
        amount: float | None = None,
    ) -> None:
        changes: dict = {}
        if name is not None:
            name = name.strip()
            if not name:
                raise ValidationError("Item name is required.")
            changes["name"] = name
        if amount is not None:
            if amount < 0:
                raise ValidationError("Amount cannot be negative.")
            changes["amount"] = amount
        if changes:
            changes["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            self.repo.update(item_id, changes)

    def delete_item(self, item_id: int) -> None:
        self.repo.deactivate(item_id)

    # ======================================================================
    # Bulk payment
    # ======================================================================

    def pay_items(
        self,
        company_id: int,
        category_id: int,
        selections: list[dict],
        payment_method: str,
        expense_date: str,
        created_by: int | None = None,
    ) -> list[str]:
        """Pay selected items, one expense voucher each.

        selections: list of ``{"item_id": int, "amount": float,
        "description": str | None}``. Returns the created voucher numbers.

        All DB work is batched into one transaction for minimal round trips.
        """
        if payment_method not in ("CASH", "BANK", "CHEQUE"):
            raise ValidationError("Invalid payment method.")
        if not selections:
            raise ValidationError("No items selected to pay.")

        # Filter to items with positive amount
        valid: list[dict] = []
        for sel in selections:
            amount = float(sel.get("amount") or 0)
            if amount > 0:
                valid.append(sel)
        if not valid:
            raise ValidationError("No valid amounts to pay (all selected amounts are zero).")

        # --- Resolve category + accounts ONCE ---
        category = self.expense_service.get_category(category_id)
        if not category.is_active:
            raise ValidationError("Category is not active.")

        expense_account_id = category.account_id
        if not expense_account_id:
            account = self.account_repo.find_by_code("6000")
            if account:
                expense_account_id = account["id"]
            else:
                from services.account_service import AccountService
                from models.enums import AccountType
                account_service = AccountService(self.db)
                new_account = account_service.create_account(
                    account_code=f"EXP-{category.id:03d}",
                    account_name=f"Expense: {category.name}",
                    account_type=AccountType.EXPENSE,
                    parent_account_id=None,
                    opening_balance=0,
                )
                expense_account_id = new_account.id

        if payment_method == "CASH":
            cash_account = self.account_repo.find_by_code("1000")
            if not cash_account:
                raise ValidationError("Cash account (1000) not found.")
            payment_account_id = cash_account["id"]
        else:
            bank_account = self.account_repo.find_by_code("1010")
            if not bank_account:
                raise ValidationError("Bank account (1010) not found.")
            payment_account_id = bank_account["id"]

        # --- Pre-generate all voucher numbers in one write ---
        from models.enums import VoucherType
        voucher_numbers = self.journal_repo.next_voucher_numbers(
            company_id, VoucherType.JOURNAL.value, len(valid)
        )

        # --- Build all rows in memory ---
        from datetime import datetime as _dt
        now_str = _dt.now().strftime("%Y-%m-%d %H:%M:%S")
        expense_rows: list[dict] = []
        journal_headers: list[dict] = []
        journal_lines: list[list[dict]] = []
        item_updates: list[tuple[int, dict]] = []
        created_vouchers: list[str] = []

        for vn, sel in zip(voucher_numbers, valid):
            item_id = sel["item_id"]
            amount = float(sel["amount"])
            row = self.repo.get_by_id(item_id)
            name = row["name"]
            description = (sel.get("description") or name or "").strip() or name

            # Expense row
            expense_rows.append({
                "company_id": company_id,
                "voucher_number": vn,
                "category_id": category_id,
                "expense_date": expense_date,
                "amount": amount,
                "payment_method": payment_method,
                "description": description,
                "created_by": created_by,
            })

            # Journal header
            journal_headers.append({
                "company_id": company_id,
                "voucher_number": vn,
                "voucher_type": VoucherType.JOURNAL.value,
                "entry_date": expense_date,
                "narration": f"Expense voucher {vn}: {category.name}",
                "source_table": "expenses",
                "is_posted": 1,
                "created_by": created_by,
            })

            # Journal lines: debit expense, credit payment
            journal_lines.append([
                {
                    "account_id": expense_account_id,
                    "debit": round(amount, 2),
                    "credit": 0,
                    "description": f"Expense: {category.name}",
                },
                {
                    "account_id": payment_account_id,
                    "debit": 0,
                    "credit": round(amount, 2),
                    "description": f"Payment for: {category.name}",
                },
            ])

            # Item amount update
            item_updates.append((item_id, {
                "amount": amount,
                "updated_at": now_str,
            }))
            created_vouchers.append(vn)

        # --- Execute everything in one transaction ---
        with self.db.transaction():
            # 1. Batch insert expenses
            expense_ids = self.expense_repo._execute_batch_insert(expense_rows)

            # 2. Link journal headers to expense IDs and batch insert
            for header, eid in zip(journal_headers, expense_ids):
                header["source_id"] = eid
            self.journal_repo.insert_entries_bulk(journal_headers, journal_lines)

            # 3. Batch update item amounts
            if item_updates:
                self.repo._execute_batch_update(item_updates)

        logger.info(
            "Batch paid %d items under category %s (first voucher: %s)",
            len(created_vouchers), category.name, created_vouchers[0] if created_vouchers else "-",
        )
        return created_vouchers
