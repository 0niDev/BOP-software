"""Backfill Cost of Sales (COGS) + production capitalization journal entries.

Problem
-------
Historical data was imported without proper inventory accounting:

1. ``import_sales_invoices.py`` posted only  Dr A/R / Cr Sales Revenue  for the
   2,390 historical sales invoices - no COGS entry. So accounts 5000 (Cost of
   Goods Sold) and 5001 (Cost of Packing Materials) show 0.00 in the Trial
   Balance ("cost of sales is not showing").
2. ``import_manufacturing.py`` imported production orders + consumption with
   real costs, but never posted the capitalization journal entries
   (Dr 1220 Finished Goods / Cr 1200 Raw + 1210 Packing). So inventory
   accounts stayed at purchase value and 1220 never received the value of
   goods produced.
3. All imported ``stock_batches`` rows carry raw_unit_cost = packing_unit_cost
   = 0, so even service-created sales compute COGS = 0 for old batches.

Fix (idempotent, dry-run by default)
------------------------------------
1. Per production order (imported/ghost ones only): one MANUFACTURING voucher
   - Dr 1220 with the consumption value, Cr 1200/1210/1220 by component type.
2. Per sales invoice: weighted-average production unit cost (raw/packing
   split) x qty -> Dr 5000 / Dr 5001 / Cr 1220 (one JOURNAL voucher per
   invoice, reference BACKFILL-COGS).
3. Optional inventory repair: FINISHED_GOOD batches with stock but zero cost
   get their raw/packing unit costs from the same weighted averages, so future
   service-created sales post real COGS even when FIFO picks an old batch.

Run:
    python backfill_cogs.py            # dry run - prints what would be posted
    python backfill_cogs.py --apply    # write the journal entries
"""

from __future__ import annotations

import os
import sys

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from database.connection import get_db
from repositories.journal_repository import JournalRepository

APPLY = "--apply" in sys.argv

db = get_db()
journal_repo = JournalRepository(db)

log = print


def money(x: float) -> float:
    return round(float(x or 0) + 1e-9, 2)


# --------------------------------------------------------------------------
# 0. Idempotency guard
# --------------------------------------------------------------------------
done = db.fetch_one(
    "SELECT COUNT(*) AS n FROM journal_entries WHERE reference_no LIKE 'BACKFILL-%'"
)
if done and done["n"]:
    log(f"Backfill already applied ({done['n']} entries with BACKFILL- reference). Nothing to do.")
    sys.exit(0)

# Account ids by code
acc_rows = db.fetch_all(
    "SELECT id, account_code FROM accounts WHERE account_code IN "
    "('1200','1210','1220','5000','5001')"
)
acc_id = {r["account_code"]: r["id"] for r in acc_rows}
missing = {"1200", "1210", "1220", "5000", "5001"} - set(acc_id)
if missing:
    log(f"FATAL: missing system accounts: {sorted(missing)}")
    sys.exit(1)

# Invoices that already have COGS/inventory lines (never touch those)
covered = {
    r["source_id"]
    for r in db.fetch_all(
        """
        SELECT DISTINCT je.source_id
        FROM journal_entries je
        JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
        JOIN accounts a ON a.id = jel.account_id
        WHERE je.source_table = 'sales_invoices'
          AND je.voucher_type = 'SALES'
          AND a.account_code IN ('1200','1210','1220','5000','5001')
        """
    )
}

# --------------------------------------------------------------------------
# 1. Weighted-average production unit cost per finished item (raw/packing split)
# --------------------------------------------------------------------------
cost_rows = db.fetch_all(
    """
    SELECT b.finished_item_id AS item_id,
           SUM(CASE WHEN i.item_type = 'PACKING_MATERIAL'
                    THEN pc.unit_cost * pc.quantity_consumed ELSE 0 END) AS pack_ext,
           SUM(CASE WHEN i.item_type != 'PACKING_MATERIAL'
                    THEN pc.unit_cost * pc.quantity_consumed ELSE 0 END) AS raw_ext,
           SUM(po.actual_quantity) AS qty
    FROM production_orders po
    JOIN bill_of_materials b ON b.id = po.bom_id
    JOIN production_consumption pc ON pc.production_order_id = po.id
    JOIN items i ON i.id = pc.component_item_id
    WHERE po.actual_quantity > 0
    GROUP BY b.finished_item_id
    """
)
item_cost: dict[int, tuple[float, float]] = {}
for r in cost_rows:
    qty = float(r["qty"] or 0)
    if qty > 0:
        item_cost[r["item_id"]] = (
            float(r["raw_ext"] or 0) / qty,
            float(r["pack_ext"] or 0) / qty,
        )
