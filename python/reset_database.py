"""
Reset the database: drop all tables, re-run migrations, then seed fresh data.
This gives a clean slate for running import scripts.
"""
import os
import sys

from utils.env_loader import setup_import_env
setup_import_env()

from database.connection import get_db, close_db
from database.schema import ALL_STATEMENTS
from database.migrations.migrator import Migrator


def main():
    db = get_db()

    # Get all table names
    tables = [r["name"] for r in db.fetch_all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    )]
    print(f"Found {len(tables)} tables to drop")

    # Drop all tables - use raw connection to disable FK checks
    conn = db._get_cached_connection()
    try:
        conn.execute("PRAGMA foreign_keys = OFF")
        for t in tables:
            conn.execute(f"DROP TABLE IF EXISTS [{t}]")
            print(f"  Dropped {t}")
        conn.execute("PRAGMA foreign_keys = ON")
    finally:
        db._return_connection(conn)

    print("\nRe-running migrations...")
    migrator = Migrator(db)
    migrator.run()

    close_db()
    print("\nDatabase reset complete.")


if __name__ == "__main__":
    main()
