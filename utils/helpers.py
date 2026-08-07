"""
Centralized Helper Functions for BOP Pharmaceutical ERP

This module provides reusable utility functions used throughout the application.
All database queries, caching, formatting, and common operations should use
these helpers to ensure consistency and maintainability.

Usage:
    from utils.helpers import (
        fetch_all_items_with_stock,
        fetch_invoices_with_customer,
        format_currency,
        safe_get,
        batch_insert,
    )
"""

import time
from typing import Any, Dict, List, Optional, Tuple, Union
from decimal import Decimal
from datetime import datetime, date

from utils.cache_manager import CacheManager, cached_global, SessionCache
from utils.logger import get_logger
from repositories.base_repository import BaseRepository

logger = get_logger(__name__)
cache_mgr = SessionCache()


# =============================================================================
# DATABASE QUERY HELPERS
# =============================================================================

def fetch_all_items_with_stock(
    db: BaseRepository,
    company_id: int = 1,
    include_inactive: bool = False
) -> List[Dict[str, Any]]:
    """
    Fetch all items with their stock quantities in a single optimized query.
    
    This replaces N+1 queries with a single JOIN query.
    
    Args:
        db: Database repository instance
        company_id: Company ID to filter by
        include_inactive: Whether to include inactive items
    
    Returns:
        List of item dictionaries with 'stock_qty' field added
    """
    cache_key = f"items_with_stock:{company_id}:{include_inactive}"
    
    # Check L2 cache first
    cached = cache_mgr.get(cache_key)
    if cached is not None:
        logger.debug(f"Cache hit for {cache_key}")
        return cached
    
    # Build query
    status_filter = "AND i.is_active = 1" if not include_inactive else ""
    
    query = f"""
        SELECT 
            i.id, i.item_code as code, i.item_name as name, i.unit as unit_of_measure,
            i.generic_name as category, i.notes as description, i.minimum_stock as reorder_level, i.is_active,
            COALESCE(SUM(sb.quantity_in_stock), 0) as stock_qty,
            COALESCE(MIN(sb.expiry_date), NULL) as earliest_expiry,
            COUNT(DISTINCT sb.id) as batch_count
        FROM items i
        LEFT JOIN stock_batches sb ON i.id = sb.item_id AND sb.quantity_in_stock > 0
        WHERE i.company_id = ? {status_filter}
        GROUP BY i.id
        ORDER BY i.item_name
    """
    
    logger.debug(f"Fetching items with stock for company {company_id}")
    items = db.fetch_all(query, (company_id,))
    
    # Ensure all items have proper types
    for item in items:
        item['stock_qty'] = int(item.get('stock_qty') or 0)
        item['batch_count'] = int(item.get('batch_count') or 0)
    
    # Cache for 30 seconds
    cache_mgr.set(cache_key, items, ttl=30)
    
    logger.info(f"Fetched {len(items)} items with stock data")
    return items


def fetch_item_by_id_with_stock(
    db: BaseRepository,
    item_id: int,
    company_id: int = 1
) -> Optional[Dict[str, Any]]:
    """
    Fetch a single item with stock details.
    
    Args:
        db: Database repository instance
        item_id: Item ID
        company_id: Company ID
    
    Returns:
        Item dictionary with stock info or None if not found
    """
    cache_key = f"item_with_stock:{item_id}"
    
    cached = cache_mgr.get(cache_key)
    if cached is not None:
        return cached
    
    query = """
        SELECT 
            i.id, i.item_code as code, i.item_name as name, i.unit as unit_of_measure,
            i.generic_name as category, i.notes as description, i.minimum_stock as reorder_level, i.is_active,
            COALESCE(SUM(sb.quantity_in_stock), 0) as stock_qty,
            COALESCE(MIN(sb.expiry_date), NULL) as earliest_expiry,
            COUNT(DISTINCT sb.id) as batch_count
        FROM items i
        LEFT JOIN stock_batches sb ON i.id = sb.item_id AND sb.quantity_in_stock > 0
        WHERE i.id = ? AND i.company_id = ?
        GROUP BY i.id
    """
    
    item = db.fetch_one(query, (item_id, company_id))
    
    if item:
        item['stock_qty'] = int(item.get('stock_qty') or 0)
        item['batch_count'] = int(item.get('batch_count') or 0)
        cache_mgr.set(cache_key, item, ttl=60)
    
    return item


