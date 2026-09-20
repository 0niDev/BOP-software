import csv, os, sys
from collections import defaultdict
from utils.env_loader import setup_import_env
setup_import_env()
from database.connection import get_db, close_db

db = get_db()
base = 'PharmaPro_FullExport'

# ===== SALES INVOICES =====
print('=' * 70)
print('SALES INVOICES - ENTRY BY ENTRY CHECK')
print('=' * 70)

with open(os.path.join(base, 'Sales.csv'), 'r', encoding='utf-8-sig') as f:
    sales_hdr = {r['SaleId'].strip(): r for r in csv.DictReader(f)}
with open(os.path.join(base, 'SalesBody.csv'), 'r', encoding='utf-8-sig') as f:
    sales_body_raw = list(csv.DictReader(f))
with open(os.path.join(base, 'Products.csv'), 'r', encoding='utf-8-sig') as f:
    products = {r['ProductId'].strip(): r for r in csv.DictReader(f)}

sales_body = defaultdict(list)
for r in sales_body_raw:
    sales_body[r['SaleId'].strip()].append(r)

imported = db.fetch_all("SELECT id, notes, total_amount FROM sales_invoices WHERE notes LIKE '%Imported from PharmaPro SaleId=%'")
imported_map = {}
for r in imported:
    sid = r['notes'].split('SaleId=')[1].split(' ')[0]
    imported_map[sid] = r

print(f'CSV sales headers: {len(sales_hdr)}')
print(f'CSV sales body lines: {len(sales_body_raw)}')
print(f'CSV invoices with body: {len(sales_body)}')
print(f'DB imported sales: {len(imported_map)}')

missing = []
for sid in sorted(sales_hdr.keys(), key=lambda x: int(x)):
    if sid not in imported_map:
        hdr = sales_hdr[sid]
        cust = hdr.get('CustomerId', '').strip()
        body = sales_body.get(sid, [])
        csv_total = sum(float(l.get('TTLValue', 0) or 0) for l in body)
        missing.append((sid, cust, len(body), csv_total))

print(f'\nMISSING SALES ({len(missing)}):')
for sid, cust, lines, total in missing[:30]:
    print(f'  SaleId={sid} Customer={cust} Lines={lines} CSVTotal={total:,.2f}')
if len(missing) > 30:
    print(f'  ... and {len(missing)-30} more')

print(f'\nAMOUNT MATCH CHECK (sample first 50 imported):')
amount_mismatches = []
for sid, r in sorted(imported_map.items(), key=lambda x: int(x[0]))[:50]:
    if sid not in sales_body:
        continue
    csv_total = sum(float(l.get('TTLValue', 0) or 0) for l in sales_body[sid])
    db_total = float(r['total_amount'] or 0)
    if abs(csv_total - db_total) > 0.01:
        amount_mismatches.append((sid, csv_total, db_total))

print(f'Amount mismatches in first 50: {len(amount_mismatches)}')
for sid, csv_t, db_t in amount_mismatches[:10]:
    print(f'  SaleId={sid} CSV={csv_t:,.2f} DB={db_t:,.2f} diff={csv_t-db_t:,.2f}')

print(f'\nLINE ITEM COUNT CHECK:')

# Batch query all line counts at once
invoice_ids = [imported_map[sid]['id'] for sid in imported_map if sid in sales_body]
if invoice_ids:
    placeholders = ','.join(['?'] * len(invoice_ids))
    rows = db.fetch_all(
        f"SELECT invoice_id, COUNT(*) c FROM sales_invoice_items WHERE invoice_id IN ({placeholders}) GROUP BY invoice_id",
        tuple(invoice_ids)
    )
    db_line_counts = {str(r['invoice_id']): r['c'] for r in rows}
else:
    db_line_counts = {}

