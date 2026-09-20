"""Check what cost data exists for COGS computation."""
import os
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from database.connection import get_db

db = get_db()

print("=== L. Distinct voucher types in journal_entries ===")
rows = db.fetch_all("""
    SELECT voucher_type, COUNT(*) as n FROM journal_entries WHERE is_posted = 1
    GROUP BY voucher_type ORDER BY n DESC
""")
for r in rows:
    print(dict(r))

print("\n=== M. production_consumption summary ===")
rows = db.fetch_all("PRAGMA table_info(production_consumption)")
print("columns:", [r["name"] for r in rows])
rows = db.fetch_all("""
    SELECT COUNT(*) as n, SUM(COALESCE(unit_cost,0)) as total_cost,
           SUM(COALESCE(quantity_consumed,0)) as total_qty
    FROM production_consumption
""")
print(dict(rows[0]))
rows = db.fetch_all("""
    SELECT pc.unit_cost, pc.quantity_consumed, pc.unit_cost * pc.quantity_consumed as ext
    FROM production_consumption pc LIMIT 5
""")
for r in rows:
    print(dict(r))

print("\n=== N. Per production order: consumption total vs production_cost ===")
rows = db.fetch_all("""
    SELECT po.id, po.production_cost, po.actual_quantity,
           COALESCE(SUM(pc.unit_cost),0) as cons_sum,
           COALESCE(SUM(pc.unit_cost * pc.quantity_consumed),0) as cons_ext
    FROM production_orders po
    LEFT JOIN production_consumption pc ON pc.production_order_id = po.id
    WHERE po.is_ghost = 1
    GROUP BY po.id LIMIT 8
""")
for r in rows:
    print(dict(r))

print("\n=== O. BOMs -> finished items ===")
rows = db.fetch_all("PRAGMA table_info(bill_of_materials)")
print("bill_of_materials columns:", [r["name"] for r in rows])

print("\n=== P. Sold items split by type, with cost-source coverage ===")
rows = db.fetch_all("""
    SELECT i.item_type,
           COUNT(DISTINCT sii.item_id) as items_sold,
           SUM(sii.qty) as total_qty,
           SUM(CASE WHEN prod.n_orders > 0 THEN 1 ELSE 0 END) as with_prod_orders
    FROM (SELECT item_id, SUM(quantity) as qty FROM sales_invoice_items GROUP BY item_id) sii
    JOIN items i ON i.id = sii.item_id
    LEFT JOIN (SELECT b.finished_item_id as item_id, COUNT(po.id) as n_orders
               FROM production_orders po JOIN bill_of_materials b ON b.id = po.bom_id
               GROUP BY b.finished_item_id) prod ON prod.item_id = sii.item_id
    GROUP BY i.item_type
""")
for r in rows:
    print(dict(r))

print("\n=== Q. Purchase cost coverage for sold RAW/PACKING items ===")
rows = db.fetch_all("""
    SELECT i.item_type,
           COUNT(*) as items,
           SUM(CASE WHEN pi.nz_purchases > 0 THEN 1 ELSE 0 END) as with_purchase_cost
    FROM (SELECT DISTINCT item_id FROM sales_invoice_items) sii
    JOIN items i ON i.id = sii.item_id
    LEFT JOIN (SELECT item_id, COUNT(*) as nz_purchases FROM purchase_invoice_items
               WHERE COALESCE(unit_cost,0) > 0 GROUP BY item_id) pi ON pi.item_id = sii.item_id
    WHERE i.item_type IN ('RAW_MATERIAL', 'PACKING_MATERIAL')
    GROUP BY i.item_type
""")
for r in rows:
    print(dict(r))

print("\n=== S. Estimated total COGS from weighted-avg production cost ===")
rows = db.fetch_all("""
    SELECT SUM(sii.quantity * u.unit_cost) as est_cogs,
           COUNT(*) as lines,
           SUM(CASE WHEN u.unit_cost IS NULL THEN sii.quantity ELSE 0 END) as qty_no_cost
    FROM sales_invoice_items sii
    LEFT JOIN (
        SELECT b.finished_item_id as item_id,
               SUM(po.production_cost) / NULLIF(SUM(po.actual_quantity),0) as unit_cost
        FROM production_orders po
        JOIN bill_of_materials b ON b.id = po.bom_id
        WHERE po.actual_quantity > 0
        GROUP BY b.finished_item_id
    ) u ON u.item_id = sii.item_id
""")
print(dict(rows[0]))

print("\n=== S2. Per-invoice-count of sales needing COGS ===")
rows = db.fetch_all("SELECT COUNT(DISTINCT invoice_id) as n FROM sales_invoice_items")
print(dict(rows[0]))

print("\n=== T. sales_returns present? ===")
try:
    rows = db.fetch_all("SELECT COUNT(*) as n FROM sales_returns")
    print("sales_returns:", dict(rows[0]))
    rows = db.fetch_all("SELECT COUNT(*) as n FROM sales_return_items")
    print("sales_return_items:", dict(rows[0]))
except Exception as e:
    print("err:", e)

print("\n=== U. Raw/packing consumption split (for capitalization JEs) ===")
rows = db.fetch_all("""
    SELECT i.item_type, COUNT(*) as n, SUM(pc.unit_cost * pc.quantity_consumed) as total
    FROM production_consumption pc
    JOIN items i ON i.id = pc.component_item_id
    GROUP BY i.item_type
""")
for r in rows:
    print(dict(r))

print("\n=== U2. JEs already referencing production? ===")
rows = db.fetch_all("""
    SELECT source_table, COUNT(*) as n FROM journal_entries
    WHERE source_table LIKE '%production%' OR source_table LIKE '%manufactur%'
    GROUP BY source_table
""")
print(rows if rows else "none")

print("\n=== V. 1220 / 5000 current balances again (post-check baseline) ===")
rows = db.fetch_all("""
    SELECT a.account_code, COALESCE(SUM(jel.debit),0) as dr, COALESCE(SUM(jel.credit),0) as cr
    FROM accounts a
    LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
    LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.is_posted = 1
    WHERE a.account_code IN ('1220','5000','5001') GROUP BY a.account_code
""")
for r in rows:
    print(dict(r))

