"""
One-off import of the remaining PharmaPro data gaps (A + B + C + D).

Covered here:
  A. Ghost items for every product in Products.csv that has no matching item
     (is_active=0, zero price/stock -- invisible to UI and stock, safe).
  B. The 13 customer-party DV lines debiting party 620041 (Qazi Irfan) that
     were skipped by both the vendor-payment and non-party-expense imports.
     Imported as individual journal entries (Dr A/R party / Cr 3100) PLUS one
     compensating entry (Cr A/R party / Dr 3100) so the party's balance still
     matches the old books exactly.  No cash, no inventory.
  C. The 4 sale returns (17 lines) recorded as passive audit_log records
     (they are IsPosted=False in old books -> zero financial impact, and the
     app's sales_returns table requires an invoice_id we cannot provide).
  D. The 1 expiry claim (6 lines) recorded as a passive audit_log record.

Everything is additive, resumable, and touches NO inventory / active items /
stock batches.
"""
from __future__ import annotations

import csv
import json
import os
import re
import sys
import time
from datetime import datetime

os.environ["ERP_LOG_LEVEL"] = "CRITICAL"
os.environ["ERP_DB_ENGINE"] = "sqlitecloud"
os.environ["SQLITE_CLOUD_URL"] = (
    "sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/erp_backup_20260820_023705.db?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw"
)

sys.path.insert(0, r"F:\software\final\BOP-software")

from database.connection import get_db, close_db
from repositories.journal_repository import JournalRepository

EXPORT = r"F:\software\final\BOP-software\PharmaPro_Export"

COMPANY_TO_TYPE = {
    "00": "FINISHED_GOOD",
    "01": "RAW_MATERIAL",
    "02": "PACKING_MATERIAL",
    "03": "FINISHED_GOOD",  # UnPacked-Materials (semi-finished)
}

CUSTOMER_DV_ACCOUNT = "620041"  # Qazi Irfan (all 13 skipped lines are to him)
COMPENSATE_NARRATION = "Compensating adjustment for customer DV lines {acct} (Imported from PharmaPro)"
DV_NARR_MARKER = "(Imported from PharmaPro customer DV)"

BATCH_SIZE = 100


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def load_csv(name: str) -> list[dict]:
    with open(f"{EXPORT}\\{name}", newline="", encoding="utf-8-sig") as fh:
        return [{k.strip("\ufeff"): v for k, v in r.items()} for r in csv.DictReader(fh)]


def to_iso_date(d: str) -> str:
    if not d:
        return None
    parts = d.split(" ")[0].split("/")
    if len(parts) != 3:
        return None
    return f"{parts[2]}-{parts[0]}-{parts[1]}"


