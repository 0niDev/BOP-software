import { DatabaseSync } from 'node:sqlite'
const db = new DatabaseSync('data/fix-fixed-2026-11-11.db', { readOnly: true })
console.log(db.prepare("select name from sqlite_master where type='table'").all().map(t=>t.name).join(', '))
console.log(db.prepare("PRAGMA table_info(journal_entry_lines)").all().map(c=>c.name).join(','))
console.log(db.prepare("select count(*) n from journal_entry_lines").get())
