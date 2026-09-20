from database.connection import get_db
import csv
db = get_db()
# CSV body for SaleId 34 (true source of invoice id 5)
with open('PharmaPro_FullExport/SalesBody.csv', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        if r['SaleId'] == '34':
            print('CSV SaleId 34:', r['ProductId'], 'qty', r['Quantity'], 'TTLValue', r['TTLValue'])
# product names
with open('PharmaPro_FullExport/Products.csv', encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        if r['ProductId'] in ('00022', '00074', '00008'):
            print('Product', r['ProductId'], '=', r['ProductName'])
# our item names
for code in ('ITEM-00218', 'ITEM-00244', 'ITEM-00008', 'ITEM-00022'):
    r = db.fetch_one("SELECT id,item_code,item_name,item_type FROM items WHERE item_code=?", (code,))
    print('DB', dict(r) if r else None)