total_csv_lines = 0
total_db_lines = 0
missing_lines = 0
for sid in imported_map:
    if sid in sales_body:
        csv_lines = len(sales_body[sid])
        total_csv_lines += csv_lines
        db_lines = db_line_counts.get(imported_map[sid]['id'], 0)
        total_db_lines += db_lines
        if csv_lines != db_lines:
            missing_lines += 1
            if missing_lines <= 5:
                print(f'  MISMATCH SaleId={sid}: CSV={csv_lines} DB={db_lines}')

print(f'Total CSV lines (imported invoices): {total_csv_lines}')
print(f'Total DB lines: {total_db_lines}')
print(f'Invoices with line count mismatch: {missing_lines}')

# ===== PURCHASE INVOICES =====
print()
print('=' * 70)
print('PURCHASE INVOICES - ENTRY BY ENTRY CHECK')
print('=' * 70)

with open(os.path.join(base, 'Purchases.csv'), 'r', encoding='utf-8-sig') as f:
    purch_hdr = {r['PurchaseId'].strip(): r for r in csv.DictReader(f)}
with open(os.path.join(base, 'PurchasesBody.csv'), 'r', encoding='utf-8-sig') as f:
    purch_body_raw = list(csv.DictReader(f))

purch_body = defaultdict(list)
for r in purch_body_raw:
    purch_body[r['PurchaseId'].strip()].append(r)

imported_p = db.fetch_all("SELECT id, notes, total_amount FROM purchase_invoices WHERE notes LIKE '%Imported from PharmaPro PurchaseId=%'")
imported_p_map = {}
for r in imported_p:
    pid = r['notes'].split('PurchaseId=')[1].split(' ')[0]
    imported_p_map[pid] = r

print(f'CSV purchase headers: {len(purch_hdr)}')
print(f'CSV purchase body lines: {len(purch_body_raw)}')
print(f'DB imported purchases: {len(imported_p_map)}')

missing_p = []
for pid in sorted(purch_hdr.keys(), key=lambda x: int(x)):
    if pid not in imported_p_map:
        hdr = purch_hdr[pid]
        body = purch_body.get(pid, [])
        csv_total = sum(float(l.get('TTLValue', 0) or 0) for l in body)
        missing_p.append((pid, hdr.get('VendorId','').strip(), len(body), csv_total))

print(f'\nMISSING PURCHASES ({len(missing_p)}):')
for pid, vid, lines, total in missing_p[:30]:
    print(f'  PurchaseId={pid} Vendor={vid} Lines={lines} CSVTotal={total:,.2f}')
if len(missing_p) > 30:
    print(f'  ... and {len(missing_p)-30} more')

# Batch query purchase line counts
print(f'\nLINE ITEM COUNT CHECK:')
p_invoice_ids = [imported_p_map[pid]['id'] for pid in imported_p_map if pid in purch_body]
if p_invoice_ids:
    placeholders = ','.join(['?'] * len(p_invoice_ids))
    p_rows = db.fetch_all(
        f"SELECT invoice_id, COUNT(*) c FROM purchase_invoice_items WHERE invoice_id IN ({placeholders}) GROUP BY invoice_id",
        tuple(p_invoice_ids)
    )
    p_db_line_counts = {str(r['invoice_id']): r['c'] for r in p_rows}
else:
    p_db_line_counts = {}

total_p_csv = 0
total_p_db = 0
mismatch_p = 0
for pid in imported_p_map:
    if pid in purch_body:
        csv_lines = len(purch_body[pid])
        total_p_csv += csv_lines
        db_lines = p_db_line_counts.get(imported_p_map[pid]['id'], 0)
        total_p_db += db_lines
        if csv_lines != db_lines:
            mismatch_p += 1
            if mismatch_p <= 5:
                print(f'  MISMATCH PurchaseId={pid}: CSV={csv_lines} DB={db_lines}')

print(f'Total CSV lines (imported): {total_p_csv}')
print(f'Total DB lines: {total_p_db}')
print(f'Mismatches: {mismatch_p}')

close_db()
