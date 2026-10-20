"""One-off import of supplier payments (DV vouchers) from PharmaPro_FullExport.

Source: DebitVouchers.csv + DebitVouchersBody.csv (all 106 vouchers, IsPosted=True)
  - Each DV voucher debits one or more accounts and credits Cash (111 in old COA).
  - Lines that debit a VENDOR party account are supplier payments:
        Dr Accounts Payable (2000) with party_id = vendor
        Cr Cash (1000)
  - Voucher numbers are software-generated (PV-00001, ...) via the PAYMENT
    numbering sequence - nothing is hard-coded.
  - No stock / inventory effects.

Usage:
    python import_supplier_payments.py          # clean re-import + verification
    python import_supplier_payments.py --keep   # resumable (skip already-imported)

NOTE: this only imports the VENDOR-party payment lines (the payables fix).
Non-party DV lines (salaries, expenses, assets, advances) are out of scope here.
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
import time
from collections import defaultdict
from datetime import datetime

from utils.env_loader import setup_import_env
setup_import_env()

from database.connection import get_db, close_db
from repositories.journal_repository import JournalRepository

DV_FILE = "PharmaPro_FullExport/DebitVouchers.csv"
DVB_FILE = "PharmaPro_FullExport/DebitVouchersBody.csv"
PARTIES_FILE = "PharmaPro_FullExport/Parties.csv"

BATCH_SIZE = 100

IMPORT_NARRATION_LIKE = "DV voucher % (Imported from PharmaPro)"


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def to_iso_date(date_str: str) -> str:
    parts = date_str.split(" ")[0].split("/")
    if len(parts) != 3:
        return date_str
    return f"{parts[2]}-{parts[0]}-{parts[1]}"


def clean_existing_import(db) -> int:
    """Delete all previously imported DV voucher data (payments + journal entries).
    Returns the number of journal entries removed."""
    imported_vnos: list[str] = []
    for row in db.fetch_all(
        "SELECT id, narration FROM journal_entries WHERE narration LIKE ?",
        (IMPORT_NARRATION_LIKE,),
    ):
        if row["narration"]:
            vno = row["narration"].split("voucher ")[1].split(" ")[0]
            imported_vnos.append(vno)

    if not imported_vnos:
        log("No previously imported data to clean.")
        return 0

    log(f"Cleaning {len(imported_vnos)} previously imported vouchers...")

    # delete payments first ( FK to journal_entries via source_id)
    db.execute(
        "DELETE FROM payment_allocations WHERE payment_id IN "
        "(SELECT id FROM payments WHERE notes LIKE 'Imported from PharmaPro DV voucher %')"
    )
    db.execute(
        "DELETE FROM payments WHERE notes LIKE 'Imported from PharmaPro DV voucher %'"
    )

    # delete journal entries ( cascades to journal_entry_lines)
    deleted = db.execute(
        "DELETE FROM journal_entries WHERE narration LIKE ?",
        (IMPORT_NARRATION_LIKE,),
    )

    log(f"Cleaned: {deleted} journal entries + related payments/lines.")
    return deleted


def verify_payments_against_csv(db, dv_vendor: dict[str, dict], narr: dict[str, str], party_by_code: dict) -> bool:
    """Compare every DV voucher from the CSV against the payments table.
    Returns True if all match."""
    log("\n===== VERIFICATION: Matching payments against CSV =====")

    # build reverse lookup: party_id -> code
    code_by_party_id = {v: k for k, v in party_by_code.items()}

    rows = db.fetch_all(
        "SELECT voucher_number, party_id, payment_date, amount, notes "
        "FROM payments WHERE notes LIKE 'Imported from PharmaPro DV voucher %' "
        "ORDER BY voucher_number"
    )
    db_payments: dict[str, dict] = {}
    for r in rows:
        # extract original DV voucher number from notes
        # notes format: "Imported from PharmaPro DV voucher <VNO>" or "... | <narr>"
        note = r["notes"] or ""
        if "DV voucher " in note:
            vno = note.split("DV voucher ")[1].split("|")[0].strip().split()[0]
        else:
            vno = r["voucher_number"]
        db_payments[vno] = {
            "voucher_number": r["voucher_number"],
            "party_id": r["party_id"],
            "payment_date": r["payment_date"],
            "amount": r["amount"],
        }

    mismatches = 0
    missing = 0
    extra = 0

    # check every CSV voucher exists in payments
    for vno, v in sorted(dv_vendor.items(), key=lambda x: int(x[0])):
        if vno not in db_payments:
            log(f"  MISSING  DV {vno}: not found in payments table")
            missing += 1
            continue

        p = db_payments[vno]
        expected_date = to_iso_date(v["date"])
        expected_amount = round(v["amount"], 2)
        expected_party = party_by_code.get(v["vendor"])

        errors = []
        if p["payment_date"] != expected_date:
            errors.append(f"date: got {p['payment_date']}, expected {expected_date}")
        if abs(p["amount"] - expected_amount) > 0.01:
            errors.append(f"amount: got {p['amount']}, expected {expected_amount}")
        if p["party_id"] != expected_party:
            errors.append(f"party_id: got {p['party_id']}, expected {expected_party}")

        if errors:
            log(f"  MISMATCH  DV {vno}: {'; '.join(errors)}")
            mismatches += 1

    # check for extra payments not in CSV
    for vno in db_payments:
        if vno not in dv_vendor:
            log(f"  EXTRA  DV {vno}: in payments table but not in CSV")
            extra += 1

    total_csv = len(dv_vendor)
    total_db = len(db_payments)
    matched = total_csv - missing - mismatches

    print(f"\n  CSV vouchers:      {total_csv}")
    print(f"  DB payments:       {total_db}")
    print(f"  Matched:           {matched}")
    print(f"  Missing:           {missing}")
    print(f"  Mismatched:        {mismatches}")
    print(f"  Extra (in DB only): {extra}")

    if missing == 0 and mismatches == 0 and extra == 0:
        log("  RESULT: ALL PAYMENTS MATCH THE CSV")
        return True
    else:
        log("  RESULT: DISCREPANCIES FOUND — see details above")
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Import supplier payments from PharmaPro CSV")
    parser.add_argument("--keep", action="store_true",
                        help="Resumable mode: skip already-imported vouchers instead of cleaning")
    args = parser.parse_args()

    t0 = time.time()
    for f in (DV_FILE, DVB_FILE, PARTIES_FILE):
        if not os.path.exists(f):
            log(f"FATAL: {f} not found. Ensure the PharmaPro_FullExport folder exists.")
            sys.exit(1)

    # ---- vendor party codes ----
    vendor_codes: set[str] = set()
    with open(PARTIES_FILE, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            if (row.get("IsVendor") or "").strip().lower() == "true":
                vendor_codes.add((row["AccountNo"] or "").strip())

    # ---- aggregate vendor payments per voucher ----
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

    # ---- clean or resume ----
    if args.keep:
        imported: set[str] = set()
        for row in db.fetch_all(
            "SELECT narration FROM journal_entries WHERE narration LIKE ?",
            (IMPORT_NARRATION_LIKE,),
        ):
            if row["narration"]:
                imported.add(row["narration"].split("voucher ")[1].split(" ")[0])
        log(f"Already imported: {len(imported)} vouchers (resumable skip)")
    else:
        clean_existing_import(db)

    if args.keep:
        remaining = [
            (vno, v)
            for vno, v in sorted(dv_vendor.items(), key=lambda x: int(x[0]))
            if vno not in imported
        ]
    else:
        remaining = [
            (vno, v)
            for vno, v in sorted(dv_vendor.items(), key=lambda x: int(x[0]))
        ]
    log(f"Remaining to import: {len(remaining)}")

    if not remaining:
        log("Nothing to import.")
        log("\nRunning verification on existing data...")
        verify_payments_against_csv(db, dv_vendor, narr, party_by_code)
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

                payment_rows = []
                for i, (vno, v) in enumerate(batch):
                    party_id = party_by_code.get(v["vendor"])
                    if party_id is None:
                        continue
                    notes = f"Imported from PharmaPro DV voucher {vno}"
                    if narr.get(vno):
                        notes += f" | {narr[vno]}"
                    payment_rows.append(
                        (
                            1, voucher_numbers[i], party_id,
                            to_iso_date(v["date"]), "CASH", None, None,
                            round(v["amount"], 2), notes, None,
                            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        )
                    )
                db.executemany(
                    """
                    INSERT INTO payments (
                        company_id, voucher_number, party_id, payment_date,
                        payment_method, bank_account_id, cheque_id, amount,
                        notes, created_by, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    payment_rows,
                )

                first_payment_id = db.last_insert_id() - len(payment_rows) + 1
                for i in range(len(payment_rows)):
                    db.execute(
                        "UPDATE journal_entries SET source_id = ? WHERE voucher_number = ? AND voucher_type = 'PAYMENT'",
                        (first_payment_id + i, voucher_numbers[i]),
                    )

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

    print("\n===== IMPORT SUMMARY =====", flush=True)
    print(f"Created: {created}", flush=True)
    print(f"Failed:  {failed}", flush=True)
    print(f"Total imported value: {round(total_value, 2)}", flush=True)
    print(f"Elapsed: {time.time() - t0:.1f}s", flush=True)

    # ---- verify against CSV ----
    verify_payments_against_csv(db, dv_vendor, narr, party_by_code)

    close_db()


if __name__ == "__main__":
    main()