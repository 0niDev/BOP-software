"""
Populate the Expenses tab (expense_categories + expenses tables) from the
already-imported DV/JV expense journal entries.

The DV/JV expense import (import_dv_expenses.py / import_jv_expenses.py) posts
journal entries but never writes to the UI tables, so the Expenses tab is empty.
This script fills those tables WITHOUT posting any new journal entries:

- one expense category per old expense account (name from ChartOfAccounts.csv,
  linked to the mapped 6000/6100 account)
- one expense row per non-party DV/JV expense line (Dr 6000/6100 only;
  fixed-asset lines are excluded - they are not expenses)
- voucher numbers from the EXPENSE_VOUCHER sequence (EV-xxxxx)

Resumable: skips voucher numbers already present in the expenses table.
"""
from __future__ import annotations

import csv
import os
import re
import sys
import time

os.environ["ERP_LOG_LEVEL"] = "CRITICAL"
os.environ["ERP_DB_ENGINE"] = "sqlitecloud"
os.environ["SQLITE_CLOUD_URL"] = (
    "sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/erp_backup_20260820_023705.db?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw"
)

sys.path.insert(0, r"F:\software\final\BOP-software")

from database.connection import get_db, close_db
from repositories.journal_repository import JournalRepository

DVB_FILE = r"F:\software\final\BOP-software\PharmaPro_Export\DebitVouchersBody.csv"
JVB_FILE = r"F:\software\final\BOP-software\PharmaPro_Export\JournalVouchersBody.csv"
COA_FILE = r"F:\software\final\BOP-software\PharmaPro_Export\ChartOfAccounts.csv"

BATCH_SIZE = 100

# old account -> new account code (same mapping as import_dv_expenses.py)
G_A_ACCOUNTS = {
    "54001", "52023", "64002", "52014", "52009", "52010", "52005",
    "52002", "52062", "52001", "52055", "64008", "5211001", "52054",
    "546", "540001", "55001", "52024", "520907", "52022", "5113",
    "540", "547",
}
SELLING_ACCOUNTS = {"52015", "548", "549", "519", "544"}
FIXED_ASSET_MAP = {  # old account -> new asset account (NOT expenses)
    "12001": "1501", "12003": "1502", "1211": "1503", "1221": "1504", "14001": "1505",
}

MAP_TO = {"6000": G_A_ACCOUNTS, "6100": SELLING_ACCOUNTS}

# old account -> new expense account (JV, same as import_jv_expenses.py)
JV_EXPENSE_MAP = {"52062": "6000", "5121": "6100"}


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def to_iso_date(d):
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", d or "")
    if not m:
        return None
    mm, dd, yyyy = m.groups()
    return f"{yyyy}-{mm}-{dd}"


