"""Party domain model (Customers/Suppliers)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from models.enums import PartyType


@dataclass
class Party:
    code: str
    name: str
    party_type: PartyType
    id: Optional[int] = None
    company_id: int = 1
    credit_limit: float = 0.0
    account_id: Optional[int] = None  # Links to A/R (1100) or A/P (2000) account
    phone: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None

    @staticmethod
    def from_row(row: dict) -> "Party":
        """Factory method to create Party from DB row"""
        return Party(
            id=row["id"],
            company_id=row["company_id"],
            code=row["code"],
            name=row["name"],
            party_type=PartyType(row["party_type"]),
            credit_limit=row["credit_limit"],
            account_id=row["account_id"],
            phone=row.get("phone"),
            address=row.get("address"),
            email=row.get("email"),
            is_active=bool(row["is_active"]),
            created_at=row.get("created_at"),
        )

    def to_dict(self) -> dict:
        """Converts to dict for repository insert"""
        return {
            "company_id": self.company_id,
            "code": self.code,
            "name": self.name,
            "party_type": self.party_type.value,
            "credit_limit": self.credit_limit,
            "account_id": self.account_id,
            "phone": self.phone,
            "address": self.address,
            "email": self.email,
            "is_active": int(self.is_active),
        }
