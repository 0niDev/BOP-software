"""Initialize the database."""
from database.connection import get_db
from database.migrations.migrator import run_migrations
from utils.logger import get_logger

logger = get_logger(__name__)

def init_database():
    """Initialize the database with schema and seed data."""
    logger.info("Initializing database...")
    db = get_db()
    run_migrations(db)
    logger.info("Database initialization complete!")

if __name__ == "__main__":
    init_database()