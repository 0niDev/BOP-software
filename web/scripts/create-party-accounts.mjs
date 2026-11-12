// Give every party its own sub-ledger account under A/R (customers) or A/P
// (suppliers), so a journal voucher can post straight to "this party".
// Idempotent: only parties with no account, or linked straight to the control
// account, are touched. Existing postings stay where they are — the party
// ledger keys on party_id, so its balance is unaffected.
//
//   node scripts/create-party-accounts.mjs            # data/erp.sqlite (backs up first)
//   node scripts/create-party-accounts.mjs <db> [--dry]
//
// Read/Write on the given file only. Never point it at maindb/SQLITE_CLOUD_URL.

import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const webRoot = path.resolve(import.meta.dirname, "..");
const dbPath = path.resolve(webRoot, process.argv[2] ?? "data/erp.sqlite");
const dry = process.argv.includes("--dry");

const CONTROL_CODE = { SUPPLIER: "2000" };
const controlCode = (partyType) => CONTROL_CODE[partyType] ?? "1100";

const db = new DatabaseSync(dbPath);

/** Same allocator as JournalRepository.nextVoucherNumber("ACCOUNT"). */
function nextAccountCode(companyId) {
  const row = db
    .prepare(
      `INSERT INTO numbering_sequences (company_id, document_type, prefix, next_number, padding)
       VALUES (?, 'ACCOUNT', 'AC-', 2, 5)
       ON CONFLICT(company_id, document_type) DO UPDATE SET
           next_number = next_number + 1
       RETURNING prefix, next_number - 1 AS next_number, padding`,
    )
    .get(companyId);
  return `${row.prefix}${String(row.next_number).padStart(Number(row.padding), "0")}`;
}

const parties = db
  .prepare(
    `SELECT id, company_id, code, name, party_type FROM parties
      WHERE account_id IS NULL
         OR account_id IN (SELECT id FROM accounts WHERE account_code IN ('1100', '2000'))
      ORDER BY company_id, id`,
  )
  .all();

if (parties.length === 0) {
  console.log("every party already has a linked account — nothing to do");
  process.exit(0);
}

if (!dry && existsSync(dbPath) && dbPath.startsWith(webRoot)) {
  const dir = path.join(webRoot, "backups");
  mkdirSync(dir, { recursive: true });
  const dest = path.join(
    dir,
    `pre-party-accounts-${new Date().toISOString().replace(/[:.]/g, "-")}.db`,
  );
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  copyFileSync(dbPath, dest);
  console.log(`backup: ${path.relative(webRoot, dest)}`);
}

const now = new Date().toISOString().replace("T", " ").slice(0, 19);
const insertAccount = db.prepare(
  `INSERT INTO accounts
     (company_id, account_code, account_name, parent_account_id, account_type,
      opening_balance, is_system_account, is_active, created_at)
   VALUES (?, ?, ?, ?, ?, 0, 0, 1, ?)`,
);
const linkParty = db.prepare("UPDATE parties SET account_id = ? WHERE id = ?");

const counts = { linked: 0, skipped: 0 };
db.exec("BEGIN");
try {
  for (const party of parties) {
    const parent = db
      .prepare(
        "SELECT id, account_type FROM accounts WHERE company_id = ? AND account_code = ?",
      )
      .get(party.company_id, controlCode(party.party_type));
    if (!parent) {
      console.error(
        `  skip party ${party.code}: control account ${controlCode(party.party_type)} missing`,
      );
      counts.skipped += 1;
      continue;
    }
    if (dry) {
      console.log(
        `  add ${party.code} "${party.name}" under ${controlCode(party.party_type)}`,
      );
      counts.linked += 1;
      continue;
    }
    const accountCode = nextAccountCode(party.company_id);
    const result = insertAccount.run(
      party.company_id,
      accountCode,
      `${party.name} (${party.code})`,
      parent.id,
      parent.account_type,
      now,
    );
    linkParty.run(result.lastInsertRowid, party.id);
    counts.linked += 1;
  }
  db.exec(dry ? "ROLLBACK" : "COMMIT");
} catch (err) {
  db.exec("ROLLBACK");
  throw err;
} finally {
  db.close();
}

console.log(
  `${dry ? "dry run: " : ""}${counts.linked} party account(s) ${dry ? "would be created" : "created"}` +
    (counts.skipped > 0 ? `, ${counts.skipped} skipped` : ""),
);