def fetch_invoices_with_customer(
    db: BaseRepository,
    table_name: str,
    company_id: int = 1,
    limit: int = 100,
    status_filter: str = "!='CANCELLED'"
) -> List[Dict[str, Any]]:
    """
    Fetch invoices with customer/party details using optimized JOIN.
    
    Works for both sales_invoices and purchase_invoices.
    
    Args:
        db: Database repository instance
        table_name: 'sales_invoices' or 'purchase_invoices'
        company_id: Company ID
        limit: Maximum records to fetch
        status_filter: SQL status filter condition
    
    Returns:
        List of invoice dictionaries with customer/supplier name
    """
    cache_key = f"{table_name}_with_party:{company_id}:{limit}"
    
    cached = cache_mgr.get(cache_key)
    if cached is not None:
        return cached
    
    # Determine join column based on table
    if table_name == 'sales_invoices':
        join_col = 'customer_id'
        party_alias = 'p.name as customer_name, p.code as customer_code'
    elif table_name == 'purchase_invoices':
        join_col = 'supplier_id'
        party_alias = 'p.name as supplier_name, p.code as supplier_code'
    else:
        raise ValueError(f"Invalid table_name: {table_name}")
    
    query = f"""
        SELECT 
            si.id, si.invoice_number, si.invoice_date, si.total_amount,
            si.status, si.due_date, si.paid_amount,
            {party_alias}
        FROM {table_name} si
        INNER JOIN parties p ON si.{join_col} = p.id
        WHERE si.company_id = ? AND si.status {status_filter}
        ORDER BY si.invoice_date DESC
        LIMIT ?
    """
    
    invoices = db.fetch_all(query, (company_id, limit))
    
    # Normalize field names
    for inv in invoices:
        inv['party_name'] = inv.get('customer_name') or inv.get('supplier_name')
        inv['party_code'] = inv.get('customer_code') or inv.get('supplier_code')
        inv['total_amount'] = float(inv.get('total_amount') or 0)
        inv['paid_amount'] = float(inv.get('paid_amount') or 0)
    
    cache_mgr.set(cache_key, invoices, ttl=30)
    
    logger.info(f"Fetched {len(invoices)} {table_name} with party details")
    return invoices


def fetch_party_ledger(
    db: BaseRepository,
    party_id: int,
    company_id: int = 1,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None
) -> List[Dict[str, Any]]:
    """
    Fetch party ledger (all transactions for a party) with optimized query.
    
    Args:
        db: Database repository instance
        party_id: Party ID
        company_id: Company ID
        from_date: Start date (optional)
        to_date: End date (optional)
    
    Returns:
        List of transaction dictionaries
    """
    cache_key = f"party_ledger:{party_id}:{from_date}:{to_date}"
    
    cached = cache_mgr.get(cache_key)
    if cached is not None:
        return cached
    
    date_filter = ""
    params = [company_id, party_id]
    
    if from_date:
        date_filter += " AND je.entry_date >= ?"
        params.append(from_date)
    
    if to_date:
        date_filter += " AND je.entry_date <= ?"
        params.append(to_date)
    
    query = f"""
        SELECT 
            je.id as journal_entry_id,
            je.voucher_number,
            je.entry_date,
            je.description,
            jel.debit,
            jel.credit,
            (jel.debit - jel.credit) as balance,
            jel.journal_entry_line_type
        FROM journal_entry_lines jel
        INNER JOIN journal_entries je ON jel.journal_entry_id = je.id
        WHERE je.company_id = ? 
        AND jel.account_id IN (
            SELECT id FROM accounts WHERE party_id = ?
        )
        {date_filter}
        ORDER BY je.entry_date DESC, je.id DESC
    """
    
    transactions = db.fetch_all(query, tuple(params))
    
    # Calculate running balance
    running_balance = Decimal('0')
    for txn in transactions:
        txn['debit'] = float(txn.get('debit') or 0)
        txn['credit'] = float(txn.get('credit') or 0)
        running_balance += Decimal(str(txn['debit'])) - Decimal(str(txn['credit']))
        txn['running_balance'] = float(running_balance)
    
    cache_mgr.set(cache_key, transactions, ttl=60)
    
    logger.info(f"Fetched {len(transactions)} ledger entries for party {party_id}")
    return transactions


