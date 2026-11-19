import { DatabaseSync } from 'node:sqlite'
const db = new DatabaseSync('data/fix-fixed-2026-11-11.db', { readOnly: true })
const rows = db.prepare(`
select je.entry_date, je.is_posted, count(distinct je.id) entries, sum(jel.debit) dr, sum(jel.credit) cr
from journal_entries je left join journal_entry_lines jel on jel.journal_entry_id = je.id
where je.entry_date >= '2026-11-01' and je.entry_date <= '2026-11-15'
group by je.entry_date, je.is_posted order by je.entry_date`).all()
console.log(rows)
console.log('all-time posted totals', db.prepare(`select je.is_posted, count(distinct je.id) e, sum(jel.debit) dr from journal_entries je join journal_entry_lines jel on jel.journal_entry_id=je.id group by je.is_posted`).all())
console.log('by month', db.prepare(`select substr(je.entry_date,1,7) m, je.is_posted, count(distinct je.id) e, sum(jel.debit) dr from journal_entries je join journal_entry_lines jel on jel.journal_entry_id=je.id group by m, je.is_posted order by m`).all())
