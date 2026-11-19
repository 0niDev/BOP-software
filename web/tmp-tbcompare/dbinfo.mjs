import { DatabaseSync } from 'node:sqlite'
import { readdirSync, statSync } from 'node:fs'
const files = readdirSync('data').filter(f => /\.(db|sqlite)$/.test(f))
const out = []
for (const f of files) {
  try {
    const db = new DatabaseSync('data/' + f, { readOnly: true })
    const q = (sql) => { try { return db.prepare(sql).all() } catch { return null } }
    const entries = q(`select count(*) n, min(entry_date) mn, max(entry_date) mx from journal_entry_lines`)
    const tables = q(`select name from sqlite_master where type='table' and name in ('accounting_entries','journal_entry_lines','sale_invoices','purchase_invoices')`)
    const accts = q(`select count(*) n from accounts`)
    out.push({ f, size: statSync('data/'+f).size, entries, accts, tables: tables?.map(t=>t.name) })
    db.close()
  } catch (e) { out.push({ f, err: String(e).slice(0,80) }) }
}
console.log(JSON.stringify(out, null, 1))
