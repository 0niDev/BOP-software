"""
Import the expense side of the Journal Vouchers (JV) from JournalVouchersBody.csv.

The JV entries debit expense accounts (52062 -> 6000, 5121 -> 6100) and credit
party accounts (620080/620083/620096). The party credits were already absorbed
into opening balances (party balances match old books exactly), and the Credit
Voucher to 14001/1505 is already reflected in the fixed-asset reconcile. So here
we book only the expense debits, balancing against Retained Earnings (3100).

JV expense lines (all IsPosted=True):
  V1 (05/03): Dr 52062 1,800  "Discount"                -> 6000
  V3 (05/05): Dr 52062 7,050  "Bility Exp"              -> 6000
  V4 (06/07): Dr 5121 16,800  "Discount FOC MLC 100"    -> 6100
  Total 25,650 -> Cr 3100 25,650

Resumable via narration marker.
"""
import csv
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

JVB_FILE = r"F:\software\final\BOP-software\PharmaPro_Export\JournalVouchersBody.csv"

# old account -> new expense account
EXPENSE_MAP = {
    "52062": "6000",  # Supply And Bility expenses (G&A)
    "5121": "6100",   # Special discount on sale (selling)
}

NARR_MARKER = "(Imported from PharmaPro JV)"


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def to_iso_date(d):
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", d or "")
    if not m:
        return None
    mm, dd, yyyy = m.groups()
    return f"{yyyy}-{mm}-{dd}"


def main():
    # ---- parse JV body (expense debit lines only) ----
    lines = []  # (old_acct, new_code, date_iso, narration, amount)
    with open(JVB_FILE, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            acct = (row["AccountNo"] or "").strip()
            debit = float(row["Debit"] or 0)
            if acct in EXPENSE_MAP and debit > 0:
                lines.append(
                    (
                        acct,
                        EXPENSE_MAP[acct],
                        to_iso_date(row.get("VoucherDate")),
                        (row.get("Narration") or "").strip(),
                        round(debit, 2),
                    )
                )

    log(f"Parsed {len(lines)} JV expense lines, total={sum(l[4] for l in lines):,.2f}")
    for old, code, d, narr, amt in lines:
        log(f"  {d} {old}->{code} {amt:,.2f} | {narr}")

    db = get_db()
    journal_repo = JournalRepository(db)

    acct_ids = {}
    for code in ("6000", "6100", "3100"):
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
    imported_keys = set()
    for row in existing:
        m = re.search(r"JV (.*?) \(Imported from PharmaPro JV\)", row["narration"] or "")
        if m:
            imported_keys.add(m.group(1))
    log(f"Already imported: {len(imported_keys)} lines")

    remaining = []
    for old_acct, code, date_iso, narr, amt in lines:
        key = f"{old_acct}|{date_iso}|{amt:.2f}"
        if key not in imported_keys:
            remaining.append((old_acct, code, date_iso, narr, amt))
    log(f"Remaining to import: {len(remaining)}")

    if not remaining:
        log("Nothing to do.")
        close_db()
        return

    t0 = time.time()
    created = 0
    try:
        with db.transaction():
            voucher_numbers = journal_repo.next_voucher_numbers(1, "OPENING", len(remaining))
            journal_headers: list[dict] = []
            journal_lines: list[list[dict]] = []
            for i, (old_acct, code, date_iso, narr, amt) in enumerate(remaining):
                key = f"{old_acct}|{date_iso}|{amt:.2f}"
                journal_lines.append(
                    [
                        {
                            "account_id": acct_ids[code],
                            "debit": amt,
                            "credit": 0.0,
                            "description": narr or f"Historical JV expense ({old_acct})",
                        },
                        {
                            "account_id": acct_ids["3100"],
                            "debit": 0.0,
                            "credit": amt,
                            "description": narr or f"Historical JV expense ({old_acct})",
                        },
                    ]
                )
                journal_headers.append(
                    {
                        "company_id": 1,
                        "voucher_number": voucher_numbers[i],
                        "voucher_type": "OPENING",
                        "entry_date": date_iso or "2026-08-31",
                        "narration": f"JV {key} {NARR_MARKER}",
                        "source_table": None,
                        "source_id": None,
                        "is_posted": 1,
                        "created_by": None,
                    }
                )
            journal_repo.insert_entries_bulk(journal_headers, journal_lines)
            created += len(journal_headers)
        log(f"Imported {created} JV expense lines ({voucher_numbers[0]}..{voucher_numbers[-1]})")
    except Exception as exc:
        log(f"FAILED: {exc}")

    print("\n===== SUMMARY =====", flush=True)
    print(f"Created: {created}", flush=True)
    print(f"Total value: {round(sum(l[4] for l in remaining), 2)}", flush=True)
    print(f"Elapsed: {time.time() - t0:.1f}s", flush=True)

    close_db()


if __name__ == "__main__":
    main()