def fetch_account_balances(
    db: BaseRepository,
    company_id: int = 1,
    account_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Fetch account balances with optimized aggregation query.
    
    Args:
        db: Database repository instance
        company_id: Company ID
        account_type: Filter by account type (optional)
    
    Returns:
        List of account dictionaries with debit/credit balances
    """
    cache_key = f"account_balances:{company_id}:{account_type}"
    
    cached = cache_mgr.get(cache_key)
    if cached is not None:
        return cached
    
    type_filter = "AND a.account_type = ?" if account_type else ""
    params = [company_id]
    if account_type:
        params.append(account_type)
    
    query = f"""
        SELECT 
            a.id, a.code, a.name, a.account_type,
            COALESCE(SUM(jel.debit), 0) as total_debit,
            COALESCE(SUM(jel.credit), 0) as total_credit,
            (COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)) as balance
        FROM accounts a
        LEFT JOIN journal_entry_lines jel ON a.id = jel.account_id
        LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.is_posted = 1
        WHERE a.company_id = ? AND a.is_active = 1 {type_filter}
        GROUP BY a.id
        HAVING balance != 0
        ORDER BY a.code
    """
    
    accounts = db.fetch_all(query, tuple(params))
    
    for acc in accounts:
        acc['total_debit'] = float(acc.get('total_debit') or 0)
        acc['total_credit'] = float(acc.get('total_credit') or 0)
        acc['balance'] = float(acc.get('balance') or 0)
    
    cache_mgr.set(cache_key, accounts, ttl=60)
    
    logger.info(f"Fetched {len(accounts)} account balances")
    return accounts


# =============================================================================
# FORMATTING HELPERS
# =============================================================================

def format_currency(
    amount: Union[int, float, Decimal, None],
    currency: str = "PKR",
    locale: str = "en_PK"
) -> str:
    """
    Format amount as currency string.
    
    Args:
        amount: Numeric amount
        currency: Currency code (default: PKR)
        locale: Locale string (default: en_PK)
    
    Returns:
        Formatted currency string (e.g., "Rs. 1,234.56")
    """
    if amount is None:
        amount = 0
    
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        amount = 0.0
    
    if currency == "PKR":
        return f"Rs. {amount:,.2f}"
    elif currency == "USD":
        return f"${amount:,.2f}"
    elif currency == "EUR":
        return f"€{amount:,.2f}"
    else:
        return f"{currency} {amount:,.2f}"


def format_date(
    dt: Optional[Union[date, datetime, str]],
    fmt: str = "%Y-%m-%d"
) -> str:
    """
    Format date/datetime to string.
    
    Args:
        dt: Date/datetime object or ISO string
        fmt: Format string (default: YYYY-MM-DD)
    
    Returns:
        Formatted date string
    """
    if dt is None:
        return ""
    
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt).date()
        except ValueError:
            return dt  # Return as-is if parsing fails
    
    if isinstance(dt, datetime):
        dt = dt.date()
    
    try:
        return dt.strftime(fmt)
    except Exception:
        return str(dt)


def format_datetime(
    dt: Optional[Union[date, datetime, str]],
    fmt: str = "%Y-%m-%d %H:%M"
) -> str:
    """
    Format datetime to string.
    
    Args:
        dt: Date/datetime object or ISO string
        fmt: Format string (default: YYYY-MM-DD HH:MM)
    
    Returns:
        Formatted datetime string
    """
    if dt is None:
        return ""
    
    if isinstance(dt, date) and not isinstance(dt, datetime):
        dt = datetime.combine(dt, datetime.min.time())
    
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt)
        except ValueError:
            return dt
    
    try:
        return dt.strftime(fmt)
    except Exception:
        return str(dt)


def safe_get(
    obj: Optional[Dict],
    key: str,
    default: Any = None,
    cast_type: Optional[type] = None
) -> Any:
    """
    Safely get value from dictionary with optional type casting.
    
    Args:
        obj: Dictionary object (can be None)
        key: Key to retrieve
        default: Default value if key missing
        cast_type: Type to cast result to (optional)
    
    Returns:
        Value or default, optionally cast to specified type
    """
    if obj is None:
        return default
    
    value = obj.get(key, default)
    
    if cast_type is not None and value is not None:
        try:
            value = cast_type(value)
        except (TypeError, ValueError):
            value = default
    
    return value


# =============================================================================
# BATCH OPERATION HELPERS
# =============================================================================

def batch_insert(
    db: BaseRepository,
    table_name: str,
    records: List[Dict[str, Any]],
    batch_size: int = 100
) -> int:
    """
    Perform batch insert with automatic chunking.
    
    Args:
        db: Database repository instance
        table_name: Target table name
        records: List of record dictionaries
        batch_size: Records per batch
    
    Returns:
        Total number of inserted records
    """
    if not records:
        return 0
    
    total_inserted = 0
    columns = list(records[0].keys())
    placeholders = ', '.join(['?' for _ in columns])
    col_names = ', '.join(columns)
    
    query = f"""
        INSERT INTO {table_name} ({col_names})
        VALUES ({placeholders})
    """
    
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        values = [tuple(record[col] for col in columns) for record in batch]
        
        try:
            db.executemany(query, values)
            total_inserted += len(batch)
            logger.debug(f"Inserted batch {i//batch_size + 1}: {len(batch)} records")
        except Exception as e:
            logger.error(f"Batch insert failed: {e}")
            raise
    
    logger.info(f"Total batch inserted: {total_inserted} records into {table_name}")
    return total_inserted


def batch_update(
    db: BaseRepository,
    table_name: str,
    records: List[Dict[str, Any]],
    id_column: str = 'id',
    batch_size: int = 100
) -> int:
    """
    Perform batch update with automatic chunking.
    
    Args:
        db: Database repository instance
        table_name: Target table name
        records: List of record dictionaries (must include id_column)
        id_column: Primary key column name
        batch_size: Records per batch
    
    Returns:
        Total number of updated records
    """
    if not records:
        return 0
    
    total_updated = 0
    columns = [col for col in records[0].keys() if col != id_column]
    
    set_clause = ', '.join([f"{col} = ?" for col in columns])
    query = f"""
        UPDATE {table_name}
        SET {set_clause}
        WHERE {id_column} = ?
    """
    
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        values = []
        for record in batch:
            row_values = [record[col] for col in columns]
            row_values.append(record[id_column])
            values.append(tuple(row_values))
        
        try:
            db.executemany(query, values)
            total_updated += len(batch)
            logger.debug(f"Updated batch {i//batch_size + 1}: {len(batch)} records")
        except Exception as e:
            logger.error(f"Batch update failed: {e}")
            raise
    
    logger.info(f"Total batch updated: {total_updated} records in {table_name}")
    return total_updated


# =============================================================================
# VALIDATION HELPERS
# =============================================================================

def validate_required_fields(
    data: Dict[str, Any],
    required_fields: List[str],
    field_labels: Optional[Dict[str, str]] = None
) -> Tuple[bool, List[str]]:
    """
    Validate that all required fields are present and non-empty.
    
    Args:
        data: Data dictionary to validate
        required_fields: List of required field names
        field_labels: Optional mapping of field names to user-friendly labels
    
    Returns:
        Tuple of (is_valid, list_of_error_messages)
    """
    errors = []
    
    for field in required_fields:
        value = data.get(field)
        
        # Check for empty/None values
        if value is None or (isinstance(value, str) and not value.strip()):
            label = field_labels.get(field, field.replace('_', ' ').title())
            errors.append(f"{label} is required")
    
    return (len(errors) == 0, errors)


def validate_numeric_field(
    value: Any,
    field_name: str,
    min_value: Optional[float] = None,
    max_value: Optional[float] = None,
    allow_zero: bool = True
) -> Tuple[bool, Optional[str]]:
    """
    Validate a numeric field with optional range constraints.
    
    Args:
        value: Value to validate
        field_name: Field name for error messages
        min_value: Minimum allowed value (optional)
        max_value: Maximum allowed value (optional)
        allow_zero: Whether zero is allowed
    
    Returns:
        Tuple of (is_valid, error_message_or_None)
    """
    try:
        num_value = float(value)
    except (TypeError, ValueError):
        return (False, f"{field_name} must be a valid number")
    
    if not allow_zero and num_value == 0:
        return (False, f"{field_name} cannot be zero")
    
    if min_value is not None and num_value < min_value:
        return (False, f"{field_name} must be at least {min_value}")
    
    if max_value is not None and num_value > max_value:
        return (False, f"{field_name} must be at most {max_value}")
    
    return (True, None)


def validate_date_range(
    from_date: Optional[date],
    to_date: Optional[date],
    from_label: str = "From Date",
    to_label: str = "To Date"
) -> Tuple[bool, Optional[str]]:
    """
    Validate that date range is logical.
    
    Args:
        from_date: Start date
        to_date: End date
        from_label: Label for from date
        to_label: Label for to date
    
    Returns:
        Tuple of (is_valid, error_message_or_None)
    """
    if from_date and to_date and from_date > to_date:
        return (False, f"{from_label} cannot be after {to_label}")
    
    return (True, None)


# =============================================================================
# PERFORMANCE HELPERS
# =============================================================================

def timed_operation(operation_name: str):
    """
    Decorator to time function execution and log performance.
    
    Usage:
        @timed_operation("Loading dashboard")
        def load_dashboard():
            pass
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            start = time.time()
            result = func(*args, **kwargs)
            duration_ms = (time.time() - start) * 1000
            
            logger.info(
                f"⏱️ {operation_name}: {duration_ms:.2f}ms",
                extra={'duration_ms': duration_ms, 'operation': operation_name}
            )
            
            return result
        return wrapper
    return decorator


class TimedBlock:
    """
    Context manager to time code blocks.
    
    Usage:
        with TimedBlock("Processing items"):
            process_items()
    """
    def __init__(self, operation_name: str):
        self.operation_name = operation_name
        self.start_time = None
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration_ms = (time.time() - self.start_time) * 1000
        logger.info(
            f"⏱️ {self.operation_name}: {duration_ms:.2f}ms",
            extra={'duration_ms': duration_ms, 'operation': self.operation_name}
        )


# =============================================================================
# EXPORT ALL PUBLIC FUNCTIONS
# =============================================================================

__all__ = [
    # Database query helpers
    'fetch_all_items_with_stock',
    'fetch_item_by_id_with_stock',
    'fetch_invoices_with_customer',
    'fetch_party_ledger',
    'fetch_account_balances',
    
    # Formatting helpers
    'format_currency',
    'format_date',
    'format_datetime',
    'safe_get',
    
    # Batch operations
    'batch_insert',
    'batch_update',
    
    # Validation
    'validate_required_fields',
    'validate_numeric_field',
    'validate_date_range',
    
    # Performance
    'timed_operation',
    'TimedBlock',
]