# ============================================================================
# A. Ghost items for missing products
# ============================================================================
def import_missing_products(db, journal_repo) -> int:
    products = load_csv("Products.csv")
    existing = db.fetch_all("SELECT id, item_name FROM items")
    existing_names = {r["item_name"].strip().lower() for r in existing}
    log(f"Loaded {len(existing)} existing items for name matching")

    new_ghosts: list[dict] = []
    for p in products:
        nm = (p.get("ProductName") or "").strip()
        if not nm:
            continue
        if nm.lower() in existing_names:
            continue
        existing_names.add(nm.lower())  # avoid intra-file dupes
        new_ghosts.append(
            {
                "name": nm,
                "company_id": (p.get("CompanyId") or "").strip(),
                "note": f"Ghost item from PharmaPro import (old ProductId={p.get('ProductId', '').strip()})",
            }
        )
    log(f"Products with no matching item: {len(new_ghosts)}")

    if not new_ghosts:
        log("  (A) no ghost items to create")
        return 0

    created = 0
    try:
        with db.transaction():
            codes = journal_repo.next_voucher_numbers(1, "ITEM", len(new_ghosts))
            rows = []
            for i, g in enumerate(new_ghosts):
                rows.append(
                    (
                        1, codes[i], g["name"], g["note"], "UNIT",
                        0.0, 0.0, 0.0, 0.0, None,
                        COMPANY_TO_TYPE.get(g["company_id"], "FINISHED_GOOD"),
                        None, 0,
                    )
                )
            db.executemany(
                """
                INSERT INTO items (
                    company_id, item_code, item_name, notes, unit,
                    purchase_price, selling_price, minimum_stock, maximum_stock,
                    tax_rate_id, item_type, category_id, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows,
            )
            created = len(rows)
        log(f"  (A) created {created} ghost items")
    except Exception as exc:
        log(f"  (A) FATAL: {exc}")
    return created


# ============================================================================
# B. Customer-party DV lines (620041) + compensating entry
# ============================================================================
def import_customer_dv_lines(db, journal_repo) -> tuple[int, float]:
    dvb = load_csv("DebitVouchersBody.csv")
    lines = []
    for r in dvb:
        acct = (r.get("AccountNo") or "").strip()
        amt = float(r.get("Debit") or 0)
        if acct != CUSTOMER_DV_ACCOUNT or amt <= 0:
            continue
        lines.append(
            {
                "voucher_no": (r.get("VoucherNo") or "").strip(),
                "date": to_iso_date(r.get("VoucherDate")),
                "narration": (r.get("Narration") or "").strip(),
                "amount": round(amt, 2),
            }
        )
    log(f"Customer-party DV lines to {CUSTOMER_DV_ACCOUNT}: {len(lines)} "
        f"total={sum(l['amount'] for l in lines):,.2f}")
    if not lines:
        return 0, 0.0

    # account ids
    ar = db.fetch_one("SELECT id FROM accounts WHERE account_code = '1100'")
    re_acct = db.fetch_one("SELECT id FROM accounts WHERE account_code = '3100'")
    party = db.fetch_one("SELECT id FROM parties WHERE code = ?", (CUSTOMER_DV_ACCOUNT,))
    if not ar or not re_acct or not party:
        log("  (B) FATAL: A/R, 3100 or party 620041 not found")
        return 0, 0.0
    ar_id, re_id, party_id = ar["id"], re_acct["id"], party["id"]

    # resumability: skip lines whose narration marker already exists
    imported_keys = set()
    for row in db.fetch_all("SELECT narration FROM journal_entries WHERE narration LIKE ?",
                            (f"%{DV_NARR_MARKER}%",)):
        if row["narration"]:
            m = re.search(r"DV (\S+)\|(\S+)\|([0-9.]+) \(", row["narration"] or "")
            if m:
                imported_keys.add((m.group(1), m.group(2), round(float(m.group(3)), 2)))

    remaining = [l for l in lines
                 if (l["voucher_no"], l["date"], l["amount"]) not in imported_keys]
    log(f"  (B) remaining lines: {len(remaining)}")

    # compensation already posted?
    comp_done = db.fetch_one(
        "SELECT id FROM journal_entries WHERE narration LIKE ?",
        (COMPENSATE_NARRATION.format(acct=CUSTOMER_DV_ACCOUNT) + "%",),
    )

    created = 0
    total = 0.0
    try:
        with db.transaction():
            if remaining:
                numbers = journal_repo.next_voucher_numbers(1, "OPENING", len(remaining))
                headers, linesets = [], []
                for i, l in enumerate(remaining):
                    key = f"{l['voucher_no']}|{l['date']}|{l['amount']:.2f}"
                    desc = l["narration"] or f"Historical DV to customer ({CUSTOMER_DV_ACCOUNT})"
                    headers.append({
                        "company_id": 1,
                        "voucher_number": numbers[i],
                        "voucher_type": "OPENING",
                        "entry_date": l["date"] or "2026-08-31",
                        "narration": f"DV {key} {DV_NARR_MARKER}",
                        "source_table": None, "source_id": None,
                        "is_posted": 1, "created_by": None,
                    })
                    linesets.append([
                        {"account_id": ar_id, "debit": l["amount"], "credit": 0.0,
                         "party_id": party_id, "description": desc},
                        {"account_id": re_id, "debit": 0.0, "credit": l["amount"],
                         "description": desc},
                    ])
                journal_repo.insert_entries_bulk(headers, linesets)
                created = len(headers)
                total = sum(l["amount"] for l in remaining)
                log(f"  (B) imported {created} DV lines, value={total:,.2f}")

            # compensating entry to keep the party balance matching old books
            if not comp_done:
                comp_total = sum(l["amount"] for l in lines)
                num = journal_repo.next_voucher_numbers(1, "OPENING", 1)[0]
                desc = f"Reverse effect of imported customer DV lines ({CUSTOMER_DV_ACCOUNT})"
                journal_repo.insert_entries_bulk(
                    [{
                        "company_id": 1, "voucher_number": num,
                        "voucher_type": "OPENING", "entry_date": "2026-05-01",
                        "narration": COMPENSATE_NARRATION.format(acct=CUSTOMER_DV_ACCOUNT),
                        "source_table": None, "source_id": None,
                        "is_posted": 1, "created_by": None,
                    }],
                    [[
                        {"account_id": ar_id, "debit": 0.0, "credit": comp_total,
                         "party_id": party_id, "description": desc},
                        {"account_id": re_id, "debit": comp_total, "credit": 0.0,
                         "description": desc},
                    ]],
                )
                log(f"  (B) posted compensating entry {num} value={comp_total:,.2f}")
            else:
                log("  (B) compensating entry already posted")
    except Exception as exc:
        log(f"  (B) FATAL: {exc}")
    return created, total


# ============================================================================
# C. Sale returns -> passive audit_log records
# ============================================================================
def import_sale_returns(db) -> int:
    heads = load_csv("SaleReturns.csv")
    body = load_csv("SaleReturnsBody.csv")
    if not heads:
        return 0
    by_id = {}
    for b in body:
        by_id.setdefault(b.get("SReturnId", "").strip(), []).append(b)

    # resumable marker
    done = set()
    for r in db.fetch_all(
        "SELECT details FROM audit_log WHERE action = 'IMPORT_PHARMAPRO_SALE_RETURN'"):
        try:
            done.add(json.loads(r["details"]).get("SReturnId"))
        except Exception:
            pass

    created = 0
    with db.transaction():
        for h in heads:
            sid = (h.get("SReturnId") or "").strip()
            if sid in done:
                continue
            details = {
                "SReturnId": sid,
                "ReturnDate": (h.get("ReturnDate") or "").strip(),
                "CustomerId": (h.get("CustomerId") or "").strip(),
                "Remarks": (h.get("Remarks") or "").strip(),
                "IsPosted": (h.get("IsPosted") or "").strip(),
                "TotalAmount": round(
                    sum(float(b.get("TTLValue") or 0) for b in by_id.get(sid, [])), 2),
                "Lines": [
                    {
                        "ProductId": b.get("ProductId"),
                        "Quantity": b.get("Quantity"),
                        "Price": b.get("Price"),
                        "TTLValue": b.get("TTLValue"),
                    }
                    for b in by_id.get(sid, [])
                ],
            }
            db.execute(
                """INSERT INTO audit_log (user_id, action, entity_table, entity_id, details)
                   VALUES (?, 'IMPORT_PHARMAPRO_SALE_RETURN', 'sales_returns', ?, ?)""",
                (None, sid, json.dumps(details)),
            )
            created += 1
    log(f"  (C) recorded {created} sale returns as passive logs")
    return created


# ============================================================================
# D. Expiries -> passive audit_log records
# ============================================================================
def import_expiries(db) -> int:
    heads = load_csv("Expiries.csv")
    body = load_csv("ExpiriesBody.csv")
    batch = load_csv("ExpiriesBatch.csv")
    if not heads:
        return 0

    done = set()
    for r in db.fetch_all(
        "SELECT details FROM audit_log WHERE action = 'IMPORT_PHARMAPRO_EXPIRY'"):
        try:
            done.add(json.loads(r["details"]).get("ExpiryId"))
        except Exception:
            pass

    created = 0
    with db.transaction():
        for h in heads:
            eid = (h.get("ExpiryId") or "").strip()
            if eid in done:
                continue
            details = {
                "ExpiryId": eid,
                "InvoiceDate": (h.get("InvoiceDate") or "").strip(),
                "Remarks": (h.get("Remarks") or "").strip(),
                "InvoiceType": (h.get("InvoiceType") or "").strip(),
                "Lines": [
                    {"ProductId": b.get("ProductId"), "Quantity": b.get("Quantity")}
                    for b in body if (b.get("ExpiryId") or "").strip() == eid
                ],
                "Batches": [
                    {"ProductId": b.get("ProductId"), "BatchNo": b.get("BatchNo"),
                     "ExpiryDate": b.get("ExpiryDate"), "Quantity": b.get("Quantity"),
                     "Cost": b.get("Cost")}
                    for b in batch if (b.get("ExpiryId") or "").strip() == eid
                ],
            }
            db.execute(
                """INSERT INTO audit_log (user_id, action, entity_table, entity_id, details)
                   VALUES (?, 'IMPORT_PHARMAPRO_EXPIRY', 'stock_losses', ?, ?)""",
                (None, eid, json.dumps(details)),
            )
            created += 1
    log(f"  (D) recorded {created} expiry claim as passive log")
    return created


# ============================================================================
def main():
    t0 = time.time()
    db = get_db()
    journal_repo = JournalRepository(db)

    log("===== A: ghost items for missing products =====")
    import_missing_products(db, journal_repo)

    log("\n===== B: customer-party DV lines (620041) =====")
    import_customer_dv_lines(db, journal_repo)

    log("\n===== C: sale returns (passive logs) =====")
    import_sale_returns(db)

    log("\n===== D: expiries (passive logs) =====")
    import_expiries(db)

    print("\n===== VERIFY =====", flush=True)
    print("items:", db.fetch_one("SELECT COUNT(*) c FROM items")["c"])
    print("items active:", db.fetch_one("SELECT COUNT(*) c FROM items WHERE is_active=1")["c"])
    print("items ghost:", db.fetch_one(
        "SELECT COUNT(*) c FROM items WHERE notes LIKE '%Ghost item%'")["c"])
    print("stock_movements:", db.fetch_one("SELECT COUNT(*) c FROM stock_movements")["c"])
    print("stock_batches active+qty:", db.fetch_one(
        "SELECT COUNT(*) c FROM stock_batches WHERE is_active=1 AND quantity_in_stock>0")["c"])
    print("journal_entries:", db.fetch_one("SELECT COUNT(*) c FROM journal_entries")["c"])
    print("audit_log:", db.fetch_one("SELECT COUNT(*) c FROM audit_log")["c"])
    print("620041 net:", db.fetch_one("""
        SELECT COALESCE(SUM(jl.debit - jl.credit),0) net
        FROM journal_entry_lines jl JOIN parties p ON p.id=jl.party_id
        WHERE p.code='620041'""")["net"])
    print(f"Elapsed: {time.time() - t0:.1f}s", flush=True)

    close_db()


if __name__ == "__main__":
    main()
