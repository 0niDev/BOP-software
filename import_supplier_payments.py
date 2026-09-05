"""One-off import of supplier payments (DV vouchers) from PharmaPro_Export.

Source: DebitVouchers.csv + DebitVouchersBody.csv (all 106 vouchers, IsPosted=True)
  - Each DV voucher debits one or more accounts and credits Cash (111 in old COA).
  - Lines that debit a VENDOR party account are supplier payments:
        Dr Accounts Payable (2000) with party_id = vendor
        Cr Cash (1000)
  - Voucher numbers are software-generated (PV-00001, ...) via the PAYMENT
    numbering sequence - nothing is hard-coded.
  - No stock / inventory effects. Resumable via notes.

NOTE: this only imports the VENDOR-party payment lines (the payables fix).
Non-party DV lines (salaries, expenses, assets, advances) are out of scope here.
"""
from __future__ import annotations

import csv
import os
import time
from collections import defaultdict
from datetime import datetime

os.environ["ERP_LOG_LEVEL"] = "CRITICAL"
os.environ["ERP_DB_ENGINE"] = "sqlitecloud"
os.environ["SQLITE_CLOUD_URL"] = (
    "sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/erp_backup_20260820_023705.db?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw"
)

from database.connection import get_db, close_db
from repositories.journal_repository import JournalRepository

DV_FILE = "PharmaPro_Export/DebitVouchers.csv"
DVB_FILE = "PharmaPro_Export/DebitVouchersBody.csv"
PARTIES_FILE = "PharmaPro_Export/Parties.csv"

BATCH_SIZE = 100


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def to_iso_date(date_str: str) -> str:
    parts = date_str.split(" ")[0].split("/")
    if len(parts) != 3:
        return date_str
    return f"{parts[2]}-{parts[0]}-{parts[1]}"


def main() -> None:
    t0 = time.time()

    # ---- vendor party codes ----
    vendor_codes: set[str] = set()
    with open(PARTIES_FILE, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            if (row.get("IsVendor") or "").strip().lower() == "true":
                vendor_codes.add((row["AccountNo"] or "").strip())

    # ---- aggregate vendor payments per voucher ----
    # group DV lines per voucher, keep only vendor-party lines
    dv_vendor: dict[str, dict] = {}
    with open(DVB_FILE, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            vno = (row["VoucherNo"] or "").strip()
            acc = (row["AccountNo"] or "").strip()
            amt = float(row["Debit"] or 0)
            if acc not in vendor_codes or amt <= 0:
                continue
            dv_vendor.setdefault(
                vno,
                {"vendor": acc, "amount": 0.0, "date": "", "narration": ""},
            )
            dv_vendor[vno]["vendor"] = acc
            dv_vendor[vno]["amount"] += amt

    with open(DV_FILE, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            vno = (row["VoucherNo"] or "").strip()
            if vno in dv_vendor:
                dv_vendor[vno]["date"] = (row["VoucherDate"] or "").strip()

    # narration per voucher line (first non-empty)
    narr: dict[str, str] = {}
    with open(DVB_FILE, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            vno = (row["VoucherNo"] or "").strip()
            if vno in dv_vendor and (row.get("Narration") or "").strip() and vno not in narr:
                narr[vno] = (row["Narration"] or "").strip()

    total_pay = sum(v["amount"] for v in dv_vendor.values())
    log(f"Parsed {len(dv_vendor)} DV vouchers with vendor payments, total={total_pay:,.2f}")

    db = get_db()
    journal_repo = JournalRepository(db)

    # ---- lookups ----
    parties = db.fetch_all("SELECT id, code FROM parties WHERE company_id = 1")
    party_by_code = {p["code"]: p["id"] for p in parties}
    ap = db.fetch_one("SELECT id FROM accounts WHERE account_code = '2000'")
    cash = db.fetch_one("SELECT id FROM accounts WHERE account_code = '1000'")
    if not ap or not cash:
        log("FATAL: A/P (2000) or Cash (1000) account not found.")
        close_db()
        return
    ap_id, cash_id = ap["id"], cash["id"]

    # ---- resumability ----
    imported: set[str] = set()
    for row in db.fetch_all(
        "SELECT narration FROM journal_entries WHERE narration LIKE 'DV voucher % (Imported from PharmaPro)'"
    ):
        if row["narration"]:
            imported.add(row["narration"].split("voucher ")[1].split(" ")[0])
    log(f"Already imported: {len(imported)} vouchers (resumable skip)")

    remaining = [
        (vno, v)
        for vno, v in sorted(dv_vendor.items(), key=lambda x: int(x[0]))
        if vno not in imported
    ]
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
        vnos = [vno for vno, _ in batch]
        t1 = time.time()
        try:
            with db.transaction():
                voucher_numbers = journal_repo.next_voucher_numbers(1, "PAYMENT", len(batch))

                journal_headers: list[dict] = []
                journal_lines: list[list[dict]] = []
                for i, (vno, v) in enumerate(batch):
                    party_id = party_by_code.get(v["vendor"])
                    if party_id is None:
                        log(f"  SKIP  voucher {vno}: vendor {v['vendor']} not in DB parties")
                        continue
                    desc = f"Supplier payment - historical import"
                    if narr.get(vno):
                        desc += f" ({narr[vno]})"
                    journal_lines.append(
                        [
                            {
                                "account_id": ap_id,
                                "debit": round(v["amount"], 2),
                                "credit": 0.0,
                                "party_id": party_id,
                                "description": desc,
                            },
                            {
                                "account_id": cash_id,
                                "debit": 0.0,
                                "credit": round(v["amount"], 2),
                                "description": desc,
                            },
                        ]
                    )
                    journal_headers.append(
                        {
                            "company_id": 1,
                            "voucher_number": voucher_numbers[i],
                            "voucher_type": "PAYMENT",
                            "entry_date": to_iso_date(v["date"]),
                            "narration": f"DV voucher {vno} (Imported from PharmaPro)",
                            "source_table": None,
                            "source_id": None,
                            "is_posted": 1,
                            "created_by": None,
                        }
                    )

                journal_repo.insert_entries_bulk(journal_headers, journal_lines)
                created += len(journal_headers)
                total_value += sum(v[1]["amount"] for v in batch)
            log(
                f"  Batch {batch_num}: imported {len(journal_headers)} payments "
                f"({voucher_numbers[0]}..{voucher_numbers[-1]}) "
                f"value={round(sum(v[1]['amount'] for v in batch), 2)} in {time.time() - t1:.1f}s"
            )
        except Exception as exc:
            log(f"  Batch {batch_num} FAILED: {exc}")
            failed += len(batch)
            continue

    print("\n===== SUMMARY =====", flush=True)
    print(f"Created: {created}", flush=True)
    print(f"Failed:  {failed}", flush=True)
    print(f"Total imported value: {round(total_value, 2)}", flush=True)
    print(f"Elapsed: {time.time() - t0:.1f}s", flush=True)

    close_db()


if __name__ == "__main__":
    main()