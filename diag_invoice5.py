from database.connection import get_db
db = get_db()
for pid in ['00008', '00009', '00010', '00013']:
    r = db.fetch_one(
        "SELECT id,item_code,item_type FROM items WHERE item_code=? OR item_code=?",
        (pid, 'ITEM-' + pid))
    print(pid, '->', dict(r) if r else None)

rows = db.fetch_all("""SELECT sii.item_id,i.item_code,i.item_type,sii.quantity
    FROM sales_invoice_items sii JOIN items i ON i.id=sii.item_id
    WHERE sii.invoice_id=5""")
print('invoice 5 items in DB:', [dict(x) for x in rows])

rows = db.fetch_all("""SELECT a.account_code,jel.debit,jel.credit
    FROM journal_entries je JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
    JOIN accounts a ON a.id=jel.account_id
    WHERE je.source_table='sales_invoices' AND je.source_id=5 AND je.is_posted=1""")
print('invoice 5 JE lines:', [dict(x) for x in rows])

# how many invoices were posted with a SalesBatch-only approach vs expected
rows = db.fetch_all("""SELECT COUNT(DISTINCT je.source_id) n
    FROM journal_entries je JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
    JOIN accounts a ON a.id=jel.account_id
    WHERE je.source_table='sales_invoices' AND je.is_posted=1 AND a.account_code IN ('5000','5001')
      AND je.narration LIKE '%Backfill%'""")
print('backfill-narrated invoices with COGS:', dict(rows[0]) if rows else 0)
rows = db.fetch_all("""SELECT COUNT(DISTINCT je.source_id) n
    FROM journal_entries je JOIN journal_entry_lines jel ON jel.journal_entry_id=je.id
    JOIN accounts a ON a.id=jel.account_id
    WHERE je.source_table='sales_invoices' AND je.is_posted=1 AND a.account_code IN ('5000','5001')
      AND (je.narration IS NULL OR je.narration NOT LIKE '%Backfill%')""")
print('non-backfill-narrated invoices with COGS:', dict(rows[0]) if rows else 0)
