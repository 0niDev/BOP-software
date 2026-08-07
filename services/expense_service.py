"""Business rules for Expenses - with automatic accounting."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from database.connection import DatabaseConnection, get_db
from models.enums import VoucherType
from models.expense import Expense, ExpenseCategory
from repositories.expense_repository import ExpenseRepository, ExpenseCategoryRepository
from repositories.account_repository import AccountRepository
# REMOVE: from repositories.bank_account_repository import BankAccountRepository
from services.accounting_service import AccountingService, JournalLine
from utils.exceptions import ValidationError
from utils.logger import get_logger
from utils.activity_logger import log_expense_created

logger = get_logger(__name__)


class ExpenseService:
    """Service for managing expenses with automatic accounting."""

    def __init__(self, db: DatabaseConnection | None = None):
        self.db = db or get_db()
        self.category_repo = ExpenseCategoryRepository(self.db)
        self.expense_repo = ExpenseRepository(self.db)
        self.account_repo = AccountRepository(self.db)
        # REMOVE: self.bank_account_repo = BankAccountRepository(self.db)
        self.accounting_service = AccountingService(self.db)

    # ======================================================================
    # Expense Categories
    # ======================================================================

    def create_category(self, name: str, account_id: int | None = None, company_id: int = 1) -> ExpenseCategory:
        """Create a new expense category."""
        name = name.strip()
        if not name:
            raise ValidationError("Category name is required.")

        # Validate account if provided
        if account_id:
            account = self.account_repo.get_by_id(account_id)
            if account["account_type"] != "EXPENSE":
                raise ValidationError("Account must be of type EXPENSE.")

        category = ExpenseCategory(
            name=name,
            account_id=account_id,
            company_id=company_id,
        )

        with self.db.transaction():
            category.id = self.category_repo.insert_unique(category.to_dict())

        logger.info("Created expense category: %s (ID: %s)", name, category.id)
        return category

    def list_categories(self, company_id: int = 1, active_only: bool = True) -> list[ExpenseCategory]:
        """List all expense categories."""
        rows = self.category_repo.find_all_for_company(company_id, active_only)
        return [ExpenseCategory.from_row(row) for row in rows]

    def get_category(self, category_id: int) -> ExpenseCategory:
        """Get category by ID."""
        row = self.category_repo.get_by_id(category_id)
        return ExpenseCategory.from_row(row)

    def update_category(self, category_id: int, name: str, account_id: int | None, is_active: bool) -> None:
        """Update expense category."""
        if not name.strip():
            raise ValidationError("Category name is required.")

        self.category_repo.update(
            category_id,
            {
                "name": name.strip(),
                "account_id": account_id,
                "is_active": int(is_active),
            }
        )
        logger.info("Updated expense category ID: %s", category_id)

    def delete_category(self, category_id: int) -> None:
        """Deactivate expense category."""
        # Check if category has expenses
        expenses = self.expense_repo.find_all_for_company(category_id=category_id)
        if expenses:
            raise ValidationError("Cannot delete category with existing expenses.")

        self.category_repo.deactivate(category_id)
        logger.info("Deactivated expense category ID: %s", category_id)

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
        company_id: int = 1,
        created_by: int | None = None,
    ) -> Expense:
        """Create an expense with automatic journal entry."""
        # Validate inputs
        voucher_number = voucher_number.strip()
        if not voucher_number:
            raise ValidationError("Voucher number is required.")
        if amount <= 0:
            raise ValidationError("Amount must be greater than 0.")
        if payment_method not in ["CASH", "BANK", "CHEQUE"]:
            raise ValidationError("Invalid payment method.")

        # Validate category
        category = self.get_category(category_id)
        if not category.is_active:
            raise ValidationError("Category is not active.")

        # Get expense account
        expense_account_id = category.account_id
        if not expense_account_id:
            # If no account linked, try to find/default expense account
            account = self.account_repo.find_by_code("6000")  # General & Admin Expenses
            if account:
                expense_account_id = account["id"]
            else:
                # Create a default expense account
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

        # Get payment account - FIXED: Use Cash or default bank account
        if payment_method == "CASH":
            cash_account = self.account_repo.find_by_code("1000")
            if not cash_account:
                raise ValidationError("Cash account (1000) not found.")
            payment_account_id = cash_account["id"]
        else:
            # For BANK or CHEQUE, use Bank Accounts (1010)
            bank_account = self.account_repo.find_by_code("1010")
            if not bank_account:
                raise ValidationError("Bank account (1010) not found.")
            payment_account_id = bank_account["id"]

        # Prepare journal entry
        journal_lines = [
            JournalLine(
                account_id=expense_account_id,
                debit=amount,
                credit=0,
                description=description or f"Expense: {category.name}"
            ),
            JournalLine(
                account_id=payment_account_id,
                debit=0,
                credit=amount,
                description=f"Payment for: {category.name}"
            )
        ]

        # Create expense
        expense = Expense(
            voucher_number=voucher_number,
            category_id=category_id,
            expense_date=expense_date,
            amount=amount,
            payment_method=payment_method,
            bank_account_id=bank_account_id,
            cheque_id=cheque_id,
            description=description,
            company_id=company_id,
            created_by=created_by,
        )

        with self.db.transaction():
            # Save expense
            expense.id = self.expense_repo.insert_unique(expense.to_dict())

            # Post journal entry
            self.accounting_service.post_journal_entry(
                voucher_type=VoucherType.JOURNAL,
                entry_date=expense_date,
                lines=journal_lines,
                source_table="expenses",
                source_id=expense.id,
                narration=f"Expense voucher {voucher_number}: {category.name}",
            )

        logger.info("Created expense %s: %s - Rs.%.2f", voucher_number, category.name, amount)
        
        # Log activity
        log_expense_created(
            expense_id=expense.id,
            expense_type=category.name,
            amount=amount,
            description=description or "",
        )
        
        return expense

    def get_expense(self, expense_id: int) -> Expense:
        """Get expense by ID."""
        row = self.expense_repo.get_by_id(expense_id)
        return Expense.from_row(row)

    def list_expenses(
        self,
        company_id: int = 1,
        date_from: str | None = None,
        date_to: str | None = None,
        category_id: int | None = None,
    ) -> list[dict]:
        """List expenses with filters."""
        return self.expense_repo.find_all_for_company(
            company_id,
            date_from,
            date_to,
            category_id,
        )

    def update_expense(
        self,
        expense_id: int,
        voucher_number: str,
        category_id: int,
        expense_date: str,
        amount: float,
        payment_method: str,
        bank_account_id: int | None = None,
        cheque_id: int | None = None,
        description: str | None = None,
    ) -> None:
        """Update expense with journal reversal."""
        self.expense_repo.update(
            expense_id,
            {
                "voucher_number": voucher_number,
                "category_id": category_id,
                "expense_date": expense_date,
                "amount": amount,
                "payment_method": payment_method,
                "bank_account_id": bank_account_id,
                "cheque_id": cheque_id,
                "description": description,
            }
        )
        logger.info("Updated expense ID: %s", expense_id)

    def delete_expense(self, expense_id: int) -> None:
        """Delete expense with journal reversal."""
        self.expense_repo.delete(expense_id)
        logger.info("Deleted expense ID: %s", expense_id)
    def get_monthly_summary(self, year: int, month: int, company_id: int = 1) -> dict:
        """Get monthly expense summary by category."""
        import calendar
        
        # Get correct last day of month
        last_day = calendar.monthrange(year, month)[1]
        date_from = f"{year}-{month:02d}-01"
        date_to = f"{year}-{month:02d}-{last_day:02d}"
        
        print(f"📊 Monthly Report: {date_from} to {date_to}")
        
        expenses = self.expense_repo.find_all_for_company(
            company_id,
            date_from,
            date_to,
        )
        
        print(f"📊 Found {len(expenses)} expenses")
        
        summary = {
            "total": 0,
            "by_category": {},
            "categories": [],
            "month": f"{calendar.month_name[month]} {year}",
            "date_from": date_from,
            "date_to": date_to,
            "has_data": len(expenses) > 0,
        }
        
        for exp in expenses:
            summary["total"] += exp["amount"]
            cat = exp.get("category_name", "Uncategorized")
            if cat not in summary["by_category"]:
                summary["by_category"][cat] = 0
            summary["by_category"][cat] += exp["amount"]
            print(f"📊 Added expense: {cat} - {exp['amount']}")
        
        for cat, amount in summary["by_category"].items():
            percentage = (amount / summary["total"] * 100) if summary["total"] > 0 else 0
            summary["categories"].append({
                "name": cat,
                "amount": amount,
                "percentage": round(percentage, 1),
            })
        
        summary["categories"].sort(key=lambda x: x["amount"], reverse=True)
        
        if not summary["categories"]:
            summary["message"] = f"No expenses recorded for {summary['month']}"
        
        print(f"📊 Summary total: {summary['total']}")
        print(f"📊 Categories: {len(summary['categories'])}")
        
        return summary






