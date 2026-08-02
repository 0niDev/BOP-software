# add_bom_numbering.py
from database.connection import get_db
from utils.logger import get_logger

logger = get_logger(__name__)

def add_bom_numbering():
    db = get_db()
    
    # Check if BOM numbering exists
    existing = db.fetch_one(
        "SELECT id FROM numbering_sequences WHERE document_type = 'BOM'"
    )
    if not existing:
        db.execute("""
            INSERT INTO numbering_sequences (company_id, document_type, prefix, next_number, padding)
            VALUES (1, 'BOM', 'BOM-', 1, 5)
        """)
        logger.info("[OK] Added BOM numbering")
    else:
        logger.info("⏭️ BOM numbering already exists")
    
    logger.info("[OK] BOM numbering setup complete!")

if __name__ == "__main__":
    add_bom_numbering()