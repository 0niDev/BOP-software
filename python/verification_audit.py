import csv, os, sys
from collections import defaultdict
from utils.env_loader import setup_import_env
setup_import_env()
from database.connection import get_db, close_db

db = get_db()
base = 'PharmaPro_FullExport'

# ===== MANUFACTURING =====
print('=' * 70)
print('MANUFACTURING - BOMS AND ORDERS')
print('=' * 70)

# BOMs
with open(os.path.join(base, 'FormulaHeader.csv'), 'r', encoding='utf-8-sig') as f:
    formulas = list(csv.DictReader(f))
with open(os.path.join(base, 'FormulaBody.csv'), 'r', encoding='utf-8-sig') as f:
    formula_body = list(csv.DictReader(f))
with open(os.path.join(base, 'FillingHeader.csv'), 'r', encoding='utf-8-sig') as f:
    fillings = list(csv.DictReader(f))
with open(os.path.join(base, 'FillingBody.csv'), 'r', encoding='utf-8-sig') as f:
    filling_body = list(csv.DictReader(f))

print(f'CSV formulas: {len(formulas)}, formula body: {len(formula_body)}')
print(f'CSV fillings: {len(fillings)}, filling body: {len(filling_body)}')

db_boms = db.fetch_one('SELECT COUNT(*) c FROM bill_of_materials')['c']
db_bom_comp = db.fetch_one('SELECT COUNT(*) c FROM bom_components')['c']
print(f'DB BOMs: {db_boms}')
print(f'DB BOM components: {db_bom_comp}')

# Production orders
with open(os.path.join(base, 'Productions.csv'), 'r', encoding='utf-8-sig') as f:
    productions = list(csv.DictReader(f))
with open(os.path.join(base, 'ProductionBody.csv'), 'r', encoding='utf-8-sig') as f:
    prod_body = list(csv.DictReader(f))
with open(os.path.join(base, 'PackingHeader.csv'), 'r', encoding='utf-8-sig') as f:
    packings = list(csv.DictReader(f))
with open(os.path.join(base, 'PackingBody.csv'), 'r', encoding='utf-8-sig') as f:
    pack_body = list(csv.DictReader(f))

print(f'\nCSV productions: {len(productions)}, production body: {len(prod_body)}')
print(f'CSV packings: {len(packings)}, packing body: {len(pack_body)}')

db_orders = db.fetch_one('SELECT COUNT(*) c FROM production_orders')['c']
db_cons = db.fetch_one('SELECT COUNT(*) c FROM production_consumption')['c']
print(f'DB production orders: {db_orders}')
print(f'DB production consumption: {db_cons}')

# ===== ITEMS =====
print()
print('=' * 70)
print('ITEMS - ENTRY BY ENTRY CHECK')
print('=' * 70)

with open(os.path.join(base, 'Products.csv'), 'r', encoding='utf-8-sig') as f:
    products = list(csv.DictReader(f))

db_items = db.fetch_all('SELECT id, item_code, item_name, is_active FROM items WHERE company_id=1')
db_by_code = {r['item_code']: r for r in db_items}
db_by_suffix = {r['item_code'].replace('ITEM-',''): r for r in db_items}

print(f'CSV products: {len(products)}')
print(f'DB items: {len(db_items)}')
print(f'  Active: {sum(1 for r in db_items if r["is_active"])}')
print(f'  Ghost: {sum(1 for r in db_items if not r["is_active"])}')

# Check each product
missing_items = []
name_mismatches = 0
for p in products:
    pid = p['ProductId'].strip()
    pname = p.get('ProductName', '').strip()
    if not pname:
        continue
    if pid in db_by_code:
        if db_by_code[pid]['item_name'] != pname:
            name_mismatches += 1
    elif pid in db_by_suffix:
        if db_by_suffix[pid]['item_name'] != pname:
            name_mismatches += 1
    else:
        missing_items.append((pid, pname))

print(f'\nProducts with name missing in CSV: {sum(1 for p in products if not p.get("ProductName","").strip())}')
print(f'Products with names, in DB: {len(products) - len(missing_items) - sum(1 for p in products if not p.get("ProductName","").strip())}')
print(f'Missing from DB: {len(missing_items)}')
for pid, pname in missing_items[:10]:
    print(f'  MISSING: {pid} {pname}')
if len(missing_items) > 10:
    print(f'  ... and {len(missing_items)-10} more')
print(f'Name mismatches: {name_mismatches}')

# ===== EXPENSES TAB =====
print()
print('=' * 70)
print('EXPENSES TAB')
print('=' * 70)

db_exp = db.fetch_one('SELECT COUNT(*) c FROM expenses')['c']
print(f'DB expense rows: {db_exp}')

# Source: DV non-party + JV expenses
# DV expenses
dv_all = []
with open(os.path.join(base, 'DebitVouchers.csv'), 'r', encoding='utf-8-sig') as f:
    dv_hdr = {r['VoucherNo'].strip(): r for r in csv.DictReader(f)}
with open(os.path.join(base, 'DebitVouchersBody.csv'), 'r', encoding='utf-8-sig') as f:
    dv_body = list(csv.DictReader(f))

# JV expenses
with open(os.path.join(base, 'JournalVouchers.csv'), 'r', encoding='utf-8-sig') as f:
    jvs = list(csv.DictReader(f))

# Count DV non-party lines (party_id NOT in 62xxxx range)
dv_nonparty = 0
for b in dv_body:
    acct = b.get('AccountNo', '').strip()
    if not acct.startswith('6'):
        dv_nonparty += 1

# Count JV expense lines
with open(os.path.join(base, 'JournalVouchersBody.csv'), 'r', encoding='utf-8-sig') as f:
    jv_body = list(csv.DictReader(f))

jv_exp_lines = len(jv_body)
print(f'DV non-party body lines (source): {dv_nonparty}')
print(f'JV body lines (source): {jv_exp_lines}')
print(f'Expected expense rows: ~{dv_nonparty + jv_exp_lines}')

# Verify journal entry balance per type
print()
print('=' * 70)
print('JOURNAL BALANCE PER SOURCE')
print('=' * 70)
for src, col in [('SALES', 'voucher_type'), ('PURCHASE', 'voucher_type'), ('RECEIPT', 'voucher_type'), ('OPENING', 'voucher_type')]:
    r = db.fetch_one(f"""
        SELECT SUM(jel.debit) as d, SUM(jel.credit) as cr, COUNT(*) as cnt
        FROM journal_entry_lines jel
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        WHERE je.{col} = '{src}'
    """)
    if r and r['d']:
        balanced = abs(r['d'] - r['cr']) < 0.01
        print(f'  {src:12s}: DR={r["d"]:>15,.2f} CR={r["cr"]:>15,.2f} lines={r["cnt"]:>6} balanced={balanced}')
    else:
        print(f'  {src:12s}: no entries')

print()
print('NOTE: No DV or JV journal entries found in DB.')
total_je = db.fetch_one('SELECT COUNT(*) c FROM journal_entries')['c']
print(f'  Total journal entries: {total_je}')

close_db()