log(f"Items with weighted-avg production cost: {len(item_cost)}")

# --------------------------------------------------------------------------
# 2. Production capitalization (imported orders never posted Dr 1220)
# --------------------------------------------------------------------------
prod_rows = db.fetch_all(
    """
    SELECT po.id, po.order_number, po.actual_quantity, po.manufacturing_date, po.is_ghost,
           COALESCE(SUM(CASE WHEN i.item_type = 'PACKING_MATERIAL'
                             THEN pc.unit_cost * pc.quantity_consumed ELSE 0 END), 0) AS pack_ext,
           COALESCE(SUM(CASE WHEN i.item_type != 'PACKING_MATERIAL'
                             THEN pc.unit_cost * pc.quantity_consumed ELSE 0 END), 0) AS raw_ext
    FROM production_orders po
    JOIN production_consumption pc ON pc.production_order_id = po.id
    JOIN items i ON i.id = pc.component_item_id
    WHERE po.actual_quantity > 0
      AND NOT EXISTS (
          SELECT 1 FROM journal_entries je
          WHERE je.voucher_type = 'MANUFACTURING' AND je.source_table = 'production_orders'
            AND je.source_id = po.id AND je.is_posted = 1
      )
    GROUP BY po.id
    ORDER BY po.manufacturing_date, po.id
    """
)

prod_headers: list[dict] = []
prod_lines_per_entry: list[list[dict]] = []

for r in prod_rows:
    raw_ext = money(r["raw_ext"])
    pack_ext = money(r["pack_ext"])
    total = money(raw_ext + pack_ext)
    if total <= 0:
        continue
    desc = f"Production capitalization - {r['order_number']}"
    lines = [{"account_id": acc_id["1220"], "debit": total, "credit": 0.0, "description": desc}]
    if raw_ext > 0:
        lines.append({"account_id": acc_id["1200"], "debit": 0.0, "credit": raw_ext,
                      "description": f"Raw materials consumed - {r['order_number']}"})
    if pack_ext > 0:
        lines.append({"account_id": acc_id["1210"], "debit": 0.0, "credit": pack_ext,
                      "description": f"Packing materials consumed - {r['order_number']}"})
    prod_headers.append({
        "company_id": 1,
        "voucher_type": "MANUFACTURING",
        "entry_date": r["manufacturing_date"] or "2025-06-30",
        "reference_no": f"BACKFILL-PROD-{r['id']}",
        "narration": f"Capitalize consumption into finished goods ({r['order_number']})",
        "source_table": "production_orders",
        "source_id": r["id"],
        "is_posted": 1,
        "created_by": None,
    })
    prod_lines_per_entry.append(lines)

log(f"Production orders to capitalize: {len(prod_headers)} "
    f"(total {sum(sum(l['debit'] for l in ls) for ls in prod_lines_per_entry):,.2f})")

# --------------------------------------------------------------------------
# 3. COGS for sales invoices
# --------------------------------------------------------------------------
inv_rows = db.fetch_all(
    """
    SELECT si.id, si.invoice_number, si.invoice_date,
           sii.item_id, sii.quantity, i.item_type
    FROM sales_invoices si
    JOIN sales_invoice_items sii ON sii.invoice_id = si.id
    JOIN items i ON i.id = sii.item_id
    ORDER BY si.invoice_date, si.id
    """
)

per_invoice: dict[int, dict] = {}
for r in inv_rows:
    d = per_invoice.setdefault(
        r["id"],
        {"number": r["invoice_number"], "date": r["invoice_date"],
         "raw": 0.0, "pack": 0.0, "missing": set()},
    )
    cost = item_cost.get(r["item_id"])
    qty = float(r["quantity"] or 0)
    if not cost or qty <= 0:
        d["missing"].add(r["item_id"])
        continue
    if r["item_type"] == "PACKING_MATERIAL":
        d["pack"] += cost[1] * qty
    else:
        d["raw"] += cost[0] * qty
        d["pack"] += cost[1] * qty

cogs_headers: list[dict] = []
cogs_lines_per_entry: list[list[dict]] = []
skipped_no_cost = 0

