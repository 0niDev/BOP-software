"""Backfill missing COGS journal entries for existing sales invoices.

Batch-optimized: fetches everything in a few large queries, processes
in memory, then posts entries. Run once:
    python scripts/backfill_cogs.py
"""
from __future__ import annotations
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load .env manually
_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(_env_path):
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

from decimal import Decimal
from database.connection import get_db
from repositories.account_repository import AccountRepository
from services.accounting_service import AccountingService, JournalLine
from models.enums import VoucherType


def backfill():
    t0 = time.time()
    db = get_db()
    acct_repo = AccountRepository(db)
    accounting = AccountingService(db)

    # Resolve needed accounts once
    accounts = {}
    for code in ["5000", "5001", "1200", "1210", "1220"]:
        a = acct_repo.find_by_code(code)
        if a:
            accounts[code] = a
    print(f"Accounts resolved in {time.time()-t0:.1f}s")

    # --- BATCH FETCH 1: All invoices ---
    t1 = time.time()
    invoices = db.fetch_all(
        "SELECT id, invoice_number, invoice_date, warehouse_id "
        "FROM sales_invoices WHERE status != 'CANCELLED' ORDER BY id"
    )
    inv_by_id = {inv["id"]: inv for inv in invoices}
    print(f"Fetched {len(invoices)} invoices in {time.time()-t1:.1f}s")

    # --- BATCH FETCH 2: All invoice items (with item type) ---
    t1 = time.time()
    all_items = db.fetch_all(
        """
        SELECT sii.invoice_id, sii.item_id, sii.quantity, sii.batch_id,
               i.item_name, i.item_code, i.item_type
        FROM sales_invoice_items sii
        JOIN items i ON i.id = sii.item_id
        """
    )
    # Group by invoice_id
    items_by_inv: dict[int, list] = {}
    for row in all_items:
        items_by_inv.setdefault(row["invoice_id"], []).append(row)
    print(f"Fetched {len(all_items)} invoice items in {time.time()-t1:.1f}s")

    # --- BATCH FETCH 3: All stock batches (including consumed/deactivated) ---
    t1 = time.time()
    all_batches = db.fetch_all("SELECT * FROM stock_batches ORDER BY id")
    batch_by_id = {b["id"]: b for b in all_batches}
    # Index by (item_id, warehouse_id) for lookup — prefer batch with cost, then stock, then any
    batch_by_item_wh: dict[tuple, dict] = {}
    for b in all_batches:
        key = (b["item_id"], b["warehouse_id"])
        existing = batch_by_item_wh.get(key)
        if existing is None:
            batch_by_item_wh[key] = b
        else:
            # Prefer the one with non-zero costs
            e_has_cost = (existing.get("purchase_price") or 0) > 0 or (existing.get("raw_unit_cost") or 0) > 0
            b_has_cost = (b.get("purchase_price") or 0) > 0 or (b.get("raw_unit_cost") or 0) > 0
            if b_has_cost and not e_has_cost:
                batch_by_item_wh[key] = b
            elif b_has_cost == e_has_cost:
                # Prefer the one with more stock
                if (b.get("quantity_in_stock") or 0) > (existing.get("quantity_in_stock") or 0):
                    batch_by_item_wh[key] = b
    print(f"Fetched {len(all_batches)} stock batches in {time.time()-t1:.1f}s")

    # --- BATCH FETCH 4: Which invoices already have COGS entries ---
    t1 = time.time()
    cogs_acct_ids = []
    if accounts.get("5000"):
        cogs_acct_ids.append(accounts["5000"]["id"])
    if accounts.get("5001"):
        cogs_acct_ids.append(accounts["5001"]["id"])

    already_has_cogs: set[int] = set()
    if cogs_acct_ids:
        placeholders = ",".join("?" * len(cogs_acct_ids))
        existing_cogs = db.fetch_all(
            f"""
            SELECT DISTINCT je.source_id
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            WHERE je.source_table = 'sales_invoices'
              AND jel.account_id IN ({placeholders})
            """,
            tuple(cogs_acct_ids),
        )
        already_has_cogs = {row["source_id"] for row in existing_cogs}
    print(f"Found {len(already_has_cogs)} invoices with existing COGS in {time.time()-t1:.1f}s")

    # --- PROCESS IN MEMORY ---
    t1 = time.time()
    posted_count = 0
    skipped_cogs = 0
    skipped_no_batch = 0
    skipped_zero_cost = 0
    skipped_no_items = 0
    entries_to_post = []

    for inv in invoices:
        inv_id = inv["id"]
        inv_num = inv["invoice_number"]

        if inv_id in already_has_cogs:
            skipped_cogs += 1
            continue

        items = items_by_inv.get(inv_id, [])
        if not items:
            skipped_no_items += 1
            continue

        cogs_raw = Decimal("0")
        cogs_packing = Decimal("0")
        credits: dict[int, Decimal] = {}
        ok = True

        for item in items:
            item_type = item.get("item_type") or "FINISHED_GOOD"
            qty = Decimal(str(item["quantity"]))
            batch_id = item.get("batch_id")

            batch = None
            if batch_id:
                batch = batch_by_id.get(batch_id)
            if not batch:
                batch = batch_by_item_wh.get((item["item_id"], inv["warehouse_id"]))
            if not batch:
                print(f"  SKIP {inv_num}: no batch for {item['item_name']}")
                skipped_no_batch += 1
                ok = False
                break

            purchase_price = Decimal(str(batch.get("purchase_price") or 0))

            if item_type == "FINISHED_GOOD":
                raw_unit = Decimal(str(batch.get("raw_unit_cost") or 0))
                pack_unit = Decimal(str(batch.get("packing_unit_cost") or 0))
                if raw_unit == 0 and pack_unit == 0:
                    raw_unit = purchase_price
                if raw_unit == 0 and pack_unit == 0:
                    print(f"  SKIP {inv_num}: zero cost batch {batch['id']} for {item['item_name']}")
                    skipped_zero_cost += 1
                    ok = False
                    break
                cogs_raw += raw_unit * qty
                cogs_packing += pack_unit * qty
                if accounts.get("1220"):
                    k = accounts["1220"]["id"]
                    credits[k] = credits.get(k, Decimal("0")) + (raw_unit + pack_unit) * qty

            elif item_type == "PACKING_MATERIAL":
                if purchase_price == 0:
                    print(f"  SKIP {inv_num}: zero cost batch {batch['id']} for {item['item_name']}")
                    skipped_zero_cost += 1
                    ok = False
                    break
                cogs_packing += purchase_price * qty
                if accounts.get("1210"):
                    k = accounts["1210"]["id"]
                    credits[k] = credits.get(k, Decimal("0")) + purchase_price * qty

            else:
                if purchase_price == 0:
                    print(f"  SKIP {inv_num}: zero cost batch {batch['id']} for {item['item_name']}")
                    skipped_zero_cost += 1
                    ok = False
                    break
                cogs_raw += purchase_price * qty
                if accounts.get("1200"):
                    k = accounts["1200"]["id"]
                    credits[k] = credits.get(k, Decimal("0")) + purchase_price * qty

        if not ok:
            continue

        cogs_total = cogs_raw + cogs_packing
        if cogs_total <= 0:
            print(f"  SKIP {inv_num}: zero COGS")
            continue

        journal_lines = []
        if cogs_raw > 0 and accounts.get("5000"):
            journal_lines.append(JournalLine(
                account_id=accounts["5000"]["id"],
                debit=float(cogs_raw), credit=0.0,
                description=f"COGS (raw materials) - {inv_num}",
            ))
        if cogs_packing > 0 and accounts.get("5001"):
            journal_lines.append(JournalLine(
                account_id=accounts["5001"]["id"],
                debit=float(cogs_packing), credit=0.0,
                description=f"COGS (packing materials) - {inv_num}",
            ))
        for acct_id, amt in credits.items():
            journal_lines.append(JournalLine(
                account_id=acct_id,
                debit=0.0, credit=float(amt),
                description=f"Reduce inventory - {inv_num}",
            ))

        if len(journal_lines) < 2:
            continue

        entries_to_post.append((inv, journal_lines, cogs_raw, cogs_packing))

    print(f"Computed {len(entries_to_post)} entries to post in {time.time()-t1:.1f}s")

    # --- POST ALL ENTRIES ---
    t1 = time.time()
    for inv, journal_lines, cogs_raw, cogs_packing in entries_to_post:
        try:
            with db.transaction():
                accounting.post_journal_entry(
                    voucher_type=VoucherType.SALES,
                    entry_date=inv["invoice_date"],
                    lines=journal_lines,
                    source_table="sales_invoices",
                    source_id=inv["id"],
                    narration=f"Backfill COGS for sales invoice {inv['invoice_number']}",
                )
            posted_count += 1
        except Exception as e:
            print(f"  ERROR posting {inv['invoice_number']}: {e}")
            continue

    print(f"\nPosted {posted_count}/{len(entries_to_post)} entries in {time.time()-t1:.1f}s")
    print(f"Skipped: {skipped_cogs} (already has COGS), {skipped_no_batch} (no batch), {skipped_zero_cost} (zero cost), {skipped_no_items} (no items)")
    print(f"Total time: {time.time()-t0:.1f}s")


if __name__ == "__main__":
    backfill()
