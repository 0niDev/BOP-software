"""
Add performance indexes to database for optimized query execution.

These indexes are critical for achieving the 10x performance improvement target.
Run this script once to add all recommended covering indexes.
"""
from database.connection import get_db
from utils.logger import get_logger

logger = get_logger(__name__)


def add_performance_indexes():
    """Add all performance-optimized indexes."""
    db = get_db()
    
    indexes = [
        # Dashboard KPI queries
        ("idx_accounts_company_type_active", 
         "accounts", 
         "company_id, account_type, is_active"),
        
        # Date-range journal queries
        ("idx_je_company_date_posted",
         "journal_entries",
         "company_id, entry_date, is_posted"),
        
        # Invoice lookups with customer info
        ("idx_si_customer_date_status",
         "sales_invoices",
         "customer_id, invoice_date, status"),
        
        # Party ledger queries
        ("idx_jel_account_je_date",
         "journal_entry_lines",
         "account_id, journal_entry_id"),
        
        # Item lookups by company
        ("idx_items_company_code",
         "items",
         "company_id, item_code"),
        
        # Purchase invoice queries
        ("idx_pi_supplier_date_status",
         "purchase_invoices",
         "supplier_id, invoice_date, status"),
        
        # Stock batch queries
        ("idx_stock_item_qty",
         "stock_batches",
         "item_id, quantity_in_stock"),
        
        # Payment queries
        ("idx_payment_date_account",
         "payments",
         "payment_date, account_id"),
        
        # Sales invoice items
        ("idx_sii_invoice_item",
         "sales_invoice_items",
         "invoice_id, item_id"),
        
        # Purchase invoice items
        ("idx_pii_invoice_item",
         "purchase_invoice_items",
         "invoice_id, item_id"),
        
        # Production orders
        ("idx_po_status_date",
         "production_orders",
         "status, order_date"),
        
        # BOM lookups
        ("idx_bom_item_active",
         "bill_of_materials",
         "item_id, is_active"),
        
        # Expense queries
        ("idx_expense_date_account",
         "expenses",
         "expense_date, account_id"),
        
        # Banking transactions
        ("idx_banking_date_account",
         "banking_transactions",
         "transaction_date, account_id"),
        
        # User lookups
        ("idx_users_username_active",
         "users",
         "username, is_active"),
    ]
    
    created = 0
    skipped = 0
    errors = 0
    
    for index_name, table_name, columns in indexes:
        try:
            # Check if index already exists
            existing = db.fetch_one(
                "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
                (index_name,)
            )
            
            if existing:
                logger.info(f"✓ Index {index_name} already exists")
                skipped += 1
                continue
            
            # Create index
            sql = f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} ({columns})"
            db.execute(sql)
            logger.info(f"✓ Created index: {index_name} on {table_name}({columns})")
            created += 1
            
        except Exception as e:
            logger.error(f"✗ Failed to create index {index_name}: {e}")
            errors += 1
    
    logger.info(f"\n=== Index Creation Summary ===")
    logger.info(f"Created: {created}")
    logger.info(f"Skipped (already exist): {skipped}")
    logger.info(f"Errors: {errors}")
    logger.info(f"Total: {len(indexes)}")
    
    return {"created": created, "skipped": skipped, "errors": errors}


if __name__ == "__main__":
    print("Adding performance indexes to database...")
    result = add_performance_indexes()
    print(f"\nCompleted: {result['created']} created, {result['skipped']} skipped, {result['errors']} errors")
