"""
Import opening balances (pre-period balances) for A/R and A/P party accounts
from the old PharmaPro system.

Logic:
  old_final   = balance from AccountsBalances.csv (cumulative, includes pre-period)
  current     = current net balance in the DB (sum of debit - credit per party)
  opening     = old_final - current

For each party with nonzero opening, one OPENING journal entry:
  Customer:  Dr/Cr A/R (1100) with party_id, counter to Retained Earnings (3100)
  Supplier:  Dr/Cr A/P (2000) with party_id, counter to Retained Earnings (3100)

Resumable: skips party codes already imported (narration marker).
"""
import csv
import os
import sys
import time

os.environ["ERP_LOG_LEVEL"] = "CRITICAL"
os.environ["ERP_DB_ENGINE"] = "sqlitecloud"
os.environ["SQLITE_CLOUD_URL"] = ""

sys.path.insert(0, r"F:\software\final\BOP-software")

from database.connection import get_db, close_db
from repositories.journal_repository import JournalRepository

BATCH_SIZE = 50
ENTRY_DATE = "2026-05-01"

ACC_FILE = r"F:\software\final\BOP-software\PharmaPro_Export\AccountsBalances.csv"


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def read_old_balances() -> dict[str, float]:
    old: dict[str, float] = {}
    with open(ACC_FILE, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            acct = (row["AccountNo"] or "").strip()
            if not acct.startswith(("61", "62")):
                continue
            bal = float(row["Bal"] or 0)
            if row["BalType"] == "Cr":
                bal = -bal
            old[acct] = round(bal, 2)
    return old


def main():
    t0 = time.time()
    old = read_old_balances()
    log(f"Old balances loaded: {len(old)} party accounts")

    db = get_db()
    journal_repo = JournalRepository(db)

    # ---- lookups ----
    parties = db.fetch_all("SELECT id, code, party_type FROM parties WHERE company_id = 1")
    party_by_code = {p["code"]: p for p in parties}
    ar = db.fetch_one("SELECT id FROM accounts WHERE account_code = '1100'")
    ap = db.fetch_one("SELECT id FROM accounts WHERE account_code = '2000'")
    re = db.fetch_one("SELECT id FROM accounts WHERE account_code = '3100'")
    if not ar or not ap or not re:
        log("FATAL: A/R (1100), A/P (2000) or Retained Earnings (3100) not found.")
        close_db()
        return
    ar_id, ap_id, re_id = ar["id"], ap["id"], re["id"]

    # ---- current net per party ----
    rows = db.fetch_all(
        """
        SELECT p.code, SUM(jl.debit - jl.credit) as net
        FROM journal_entry_lines jl
        JOIN parties p ON p.id = jl.party_id
        GROUP BY p.id
        HAVING ABS(net) > 0.005
        """
    )
    current = {r["code"]: round(r["net"], 2) for r in rows}

    # ---- compute opening per party (union of old balances and current activity) ----
    items = []  # (code, party_type, opening)
    for code in sorted(set(old) | set(current)):
        if not code.startswith(("61", "62")):
            continue
        p = party_by_code.get(code)
        if p is None:
            log(f"WARN: party {code} not found in DB, skipping")
            continue
        opening = round(old.get(code, 0.0) - current.get(code, 0.0), 2)
        if abs(opening) < 0.005:
            continue
        items.append((code, p["party_type"], p["id"], opening))

    log(f"Parties needing opening balance: {len(items)}")

    # ---- resumability ----
    imported: set[str] = set()
    for row in db.fetch_all(
        "SELECT narration FROM journal_entries WHERE narration LIKE 'Opening balance % (Imported from PharmaPro)'"
    ):
        if row["narration"]:
            imported.add(row["narration"].split(" ")[2].split(" ")[0])
    log(f"Already imported: {len(imported)} (resumable skip)")

    remaining = [it for it in items if it[0] not in imported]
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
                for i, (code, ptype, party_id, opening) in enumerate(batch):
                    if ptype == "CUSTOMER":
                        party_acct = ar_id
                    else:
                        party_acct = ap_id
                    if opening > 0:
                        party_line = {"account_id": party_acct, "debit": opening, "credit": 0.0,
                                     "party_id": party_id, "description": "Opening balance"}
                        equity_line = {"account_id": re_id, "debit": 0.0, "credit": opening,
                                       "description": "Opening balance"}
                    else:
                        party_line = {"account_id": party_acct, "debit": 0.0, "credit": -opening,
                                     "party_id": party_id, "description": "Opening balance"}
                        equity_line = {"account_id": re_id, "debit": -opening, "credit": 0.0,
                                       "description": "Opening balance"}
                    journal_lines.append([party_line, equity_line])
                    journal_headers.append(
                        {
                            "company_id": 1,
                            "voucher_number": voucher_numbers[i],
                            "voucher_type": "OPENING",
                            "entry_date": ENTRY_DATE,
                            "narration": f"Opening balance {code} (Imported from PharmaPro)",
                            "source_table": None,
                            "source_id": None,
                            "is_posted": 1,
                            "created_by": None,
                        }
                    )

                journal_repo.insert_entries_bulk(journal_headers, journal_lines)
                created += len(journal_headers)
                total_value += sum(abs(it[3]) for it in batch)
            log(
                f"  Batch {batch_num}: imported {len(journal_headers)} openings "
                f"({voucher_numbers[0]}..{voucher_numbers[-1]}) "
                f"value={round(sum(abs(it[3]) for it in batch), 2)} in {time.time() - t1:.1f}s"
            )
        except Exception as exc:
            log(f"  Batch {batch_num} FAILED: {exc}")
            failed += len(batch)
            continue

    print("\n===== SUMMARY =====", flush=True)
    print(f"Created: {created}", flush=True)
    print(f"Failed:  {failed}", flush=True)
    print(f"Total opening value: {round(total_value, 2)}", flush=True)
    print(f"Elapsed: {time.time() - t0:.1f}s", flush=True)

    close_db()


if __name__ == "__main__":
    main()