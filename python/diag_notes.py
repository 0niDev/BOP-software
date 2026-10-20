from database.connection import get_db
db = get_db()
rows = db.fetch_all("""
    SELECT id, invoice_number, notes, total_amount FROM sales_invoices
    WHERE id IN (1,2,3,4,5,6) """)
for r in rows:
    print(dict(r))
rows = db.fetch_all("""
    SELECT COUNT(*) n FROM sales_invoices
    WHERE notes LIKE 'Imported from PharmaPro SaleId=%'""")
print('invoices with PharmaPro notes:', dict(rows[0]))
rows = db.fetch_all("""
    SELECT id, invoice_number, notes FROM sales_invoices
    WHERE notes LIKE 'Imported from PharmaPro SaleId=%' ORDER BY id LIMIT 6""")
for r in rows:
    print(dict(r))
