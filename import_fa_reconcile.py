"""
Reconcile imported fixed assets (1501-1505) to old books' final balances.

The DV import booked the full debit side of each instalment/asset voucher, but the
old books' final balances (AccountsBalances.csv) reflect net asset values. The
differences are reclassed against Retained Earnings (3100) to keep the balance
sheet balanced.

Adjustments (current -> target):
  1501 HBL Instalment:       9,750,372 -> 3,650,372  (cr 6,100,000)
  1502 Motor Car Instalment:    738,150 ->    47,500  (cr   690,650)
  1503 Auto Vehicles:           505,000 ->   505,000  (none)
  1504 Furniture:                94,000 ->    94,000  (none)
  1505 Car Sale & Purchase:     175,700 -> Cr 200,000 (cr   375,700)

  Total credit to assets 7,166,350 / debit to 3100 7,166,350.
"""
import os
import re
import sys
import time

os.environ["ERP_LOG_LEVEL"] = "CRITICAL"
os.environ["ERP_DB_ENGINE"] = "sqlitecloud"
os.environ["SQLITE_CLOUD_URL"] = ""

sys.path.insert(0, r"F:\software\final\BOP-software")

from database.connection import get_db, close_db
from repositories.journal_repository import JournalRepository

NARR_MARKER = "(Fixed asset reconcile to old books)"


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def main():
    # target balances per account code
    ADJUSTMENTS = [
        # (account_code, credit_amount)
        ("1501", 6100000.00),
        ("1502", 690650.00),
        ("1505", 375700.00),
    ]
    total_cr = sum(a for _, a in ADJUSTMENTS)

    db = get_db()
    journal_repo = JournalRepository(db)

    # lookups
    acct_ids = {}
    for code in ("1501", "1502", "1505", "3100"):
        r = db.fetch_one("SELECT id FROM accounts WHERE account_code = ?", (code,))
        if not r:
            log(f"FATAL: account {code} not found.")
            close_db()
            return
        acct_ids[code] = r["id"]

    # resumability
    existing = db.fetch_all(
        "SELECT narration FROM journal_entries WHERE narration LIKE ?",
        (f"%{NARR_MARKER}%",),
    )
    if existing:
        log(f"Already imported ({len(existing)} entries). Nothing to do.")
        close_db()
        return

    t0 = time.time()
    try:
        with db.transaction():
            voucher_numbers = journal_repo.next_voucher_numbers(1, "OPENING", 1)
            lines = []
            for code, amt in ADJUSTMENTS:
                lines.append(
                    {
                        "account_id": acct_ids[code],
                        "debit": 0.0,
                        "credit": amt,
                        "description": f"Reconcile fixed asset {code} to old books",
                    }
                )
            lines.append(
                {
                    "account_id": acct_ids["3100"],
                    "debit": total_cr,
                    "credit": 0.0,
                    "description": "Reclass fixed asset overstatement to Retained Earnings",
                }
            )
            header = {
                "company_id": 1,
                "voucher_number": voucher_numbers[0],
                "voucher_type": "OPENING",
                "entry_date": "2026-08-31",
                "narration": NARR_MARKER,
                "source_table": None,
                "source_id": None,
                "is_posted": 1,
                "created_by": None,
            }
            journal_repo.insert_entries_bulk([header], [lines])
        log(f"Imported reconcile entry {voucher_numbers[0]}, total={total_cr:,.2f}")
    except Exception as exc:
        log(f"FAILED: {exc}")

    print("\n===== SUMMARY =====", flush=True)
    print(f"Total credit to assets: {total_cr:,.2f}", flush=True)
    print(f"Elapsed: {time.time() - t0:.1f}s", flush=True)

    close_db()


if __name__ == "__main__":
    main()