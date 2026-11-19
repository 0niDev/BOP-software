import { DatabaseSync } from 'node:sqlite'
const db = new DatabaseSync('data/fix-fixed-2026-11-11.db', { readOnly: true })
console.log('orphan lines', db.prepare(`select count(*) n, sum(jel.debit) dr from journal_entry_lines jel left join accounts a on a.id = jel.account_id where a.id is null`).get())
console.log('company ids', db.prepare(`select company_id, count(*) n from accounts group by company_id`).all())
console.log('je company', db.prepare(`select company_id, count(*) n from journal_entries group by company_id`).all())
console.log('nov lines by account', db.prepare(`
select a.id, a.account_code, a.account_name, a.company_id, a.is_active, sum(jel.debit) dr, sum(jel.credit) cr
from journal_entry_lines jel join journal_entries je on je.id=jel.journal_entry_id
left join accounts a on a.id=jel.account_id
where je.entry_date between '2026-11-01' and '2026-11-15'
group by a.id order by abs(sum(jel.debit)) desc limit 20`).all())
