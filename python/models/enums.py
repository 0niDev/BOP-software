"""Enumerations shared across models, services and views."""
from __future__ import annotations

from enum import Enum


class AccountType(str, Enum):
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    EQUITY = "EQUITY"
    REVENUE = "REVENUE"
    EXPENSE = "EXPENSE"

    @property
    def label(self) -> str:
        return self.value.title()

    @property
    def normal_balance_is_debit(self) -> bool:
        """True if increases to this account type are recorded as debits."""
        return self in (AccountType.ASSET, AccountType.EXPENSE)


class PartyType(str, Enum):
    CUSTOMER = "CUSTOMER"
    SUPPLIER = "SUPPLIER"
    BOTH = "BOTH"


class PaymentMethod(str, Enum):
    CASH = "CASH"
    BANK = "BANK"
    CHEQUE = "CHEQUE"
    CREDIT = "CREDIT"


class VoucherType(str, Enum):
    JOURNAL = "JOURNAL"
    SALES = "SALES"
    SALES_RETURN = "SALES_RETURN"
    PURCHASE = "PURCHASE"
    PURCHASE_RETURN = "PURCHASE_RETURN"
    PAYMENT = "PAYMENT"
    RECEIPT = "RECEIPT"
    MANUFACTURING = "MANUFACTURING"
    STOCK_ADJUSTMENT = "STOCK_ADJUSTMENT"
    OPENING = "OPENING"


class DocumentStatus(str, Enum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
