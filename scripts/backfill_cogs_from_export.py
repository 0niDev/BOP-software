"""Backfill COGS using PharmaPro SalesBatch.csv cost data.

Uses accounting.post_journal_entry() which is proven to work.
One entry at a time to avoid connection pool issues.

Run: python scripts/backfill_cogs_from_export.py
"""
from __future__ import annotations
import sys, os, csv, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(_env_path):
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

from decimal import Decimal
import sqlitecloud
from database.connection import get_db
from repositories.account_repository import AccountRepository
from services.accounting_service import AccountingService, JournalLine
from models.enums import VoucherType

EXPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "PharmaPro_FullExport")


def backfill():
    t0 = time.time()
    db = get_db()
    acct_repo = AccountRepository(db)
    accounting = AccountingService(db)

    accounts = {}
    for code in ["5000", "5001", "5002", "1200", "1210", "1220"]:
        a = acct_repo.find_by_code(code)
        if a:
            accounts[code] = a
    print(f"Accounts resolved ({time.time()-t0:.1f}s)")

    sales_body = {}
    with open(os.path.join(EXPORT_DIR, "SalesBody.csv"), encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            sales_body[(row["SaleId"], row["ProductId"])] = float(row["Quantity"])

    sales_batch = {}
    with open(os.path.join(EXPORT_DIR, "SalesBatch.csv"), encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            key = (row["SaleId"], row["ProductId"])
            sales_batch.setdefault(key, []).append({
                "quantity": float(row["Quantity"]),
                "cost": float(row["Cost"]),
            })

    product_pp = {}
    with open(os.path.join(EXPORT_DIR, "Products.csv"), encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            product_pp[row["ProductId"]] = float(row.get("PurchasePrice", "0") or "0")

    items = db.fetch_all("SELECT id, item_code, item_type FROM items")
    code_to_item = {i["item_code"]: i for i in items}

    def find_item(pid):
        r = code_to_item.get(pid)
        return r if r else code_to_item.get("ITEM-" + pid)

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
    print(f"Data loaded, {len(already)} have COGS, computing ({time.time()-t0:.1f}s)")

    t1 = time.time()
    entries = []

    import re
    for inv in invoices:
        inv_id = inv["id"]
        if inv_id in already:
            continue
        m = re.search(r"SaleId=(\d+)", inv.get("notes") or "")
        sale_id = m.group(1) if m else str(inv_id)

        cogs_finished = Decimal("0")
        cogs_packing = Decimal("0")
        cogs_raw_mat = Decimal("0")
        credits = {}

        for body_key, qty in sales_body.items():
            if body_key[0] != sale_id:
                continue
            item = find_item(body_key[1])
            if not item:
                continue
            batches = sales_batch.get(body_key)
            if not batches:
                continue
            total_qty = sum(b["quantity"] for b in batches)
            if total_qty == 0:
                continue
            unit_cost = Decimal(str(sum(b["cost"] * b["quantity"] for b in batches) / total_qty))
            if unit_cost <= 0:
                pp = Decimal(str(product_pp.get(body_key[1], 0)))
                if pp > 0:
                    unit_cost = pp
                else:
                    continue

            total_cost = unit_cost * Decimal(str(qty))
            item_type = item.get("item_type") or "FINISHED_GOOD"
            if item_type == "FINISHED_GOOD":
                cogs_finished += total_cost
                k = accounts["1220"]["id"]
                credits[k] = credits.get(k, Decimal("0")) + total_cost
            elif item_type == "PACKING_MATERIAL":
                cogs_packing += total_cost
                k = accounts["1210"]["id"]
                credits[k] = credits.get(k, Decimal("0")) + total_cost
            else:
                cogs_raw_mat += total_cost
                k = accounts["1200"]["id"]
                credits[k] = credits.get(k, Decimal("0")) + total_cost

        if (cogs_finished + cogs_packing + cogs_raw_mat) <= 0:
            continue

        lines = []
        if cogs_finished > 0:
            lines.append(JournalLine(
                account_id=accounts["5000"]["id"],
                debit=float(cogs_finished), credit=0.0,
                description=f"COGS (finished goods) - {inv['invoice_number']}",
            ))
        if cogs_packing > 0:
            lines.append(JournalLine(
                account_id=accounts["5001"]["id"],
                debit=float(cogs_packing), credit=0.0,
                description=f"COGS (packing materials) - {inv['invoice_number']}",
            ))
        if cogs_raw_mat > 0:
            lines.append(JournalLine(
                account_id=accounts["5002"]["id"],
                debit=float(cogs_raw_mat), credit=0.0,
                description=f"COGS (raw materials) - {inv['invoice_number']}",
            ))
        for acct_id, amt in credits.items():
            lines.append(JournalLine(
                account_id=acct_id,
                debit=0.0, credit=float(amt),
                description=f"Reduce inventory - {inv['invoice_number']}",
            ))
        if len(lines) >= 2:
            entries.append((inv, lines))

    print(f"Computed {len(entries)} entries in {time.time()-t1:.1f}s, posting...")

    # Get next voucher number
    last_vn = db.fetch_one(
        "SELECT voucher_number FROM journal_entries WHERE voucher_type='SALES' ORDER BY id DESC LIMIT 1"
    )
    if last_vn and last_vn["voucher_number"] and last_vn["voucher_number"].startswith("SI-"):
        vn_num = int(last_vn["voucher_number"].split("-")[1])
    else:
        vn_num = 0

    # Use one raw connection for all inserts — no pool overhead
    conn_str = os.environ.get("SQLITE_CLOUD_URL")
    raw = sqlitecloud.connect(conn_str)
    raw.execute("PRAGMA journal_mode = WAL")

    t1 = time.time()
    posted = 0
    errors = 0

    for inv, journal_lines in entries:
        try:
            vn_num += 1
            voucher_number = f"SI-{vn_num:05d}"
            raw.execute("BEGIN")
            cur = raw.execute(
                "INSERT INTO journal_entries (company_id,voucher_number,voucher_type,entry_date,reference_no,narration,source_table,source_id,is_posted,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (1, voucher_number, "SALES", inv["invoice_date"], None,
                 f"Backfill COGS for sales invoice {inv['invoice_number']}",
                 "sales_invoices", inv["id"], 1, None),
            )
            entry_id = cur.lastrowid
            for order, jl in enumerate(journal_lines):
                raw.execute(
                    "INSERT INTO journal_entry_lines (journal_entry_id,account_id,debit,credit,description,line_order) VALUES (?,?,?,?,?,?)",
                    (entry_id, jl.account_id, jl.debit, jl.credit, jl.description, order),
                )
            raw.execute("COMMIT")
            posted += 1
            if posted % 100 == 0:
                elapsed = time.time() - t1
                rate = posted / elapsed if elapsed > 0 else 0
                eta = (len(entries) - posted) / rate if rate > 0 else 0
                print(f"  {posted}/{len(entries)} ({rate:.1f}/s, ETA {eta:.0f}s)")
        except Exception as e:
            try:
                raw.execute("ROLLBACK")
            except Exception:
                pass
            errors += 1
            if errors <= 5:
                print(f"  ERROR {inv['invoice_number']}: {e}")

    raw.close()
    elapsed = time.time() - t1
    print(f"\nPosted {posted}/{len(entries)} ({errors} errors) in {elapsed:.1f}s")
    print(f"Total: {time.time()-t0:.1f}s")


if __name__ == "__main__":
    backfill()
