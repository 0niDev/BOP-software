"""Diagnose why some backfilled invoices have less COGS than expected."""
import os, sys, csv
from collections import defaultdict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database.connection import get_db

db = get_db()
EXPORT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "PharmaPro_FullExport")

items = db.fetch_all("SELECT item_code FROM items")
codes = {i["item_code"] for i in items}

with open(os.path.join(EXPORT, "Products.csv"), encoding="utf-8-sig") as f:
    pids = [r["ProductId"] for r in csv.DictReader(f)]
missing = [p for p in pids if p not in codes and ("ITEM-" + p) not in codes]
print(f"Products.csv: {len(pids)} products, {len(missing)} with NO item in DB: {missing[:20]}")

# which product lines does SaleId 5 have, and their costs
batch = defaultdict(list)
with open(os.path.join(EXPORT, "SalesBatch.csv"), encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        batch[(r["SaleId"], r["ProductId"])].append((float(r["Quantity"]), float(r["Cost"])))
with open(os.path.join(EXPORT, "SalesBody.csv"), encoding="utf-8-sig") as f:
    body = [(r["SaleId"], r["ProductId"], float(r["Quantity"])) for r in csv.DictReader(f)]

for sid in ("5", "39"):
    print(f"\nSaleId {sid} lines:")
    for s, p, q in body:
        if s != sid: continue
        bs = batch.get((s, p))
        tq = sum(b[0] for b in bs) if bs else 0
        uc = (sum(b[0]*b[1] for b in bs)/tq) if bs and tq else 0
        in_db = p in codes or ("ITEM-"+p) in codes
        print(f"  {p}: qty={q} unit_cost={uc:.4f} item_in_db={in_db}")
