"""
Data models for the Pharmaceutical ERP system.

All models follow the same pattern:
- from_row(): Create model from database row
- to_insert_dict(): Convert to dict for INSERT
- to_update_dict(): Convert to dict for UPDATE
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional


@dataclass
class Account:
    """Chart of Accounts model."""
    id: Optional[int] = None
    company_id: int = 1
    account_code: str = ""
    account_name: str = ""
    parent_account_id: Optional[int] = None
    account_type: str = ""  # ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    account_subtype: Optional[str] = None
    opening_balance: float = 0.0
    is_system_account: bool = False
    is_active: bool = True
    created_at: Optional[str] = None
    
    @classmethod
    def from_row(cls, row: dict) -> "Account":
        return cls(
            id=row.get("id"),
            company_id=row.get("company_id", 1),
            account_code=row.get("account_code", ""),
            account_name=row.get("account_name", ""),
            parent_account_id=row.get("parent_account_id"),
            account_type=row.get("account_type", ""),
            account_subtype=row.get("account_subtype"),
            opening_balance=row.get("opening_balance", 0.0),
            is_system_account=bool(row.get("is_system_account", 0)),
            is_active=bool(row.get("is_active", 1)),
            created_at=row.get("created_at"),
        )
    
    def to_insert_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "account_code": self.account_code,
            "account_name": self.account_name,
            "parent_account_id": self.parent_account_id,
            "account_type": self.account_type,
            "account_subtype": self.account_subtype,
            "opening_balance": self.opening_balance,
            "is_system_account": int(self.is_system_account),
            "is_active": int(self.is_active),
        }
    
    def to_update_dict(self) -> dict:
        return {
            "account_name": self.account_name,
            "parent_account_id": self.parent_account_id,
            "opening_balance": self.opening_balance,
            "is_active": int(self.is_active),
        }


@dataclass
class Party:
    """Party model (Customer/Supplier)."""
    id: Optional[int] = None
    company_id: int = 1
    code: str = ""
    name: str = ""
    party_type: str = ""  # CUSTOMER, SUPPLIER, BOTH
    customer_category: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    opening_balance: float = 0.0
    credit_limit: float = 0.0
    account_id: Optional[int] = None
    is_active: bool = True
    created_at: Optional[str] = None
    
    @classmethod
    def from_row(cls, row: dict) -> "Party":
        return cls(
            id=row.get("id"),
            company_id=row.get("company_id", 1),
            code=row.get("code", ""),
            name=row.get("name", ""),
            party_type=row.get("party_type", ""),
            customer_category=row.get("customer_category"),
            phone=row.get("phone"),
            address=row.get("address"),
            email=row.get("email"),
            opening_balance=row.get("opening_balance", 0.0),
            credit_limit=row.get("credit_limit", 0.0),
            account_id=row.get("account_id"),
            is_active=bool(row.get("is_active", 1)),
            created_at=row.get("created_at"),
        )
    
    def to_insert_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "code": self.code,
            "name": self.name,
            "party_type": self.party_type,
            "customer_category": self.customer_category,
            "phone": self.phone,
            "address": self.address,
            "email": self.email,
            "opening_balance": self.opening_balance,
            "credit_limit": self.credit_limit,
            "account_id": self.account_id,
            "is_active": int(self.is_active),
        }
    
    def to_update_dict(self) -> dict:
        return {
            "name": self.name,
            "party_type": self.party_type,
            "customer_category": self.customer_category,
            "phone": self.phone,
            "address": self.address,
            "email": self.email,
            "credit_limit": self.credit_limit,
            "is_active": int(self.is_active),
        }


@dataclass
class Item:
    """Item/Product model."""
    id: Optional[int] = None
    company_id: int = 1
    item_code: str = ""
    item_name: str = ""
    description: Optional[str] = None
    category: Optional[str] = None
    unit_of_measure: str = "PCS"
    sale_price: float = 0.0
    purchase_price: float = 0.0
    cost_price: float = 0.0
    reorder_level: float = 0.0
    tax_rate: Optional[float] = None
    is_active: bool = True
    created_at: Optional[str] = None
    
    @classmethod
    def from_row(cls, row: dict) -> "Item":
        return cls(
            id=row.get("id"),
            company_id=row.get("company_id", 1),
            item_code=row.get("item_code", ""),
            item_name=row.get("item_name", ""),
            description=row.get("description"),
            category=row.get("category"),
            unit_of_measure=row.get("unit_of_measure", "PCS"),
            sale_price=row.get("sale_price", 0.0),
            purchase_price=row.get("purchase_price", 0.0),
            cost_price=row.get("cost_price", 0.0),
            reorder_level=row.get("reorder_level", 0.0),
            tax_rate=row.get("tax_rate"),
            is_active=bool(row.get("is_active", 1)),
            created_at=row.get("created_at"),
        )
    
    def to_insert_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "item_code": self.item_code,
            "item_name": self.item_name,
            "description": self.description,
            "category": self.category,
            "unit_of_measure": self.unit_of_measure,
            "sale_price": self.sale_price,
            "purchase_price": self.purchase_price,
            "cost_price": self.cost_price,
            "reorder_level": self.reorder_level,
            "tax_rate": self.tax_rate,
            "is_active": int(self.is_active),
        }
    
    def to_update_dict(self) -> dict:
        return {
            "item_name": self.item_name,
            "description": self.description,
            "category": self.category,
            "unit_of_measure": self.unit_of_measure,
            "sale_price": self.sale_price,
            "purchase_price": self.purchase_price,
            "cost_price": self.cost_price,
            "reorder_level": self.reorder_level,
            "tax_rate": self.tax_rate,
            "is_active": int(self.is_active),
        }


@dataclass
class SalesInvoice:
    """Sales Invoice model."""
    id: Optional[int] = None
    company_id: int = 1
    invoice_number: str = ""
    customer_id: int = 0
    invoice_date: str = ""
    payment_type: str = "CREDIT"  # CASH, BANK, CHEQUE, CREDIT
    subtotal: float = 0.0
    discount_amount: float = 0.0
    tax_amount: float = 0.0
    total_amount: float = 0.0
    notes: Optional[str] = None
    warehouse_id: int = 1
    journal_entry_id: Optional[int] = None
    is_posted: bool = True
    created_by: Optional[int] = None
    created_at: Optional[str] = None
    
    @classmethod
    def from_row(cls, row: dict) -> "SalesInvoice":
        return cls(
            id=row.get("id"),
            company_id=row.get("company_id", 1),
            invoice_number=row.get("invoice_number", ""),
            customer_id=row.get("customer_id", 0),
            invoice_date=row.get("invoice_date", ""),
            payment_type=row.get("payment_type", "CREDIT"),
            subtotal=row.get("subtotal", 0.0),
            discount_amount=row.get("discount_amount", 0.0),
            tax_amount=row.get("tax_amount", 0.0),
            total_amount=row.get("total_amount", 0.0),
            notes=row.get("notes"),
            warehouse_id=row.get("warehouse_id", 1),
            journal_entry_id=row.get("journal_entry_id"),
            is_posted=bool(row.get("is_posted", 1)),
            created_by=row.get("created_by"),
            created_at=row.get("created_at"),
        )
    
    def to_insert_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "invoice_number": self.invoice_number,
            "customer_id": self.customer_id,
            "invoice_date": self.invoice_date,
            "payment_type": self.payment_type,
            "subtotal": self.subtotal,
            "discount_amount": self.discount_amount,
            "tax_amount": self.tax_amount,
            "total_amount": self.total_amount,
            "notes": self.notes,
            "warehouse_id": self.warehouse_id,
            "journal_entry_id": self.journal_entry_id,
            "is_posted": int(self.is_posted),
            "created_by": self.created_by,
        }


@dataclass
class SalesInvoiceItem:
    """Sales Invoice Item model."""
    id: Optional[int] = None
    sales_invoice_id: int = 0
    item_id: int = 0
    quantity: float = 0.0
    unit_price: float = 0.0
    discount_percent: float = 0.0
    tax_percent: float = 0.0
    amount: float = 0.0
    batch_number: Optional[str] = None
    expiry_date: Optional[str] = None
    
    @classmethod
    def from_row(cls, row: dict) -> "SalesInvoiceItem":
        return cls(
            id=row.get("id"),
            sales_invoice_id=row.get("sales_invoice_id", 0),
            item_id=row.get("item_id", 0),
            quantity=row.get("quantity", 0.0),
            unit_price=row.get("unit_price", 0.0),
            discount_percent=row.get("discount_percent", 0.0),
            tax_percent=row.get("tax_percent", 0.0),
            amount=row.get("amount", 0.0),
            batch_number=row.get("batch_number"),
            expiry_date=row.get("expiry_date"),
        )
    
    def to_insert_dict(self) -> dict:
        return {
            "sales_invoice_id": self.sales_invoice_id,
            "item_id": self.item_id,
            "quantity": self.quantity,
            "unit_price": self.unit_price,
            "discount_percent": self.discount_percent,
            "tax_percent": self.tax_percent,
            "amount": self.amount,
            "batch_number": self.batch_number,
            "expiry_date": self.expiry_date,
        }


@dataclass
class PurchaseInvoice:
    """Purchase Invoice model."""
    id: Optional[int] = None
    company_id: int = 1
    invoice_number: str = ""
    supplier_id: int = 0
    invoice_date: str = ""
    payment_type: str = "CREDIT"
    subtotal: float = 0.0
    discount_amount: float = 0.0
    tax_amount: float = 0.0
    total_amount: float = 0.0
    notes: Optional[str] = None
    warehouse_id: int = 1
    journal_entry_id: Optional[int] = None
    is_posted: bool = True
    created_by: Optional[int] = None
    created_at: Optional[str] = None
    
    @classmethod
    def from_row(cls, row: dict) -> "PurchaseInvoice":
        return cls(
            id=row.get("id"),
            company_id=row.get("company_id", 1),
            invoice_number=row.get("invoice_number", ""),
            supplier_id=row.get("supplier_id", 0),
            invoice_date=row.get("invoice_date", ""),
            payment_type=row.get("payment_type", "CREDIT"),
            subtotal=row.get("subtotal", 0.0),
            discount_amount=row.get("discount_amount", 0.0),
            tax_amount=row.get("tax_amount", 0.0),
            total_amount=row.get("total_amount", 0.0),
            notes=row.get("notes"),
            warehouse_id=row.get("warehouse_id", 1),
            journal_entry_id=row.get("journal_entry_id"),
            is_posted=bool(row.get("is_posted", 1)),
            created_by=row.get("created_by"),
            created_at=row.get("created_at"),
        )
    
    def to_insert_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "invoice_number": self.invoice_number,
            "supplier_id": self.supplier_id,
            "invoice_date": self.invoice_date,
            "payment_type": self.payment_type,
            "subtotal": self.subtotal,
            "discount_amount": self.discount_amount,
            "tax_amount": self.tax_amount,
            "total_amount": self.total_amount,
            "notes": self.notes,
            "warehouse_id": self.warehouse_id,
            "journal_entry_id": self.journal_entry_id,
            "is_posted": int(self.is_posted),
            "created_by": self.created_by,
        }


@dataclass
class JournalEntry:
    """Journal Entry model for double-entry accounting."""
    id: Optional[int] = None
    company_id: int = 1
    voucher_number: str = ""
    voucher_type: str = ""  # JOURNAL, SALES, PURCHASE, PAYMENT, RECEIPT, etc.
    entry_date: str = ""
    reference_no: Optional[str] = None
    narration: Optional[str] = None
    source_table: Optional[str] = None
    source_id: Optional[int] = None
    is_posted: bool = True
    created_by: Optional[int] = None
    created_at: Optional[str] = None
    
    @classmethod
    def from_row(cls, row: dict) -> "JournalEntry":
        return cls(
            id=row.get("id"),
            company_id=row.get("company_id", 1),
            voucher_number=row.get("voucher_number", ""),
            voucher_type=row.get("voucher_type", ""),
            entry_date=row.get("entry_date", ""),
            reference_no=row.get("reference_no"),
            narration=row.get("narration"),
            source_table=row.get("source_table"),
            source_id=row.get("source_id"),
            is_posted=bool(row.get("is_posted", 1)),
            created_by=row.get("created_by"),
            created_at=row.get("created_at"),
        )
    
    def to_insert_dict(self) -> dict:
        return {
            "company_id": self.company_id,
            "voucher_number": self.voucher_number,
            "voucher_type": self.voucher_type,
            "entry_date": self.entry_date,
            "reference_no": self.reference_no,
            "narration": self.narration,
            "source_table": self.source_table,
            "source_id": self.source_id,
            "is_posted": int(self.is_posted),
            "created_by": self.created_by,
        }


@dataclass
class JournalEntryLine:
    """Journal Entry Line model."""
    id: Optional[int] = None
    journal_entry_id: int = 0
    account_id: int = 0
    party_id: Optional[int] = None
    debit: float = 0.0
    credit: float = 0.0
    description: Optional[str] = None
    line_order: int = 0
    
    @classmethod
    def from_row(cls, row: dict) -> "JournalEntryLine":
        return cls(
            id=row.get("id"),
            journal_entry_id=row.get("journal_entry_id", 0),
            account_id=row.get("account_id", 0),
            party_id=row.get("party_id"),
            debit=row.get("debit", 0.0),
            credit=row.get("credit", 0.0),
            description=row.get("description"),
            line_order=row.get("line_order", 0),
        )
    
    def to_insert_dict(self) -> dict:
        return {
            "journal_entry_id": self.journal_entry_id,
            "account_id": self.account_id,
            "party_id": self.party_id,
            "debit": self.debit,
            "credit": self.credit,
            "description": self.description,
            "line_order": self.line_order,
        }


@dataclass
class User:
    """User model for authentication."""
    id: Optional[int] = None
    username: str = ""
    password_hash: str = ""
    password_salt: str = ""
    full_name: str = ""
    email: Optional[str] = None
    role_id: int = 0
    is_active: bool = True
    last_login_at: Optional[str] = None
    created_at: Optional[str] = None
    
    @classmethod
    def from_row(cls, row: dict) -> "User":
        return cls(
            id=row.get("id"),
            username=row.get("username", ""),
            password_hash=row.get("password_hash", ""),
            password_salt=row.get("password_salt", ""),
            full_name=row.get("full_name", ""),
            email=row.get("email"),
            role_id=row.get("role_id", 0),
            is_active=bool(row.get("is_active", 1)),
            last_login_at=row.get("last_login_at"),
            created_at=row.get("created_at"),
        )
    
    def to_insert_dict(self) -> dict:
        return {
            "username": self.username,
            "password_hash": self.password_hash,
            "password_salt": self.password_salt,
            "full_name": self.full_name,
            "email": self.email,
            "role_id": self.role_id,
            "is_active": int(self.is_active),
        }
