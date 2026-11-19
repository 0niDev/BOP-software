import { DatabaseSync } from 'node:sqlite'
const db = new DatabaseSync('data/fix-fixed-2026-11-11.db', { readOnly: true })
// Check sales invoice SI-00033 line items
console.log('--- SI-00033 line items')
console.log(db.prepare(`select * from journal_entry_lines where journal_entry_id=33`).all())
// Check accounts with opening_balance != 0
console.log('--- accounts with nonzero opening_balance')
console.log(db.prepare(`select a.account_code, a.account_name, a.opening_balance from accounts a where a.opening_balance<>0 and a.is_active=1 order by abs(a.opening_balance) desc limit 30`).all())
// Check period movement Nov 1-15
console.log('--- Nov 1-15 movement per account')
console.log(db.prepare(`select a.account_code, a.account_name, sum(jel.debit) dr, sum(jel.credit) cr from journal_entry_lines jel join journal_entries je on je.id=jel.journal_entry_id where je.entry_date >= '2026-11-01' and je.entry_date <= '2026-11-15' and a.id=jel.account_id group by a.account_code, a.account_name having dr>0 or cr>0 order by dr+cr desc`).all())
// Check what accounts have posting in Nov 1-15
console.log('--- all account postings Nov 1-15')
console.log(db.prepare(`select a.account_code, a.account_name, sum(jel.debit) dr, sum(jel.credit) cr from journal_entry_lines jel join journal_entries je on je.id=jel.journal_entry_id join accounts a on a.id=jel.account_id where je.entry_date >= '2026-11-01' and je.entry_date <= '2026-11-15' group by a.account_code, a.account_name order by dr+cr desc`).all().slice(0,50))
