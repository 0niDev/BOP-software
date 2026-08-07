"""
Activity Logger - Logs ALL user activities to a dedicated text file.

This module provides a centralized activity logging system that tracks
every significant action in the ERP system including:
- Item creation, updates, deletions
- Sales invoice creation, updates, deletions
- Purchase invoice creation, updates, deletions
- Party (customer/supplier) creation, updates, deletions
- User login/logout
- Stock adjustments
- Payments and banking transactions
- Manufacturing operations
- Expense entries

All activities are logged to a human-readable text file for audit purposes.
"""
from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from config.app_config import get_config

# Activity log file path
LOG_DIR = Path(get_config().logging.log_file).parent
ACTIVITY_LOG_FILE = LOG_DIR / "activity_log.txt"

# Ensure log directory exists
LOG_DIR.mkdir(parents=True, exist_ok=True)


def _get_timestamp() -> str:
    """Returns current timestamp in readable format."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _format_activity_entry(
    activity_type: str,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    entity_name: Optional[str] = None,
    action: str = "CREATE",
    details: Optional[dict[str, Any]] = None,
    company_id: int = 1,
) -> str:
    """
    Formats an activity log entry.
    
    Args:
        activity_type: Type of activity (e.g., "ITEM", "SALES", "PURCHASE", "PARTY")
        user_id: ID of the user performing the action
        username: Username of the user performing the action
        entity_type: Type of entity affected (e.g., "Item", "Invoice", "Party")
        entity_id: Database ID of the entity
        entity_name: Human-readable name/code of the entity
        action: Action performed (CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.)
        details: Additional details as a dictionary
        company_id: Company ID for multi-tenant support
    
    Returns:
        Formatted log entry string
    """
    timestamp = _get_timestamp()
    
    # Build the base entry
    user_info = f"[User: {username} (ID:{user_id})]" if username else "[System]"
    entity_info = ""
    if entity_type:
        entity_info = f" | Entity: {entity_type}"
        if entity_id:
            entity_info += f"(ID:{entity_id})"
        if entity_name:
            entity_info += f" [{entity_name}]"
    
    details_str = ""
    if details:
        detail_parts = []
        for key, value in details.items():
            detail_parts.append(f"{key}={value}")
        if detail_parts:
            details_str = f" | Details: {{'{' '.join(detail_parts)}'}}"
    
    entry = (
        f"{timestamp} | {activity_type:15} | {action:10} | "
        f"Company:{company_id} {user_info}{entity_info}{details_str}"
    )
    
    return entry


def log_activity(
    activity_type: str,
    action: str,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    entity_name: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
    company_id: int = 1,
) -> None:
    """
    Logs an activity to the activity log file.
    
    Args:
        activity_type: Type of activity (e.g., "ITEM", "SALES", "PURCHASE", "PARTY")
        action: Action performed (CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.)
        user_id: ID of the user performing the action
        username: Username of the user performing the action
        entity_type: Type of entity affected
        entity_id: Database ID of the entity
        entity_name: Human-readable name/code of the entity
        details: Additional details as a dictionary
        company_id: Company ID for multi-tenant support
    """
    entry = _format_activity_entry(
        activity_type=activity_type,
        user_id=user_id,
        username=username,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        action=action,
        details=details,
        company_id=company_id,
    )
    
    # Append to activity log file
    try:
        with open(ACTIVITY_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(entry + "\n")
    except Exception as e:
        # Don't fail the operation if logging fails, but note it
        print(f"Warning: Failed to write activity log: {e}")


# ============================================================================
# Convenience functions for common activity types
# ============================================================================

def log_item_created(
    item_id: int,
    item_code: str,
    item_name: str,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    company_id: int = 1,
    **kwargs
) -> None:
    """Logs item creation."""
    log_activity(
        activity_type="ITEM",
        action="CREATE",
        user_id=user_id,
        username=username,
        entity_type="Item",
        entity_id=item_id,
        entity_name=item_code,
        details={"name": item_name, **kwargs},
        company_id=company_id,
    )


def log_item_updated(
    item_id: int,
    item_code: str,
    item_name: str,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    company_id: int = 1,
    changes: Optional[dict] = None,
    **kwargs
) -> None:
    """Logs item update."""
    log_activity(
        activity_type="ITEM",
        action="UPDATE",
        user_id=user_id,
        username=username,
        entity_type="Item",
        entity_id=item_id,
        entity_name=item_code,
        details={"name": item_name, "changes": changes, **kwargs},
        company_id=company_id,
    )


def log_item_deleted(
    item_id: int,
    item_code: str,
    item_name: str,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    company_id: int = 1,
) -> None:
    """Logs item deletion/deactivation."""
    log_activity(
        activity_type="ITEM",
        action="DELETE",
        user_id=user_id,
        username=username,
        entity_type="Item",
        entity_id=item_id,
        entity_name=item_code,
        details={"name": item_name},
        company_id=company_id,
    )


def log_sales_invoice_created(
    invoice_id: int,
    invoice_number: str,
    customer_name: str,
    total_amount: float,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    company_id: int = 1,
    items_count: int = 0,
    payment_type: str = "",
) -> None:
    """Logs sales invoice creation."""
    log_activity(
        activity_type="SALES",
        action="CREATE",
        user_id=user_id,
        username=username,
        entity_type="Sales Invoice",
        entity_id=invoice_id,
        entity_name=invoice_number,
        details={
            "customer": customer_name,
            "total": total_amount,
            "items": items_count,
            "payment": payment_type,
        },
        company_id=company_id,
    )


def log_sales_invoice_updated(
    invoice_id: int,
    invoice_number: str,
    customer_name: str,
    total_amount: float,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    company_id: int = 1,
    changes: Optional[dict] = None,
) -> None:
    """Logs sales invoice update."""
    log_activity(
        activity_type="SALES",
        action="UPDATE",
        user_id=user_id,
        username=username,
        entity_type="Sales Invoice",
        entity_id=invoice_id,
        entity_name=invoice_number,
        details={
            "customer": customer_name,
            "total": total_amount,
            "changes": changes,
        },
        company_id=company_id,
    )


def log_sales_invoice_deleted(
    invoice_id: int,
    invoice_number: str,
    customer_name: str,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    company_id: int = 1,
) -> None:
    """Logs sales invoice deletion/void."""
    log_activity(
        activity_type="SALES",
        action="DELETE",
        user_id=user_id,
        username=username,
        entity_type="Sales Invoice",
        entity_id=invoice_id,
        entity_name=invoice_number,
        details={"customer": customer_name},
        company_id=company_id,
    )


def log_purchase_invoice_created(
    invoice_id: int,
    invoice_number: str,
    supplier_name: str,
    total_amount: float,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    company_id: int = 1,
    items_count: int = 0,
    payment_type: str = "",
) -> None:
    """Logs purchase invoice creation."""
    log_activity(
        activity_type="PURCHASE",
        action="CREATE",
        user_id=user_id,
        username=username,
        entity_type="Purchase Invoice",
        entity_id=invoice_id,
        entity_name=invoice_number,
        details={
            "supplier": supplier_name,
            "total": total_amount,
            "items": items_count,
            "payment": payment_type,
        },
        company_id=company_id,
    )


def log_purchase_invoice_updated(
    invoice_id: int,
    invoice_number: str,
    supplier_name: str,
    total_amount: float,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    company_id: int = 1,
    changes: Optional[dict] = None,
) -> None:
    """Logs purchase invoice update."""
    log_activity(
        activity_type="PURCHASE",
        action="UPDATE",
        user_id=user_id,
        username=username,
        entity_type="Purchase Invoice",
        entity_id=invoice_id,
        entity_name=invoice_number,
        details={
            "supplier": supplier_name,
            "total": total_amount,
            "changes": changes,
        },
        company_id=company_id,
    )


def log_purchase_invoice_deleted(
    invoice_id: int,
    invoice_number: str,
    supplier_name: str,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    company_id: int = 1,
) -> None:
    """Logs purchase invoice deletion/void."""
    log_activity(
        activity_type="PURCHASE",
        action="DELETE",
        user_id=user_id,
        username=username,
        entity_type="Purchase Invoice",
        entity_id=invoice_id,
        entity_name=invoice_number,
        details={"supplier": supplier_name},
        company_id=company_id,
    )


def log_party_created(
    party_id: int,
    party_code: str,
    party_name: str,
    party_type: str,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    company_id: int = 1,
    credit_limit: float = 0.0,
) -> None:
    """Logs party (customer/supplier) creation."""
    log_activity(
        activity_type="PARTY",
        action="CREATE",
        user_id=user_id,
        username=username,
        entity_type=f"Party ({party_type})",
        entity_id=party_id,
        entity_name=party_code,
        details={"name": party_name, "credit_limit": credit_limit},
        company_id=company_id,
    )


def log_party_updated(
    party_id: int,
    party_code: str,
    party_name: str,
    party_type: str,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    company_id: int = 1,
    changes: Optional[dict] = None,
) -> None:
    """Logs party update."""
    log_activity(
        activity_type="PARTY",
        action="UPDATE",
        user_id=user_id,
        username=username,
        entity_type=f"Party ({party_type})",
        entity_id=party_id,
        entity_name=party_code,
        details={"name": party_name, "changes": changes},
        company_id=company_id,
    )


def log_party_deleted(
    party_id: int,
    party_code: str,
    party_name: str,
    party_type: str,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    company_id: int = 1,
) -> None:
    """Logs party deletion/deactivation."""
    log_activity(
        activity_type="PARTY",
        action="DELETE",
        user_id=user_id,
        username=username,
        entity_type=f"Party ({party_type})",
        entity_id=party_id,
        entity_name=party_code,
        details={"name": party_name},
        company_id=company_id,
    )


def log_user_login(
    user_id: int,
    username: str,
    role: str,
    company_id: int = 1,
) -> None:
    """Logs user login."""
    log_activity(
        activity_type="AUTH",
        action="LOGIN",
        user_id=user_id,
        username=username,
        entity_type="User",
        entity_id=user_id,
        entity_name=username,
        details={"role": role},
        company_id=company_id,
    )


def log_user_logout(
    user_id: int,
    username: str,
    company_id: int = 1,
) -> None:
    """Logs user logout."""
    log_activity(
        activity_type="AUTH",
        action="LOGOUT",
        user_id=user_id,
        username=username,
        entity_type="User",
        entity_id=user_id,
        entity_name=username,
        company_id=company_id,
    )


def log_payment_created(
    payment_id: int,
    payment_type: str,
    amount: float,
    party_name: Optional[str] = None,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    company_id: int = 1,
) -> None:
    """Logs payment/receipt creation."""
    log_activity(
        activity_type="PAYMENT",
        action="CREATE",
        user_id=user_id,
        username=username,
        entity_type=f"Payment ({payment_type})",
        entity_id=payment_id,
        entity_name=f"#{payment_id}",
        details={"amount": amount, "party": party_name},
        company_id=company_id,
    )


def log_stock_adjustment(
    item_id: int,
    item_code: str,
    item_name: str,
    quantity_change: float,
    reason: str,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    company_id: int = 1,
) -> None:
    """Logs stock adjustment."""
    log_activity(
        activity_type="STOCK",
        action="ADJUST",
        user_id=user_id,
        username=username,
        entity_type="Stock",
        entity_id=item_id,
        entity_name=item_code,
        details={"name": item_name, "change": quantity_change, "reason": reason},
        company_id=company_id,
    )


def log_expense_created(
    expense_id: int,
    expense_type: str,
    amount: float,
    description: str,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    company_id: int = 1,
) -> None:
    """Logs expense entry."""
    log_activity(
        activity_type="EXPENSE",
        action="CREATE",
        user_id=user_id,
        username=username,
        entity_type="Expense",
        entity_id=expense_id,
        entity_name=expense_type,
        details={"amount": amount, "description": description},
        company_id=company_id,
    )


def log_manufacturing_order_created(
    order_id: int,
    order_number: str,
    product_name: str,
    quantity: float,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    company_id: int = 1,
) -> None:
    """Logs manufacturing order creation."""
    log_activity(
        activity_type="MANUFACTURING",
        action="CREATE",
        user_id=user_id,
        username=username,
        entity_type="Production Order",
        entity_id=order_id,
        entity_name=order_number,
        details={"product": product_name, "quantity": quantity},
        company_id=company_id,
    )


def log_banking_transaction(
    transaction_id: int,
    transaction_type: str,
    amount: float,
    bank_name: str,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    company_id: int = 1,
    description: str = "",
) -> None:
    """Logs banking transaction (deposit/withdrawal)."""
    log_activity(
        activity_type="BANKING",
        action="CREATE",
        user_id=user_id,
        username=username,
        entity_type=f"Bank Transaction ({transaction_type})",
        entity_id=transaction_id,
        entity_name=bank_name,
        details={"amount": amount, "description": description},
        company_id=company_id,
    )


# Initialize activity log file with header if it doesn't exist
def _initialize_activity_log() -> None:
    """Initializes the activity log file with a header."""
    if not ACTIVITY_LOG_FILE.exists():
        header = (
            "=" * 120 + "\n"
            "ERP SYSTEM ACTIVITY LOG\n"
            "Tracks all user activities including: Items, Sales, Purchases, Parties, Payments, Stock, Expenses\n"
            "Format: TIMESTAMP | ACTIVITY_TYPE | ACTION | CompanyInfo UserInfo EntityInfo Details\n"
            "=" * 120 + "\n\n"
        )
        with open(ACTIVITY_LOG_FILE, "w", encoding="utf-8") as f:
            f.write(header)


# Initialize on module load
_initialize_activity_log()
