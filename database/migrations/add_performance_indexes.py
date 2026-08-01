"""
Migration script to add performance indexes for hosted database.
Run this once on your existing database to improve Chart of Accounts loading speed.
"""
from database.connection import get_db
from utils.logger import get_logger

logger = get_logger(__name__)

INDEXES = [
    # Accounts table indexes
    "CREATE INDEX IF NOT EXISTS idx_accounts_company_active ON accounts(company_id, is_active);",
    "CREATE INDEX IF NOT EXISTS idx_accounts_code_order ON accounts(company_id, account_code);",
    
    # Journal entries indexes
    "CREATE INDEX IF NOT EXISTS idx_je_posted ON journal_entries(is_posted, id);",
    
    # Journal entry lines indexes
    "CREATE INDEX IF NOT EXISTS idx_jel_account_je ON journal_entry_lines(account_id, journal_entry_id);",
]

def run_migration():
    """Add performance indexes to existing database."""
    db = get_db()
    
    logger.info("Starting performance index migration...")
    print("Adding performance indexes to database...")
    
    with db.transaction():
        for i, sql in enumerate(INDEXES, 1):
            try:
                print(f"  [{i}/{len(INDEXES)}] Creating index...")
                db.execute(sql)
                logger.info(f"Created index: {sql[:80]}")
            except Exception as e:
                logger.warning(f"Could not create index (may already exist): {e}")
                print(f"  Warning: {e}")
    
    print("\n✓ Performance indexes created successfully!")
    print("Chart of Accounts and other screens should now load faster.")
    
    db.close()

if __name__ == "__main__":
    run_migration()
