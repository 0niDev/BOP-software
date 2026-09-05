"""
Import non-party DV expense/asset debits from DebitVouchersBody.csv as ONE
journal entry PER LINE (each with its own voucher date + narration).

Dr mapped Expense/Asset account, Cr Retained Earnings 3100.
Cash was already zeroed out vs old books (import_cash_zeroout.py), so booking
against Retained Earnings keeps the balance sheet balanced and gives a real P&L
with correct monthly breakdown.

Classification (old account -> new account):
  6000 (G&A): salaries, building, DR. Abdul Razzaq, utilities, registration, etc.
  6100 (Selling): market team, incentives, market salary, tours
  1500 (Fixed Assets): HBL instalment, car instalment, vehicles, furniture

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

BATCH_SIZE = 100

DVB_FILE = r"F:\software\final\BOP-software\PharmaPro_Export\DebitVouchersBody.csv"

# old account -> new account code
G_A_ACCOUNTS = {
    "54001", "52023", "64002", "52014", "52009", "52010", "52005",
    "52002", "52062", "52001", "52055", "64008", "5211001", "52054",
    "546", "540001", "55001", "52024", "520907", "52022", "5113",
    "540", "547",
}
SELLING_ACCOUNTS = {
    "52015", "548", "549", "519", "544",
}
# old account -> new asset account (keep each asset separate)
FIXED_ASSET_MAP = {  # old account -> new asset account code
    "12001": "1501",  # HBL Instalment
    "12003": "1502",  # Instalment of Motor Car
    "1211": "1503",   # Auto Vehicles
    "1221": "1504",   # Furniture & Fixtures
    "14001": "1505",  # Car Sale And Purchase
}

MAP_TO = {  # new account code
    "6000": G_A_ACCOUNTS,
    "6100": SELLING_ACCOUNTS,
}


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def to_iso_date(d):
    """Convert 'MM/DD/YYYY HH:MM:SS' to 'YYYY-MM-DD'."""
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", d or "")
    if not m:
        return None
    mm, dd, yyyy = m.groups()
    return f"{yyyy}-{mm}-{dd}"


def main():
    t0 = time.time()

    # ---- parse DV body (non-party lines only) ----
    lines = []  # (old_acct, date_iso, narration, amount)
    with open(DVB_FILE, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            acct = (row["AccountNo"] or "").strip()
            if acct.startswith(("61", "62")):
                continue  # party lines handled by payment/opening scripts
            amt = float(row["Debit"] or 0)
            if amt <= 0:
                continue
            date_iso = to_iso_date(row.get("VoucherDate"))
            narr = (row.get("Narration") or "").strip()
            lines.append((acct, date_iso, narr, round(amt, 2)))

    log(f"Parsed {len(lines)} non-party DV lines, total={sum(l[3] for l in lines):,.2f}")

    # ---- map each line ----
    items = []  # (old_acct, new_code, date_iso, narration, amount)
    unmapped = set()
    for old_acct, date_iso, narr, amt in lines:
        target = FIXED_ASSET_MAP.get(old_acct)
        if target is None:
            for new_code, old_set in MAP_TO.items():
                if old_acct in old_set:
                    target = new_code
                    break
        if target is None:
            unmapped.add(old_acct)
            continue
        items.append((old_acct, target, date_iso, narr, amt))

    log(f"Mapped {len(items)} lines, total={sum(it[4] for it in items):,.2f}, "
        f"unmapped accounts: {sorted(unmapped)}")

    # per-new-account summary
    from collections import defaultdict
    by_code = defaultdict(float)
    for _, code, _, _, amt in items:
        by_code[code] += amt
    for code, amt in sorted(by_code.items()):
        log(f"  -> {code}: {amt:,.2f}")

    db = get_db()
    journal_repo = JournalRepository(db)

    # ---- lookups ----
    acct_ids = {}
    for code in ("6000", "6100", "1500", "1501", "1502", "1503", "1504", "1505", "3100"):
        r = db.fetch_one("SELECT id FROM accounts WHERE account_code = ?", (code,))
        if not r:
            log(f"FATAL: account {code} not found.")
            close_db()
            return
        acct_ids[code] = r["id"]
    re_id = acct_ids["3100"]

    # ---- resumability ----
    existing = db.fetch_all(
        "SELECT narration FROM journal_entries WHERE narration LIKE '%(Imported from PharmaPro DV)%'"
    )
    imported_keys = set()
    for row in existing:
        m = re.search(r"DV (.*?) \(Imported from PharmaPro DV\)", row["narration"] or "")
        if m:
            imported_keys.add(m.group(1))
    log(f"Already imported: {len(imported_keys)} lines (resumable skip)")

    remaining = []
    for old_acct, code, date_iso, narr, amt in items:
        key = f"{old_acct}|{date_iso}|{amt:.2f}"
        if key not in imported_keys:
            remaining.append((old_acct, code, date_iso, narr, amt))
    log(f"Remaining to import: {len(remaining)}")

    if not remaining:
        log("Nothing to do.")
        close_db()
        return

    # ---- run in batches ----
    created = 0
    failed = 0
    total_value = 0.0
    batch_num = 0

    for start in range(0, len(remaining), BATCH_SIZE):
        batch_num += 1
        batch = remaining[start : start + BATCH_SIZE]
        t1 = time.time()
        try:
            with db.transaction():
                voucher_numbers = journal_repo.next_voucher_numbers(1, "OPENING", len(batch))
                journal_headers: list[dict] = []
                journal_lines: list[list[dict]] = []
                for i, (old_acct, code, date_iso, narr, amt) in enumerate(batch):
                    key = f"{old_acct}|{date_iso}|{amt:.2f}"
                    journal_lines.append(
                        [
                            {
                                "account_id": acct_ids[code],
                                "debit": amt,
                                "credit": 0.0,
                                "description": narr or f"Historical DV expenses ({old_acct})",
                            },
                            {
                                "account_id": re_id,
                                "debit": 0.0,
                                "credit": amt,
                                "description": narr or f"Historical DV expenses ({old_acct})",
                            },
                        ]
                    )
                    journal_headers.append(
                        {
                            "company_id": 1,
                            "voucher_number": voucher_numbers[i],
                            "voucher_type": "OPENING",
                            "entry_date": date_iso or "2026-08-31",
                            "narration": f"DV {key} (Imported from PharmaPro DV)",
                            "source_table": None,
                            "source_id": None,
                            "is_posted": 1,
                            "created_by": None,
                        }
                    )
                journal_repo.insert_entries_bulk(journal_headers, journal_lines)
                created += len(journal_headers)
                total_value += sum(it[4] for it in batch)
            log(
                f"  Batch {batch_num}: imported {len(journal_headers)} lines "
                f"({voucher_numbers[0]}..{voucher_numbers[-1]}) "
                f"value={round(sum(it[4] for it in batch), 2)} in {time.time() - t1:.1f}s"
            )
        except Exception as exc:
            log(f"  Batch {batch_num} FAILED: {exc}")
            failed += len(batch)
            continue

    print("\n===== SUMMARY =====", flush=True)
    print(f"Created: {created}", flush=True)
    print(f"Failed:  {failed}", flush=True)
    print(f"Total value: {round(total_value, 2)}", flush=True)
    print(f"Elapsed: {time.time() - t0:.1f}s", flush=True)

    close_db()


if __name__ == "__main__":
    main()