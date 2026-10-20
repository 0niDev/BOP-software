#!/usr/bin/env python3
"""
Reset all transactional data to zero while keeping:
- Formulations (BOMs) and products
- Chart of Accounts structure (zero balances)
- Parties structure (zero balances)
- Reference tables (companies, warehouses, users, settings, etc.)
- Expense categories (names only, zero expenses)
- Bank accounts (zero balances)
- Document numbering sequences (reset to 1)
"""
import os
import sys

os.environ.setdefault("ERP_DB_ENGINE", "sqlitecloud")
os.environ.setdefault("ERP_LOG_LEVEL", "INFO")

from database.connection import get_db, close_db
from utils.logger import get_logger

logger = get_logger(__name__)

# Tables to TRUNCATE (child first for FK safety)
TRUNCATE_TABLES = [
    # Journal (child first)
    "journal_entry_lines",
    "journal_entries",
    
    # Sales
    "sales_invoice_items",
    "sales_invoices",
    "sales_return_items",
    "sales_returns",
    
    # Purchases
    "purchase_invoice_items",
    "purchase_invoices",
    "purchase_return_items",
    "purchase_returns",
    
    # Payments/Receipts
    "payment_allocations",
    "payments",
    "receipt_allocations",
    "receipts",
    
    # Expenses (keep expense_categories)
    "expense_items",
    "expenses",
    
    # Manufacturing
    "production_consumption",
    "production_orders",
    
    # Inventory/Stock
    "stock_movements",
    "stock_batches",
    "stock_losses",
    
    # Banking
    "bank_transactions",
    "cheques",
    
    # Assets
    "asset_details",
    
    # Audit
    "audit_log",
]

# Tables to UPDATE (zero balances)
ZERO_BALANCE_UPDATES = [
    ("accounts", "opening_balance = 0"),
    ("parties", "opening_balance = 0, credit_limit = 0"),
    ("bank_accounts", "opening_balance = 0"),
]

# Numbering sequences reset
RESET_NUMBERING = """
UPDATE numbering_sequences SET next_number = 1 WHERE company_id = 1
"""

def main():
    db = get_db()
    
    logger.info("=" * 60)
    logger.info("RESETTING TRANSACTIONAL DATA")
    logger.info("=" * 60)
    
    try:
        # Disable FK checks for truncation
        logger.info("Disabling foreign key checks...")
        db.execute("PRAGMA foreign_keys = OFF")
        
        # Truncate tables
        for table in TRUNCATE_TABLES:
            try:
                count_before = db.fetch_one(f"SELECT COUNT(*) as cnt FROM {table}")["cnt"]
                if count_before > 0:
                    db.execute(f"DELETE FROM {table}")
                    logger.info(f"  TRUNCATED {table}: {count_before} rows removed")
                else:
                    logger.info(f"  SKIP {table}: already empty")
            except Exception as e:
                logger.warning(f"  WARNING {table}: {e}")
        
        # Zero balances
        logger.info("\nZeroing balances...")
        for table, set_clause in ZERO_BALANCE_UPDATES:
            try:
                count = db.fetch_one(f"SELECT COUNT(*) as cnt FROM {table} WHERE company_id = 1")["cnt"]
                if count > 0:
                    db.execute(f"UPDATE {table} SET {set_clause} WHERE company_id = 1")
                    logger.info(f"  ZEROED {table}: {count} rows updated")
            except Exception as e:
                logger.warning(f"  WARNING {table}: {e}")
        
        # Reset numbering sequences
        logger.info("\nResetting numbering sequences...")
        db.execute(RESET_NUMBERING)
        logger.info("  Numbering sequences reset to 1")
        
        # Re-enable FK checks
        logger.info("\nRe-enabling foreign key checks...")
        db.execute("PRAGMA foreign_keys = ON")
        
        # Verify
        logger.info("\n" + "=" * 60)
        logger.info("VERIFICATION")
        logger.info("=" * 60)
        
        # Check truncated tables
        for table in TRUNCATE_TABLES:
            try:
                cnt = db.fetch_one(f"SELECT COUNT(*) as cnt FROM {table}")["cnt"]
                if cnt > 0:
                    logger.warning(f"  {table}: {cnt} rows REMAIN (should be 0)")
            except:
                pass
        
        # Check balances
        for table, _ in ZERO_BALANCE_UPDATES:
            try:
                rows = db.fetch_all(f"SELECT opening_balance FROM {table} WHERE company_id = 1 AND opening_balance != 0")
                if rows:
                    logger.warning(f"  {table}: {len(rows)} rows have non-zero opening_balance")
            except:
                pass
        
        # Check numbering
        seqs = db.fetch_all("SELECT document_type, next_number FROM numbering_sequences WHERE company_id = 1")
        for s in seqs:
            logger.info(f"  {s['document_type']}: next = {s['next_number']}")
        
        logger.info("\n" + "=" * 60)
        logger.info("RESET COMPLETE")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.exception(f"RESET FAILED: {e}")
        raise
    finally:
        close_db()

if __name__ == "__main__":
    main()