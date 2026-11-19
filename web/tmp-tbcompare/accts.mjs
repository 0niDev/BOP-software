import { DatabaseSync } from 'node:sqlite'
const db = new DatabaseSync('data/fix-fixed-2026-11-11.db', { readOnly: true })
console.log(db.prepare(`select id, account_code, account_name, account_type, opening_balance, is_active from accounts where account_code in ('5846','5850','5851','5852','5860','5870','5880','5890') or account_name like '%Insurance%' or account_name like '%Miscellaneous%' or account_name like '%TRAVEL%'`).all())
