import { DatabaseSync } from 'node:sqlite'
const db = new DatabaseSync('data/fix-fixed-2026-11-11.db', { readOnly: true })
// Check account schema
console.log('--- accounts table schema')
console.log(db.prepare('pragma table_info(accounts)').all())
// Check SI-00033 line items
console.log('--- SI-00033 line items')
console.log(db.prepare(`select * from journal_entry_lines where journal_entry_id=33`).all())
// Check what journal_entry has id=33
console.log('--- journal_entry id=33')
console.log(db.prepare(`select * from journal_entries where id=33`).all())
// Check Nov 1-15 movement - use account name instead of code
console.log('--- Nov 1-15 movement by account name')
console.log(db.prepare(`select a.account_name, sum(jel.debit) dr, sum(jel.credit) cr from journal_entry_lines jel join journal_entries je on je.id=jel.journal_entry_id join accounts a on a.id=jel.account_id where je.entry_date >= '2026-11-01' and je.entry_date <= '2026-11-15' group by a.account_name having dr>0 or cr>0 order by dr+cr desc`).all().slice(0,50))
// Check accounts with opening_balance != 0
console.log('--- accounts with nonzero opening_balance')
console.log(db.prepare(`select a.account_name, a.opening_balance from accounts a where a.opening_balance<>0 and a.is_active=1 order by abs(a.opening_balance) desc limit 30`).all())
// Check what journals exist in Nov 1-15
console.log('--- journal entry dates Nov 1-15')
console.log(db.prepare(`select distinct substr(entry_date,1,10) from journal_entries where entry_date >= '2026-11-01' and entry_date <= '2026-11-15' order by entry_date`).all())
