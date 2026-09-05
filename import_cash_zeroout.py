"""
Zero out Cash (1000) to match old books (old cash 111 = 0).
Counter to Retained Earnings (3100).
Entry: Dr 3100 85,185,208.00 / Cr 1000 85,185,208.00
Resumable via narration marker.
"""
import os
import sys
import time

os.environ["ERP_LOG_LEVEL"] = "CRITICAL"
os.environ["ERP_DB_ENGINE"] = "sqlitecloud"
os.environ["SQLITE_CLOUD_URL"] = ""

sys.path.insert(0, r"F:\software\final\BOP-software")

from database.connection import get_db, close_db
from repositories.journal_repository import JournalRepository

AMOUNT = 85185208.00
ENTRY_DATE = "2026-08-31"
MARKER = "Cash zero-out vs old books (Imported from PharmaPro)"


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def main():
    t0 = time.time()
    db = get_db()
    journal_repo = JournalRepository(db)

    cash = db.fetch_one("SELECT id FROM accounts WHERE account_code = '1000'")
    re = db.fetch_one("SELECT id FROM accounts WHERE account_code = '3100'")
    if not cash or not re:
        log("FATAL: Cash (1000) or Retained Earnings (3100) not found.")
        close_db()
        return

    existing = db.fetch_all(f"SELECT id FROM journal_entries WHERE narration = '{MARKER}'")
    if existing:
        log(f"Already imported ({len(existing)}). Nothing to do.")
        close_db()
        return

    voucher_number = journal_repo.next_voucher_number(1, "OPENING")
    journal_headers = [
        {
            "company_id": 1,
            "voucher_number": voucher_number,
            "voucher_type": "OPENING",
            "entry_date": ENTRY_DATE,
            "narration": MARKER,
            "source_table": None,
            "source_id": None,
            "is_posted": 1,
            "created_by": None,
        }
    ]
    journal_lines = [
        [
            {"account_id": re["id"], "debit": AMOUNT, "credit": 0.0, "description": "Cash zero-out vs old books"},
            {"account_id": cash["id"], "debit": 0.0, "credit": AMOUNT, "description": "Cash zero-out vs old books"},
        ]
    ]
    journal_repo.insert_entries_bulk(journal_headers, journal_lines)
    log(f"Posted {voucher_number}: Dr 3100 {AMOUNT:,.2f} / Cr 1000 {AMOUNT:,.2f}")

    print("\n===== SUMMARY =====", flush=True)
    print(f"Created: 1", flush=True)
    print(f"Amount: {AMOUNT:,.2f}", flush=True)
    print(f"Elapsed: {time.time() - t0:.1f}s", flush=True)

    close_db()


if __name__ == "__main__":
    main()