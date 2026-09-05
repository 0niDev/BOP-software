"""One-off import of historical sales invoices from PharmaPro_Export.

Data sources:
  Products.csv       ProductId -> old product name + CompanyId (item type)
  Sales.csv          SaleId -> sale date, customer, remarks (invoice header)
  SalesBody.csv      SaleId + ProductId + Quantity/Price/TTLValue (lines)

Rules (per user - mirrors the purchase import):
  * Products are already in the system; the software decides all IDs/codes.
  * Invoice numbers are software-generated (SI-00001, ...) via the journal
    numbering sequence - nothing is hard-coded.
  * Sales are imported as HISTORICAL LOGS ONLY:
      - Journal entries ARE posted (Dr A/R with party_id, Cr Sales Revenue)
      - Stock / COGS are NOT touched (no batches, no inventory reduction)
      - No bank transactions are recorded
  * Old products that don't already exist are created as "ghost" items
    (is_active = 0) using their PharmaPro names, purely so the old invoices
    can be logged against something. Current products are never modified.

Performance: all inserts are batched with executemany inside a handful of
transactions instead of per-row round trips.
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
from services.accounting_service import AccountingService

PRODUCTS_FILE = "PharmaPro_Export/Products.csv"
SALES_FILE = "PharmaPro_Export/Sales.csv"
BODIES_FILE = "PharmaPro_Export/SalesBody.csv"

COMPANY_TO_TYPE = {
    "00": "FINISHED_GOOD",
    "01": "RAW_MATERIAL",
    "02": "PACKING_MATERIAL",
}

BATCH_SIZE = 200


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def parse_products(path: str) -> dict[str, dict]:
    products: dict[str, dict] = {}
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            pid = (row.get("ProductId") or "").strip()
            products[pid] = {
                "name": (row.get("ProductName") or "").strip(),
                "company_id": (row.get("CompanyId") or "").strip(),
            }
    return products


def parse_sales(path: str) -> dict[str, dict]:
    sales: dict[str, dict] = {}
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            sales[(row.get("SaleId") or "").strip()] = {
                "sale_date": (row.get("SaleDate") or "").strip(),
                "customer_id": (row.get("CustomerId") or "").strip(),
                "remarks": (row.get("Remarks") or "").strip(),
            }
    return sales


def parse_bodies(path: str) -> dict[str, list[dict]]:
    bodies: dict[str, list[dict]] = {}
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            if (row.get("IsDeleted") or "").strip().lower() == "true":
                continue
            pid = (row.get("SaleId") or "").strip()
            bodies.setdefault(pid, []).append(
                {
                    "product_id": (row.get("ProductId") or "").strip(),
                    "quantity": float(row.get("Quantity") or 0),
                    "price": float(row.get("Price") or 0),
                    "ttl_value": float(row.get("TTLValue") or 0),
                }
            )
    return bodies


def to_iso_date(date_str: str) -> str:
    """Convert 'MM/DD/YYYY HH:MM:SS' -> 'YYYY-MM-DD'."""
    if not date_str:
        return ""
    parts = date_str.split(" ")[0].split("/")
    if len(parts) != 3:
        return date_str
    return f"{parts[2]}-{parts[0]}-{parts[1]}"


def main() -> None:
    t0 = time.time()
    products = parse_products(PRODUCTS_FILE)
    sales = parse_sales(SALES_FILE)
    bodies = parse_bodies(BODIES_FILE)
    log(
        f"Parsed {len(products)} products, {len(sales)} sales, "
        f"{sum(len(v) for v in bodies.values())} body lines"
    )

    db = get_db()
    journal_repo = JournalRepository(db)
    accounting = AccountingService(db)

    # ---- lookups -----------------------------------------------------------
    parties = db.fetch_all("SELECT id, code FROM parties WHERE company_id = 1")
    party_by_code = {p["code"]: p["id"] for p in parties}

    imported_sales: set[str] = set()
    for row in db.fetch_all(
        "SELECT notes FROM sales_invoices WHERE notes LIKE 'Imported from PharmaPro SaleId=%'"
    ):
        if row["notes"]:
            imported_sales.add(row["notes"].split("SaleId=")[1].split(" ")[0])
    log(f"Already imported: {len(imported_sales)} sales (resumable skip)")

    all_items = db.fetch_all("SELECT id, item_name, item_type FROM items WHERE company_id = 1")
    item_id_by_name = {r["item_name"]: r["id"] for r in all_items}
    item_type_by_id = {r["id"]: r["item_type"] for r in all_items}
    log(f"Loaded {len(all_items)} existing items")

    # ---- resolve remaining sales --------------------------------------------
    remaining: list[str] = []
    for sid in sorted(sales, key=lambda k: int(k)):
        if sid in imported_sales:
            continue
        header = sales[sid]
        if sid not in bodies:
            log(f"  WARN  sale {sid} has no body lines; skipping")
            continue
        if header["customer_id"] not in party_by_code:
            log(f"  SKIP  sale {sid}: customer {header['customer_id']} not found")
            continue
        remaining.append(sid)
    log(f"Remaining to import: {len(remaining)}")

    if not remaining:
        log("Nothing to do.")
        close_db()
        return

    # ---- figure out which ghost items we still need -------------------------
    needed_product_ids: set[str] = set()
    for sid in remaining:
        needed_product_ids.update(l["product_id"] for l in bodies[sid])

    new_ghosts: list[tuple[str, str, str]] = []
    for prod_id in sorted(needed_product_ids):
        info = products.get(prod_id)
        if not info or not info["name"]:
            log(f"  WARN  product {prod_id} has no name in Products.csv")
            continue
        if info["name"] in item_id_by_name:
            continue
        new_ghosts.append(
            (
                info["name"],
                COMPANY_TO_TYPE.get(info["company_id"], "FINISHED_GOOD"),
                f"Ghost item from PharmaPro import (old ProductId={prod_id})",
            )
        )
    log(f"New ghost items to create: {len(new_ghosts)}")

    # ---- create ghost items first (one batch) ------------------------------
    if new_ghosts:
        try:
            with db.transaction():
                codes = journal_repo.next_voucher_numbers(1, "ITEM", len(new_ghosts))
                ghost_rows = []
                for (name, itype, note), code in zip(new_ghosts, codes):
                    ghost_rows.append(
                        (
                            1, code, name, note, "UNIT",
                            0.0, 0.0, 0.0, 0.0, None, itype, None, 0,
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
                    ghost_rows,
                )
                last_id = db.last_insert_id()
                first_id = last_id - len(ghost_rows) + 1
                for i, ((name, itype, note), code) in enumerate(zip(new_ghosts, codes)):
                    item_id_by_name[name] = first_id + i
                    item_type_by_id[first_id + i] = itype
            log(f"Created {len(new_ghosts)} ghost items")
        except Exception as exc:
            log(f"FATAL: ghost item creation failed: {exc}")
            close_db()
            return
        new_ghosts = []

    # ---- precompute all rows in memory --------------------------------------
    account_repo = accounting.account_repo
    ar = account_repo.find_by_code("1100")
    if not ar:
        log("FATAL: Accounts Receivable account (1100) not found.")
        close_db()
        return
    ar_account_id = ar["id"]
    rev = account_repo.find_by_code("4000")
    if not rev:
        log("FATAL: Sales Revenue account (4000) not found.")
        close_db()
        return
    rev_account_id = rev["id"]

    invoice_rows: list[dict] = []

    for sid in remaining:
        header = sales[sid]
        lines = bodies[sid]
        customer_id = party_by_code[header["customer_id"]]
        invoice_date = to_iso_date(header["sale_date"])
        notes = f"Imported from PharmaPro SaleId={sid}"
        if header["remarks"]:
            notes += f" | {header['remarks']}"

        items = []
        subtotal = 0.0
        for line in lines:
            item_id = item_id_by_name.get(products.get(line["product_id"], {}).get("name", ""))
            if item_id is None:
                log(
                    f"  WARN  sale {sid}: no item for product {line['product_id']} "
                    f"({products.get(line['product_id'], {}).get('name', '?')}); skipping sale"
                )
                items = None
                break
            items.append(
                {
                    "item_id": item_id,
                    "quantity": line["quantity"],
                    "unit_price": line["price"],
                    "line_total": line["ttl_value"],
                }
            )
            subtotal += line["ttl_value"]
        if items is None:
            continue

        invoice_rows.append(
            {
                "_sid": sid,
                "_customer_id": customer_id,
                "_invoice_date": invoice_date,
                "_notes": notes,
                "_subtotal": round(subtotal, 2),
                "_items": items,
            }
        )

    log(f"Prepared {len(invoice_rows)} invoices in memory")

    # ---- run in batches -----------------------------------------------------
    created = 0
    failed = 0
    total_value = 0.0
    batch_num = 0

    for start in range(0, len(invoice_rows), BATCH_SIZE):
        batch_num += 1
        batch = invoice_rows[start : start + BATCH_SIZE]
        t1 = time.time()
        try:
            with db.transaction():
                # 1. reserve invoice + journal voucher numbers (same sequence)
                need = len(batch) * 2
                numbers = journal_repo.next_voucher_numbers(1, "SALES", need)
                invoice_numbers = numbers[0::2]
                voucher_numbers = numbers[1::2]

                # 3. insert invoice headers
                header_rows = []
                for inv, inum in zip(batch, invoice_numbers):
                    header_rows.append(
                        (
                            1, 1, inum, inv["_customer_id"], inv["_invoice_date"],
                            "CREDIT", inv["_subtotal"], 0.0, 0.0, inv["_subtotal"],
                            0.0, "CONFIRMED", inv["_notes"], None,
                        )
                    )
                db.executemany(
                    """
                    INSERT INTO sales_invoices (
                        company_id, warehouse_id, invoice_number, customer_id, invoice_date,
                        payment_type, subtotal, discount_amount, tax_amount,
                        total_amount, paid_amount, status, notes, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    header_rows,
                )
                last_id = db.last_insert_id()
                first_inv_id = last_id - len(header_rows) + 1
                invoice_ids = [first_inv_id + i for i in range(len(header_rows))]

                # 4. insert invoice items (bulk)
                line_rows = []
                for i, inv in enumerate(batch):
                    inv_id = invoice_ids[i]
                    for it in inv["_items"]:
                        line_rows.append(
                            (
                                inv_id, it["item_id"], None,
                                it["quantity"], it["unit_price"], 0.0, 0.0, it["line_total"],
                            )
                        )
                db.executemany(
                    """
                    INSERT INTO sales_invoice_items (
                        invoice_id, item_id, batch_id, quantity, unit_price,
                        discount_amount, tax_amount, line_total
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    line_rows,
                )

                # 5. journal: Dr A/R (party), Cr Sales Revenue
                journal_headers: list[dict] = []
                journal_lines: list[list[dict]] = []
                for i, inv in enumerate(batch):
                    jlines = [
                        {
                            "account_id": rev_account_id,
                            "debit": 0.0,
                            "credit": inv["_subtotal"],
                            "description": "Sales revenue",
                        },
                        {
                            "account_id": ar_account_id,
                            "debit": inv["_subtotal"],
                            "credit": 0.0,
                            "party_id": inv["_customer_id"],
                            "description": "Credit sale to customer - historical import",
                        },
                    ]
                    journal_headers.append(
                        {
                            "company_id": 1,
                            "voucher_number": voucher_numbers[i],
                            "voucher_type": "SALES",
                            "entry_date": inv["_invoice_date"],
                            "narration": f"Sales invoice {invoice_numbers[i]}",
                            "source_table": "sales_invoices",
                            "source_id": invoice_ids[i],
                            "is_posted": 1,
                            "created_by": None,
                        }
                    )
                    journal_lines.append(jlines)

                journal_repo.insert_entries_bulk(journal_headers, journal_lines)

                batch_created = len(batch)
                batch_value = sum(inv["_subtotal"] for inv in batch)
                created += batch_created
                total_value += batch_value

            log(
                f"  Batch {batch_num}: imported {batch_created} invoices "
                f"({invoice_numbers[0]}..{invoice_numbers[-1]}) value={round(batch_value, 2)} "
                f"in {time.time() - t1:.1f}s"
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