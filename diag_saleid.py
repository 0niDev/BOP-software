from database.connection import get_db
db = get_db()
rows = db.fetch_all("""
    SELECT id, invoice_number, invoice_date, total_amount
    FROM sales_invoices ORDER BY id LIMIT 8""")
for r in rows:
    print(dict(r))
print()
# does invoice_number correlate with CSV SaleId? Look at total for SaleId 1 in CSV
import csv
with open('PharmaPro_FullExport/SalesBody.csv', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        if r['SaleId'] == '1':
            print('CSV SaleId 1:', r['ProductId'], r['Quantity'], 'TTLValue=', r['TTLValue'])
# our invoice with number like INV-1 or 1
for num in ('1', 'INV-1', 'SALE-1', 'SI-1'):
    r = db.fetch_one("SELECT id, invoice_number, total_amount FROM sales_invoices WHERE invoice_number=? OR invoice_number LIKE ?", (num, f"%{num}"))
    if r:
        print('DB match:', dict(r))
# totals check: sum of CSV TTLValue for SaleId 1..5 vs our invoice 1..5 totals
for iid in range(1, 6):
    r = db.fetch_one("SELECT id, invoice_number, total_amount FROM sales_invoices WHERE id=?", (iid,))
    print('DB invoice', dict(r) if r else None)
