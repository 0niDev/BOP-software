"""One-off import of historical customer collections from PharmaPro_Export.

Data sources:
  CashCollection.csv   CollectionId -> collection date, cash account (111 = Cash In Hand)
  CollectionBody.csv   CollectionId + CustomerId + Amount (+ remarks)

Rules (per user - historical log only):
  * Collections are per-customer (IsWithInvoices=False), NOT linked to
    specific sales invoices, so sales_invoices.paid_amount is NOT updated.
  * A receipt is recorded for each collection:
      - journal entry: Dr Cash (1000), Cr A/R (1100) with party_id
      - a row in the `receipts` table
  * Voucher numbers are software-generated (RV-00001, ...) via the RECEIPT
    numbering sequence - nothing is hard-coded.
  * No stock / inventory effects.
"""
from __future__ import annotations

import csv
import os
import time
from datetime import datetime

os.environ["ERP_LOG_LEVEL"] = "CRITICAL"
os.environ["ERP_DB_ENGINE"] = "sqlitecloud"
os.environ["SQLITE_CLOUD_URL"] = (
    "sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/erp_backup_20260820_023705.db?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw"
)

from database.connection import get_db, close_db
from repositories.journal_repository import JournalRepository

CASH_FILE = "PharmaPro_Export/CashCollection.csv"
BODY_FILE = "PharmaPro_Export/CollectionBody.csv"

BATCH_SIZE = 200


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def parse_collections() -> list[dict]:
    headers: dict[str, dict] = {}
    with open(CASH_FILE, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            headers[row["CollectionId"].strip()] = {
                "date": (row["CollectionDate"] or "").strip(),
                "cash_account": (row["CashAccount"] or "").strip(),
            }

    collections: list[dict] = []
    with open(BODY_FILE, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            if (row.get("isDeleted") or "").strip().lower() == "true":
                continue
            cid = row["CollectionId"].strip()
            header = headers.get(cid)
            if not header:
                log(f"  WARN  collection {cid} has no header; skipping")
                continue
            collections.append(
                {
                    "collection_id": cid,
                    "date": header["date"],
                    "customer_id": (row["CustomerId"] or "").strip(),
                    "amount": float(row["Amount"] or 0),
                    "remarks": (row["Remarks"] or "").strip(),
                }
            )
    return collections


def to_iso_date(date_str: str) -> str:
    parts = date_str.split(" ")[0].split("/")
    if len(parts) != 3:
        return date_str
    return f"{parts[2]}-{parts[0]}-{parts[1]}"


def main() -> None:
    t0 = time.time()
    collections = parse_collections()
    log(f"Parsed {len(collections)} collection records")

    db = get_db()
    journal_repo = JournalRepository(db)

    # ---- lookups -----------------------------------------------------------
    parties = db.fetch_all("SELECT id, code FROM parties WHERE company_id = 1")
    party_by_code = {p["code"]: p["id"] for p in parties}
    log(f"Loaded {len(parties)} parties")

    cash = db.fetch_one("SELECT id FROM accounts WHERE account_code = '1000'")
    if not cash:
        log("FATAL: Cash account (1000) not found.")
        close_db()
        return
    ar = db.fetch_one("SELECT id FROM accounts WHERE account_code = '1100'")
    if not ar:
        log("FATAL: A/R account (1100) not found.")
        close_db()
        return
    cash_id, ar_id = cash["id"], ar["id"]

    # ---- resumability ------------------------------------------------------
    imported: set[str] = set()
    for row in db.fetch_all(
        "SELECT notes FROM receipts WHERE notes LIKE 'Imported from PharmaPro CollectionId=%'"
    ):
        if row["notes"]:
            imported.add(row["notes"].split("CollectionId=")[1].split(" ")[0])
    log(f"Already imported: {len(imported)} collections (resumable skip)")

    remaining = []
    for c in collections:
        if c["collection_id"] in imported:
            continue
        if c["customer_id"] not in party_by_code:
            log(f"  SKIP  collection {c['collection_id']}: customer {c['customer_id']} not found")
            continue
        remaining.append(c)
    log(f"Remaining to import: {len(remaining)}")

    if not remaining:
        log("Nothing to do.")
        close_db()
        return

    # ---- run in batches ----------------------------------------------------
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
                voucher_numbers = journal_repo.next_voucher_numbers(
                    1, "RECEIPT", len(batch)
                )

                # journal entries: Dr Cash, Cr A/R (party)
                journal_headers: list[dict] = []
                journal_lines: list[list[dict]] = []
                receipt_rows = []
                for i, c in enumerate(batch):
                    vnum = voucher_numbers[i]
                    customer_name = party_by_code[c["customer_id"]]
                    desc = f"Collection from customer - historical import"
                    if c["remarks"]:
                        desc += f" ({c['remarks']})"
                    journal_lines.append(
                        [
                            {
                                "account_id": cash_id,
                                "debit": c["amount"],
                                "credit": 0.0,
                                "description": desc,
                            },
                            {
                                "account_id": ar_id,
                                "debit": 0.0,
                                "credit": c["amount"],
                                "party_id": customer_name,
                                "description": desc,
                            },
                        ]
                    )
                    journal_headers.append(
                        {
                            "company_id": 1,
                            "voucher_number": vnum,
                            "voucher_type": "RECEIPT",
                            "entry_date": to_iso_date(c["date"]),
                            "narration": f"Collection {c['collection_id']} from customer",
                            "source_table": "receipts",
                            "source_id": None,
                            "is_posted": 1,
                            "created_by": None,
                        }
                    )

                journal_repo.insert_entries_bulk(journal_headers, journal_lines)

                # receipts rows (source_id for journal entries is the receipt id)
                first_entry_id = db.last_insert_id() - len(journal_headers) + 1
                receipt_rows = []
                for i, c in enumerate(batch):
                    notes = f"Imported from PharmaPro CollectionId={c['collection_id']}"
                    if c["remarks"]:
                        notes += f" | {c['remarks']}"
                    receipt_rows.append(
                        (
                            1, voucher_numbers[i], party_by_code[c["customer_id"]],
                            to_iso_date(c["date"]), "CASH", None, None,
                            c["amount"], notes, None, datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        )
                    )
                db.executemany(
                    """
                    INSERT INTO receipts (
                        company_id, voucher_number, party_id, receipt_date,
                        payment_method, bank_account_id, cheque_id, amount,
                        notes, created_by, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    receipt_rows,
                )
                first_receipt_id = db.last_insert_id() - len(receipt_rows) + 1

                # link journal entries to receipts
                for i, c in enumerate(batch):
                    db.execute(
                        "UPDATE journal_entries SET source_id = ? WHERE voucher_number = ? AND voucher_type = 'RECEIPT'",
                        (first_receipt_id + i, voucher_numbers[i]),
                    )

                created += len(batch)
                total_value += sum(c["amount"] for c in batch)
            log(
                f"  Batch {batch_num}: imported {len(batch)} collections "
                f"({voucher_numbers[0]}..{voucher_numbers[-1]}) "
                f"value={round(sum(c['amount'] for c in batch), 2)} in {time.time() - t1:.1f}s"
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
