// Generate docs/COA-CURRENT.md from a database — the shared reference for the
// chart-of-accounts cleanup. Read-only on the DB.
//
//   node scripts/dump-coa.mjs                       # data/erp.sqlite -> docs/COA-CURRENT.md
//   node scripts/dump-coa.mjs backups/20261028_120911.db /tmp/coa.md

import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";

const webRoot = path.resolve(import.meta.dirname, "..");
const dbPath = path.resolve(webRoot, process.argv[2] ?? "data/erp.sqlite");
const outPath = path.resolve(webRoot, process.argv[3] ?? "docs/COA-CURRENT.md");
mkdirSync(path.dirname(outPath), { recursive: true });

const db = new DatabaseSync(dbPath, { readOnly: true });

const accounts = db
  .prepare(
    `SELECT id, account_code, account_name, parent_account_id, account_type,
            account_subtype, opening_balance, is_active
       FROM accounts
      WHERE company_id = 1
      ORDER BY CAST(account_code AS INTEGER), account_code`,
  )
  .all();

const usage = new Map(
  db
    .prepare(
      `SELECT account_id, COUNT(*) AS n, SUM(debit + credit) AS volume
         FROM journal_entry_lines
        GROUP BY account_id`,
    )
    .all()
    .map((r) => [r.account_id, { n: Number(r.n), v: Number(r.volume ?? 0) }]),
);

const catCount = db
  .prepare("SELECT COUNT(*) AS n FROM expense_categories WHERE company_id = 1")
  .get()?.n ?? 0;

db.close();

// Seed codes from server/src/db/bootstrap.ts SYSTEM_ACCOUNTS: every service
// looks these up by exact code (idFor("1000") etc.), so they must keep their
// code unless callers are changed. The DB flag is unreliable (the import set
// is_system_account=1 on its own rows too), so membership in this list is the
// real marker.
const SEED_CODES = new Set([
  "1000", "1010", "1100", "1200", "1210", "1220", "1300", "1500", "1501",
  "1502", "1503", "1504", "1505", "2000", "2100", "2200", "3000", "3100",
  "4000", "4100", "5000", "5001", "5002", "5100", "5200", "5300", "6000",
  "6100", "6900",
]);

const byId = new Map(accounts.map((a) => [a.id, a]));
const TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const codeNum = (a) => Number(a.account_code) || Infinity;

const stat = (a) => usage.get(a.id) ?? { n: 0, v: 0 };
const flag = (a) => (a.is_active ? "" : " [INACTIVE]") + (SEED_CODES.has(a.account_code) ? " 🌱seed" : "");
const money = (x) => (x ? x.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "");
const line = (a) =>
  `- **${a.account_code}** ${a.account_name}${a.account_subtype ? ` (${a.account_subtype})` : ""} — ${a.account_type}${flag(a)}` +
  (a.opening_balance ? ` · opening ${money(a.opening_balance)}` : "") +
  (stat(a).n ? ` · ${stat(a).n} journal lines` : "");

// --- tree, ordered numerically inside each level ------------------------------
const childrenOf = new Map();
const roots = [];
for (const a of accounts) {
  const parent = a.parent_account_id ? byId.get(a.parent_account_id) : undefined;
  if (parent) {
    if (!childrenOf.has(parent.id)) childrenOf.set(parent.id, []);
    childrenOf.get(parent.id).push(a);
  } else {
    roots.push(a);
  }
}
const siblingsNum = (x, y) => codeNum(x) - codeNum(y) || x.account_code.localeCompare(y.account_code);
for (const kids of childrenOf.values()) kids.sort(siblingsNum);
roots.sort(siblingsNum);

function renderTree(nodes, type, depth = 0) {
  return nodes
    .map((a) => {
      const kids = childrenOf.get(a.id) ?? [];
      const head = `${"    ".repeat(depth)}- **${a.account_code}** ${a.account_name} — ${a.account_type}${flag(a)}`;
      const tail = [];
      if (a.opening_balance) tail.push(`opening ${money(a.opening_balance)}`);
      if (stat(a).n) tail.push(`${stat(a).n} j/l (${money(stat(a).v)})`);
      const fine = tail.length ? ` <sub>${tail.join(" · ")}</sub>` : "";
      const kidBlock = kids.length
        ? `\n${renderTree(kids, type, depth + 1)}`
        : "";
      return head + fine + kidBlock;
    })
    .join("\n");
}

