"""Backfill COGS using PharmaPro SalesBatch.csv cost data - MAXIMUM BATCH."""

from __future__ import annotations
import sys, os, csv, time, re
from decimal import Decimal
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(_env_path):
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

from database.connection import get_db
from repositories.account_repository import AccountRepository
from repositories.journal_repository import JournalRepository

EXPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "PharmaPro_FullExport")


def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def backfill():
    t0 = time.time()
    db = get_db()
    acct_repo = AccountRepository(db)
    journal_repo = JournalRepository(db)

    accounts = {}
    for code in ["5000", "5001", "5002", "1200", "1210", "1220"]:
        a = acct_repo.find_by_code(code)
        if a:
            accounts[code] = a
    log(f"Accounts resolved ({time.time()-t0:.1f}s)")

    # ---- Load CSV data ----
    log("Loading SalesBody.csv...")
    sales_body_by_sale = defaultdict(list)
    with open(os.path.join(EXPORT_DIR, "SalesBody.csv"), encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            sale_id = (row["SaleId"] or "").strip()
            pid = (row["ProductId"] or "").strip()
            qty = float(row["Quantity"] or 0)
            if sale_id and pid and qty > 0:
                sales_body_by_sale[sale_id].append((pid, qty))
    log(f"  SalesBody: {len(sales_body_by_sale)} sales, {sum(len(v) for v in sales_body_by_sale.values())} lines")

    log("Loading SalesBatch.csv...")
    sales_batch = defaultdict(list)
    with open(os.path.join(EXPORT_DIR, "SalesBatch.csv"), encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            key = ((row["SaleId"] or "").strip(), (row["ProductId"] or "").strip())
            q = float(row["Quantity"] or 0)
            c = float(row["Cost"] or 0)
            if key[0] and key[1] and q > 0:
                sales_batch[key].append((q, c))
    log(f"  SalesBatch: {len(sales_batch)} keys")

    log("Loading Products.csv...")
    product_pp = {}
    product_type = {}
    with open(os.path.join(EXPORT_DIR, "Products.csv"), encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            pid = (row["ProductId"] or "").strip()
            product_pp[pid] = float(row.get("PurchasePrice", "0") or "0")
            cid = (row.get("CompanyId") or "").strip()
            product_type[pid] = {"00": "FINISHED_GOOD", "01": "RAW_MATERIAL", "02": "PACKING_MATERIAL", "03": "FINISHED_GOOD"}.get(cid, "FINISHED_GOOD")
    log(f"  Products: {len(product_pp)}")

    # ---- Load DB items ----
    items = db.fetch_all("SELECT id, item_code, item_type FROM items")
    code_to_item = {i["item_code"]: i for i in items}
    log(f"DB items: {len(code_to_item)}")

    def find_item(pid):
        r = code_to_item.get(pid)
        return r if r else code_to_item.get("ITEM-" + pid)

    # ---- Precompute unit costs from SalesBatch ----
    log("Precomputing unit costs from SalesBatch...")
    unit_cost_cache = {}
    for (sid, pid), batches in sales_batch.items():
        if not batches:
            continue
        total_qty = sum(b[0] for b in batches)
        if total_qty == 0:
            continue
        uc = sum(b[0] * b[1] for b in batches) / total_qty
        if uc > 0:
            unit_cost_cache[(sid, pid)] = uc
    log(f"  Computed unit costs for {len(unit_cost_cache)} (sale,product) pairs")

    # ---- Get invoices needing COGS ----
    log("Fetching invoices...")
    invoices = db.fetch_all(
        "SELECT id, invoice_number, invoice_date, notes FROM sales_invoices WHERE status != 'CANCELLED' ORDER BY id"
    )

    already = set()
    rows = db.fetch_all("""
        SELECT DISTINCT je.source_id FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.journal_entry_id
        WHERE je.source_table = 'sales_invoices' AND jel.account_id IN (?, ?, ?)
    """, (accounts.get("5000", {}).get("id", 0), accounts.get("5001", {}).get("id", 0), accounts.get("5002", {}).get("id", 0)))
    already = {r["source_id"] for r in rows}
    log(f"Invoices needing COGS: {len(invoices) - len(already)} / {len(invoices)} total")

    # ---- Compute COGS per invoice ----
    t1 = time.time()
    cogs_headers = []
    cogs_lines_per_entry = []

    for inv in invoices:
        inv_id = inv["id"]
        if inv_id in already:
            continue
        m = re.search(r"SaleId=(\d+)", inv.get("notes") or "")
        sale_id = m.group(1) if m else str(inv_id)

        body_lines = sales_body_by_sale.get(sale_id, [])
        if not body_lines:
            continue

        cogs_finished = Decimal("0")
        cogs_packing = Decimal("0")
        cogs_raw_mat = Decimal("0")
        credits = {}

        for pid, qty in body_lines:
            item = find_item(pid)
            if not item:
                continue

            uc = unit_cost_cache.get((sale_id, pid))
            if uc is None:
                pp = Decimal(str(product_pp.get(pid, 0)))
                if pp <= 0:
                    continue
                uc = float(pp)

            total_cost = Decimal(str(uc)) * Decimal(str(qty))
            if total_cost <= 0:
                continue

            itype = product_type.get(pid, item.get("item_type") or "FINISHED_GOOD")
            if itype == "FINISHED_GOOD":
                cogs_finished += total_cost
                k = accounts["1220"]["id"]
            elif itype == "PACKING_MATERIAL":
                cogs_packing += total_cost
                k = accounts["1210"]["id"]
            else:
                cogs_raw_mat += total_cost
                k = accounts["1200"]["id"]
            credits[k] = credits.get(k, Decimal("0")) + total_cost

        if (cogs_finished + cogs_packing + cogs_raw_mat) <= 0:
            continue

        lines = []
        if cogs_finished > 0:
            lines.append({"account_id": accounts["5000"]["id"], "debit": float(cogs_finished), "credit": 0.0,
                          "description": f"COGS (finished goods) - {inv['invoice_number']}"})
        if cogs_packing > 0:
            lines.append({"account_id": accounts["5001"]["id"], "debit": float(cogs_packing), "credit": 0.0,
                          "description": f"COGS (packing materials) - {inv['invoice_number']}"})
        if cogs_raw_mat > 0:
            lines.append({"account_id": accounts["5002"]["id"], "debit": float(cogs_raw_mat), "credit": 0.0,
                          "description": f"COGS (raw materials) - {inv['invoice_number']}"})
        for acct_id, amt in credits.items():
            lines.append({"account_id": acct_id, "debit": 0.0, "credit": float(amt),
                          "description": f"Reduce inventory - {inv['invoice_number']}"})

        if len(lines) >= 2:
            cogs_headers.append({
                "company_id": 1,
                "voucher_type": "SALES",
                "entry_date": inv["invoice_date"],
                "reference_no": "BACKFILL-COGS-EXPORT",
                "narration": f"Backfill COGS from export for sales invoice {inv['invoice_number']}",
                "source_table": "sales_invoices",
                "source_id": inv["id"],
                "is_posted": 1,
                "created_by": None,
            })
            cogs_lines_per_entry.append(lines)

    log(f"Computed {len(cogs_headers)} COGS entries in {time.time()-t1:.1f}s")

    # ---- Get voucher numbers ----
    log("Getting voucher numbers...")
    voucher_numbers = journal_repo.next_voucher_numbers(1, "SALES", len(cogs_headers))
    for i, hdr in enumerate(cogs_headers):
        hdr["voucher_number"] = voucher_numbers[i]

    # ---- Batch insert using journal_repo (uses pool) ----
    log("Posting journal entries in one bulk transaction...")
    t1 = time.time()
    try:
        with db.transaction():
            journal_repo.insert_entries_bulk(cogs_headers, cogs_lines_per_entry)
        log(f"Posted {len(cogs_headers)} COGS entries in {time.time()-t1:.1f}s")
    except Exception as e:
        log(f"ERROR: {e}")

    log(f"Total: {time.time()-t0:.1f}s")


if __name__ == "__main__":
    backfill()