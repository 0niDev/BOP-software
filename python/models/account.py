"""Chart-of-Accounts domain model."""
from __future__ import annotations

from dataclasses import dataclass, field

from models.enums import AccountType


@dataclass
class Account:
    account_code: str
    account_name: str
    account_type: AccountType
    id: int | None = None
    company_id: int = 1
    parent_account_id: int | None = None
    account_subtype: str | None = None
    opening_balance: float = 0.0
    current_balance: float = 0.0
    is_system_account: bool = False
    is_active: bool = True
    created_at: str | None = None

    @staticmethod
    def from_row(row: dict) -> "Account":
        return Account(
            id=row["id"],
            company_id=row["company_id"],
            account_code=row["account_code"],
            account_name=row["account_name"],
            parent_account_id=row["parent_account_id"],
            account_type=AccountType(row["account_type"]),
            account_subtype=row["account_subtype"],
            opening_balance=row["opening_balance"],
            current_balance=row.get("current_balance", row["opening_balance"]),
            is_system_account=bool(row["is_system_account"]),
            is_active=bool(row["is_active"]),
            created_at=row.get("created_at"),
        )

    def to_insert_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "account_code": self.account_code,
            "account_name": self.account_name,
            "parent_account_id": self.parent_account_id,
            "account_type": self.account_type.value if hasattr(self.account_type, 'value') else self.account_type,
            "account_subtype": self.account_subtype,
            "opening_balance": self.opening_balance,
            "is_system_account": int(self.is_system_account),
            "is_active": int(self.is_active),
        }