def parse_account_names() -> dict[str, str]:
    names = {}
    with open(COA_FILE, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            code = (row["AccountNo"] or "").strip()
            name = (row["AccountName"] or "").strip()
            if code:
                names[code] = name
    return names


def map_expense_target(old_acct: str) -> str | None:
    """Map an old account to 6000/6100, or None if it is a fixed asset / unknown."""
    if old_acct in FIXED_ASSET_MAP:
        return None
    for new_code, old_set in MAP_TO.items():
        if old_acct in old_set:
            return new_code
    return None


def main():
    t0 = time.time()
    acct_names = parse_account_names()

    # ---- parse DV body: non-party expense lines (6000/6100 only) ----
    dv_lines = []  # (old_acct, new_code, date_iso, narration, amount)
    with open(DVB_FILE, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            acct = (row["AccountNo"] or "").strip()
            if acct.startswith(("61", "62")):
                continue
            amt = float(row["Debit"] or 0)
            if amt <= 0:
                continue
            target = map_expense_target(acct)
            if target is None:
                continue
            dv_lines.append(
                (acct, target, to_iso_date(row.get("VoucherDate")),
                 (row.get("Narration") or "").strip(), round(amt, 2))
            )

    # ---- parse JV body: expense debit lines ----
    jv_lines = []
    with open(JVB_FILE, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            acct = (row["AccountNo"] or "").strip()
            debit = float(row["Debit"] or 0)
            if acct in JV_EXPENSE_MAP and debit > 0:
                jv_lines.append(
                    (acct, JV_EXPENSE_MAP[acct], to_iso_date(row.get("VoucherDate")),
                     (row.get("Narration") or "").strip(), round(debit, 2))
                )

    all_lines = dv_lines + jv_lines
    log(f"Parsed {len(dv_lines)} DV + {len(jv_lines)} JV = {len(all_lines)} expense lines, "
        f"total={sum(l[4] for l in all_lines):,.2f}")

    db = get_db()
    journal_repo = JournalRepository(db)

    # ---- accounts lookup ----
    acct_ids = {}
    for code in ("6000", "6100"):
        r = db.fetch_one("SELECT id FROM accounts WHERE account_code = ?", (code,))
        if not r:
            log(f"FATAL: account {code} not found.")
            close_db()
            return
        acct_ids[code] = r["id"]

    # ---- create expense categories (one per old expense account) ----
    categories = {}  # old_acct -> category_id
    for old_acct, code, _date, _narr, _amt in all_lines:
        if old_acct in categories:
            continue
        name = acct_names.get(old_acct, f"Expense ({old_acct})")
        existing = db.fetch_one(
            "SELECT id FROM expense_categories WHERE company_id = 1 AND name = ?",
            (name,),
        )
        if existing:
            categories[old_acct] = existing["id"]
            continue
        r = db.execute(
            "INSERT INTO expense_categories (company_id, name, account_id, is_active) VALUES (1, ?, ?, 1)",
            (name, acct_ids[code]),
        )
        categories[old_acct] = db.last_insert_id()
    log(f"Expense categories ensured: {len(categories)}")

    # ---- resumability: skip if any EV- expense rows already exist ----
    existing_keys = set(
        r["voucher_number"] for r in db.fetch_all(
            "SELECT voucher_number FROM expenses WHERE voucher_number LIKE 'EV-%'"
        )
    )
    log(f"Already imported expense rows: {len(existing_keys)}")

    # ---- build expense rows ----
    remaining = []
    for old_acct, code, date_iso, narr, amt in all_lines:
        remaining.append((old_acct, categories[old_acct], date_iso, narr, amt))

    if existing_keys:
        # IDs are not reusable; any EV- row means the import already ran.
        remaining = []
    log(f"Remaining expense rows: {len(remaining)}")

    if not remaining:
        log("Nothing to do.")
        close_db()
        return

    # ---- generate unique voucher numbers and insert ----
    created = 0
    total_value = 0.0
    for start in range(0, len(remaining), BATCH_SIZE):
        batch = remaining[start : start + BATCH_SIZE]
        t1 = time.time()
        try:
            with db.transaction():
                voucher_numbers = journal_repo.next_voucher_numbers(
                    1, "EXPENSE_VOUCHER", len(batch)
                )
                exp_rows = []
                for i, (old_acct, cat_id, date_iso, narr, amt) in enumerate(batch):
                    desc = narr or f"Expense ({old_acct})"
                    exp_rows.append(
                        (1, voucher_numbers[i], cat_id,
                         date_iso or "2026-08-31", amt, "CASH", desc)
                    )
                db.executemany(
                    """INSERT INTO expenses (
                        company_id, voucher_number, category_id, expense_date,
                        amount, payment_method, description
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    exp_rows,
                )
                created += len(exp_rows)
                total_value += sum(r[4] for r in batch)
            log(
                f"  Batch: imported {len(exp_rows)} rows "
                f"({voucher_numbers[0]}..{voucher_numbers[-1]}) "
                f"value={round(sum(r[4] for r in batch), 2)} in {time.time() - t1:.1f}s"
            )
        except Exception as exc:
            log(f"  Batch FAILED: {exc}")
            continue

    # ---- create expense items: one per distinct description per category ----
    import datetime
    item_rows = db.fetch_all("""
        SELECT category_id, description, MAX(amount) amt
        FROM expenses
        WHERE description IS NOT NULL AND TRIM(description) != ''
        GROUP BY category_id, description
        ORDER BY category_id, description
    """)
    items_created = 0
    with db.transaction():
        for r in item_rows:
            cat_id = r["category_id"]
            name = r["description"]
            exists = db.fetch_one(
                "SELECT id FROM expense_items WHERE company_id=1 AND category_id=? AND name=?",
                (cat_id, name),
            )
            if exists:
                continue
            db.execute(
                "INSERT INTO expense_items (company_id, category_id, name, amount, is_active, created_at) VALUES (1, ?, ?, ?, 1, ?)",
                (cat_id, name, r["amt"], datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
            )
            items_created += 1
    log(f"Expense items ensured: {items_created}")

    print("\n===== SUMMARY =====", flush=True)
    print(f"Created: {created}", flush=True)
    print(f"Total value: {round(total_value, 2)}", flush=True)
    print(f"Elapsed: {time.time() - t0:.1f}s", flush=True)

    # ---- verification ----
    print("\n===== VERIFY =====", flush=True)
    print("expenses rows:", db.fetch_one("SELECT COUNT(*) c FROM expenses")["c"])
    print("expense_categories rows:", db.fetch_one("SELECT COUNT(*) c FROM expense_categories")["c"])
    print("expense_items rows:", db.fetch_one("SELECT COUNT(*) c FROM expense_items")["c"])
    print("expense total:", db.fetch_one("SELECT COALESCE(SUM(amount),0) s FROM expenses")["s"])
    print("6000 bal:", db.fetch_one("SELECT COALESCE(SUM(debit)-SUM(credit),0) s FROM journal_entry_lines WHERE account_id=19")["s"])
    print("6100 bal:", db.fetch_one("SELECT COALESCE(SUM(debit)-SUM(credit),0) s FROM journal_entry_lines WHERE account_id=21")["s"])

    close_db()


if __name__ == "__main__":
    main()