for inv_id in sorted(per_invoice):
    if inv_id in covered:
        continue
    d = per_invoice[inv_id]
    if d["missing"]:
        skipped_no_cost += 1
    raw_amt = money(d["raw"])
    pack_amt = money(d["pack"])
    if raw_amt <= 0 and pack_amt <= 0:
        continue
    lines = []
    if raw_amt > 0:
        lines.append({"account_id": acc_id["5000"], "debit": raw_amt, "credit": 0.0,
                      "description": f"COGS (raw materials) - {d['number']}"})
    if pack_amt > 0:
        lines.append({"account_id": acc_id["5001"], "debit": pack_amt, "credit": 0.0,
                      "description": f"COGS (packing materials) - {d['number']}"})
    lines.append({"account_id": acc_id["1220"], "debit": 0.0,
                  "credit": money(raw_amt + pack_amt),
                  "description": f"Reduce finished goods inventory - {d['number']}"})
    cogs_headers.append({
        "company_id": 1,
        "voucher_type": "JOURNAL",
        "entry_date": d["date"] or "2025-06-30",
        "reference_no": f"BACKFILL-COGS-{inv_id}",
        "narration": f"Backfilled COGS for sales invoice {d['number']}",
        "source_table": "sales_invoices",
        "source_id": inv_id,
        "is_posted": 1,
        "created_by": None,
    })
    cogs_lines_per_entry.append(lines)

cogs_total = sum(sum(l["debit"] for l in ls) for ls in cogs_lines_per_entry)
log(f"Sales invoices to backfill COGS: {len(cogs_headers)} (total {cogs_total:,.2f})")
log(f"Invoices skipped (items have no production cost): {skipped_no_cost}")
# --------------------------------------------------------------------------
# 4. Inventory repair (optional): give zero-cost finished-good batches a
#    weighted-average cost so future sales through the normal service path
#    also post real COGS.
# --------------------------------------------------------------------------
if APPLY:
    repaired = 0
    for item_id, (raw_u, pack_u) in sorted(item_cost.items()):
        n = db.execute(
            """
            UPDATE stock_batches
            SET raw_unit_cost = ?, packing_unit_cost = ?, purchase_price = ?
            WHERE item_id = ? AND raw_unit_cost = 0 AND packing_unit_cost = 0
              AND purchase_price = 0 AND quantity_in_stock > 0
            """,
            (round(raw_u, 6), round(pack_u, 6), round(raw_u + pack_u, 6), item_id),
        )
        repaired += n
    log(f"Batches with zero cost repaired: {repaired}")
else:
    log("Inventory repair skipped (dry run; use --apply)")

# --------------------------------------------------------------------------
# 5. Write the journal entries
# --------------------------------------------------------------------------
if APPLY:
    with db.transaction():
        if prod_headers:
            journal_repo.insert_entries_bulk(prod_headers, prod_lines_per_entry)
        if cogs_headers:
            journal_repo.insert_entries_bulk(cogs_headers, cogs_lines_per_entry)
    log(
        f"APPLIED: {len(prod_headers)} MANUFACTURING entries + "
        f"{len(cogs_headers)} COGS entries."
    )
else:
    log("DRY RUN - nothing written. Re-run with --apply to post the entries.")

# --------------------------------------------------------------------------
# 6. Post-apply verification
# --------------------------------------------------------------------------
if APPLY:
    log("\n=== Account balances after backfill ===")
    rows = db.fetch_all(
        """
        SELECT a.account_code, a.account_name,
               COALESCE(SUM(jel.debit), 0) AS dr, COALESCE(SUM(jel.credit), 0) AS cr
        FROM accounts a
        LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
        LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.is_posted = 1
        WHERE a.account_code IN ('1200','1210','1220','5000','5001')
        GROUP BY a.id ORDER BY a.account_code
        """
    )
    for r in rows:
        log(f"  {r['account_code']} {r['account_name']:<35} Dr {r['dr']:>15,.2f}  Cr {r['cr']:>15,.2f}")
    log("\n=== Trial balance ===")
    rows = db.fetch_all(
        """
        SELECT COALESCE(SUM(jel.debit), 0) AS dr, COALESCE(SUM(jel.credit), 0) AS cr
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.journal_entry_id
        WHERE je.is_posted = 1
        """
    )
    diff = rows[0]["dr"] - rows[0]["cr"]
    log(f"  Total Dr {rows[0]['dr']:,.2f} / Cr {rows[0]['cr']:,.2f} (diff {diff:,.2f})")

