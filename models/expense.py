"""Expense domain models."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class ExpenseCategory:
    """Expense category (e.g., Salaries, Electricity, Rent)."""
    name: str
    account_id: int | None = None
    id: Optional[int] = None
    company_id: int = 1
    is_active: bool = True
    created_at: Optional[str] = None

    @staticmethod
    def from_row(row: dict) -> "ExpenseCategory":
        return ExpenseCategory(
            id=row["id"],
            company_id=row["company_id"],
            name=row["name"],
            account_id=row.get("account_id"),
            is_active=bool(row["is_active"]),
            created_at=row.get("created_at"),
        )

    def to_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "name": self.name,
            "account_id": self.account_id,
            "is_active": int(self.is_active),
        }


@dataclass
class Expense:
    """Expense voucher."""
    voucher_number: str
    category_id: int
    expense_date: str
    amount: float
    payment_method: str  # CASH, BANK, CHEQUE
    description: str | None = None
    bank_account_id: int | None = None
    cheque_id: int | None = None
    id: Optional[int] = None
    company_id: int = 1
    created_by: Optional[int] = None
    created_at: Optional[str] = None

    @staticmethod
    def from_row(row: dict) -> "Expense":
        return Expense(
            id=row["id"],
            company_id=row["company_id"],
            voucher_number=row["voucher_number"],
            category_id=row["category_id"],
            expense_date=row["expense_date"],
            amount=row["amount"],
            payment_method=row["payment_method"],
            bank_account_id=row.get("bank_account_id"),
            cheque_id=row.get("cheque_id"),
            description=row.get("description"),
            created_by=row.get("created_by"),
            created_at=row.get("created_at"),
        )

    def to_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "voucher_number": self.voucher_number,
            "category_id": self.category_id,
            "expense_date": self.expense_date,
            "amount": self.amount,
            "payment_method": self.payment_method,
            "bank_account_id": self.bank_account_id,
            "cheque_id": self.cheque_id,
            "description": self.description,
            "created_by": self.created_by,
        }