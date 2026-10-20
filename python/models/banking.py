"""Banking domain models."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class BankAccount:
    """Bank account."""
    bank_name: str
    account_title: str
    account_number: str
    account_id: int  # Link to Chart of Accounts (1010)
    opening_balance: float = 0.0
    branch_code: str | None = None
    iban: str | None = None
    id: Optional[int] = None
    company_id: int = 1
    is_active: bool = True
    created_at: Optional[str] = None

    @staticmethod
    def from_row(row: dict) -> "BankAccount":
        return BankAccount(
            id=row["id"],
            company_id=row["company_id"],
            account_id=row["account_id"],
            bank_name=row["bank_name"],
            account_title=row["account_title"],
            account_number=row["account_number"],
            branch_code=row.get("branch_code"),
            iban=row.get("iban"),
            opening_balance=row["opening_balance"],
            is_active=bool(row["is_active"]),
            created_at=row.get("created_at"),
        )

    def to_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "account_id": self.account_id,
            "bank_name": self.bank_name,
            "account_title": self.account_title,
            "account_number": self.account_number,
            "branch_code": self.branch_code,
            "iban": self.iban,
            "opening_balance": self.opening_balance,
            "is_active": int(self.is_active),
        }


@dataclass
class BankTransaction:
    """Bank transaction (deposit/withdrawal/transfer)."""
    bank_account_id: int
    transaction_type: str  # DEPOSIT, WITHDRAWAL, TRANSFER_IN, TRANSFER_OUT
    amount: float
    transaction_date: str
    reference_no: str | None = None
    notes: str | None = None
    journal_entry_id: int | None = None
    id: Optional[int] = None
    created_at: Optional[str] = None

    @staticmethod
    def from_row(row: dict) -> "BankTransaction":
        return BankTransaction(
            id=row["id"],
            bank_account_id=row["bank_account_id"],
            transaction_type=row["transaction_type"],
            amount=row["amount"],
            transaction_date=row["transaction_date"],
            reference_no=row.get("reference_no"),
            notes=row.get("notes"),
            journal_entry_id=row.get("journal_entry_id"),
            created_at=row.get("created_at"),
        )

    def to_dict(self) -> dict:
        return {
            "bank_account_id": self.bank_account_id,
            "transaction_type": self.transaction_type,
            "amount": self.amount,
            "transaction_date": self.transaction_date,
            "reference_no": self.reference_no,
            "notes": self.notes,
            "journal_entry_id": self.journal_entry_id,
        }


@dataclass
class Cheque:
    """Cheque (issued or received)."""
    bank_account_id: int
    cheque_number: str
    cheque_type: str  # ISSUED, RECEIVED
    amount: float
    cheque_date: str
    party_id: int | None = None
    status: str = "UNCLEARED"  # UNCLEARED, CLEARED, BOUNCED, LOST
    cleared_date: str | None = None
    notes: str | None = None
    id: Optional[int] = None
    company_id: int = 1
    created_at: Optional[str] = None

    @staticmethod
    def from_row(row: dict) -> "Cheque":
        return Cheque(
            id=row["id"],
            company_id=row["company_id"],
            bank_account_id=row["bank_account_id"],
            party_id=row.get("party_id"),
            cheque_number=row["cheque_number"],
            cheque_type=row["cheque_type"],
            amount=row["amount"],
            cheque_date=row["cheque_date"],
            status=row["status"],
            cleared_date=row.get("cleared_date"),
            notes=row.get("notes"),
            created_at=row.get("created_at"),
        )

    def to_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "bank_account_id": self.bank_account_id,
            "party_id": self.party_id,
            "cheque_number": self.cheque_number,
            "cheque_type": self.cheque_type,
            "amount": self.amount,
            "cheque_date": self.cheque_date,
            "status": self.status,
            "cleared_date": self.cleared_date,
            "notes": self.notes,
        }