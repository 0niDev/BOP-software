"""One-off import of historical purchase invoices from PharmaPro_Export.

Data sources:
  Products.csv       ProductId -> old product name + CompanyId (item type)
  Purchases.csv      PurchaseId -> bill date, vendor, remarks (invoice header)
  PurchasesBody.csv  PurchaseId + ProductId + Quantity/Price/TTLValue (lines)

Rules (per user):
  * Products are already in the system; the software decides all IDs/codes.
  * Invoice numbers are software-generated (PI-00001, ...) via the journal
    numbering sequence - nothing is hard-coded.
  * Purchases are imported as HISTORICAL LOGS ONLY:
      - Journal entries ARE posted (inventory debit by item type, A/P credit)
      - Stock batches / stock quantities are NOT touched
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
PURCHASES_FILE = "PharmaPro_Export/Purchases.csv"
BODIES_FILE = "PharmaPro_Export/PurchasesBody.csv"

COMPANY_TO_TYPE = {
    "00": "FINISHED_GOOD",
    "01": "RAW_MATERIAL",
    "02": "PACKING_MATERIAL",
}

INVENTORY_ACCOUNTS = {
    "RAW_MATERIAL": "1200",
    "PACKING_MATERIAL": "1210",
    "FINISHED_GOOD": "1220",
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


def parse_purchases(path: str) -> dict[str, dict]:
    purchases: dict[str, dict] = {}
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            purchases[(row.get("PurchaseId") or "").strip()] = {
                "bill_date": (row.get("BillDate") or "").strip(),
                "vendor_id": (row.get("VendorId") or "").strip(),
                "remarks": (row.get("Remarks") or "").strip(),
            }
    return purchases


def parse_bodies(path: str) -> dict[str, list[dict]]:
    bodies: dict[str, list[dict]] = {}
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            if (row.get("IsDeleted") or "").strip().lower() == "true":
                continue
            pid = (row.get("PurchaseId") or "").strip()
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
    purchases = parse_purchases(PURCHASES_FILE)
    bodies = parse_bodies(BODIES_FILE)
    log(
        f"Parsed {len(products)} products, {len(purchases)} purchases, "
        f"{sum(len(v) for v in bodies.values())} body lines"
    )

    db = get_db()
    journal_repo = JournalRepository(db)
    accounting = AccountingService(db)

    # ---- lookups -----------------------------------------------------------
    parties = db.fetch_all("SELECT id, code FROM parties WHERE company_id = 1")
    party_by_code = {p["code"]: p["id"] for p in parties}

    imported_pids: set[str] = set()
    for row in db.fetch_all(
        "SELECT notes FROM purchase_invoices WHERE notes LIKE 'Imported from PharmaPro PurchaseId=%'"
    ):
        if row["notes"]:
            imported_pids.add(row["notes"].split("PurchaseId=")[1].split(" ")[0])
    log(f"Already imported: {len(imported_pids)} purchases (resumable skip)")

    # existing items by name (active + ghost) and by id
    all_items = db.fetch_all("SELECT id, item_name, item_type, is_active FROM items WHERE company_id = 1")
    item_id_by_name = {r["item_name"]: r["id"] for r in all_items}
    item_type_by_id = {r["id"]: r["item_type"] for r in all_items}
    log(f"Loaded {len(all_items)} existing items")

    # ---- resolve remaining purchases ----------------------------------------
    remaining: list[str] = []
    for pid in sorted(purchases, key=lambda k: int(k)):
        if pid in imported_pids:
            continue
        header = purchases[pid]
        if pid not in bodies:
            log(f"  WARN  purchase {pid} has no body lines; skipping")
            continue
        if header["vendor_id"] not in party_by_code:
            log(f"  SKIP  purchase {pid}: vendor {header['vendor_id']} not found")
            continue
        remaining.append(pid)
    log(f"Remaining to import: {len(remaining)}")

    if not remaining:
        log("Nothing to do.")
        close_db()
        return

    # ---- figure out which ghost items we still need -------------------------
    needed_product_ids: set[str] = set()
    for pid in remaining:
        needed_product_ids.update(l["product_id"] for l in bodies[pid])

    new_ghosts: list[tuple[str, str, str]] = []  # (name, item_type, notes)
    for prod_id in sorted(needed_product_ids):
        info = products.get(prod_id)
        if not info or not info["name"]:
            log(f"  WARN  product {prod_id} has no name in Products.csv")
            continue
        if info["name"] in item_id_by_name:
            continue  # already exists (ghost or active) - reuse
        new_ghosts.append(
            (
                info["name"],
                COMPANY_TO_TYPE.get(info["company_id"], "FINISHED_GOOD"),
                f"Ghost item from PharmaPro import (old ProductId={prod_id})",
            )
        )
    log(f"New ghost items to create: {len(new_ghosts)}")

    # ---- precompute all rows in memory --------------------------------------
    inv_account_ids: dict[str, int] = {}
    account_repo = accounting.account_repo
    for code in ("1200", "1210", "1220"):
        acc = account_repo.find_by_code(code)
        if not acc:
            log(f"FATAL: Inventory account ({code}) not found.")
            close_db()
            return
        inv_account_ids[code] = acc["id"]
    ap = account_repo.find_by_code("2000")
    if not ap:
        log("FATAL: Accounts Payable account (2000) not found.")
        close_db()
        return
    ap_account_id = ap["id"]

    # in-memory invoice data (header + lines + journal derived together)
    invoice_rows: list[dict] = []

    for pid in remaining:
        header = purchases[pid]
        lines = bodies[pid]
        vendor_id = party_by_code[header["vendor_id"]]
        invoice_date = to_iso_date(header["bill_date"])
        notes = f"Imported from PharmaPro PurchaseId={pid}"
        if header["remarks"]:
            notes += f" | {header['remarks']}"

        items = []
        subtotal = 0.0
        type_totals: dict[str, float] = {}
        for line in lines:
            item_id = item_id_by_name.get(products.get(line["product_id"], {}).get("name", ""))
            if item_id is None:
                log(
                    f"  WARN  purchase {pid}: no item for product {line['product_id']} "
                    f"({products.get(line['product_id'], {}).get('name', '?')}); skipping purchase"
                )
                items = None
                break
            itype = item_type_by_id.get(item_id, "RAW_MATERIAL")
            items.append(
                {
                    "item_id": item_id,
                    "quantity": line["quantity"],
                    "unit_cost": line["price"],
                    "line_total": line["ttl_value"],
                }
            )
            subtotal += line["ttl_value"]
            type_totals[itype] = type_totals.get(itype, 0.0) + line["ttl_value"]
        if items is None:
            continue

        # reserve the row indexes; numbers assigned in the transaction below
        invoice_rows.append(
            {
                "_pid": pid,
                "_vendor_id": vendor_id,
                "_invoice_date": invoice_date,
                "_notes": notes,
                "_subtotal": round(subtotal, 2),
                "_type_totals": type_totals,
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
                # 1. reserve item codes for ghost items and insert them
                if new_ghosts:
                    codes = journal_repo.next_voucher_numbers(1, "ITEM", len(new_ghosts))
                    ghost_rows = []
                    for (name, itype, note), code in zip(new_ghosts, codes):
                        ghost_rows.append(
                            (
                                1,
                                code,
                                name,
                                note,
                                "UNIT",
                                0.0,
                                0.0,
                                0.0,
                                0.0,
                                None,
                                itype,
                                None,
                                0,
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
                        gid = first_id + i
                        item_id_by_name[name] = gid
                        item_type_by_id[gid] = itype
                    new_ghosts = []
                    log(f"  Batch {batch_num}: created {len(codes)} ghost items")

                # 2. reserve invoice numbers (invoice + journal voucher from same sequence)
                need = len(batch) * 2
                numbers = journal_repo.next_voucher_numbers(1, "PURCHASE", need)
                invoice_numbers = numbers[0::2]
                voucher_numbers = numbers[1::2]

                # 3. insert invoice headers
                header_rows = []
                for inv, inum in zip(batch, invoice_numbers):
                    header_rows.append(
                        (
                            1,
                            1,
                            inum,
                            inv["_vendor_id"],
                            inv["_invoice_date"],
                            "CREDIT",
                            inv["_subtotal"],
                            0.0,
                            0.0,
                            inv["_subtotal"],
                            0.0,
                            "CONFIRMED",
                            inv["_notes"],
                            None,
                        )
                    )
                db.executemany(
                    """
                    INSERT INTO purchase_invoices (
                        company_id, warehouse_id, invoice_number, supplier_id, invoice_date,
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
                                inv_id,
                                it["item_id"],
                                None,
                                None,
                                None,
                                None,
                                it["quantity"],
                                it["unit_cost"],
                                0.0,
                                0.0,
                                it["line_total"],
                            )
                        )
                db.executemany(
                    """
                    INSERT INTO purchase_invoice_items (
                        invoice_id, item_id, batch_id, batch_number, manufacturing_date,
                        expiry_date, quantity, unit_cost, discount_amount, tax_amount, line_total
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    line_rows,
                )

                # 5. insert journal headers + lines (bulk)
                journal_headers: list[dict] = []
                journal_lines: list[list[dict]] = []
                for i, inv in enumerate(batch):
                    inv_id = invoice_ids[i]
                    jlines: list[dict] = []
                    for itype, amount in inv["_type_totals"].items():
                        code = INVENTORY_ACCOUNTS.get(itype, "1200")
                        jlines.append(
                            {
                                "account_id": inv_account_ids[code],
                                "debit": round(amount, 2),
                                "credit": 0.0,
                                "description": f"Inventory purchase - {itype.replace('_', ' ').title()}",
                            }
                        )
                    jlines.append(
                        {
                            "account_id": ap_account_id,
                            "debit": 0.0,
                            "credit": inv["_subtotal"],
                            "party_id": inv["_vendor_id"],
                            "description": "Supplier credit - historical import",
                        }
                    )
                    journal_headers.append(
                        {
                            "company_id": 1,
                            "voucher_number": voucher_numbers[i],
                            "voucher_type": "PURCHASE",
                            "entry_date": inv["_invoice_date"],
                            "narration": f"Purchase invoice {invoice_numbers[i]}",
                            "source_table": "purchase_invoices",
                            "source_id": inv_id,
                            "is_posted": 1,
                            "created_by": None,
                        }
                    )
                    journal_lines.append(jlines)

                journal_repo.insert_entries_bulk(journal_headers, journal_lines)

                # bookkeeping for summary
                batch_created = 0
                batch_value = 0.0
                for inv in batch:
                    batch_created += 1
                    batch_value += inv["_subtotal"]
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