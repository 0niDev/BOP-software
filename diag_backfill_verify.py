"""Read-only verification of the COGS backfill against the PharmaPro export.

Checks:
  1. How many non-cancelled sales invoices exist, how many have COGS lines.
  2. Total posted COGS (5000+5001) for sales_invoices JEs, split by
     entry_date bucket (opening = before 2025-07-01, else current).
  3. Where the offsetting credits went (by account code).
  4. Per-invoice reconciliation: posted COGS vs CSV-implied COGS
     (weighted avg batch cost x SalesBody quantity) for EVERY invoice.
"""
from __future__ import annotations
import os, sys, csv
from collections import defaultdict
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database.connection import get_db

EXPORT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "PharmaPro_FullExport")

db = get_db()

# ---- CSV expected COGS per SaleId --------------------------------------
body = defaultdict(float)
with open(os.path.join(EXPORT, "SalesBody.csv"), encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        body[(r["SaleId"], r["ProductId"])] += float(r["Quantity"])

batch = defaultdict(list)
with open(os.path.join(EXPORT, "SalesBatch.csv"), encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        batch[(r["SaleId"], r["ProductId"])].append((float(r["Quantity"]), float(r["Cost"])))

expected = defaultdict(Decimal)
for (sid, pid), qty in body.items():
    if qty <= 0:
        continue
    bs = batch.get((sid, pid))
    if not bs:
        continue
    tq = sum(b[0] for b in bs)
    if tq == 0:
        continue
    uc = sum(b[0] * b[1] for b in bs) / tq
    if uc <= 0:
        continue
    expected[int(sid)] += Decimal(str(uc)) * Decimal(str(qty))

print(f"CSV: expected COGS for {len(expected)} invoices, total {sum(expected.values()):,.2f}")

# ---- DB: invoices with COGS --------------------------------------------
rows = db.fetch_all("""
    SELECT je.source_id, SUM(jel.debit) as cogs
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN accounts a ON a.id = jel.account_id
    WHERE je.source_table = 'sales_invoices' AND je.is_posted = 1
      AND a.account_code IN ('5000','5001')
    GROUP BY je.source_id
""")
posted = {r["source_id"]: Decimal(str(r["cogs"] or 0)) for r in rows}
print(f"DB: {len(posted)} invoices have COGS lines, total {sum(posted.values()):,.2f}")

inv = db.fetch_one("SELECT COUNT(*) n FROM sales_invoices WHERE status != 'CANCELLED'")
print(f"DB: {inv['n']} non-cancelled sales invoices total")

# ---- reconciliation per invoice ----------------------------------------
both = set(posted) & set(expected)
match = 0
mismatch = []
for sid in sorted(both):
    p, e = posted[sid], expected[sid]
    if abs(p - e) <= Decimal("0.05"):
        match += 1
    else:
        mismatch.append((sid, float(p), float(e)))
print(f"RECONCILED (both sides): {match}/{len(both)} match within 0.05")
for sid, p, e in mismatch[:8]:
    print(f"  MISMATCH SaleId {sid}: posted {p:,.2f} vs expected {e:,.2f}")

only_db = set(posted) - set(expected)
only_csv = set(expected) - set(posted)
print(f"posted but no CSV expectation: {len(only_db)} -> {sorted(only_db)[:10]}")
print(f"CSV expectation but not posted: {len(only_csv)} (remaining to backfill)")

# ---- entry_date buckets and credit accounts -----------------------------
rows = db.fetch_all("""
    SELECT CASE WHEN je.entry_date < '2025-07-01' THEN 'opening' ELSE 'current' END b,
           SUM(jel.debit) d
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN accounts a ON a.id = jel.account_id
    WHERE je.source_table = 'sales_invoices' AND je.is_posted = 1
      AND a.account_code IN ('5000','5001')
    GROUP BY b
""")
for r in rows:
    print(f"COGS {r['b']} bucket: {r['d']:,.2f}")

rows = db.fetch_all("""
    SELECT a.account_code, a.account_name, SUM(jel.credit) c
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN accounts a ON a.id = jel.account_id
    WHERE je.source_table = 'sales_invoices' AND je.is_posted = 1
      AND jel.credit > 0
    GROUP BY a.account_code ORDER BY c DESC LIMIT 12
""")
print("Credit accounts on sales_invoices JEs:")
for r in rows:
    print(f"  {r['account_code']} {r['account_name']}: {r['c']:,.2f}")

# ---- item types of sold items -------------------------------------------
rows = db.fetch_all("""
    SELECT i.item_type, COUNT(DISTINCT sii.item_id) n
    FROM sales_invoice_items sii JOIN items i ON i.id = sii.item_id
    GROUP BY i.item_type
""")
print("Sold items by item_type:", [dict(r) for r in rows])
