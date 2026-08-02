"""Enumeration types for the ERP system"""

from enum import Enum


class AccountType(Enum):
    """Chart of Accounts types"""
    ASSET = "Asset"
    LIABILITY = "Liability"
    EQUITY = "Equity"
    INCOME = "Income"
    EXPENSE = "Expense"
    
    @classmethod
    def balance_sheet_types(cls):
        return [cls.ASSET, cls.LIABILITY, cls.EQUITY]
    
    @classmethod
    def profit_loss_types(cls):
        return [cls.INCOME, cls.EXPENSE]


class PartyType(Enum):
    """Types of business parties"""
    CUSTOMER = "Customer"
    SUPPLIER = "Supplier"
    BOTH = "Both"
    EMPLOYEE = "Employee"


class VoucherType(Enum):
    """Journal voucher types"""
    SALES = "Sales"
    PURCHASE = "Purchase"
    PAYMENT = "Payment"
    RECEIPT = "Receipt"
    JOURNAL = "Journal"
    CONTRA = "Contra"
    CREDIT_NOTE = "Credit Note"
    DEBIT_NOTE = "Debit Note"
    PRODUCTION = "Production"
    STOCK_ADJUSTMENT = "Stock Adjustment"


class DocumentStatus(Enum):
    """Document workflow status"""
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    CANCELLED = "Cancelled"
    PAID = "Paid"
    PARTIAL = "Partial"


class PaymentMethod(Enum):
    """Payment methods"""
    CASH = "Cash"
    BANK_TRANSFER = "Bank Transfer"
    CHEQUE = "Cheque"
    CARD = "Card"
    ONLINE = "Online"
    OTHER = "Other"


class ItemType(Enum):
    """Types of inventory items"""
    RAW_MATERIAL = "Raw Material"
    PACKAGING = "Packaging"
    FINISHED_GOODS = "Finished Goods"
    TRADING = "Trading"
    SERVICE = "Service"
    ASSET = "Asset"


class UnitType(Enum):
    """Unit of measurement categories"""
    WEIGHT = "Weight"
    VOLUME = "Volume"
    LENGTH = "Length"
    COUNT = "Count"
    AREA = "Area"
    TIME = "Time"


class TransactionType(Enum):
    """Stock transaction types"""
    PURCHASE = "Purchase"
    SALES = "Sales"
    PRODUCTION_IN = "Production In"
    PRODUCTION_OUT = "Production Out"
    ADJUSTMENT = "Adjustment"
    TRANSFER = "Transfer"
    RETURN_IN = "Return In"
    RETURN_OUT = "Return Out"
    OPENING = "Opening"
