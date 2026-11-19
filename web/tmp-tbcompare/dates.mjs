import { DatabaseSync } from 'node:sqlite'
const db = new DatabaseSync('data/fix-fixed-2026-11-11.db', { readOnly: true })
console.log(db.prepare("select count(*) n, min(entry_date) mn, max(entry_date) mx from journal_entries").get())
console.log(db.prepare("select entry_date, count(*) n from journal_entries where entry_date >= '2026-10-25' group by entry_date order by entry_date").all())
console.log('invoices:')
console.log(db.prepare("select 'sale' t, count(*) n, min(invoice_date) mn, max(invoice_date) mx from sales_invoices").get())
console.log(db.prepare("select 'purchase' t, count(*) n, min(invoice_date) mn, max(invoice_date) mx from purchase_invoices").get())
console.log(db.prepare("select 'sale' t, invoice_date, count(*) n from sales_invoices where invoice_date >= '2026-10-25' group by invoice_date").all())
console.log(db.prepare("select 'purchase' t, invoice_date, count(*) n from purchase_invoices where invoice_date >= '2026-10-25' group by invoice_date").all())