/** Orphan finding: account with a parent id that no longer resolves. */
const orphans = accounts.filter(
  (a) => a.parent_account_id && !byId.has(a.parent_account_id),
);

// --- findings -----------------------------------------------------------------
// Same type + normalized name → same-named accounts to merge. Seed accounts are
// exempt: duplicates OF a seed account are fine (marker of an import overlap).
const groups = new Map();
for (const a of accounts) {
  const key = `${a.account_type}|${norm(a.account_name)}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(a);
}
const dupes = [...groups.values()]
  .filter((g) => g.length > 1)
  .filter((g) => g.some((a) => !SEED_CODES.has(a.account_code)))
  .map((g) =>
    // seed copy first so duplicates of a seed account read as "import twin of X"
    [...g].sort((x, y) => Number(SEED_CODES.has(y.account_code)) - Number(SEED_CODES.has(x.account_code))),
  );

const unused = accounts.filter((a) => a.is_active && stat(a).n === 0);
const inactive = accounts.filter((a) => !a.is_active);
const nonNumeric = accounts.filter((a) => !/^\d+$/.test(a.account_code));

// --- doc -----------------------------------------------------------------------
const active = accounts.filter((a) => a.is_active);
const byType = {};
for (const t of TYPES) byType[t] = accounts.filter((a) => a.account_type === t);

const doc = `# Chart of Accounts — current state

> Generated by \`node scripts/dump-coa.mjs ${path.relative(webRoot, dbPath)}\` on ${new Date().toISOString().slice(0, 10)}. Do not hand-edit.

**${path.relative(webRoot, dbPath)} · company 1 · ${accounts.length} accounts (${inactive.length} inactive) · ${catCount} expense_categories · ${accounts.filter((a) => stat(a).n > 0).length} accounts carry journal lines.**

## A. Seed system accounts

Hardcoded in \`server/src/db/bootstrap.ts\`; the app looks these up **by exact code** (\`idFor("1000")\`…), so they must keep their code unless every caller is updated. They are shown again inside the tree below, marked \`🌱seed\`.

| code | name | type | subtype | active | journal lines |
|---|---|---|---|---|---|
${[...SEED_CODES]
  .map((c) => accounts.find((a) => a.account_code === c))
  .filter(Boolean)
  .map(
    (a) =>
      `| ${a.account_code} | ${a.account_name} | ${a.account_type} | ${a.account_subtype ?? "—"} | ${a.is_active ? "yes" : "**no**"} | ${stat(a).n} |`,
  )
  .join("\n")}

## B. Full chart (imported hierarchy, trees from parent links)

${TYPES.map((t) => {
  const top = roots.filter((r) => r.account_type === t);
  return `### ${t} — ${byType[t].length} accounts\n\n${top.length ? renderTree(top, t) : "_(none)_"}`;
}).join("\n\n")}

## C. Findings

### C1. Same-named accounts (import overlap — merge candidates)

Same type + same normalised name. 🌱seed-containing groups are just "the import re-created a seed account under a new code" — usually the imported copy is the one to retire.

${(dupes.length || seedDupes.length
      ? [...dupes]
          .map((g) =>
            `- ${g.map((a) => `\`${a.account_code}\` ${a.account_name}${a.is_active ? "" : " (inactive)"}${SEED_CODES.has(a.account_code) ? " 🌱seed" : ""}`).join(" · ")}`,
          )
          .join("\n")
      : "_none_")}
${
      nonNumeric.length
        ? `\n### C2. Non-numeric account codes\n\n${nonNumeric.map((a) => line(a)).join("\n")}`
        : ""
    }

### C3. Active but unused

${unused.length} active accounts have **zero journal lines** — free to remap/retire without touching history.

<details><summary>list (${unused.length})</summary>

${unused.map(line).join("\n")}

</details>

### C4. Inactive accounts

${inactive.map(line).join("\n") || "_none_"}

### C5. Broken parent links

${orphans.map(line).join("\n") || "_none_"}
`;

writeFileSync(outPath, doc);
console.log(`wrote ${outPath} (${accounts.length} accounts, ${inactive.length} inactive, ${unused.length} active-unused)`);
