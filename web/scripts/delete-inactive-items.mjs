// Delete every inactive item from the TEST database.
//
//   node scripts/delete-inactive-items.mjs --dry-run
//   node scripts/delete-inactive-items.mjs
//   node scripts/delete-inactive-items.mjs --url data/e2e.sqlite --dry-run
//
// Target: SQLITE_CLOUD_TESTDB_URL (process env or web/.env). SQLITE_CLOUD_URL
// (main) is refused unless --allow-main is passed explicitly.
//
// Only unreferenced items are deleted: if an inactive item still has stock,
// stock movements, invoice lines, BOM links, production consumption or stock
// losses, the script aborts without changing anything and lists it, so history
// is never orphaned. Idempotent — a second run finds nothing to do.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const webRoot = path.resolve(import.meta.dirname, "..");

function envValue(key) {
  const file = path.join(webRoot, ".env");
  if (!existsSync(file)) return "";
  const line = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .find((raw) => raw.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
}

function mask(url) {
  return url.replace(/\/\/[^@]*@/, "//***@").replace(/apikey=[^&]+/, "apikey=***");
}

async function connect(target) {
  if (target.startsWith("sqlitecloud://")) {
    const { Database } = await import("@sqlitecloud/drivers");
    const db = new Database(target);
    const query = (sql, params = []) =>
      params.length ? db.sql({ query: sql, parameters: params }) : db.sql(sql);
    return {
      all: async (sql, params = []) => {
        const out = await query(sql, params);
        return Array.isArray(out) ? out : [];
      },
      run: (sql, params = []) => query(sql, params),
      exec: (sql) =>
        new Promise((resolve, reject) => {
          try {
            db.exec(sql, (err) => (err ? reject(err) : resolve()));
          } catch (err) {
            reject(err);
          }
        }),
      close: async () => {},
    };
  }
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(target);
  return {
    all: async (sql, params = []) => db.prepare(sql).all(...params),
    run: async (sql, params = []) => db.prepare(sql).run(...params),
    exec: async (sql) => db.exec(sql),
    close: async () => db.close(),
  };
}

/** Every column that points at items(id). */
const REFERENCES = [
  ["stock_batches", "item_id"],
  ["stock_movements", "item_id"],
  ["sales_invoice_items", "item_id"],
  ["purchase_invoice_items", "item_id"],
  ["bom_components", "component_item_id"],
  ["bill_of_materials", "finished_item_id"],
  ["production_consumption", "component_item_id"],
  ["stock_losses", "item_id"],
];

const num = (v) => Number(v ?? 0);

async function plan(db) {
  const refSum = REFERENCES.map(
    ([table, column]) => `(SELECT COUNT(*) FROM ${table} x WHERE x.${column} = i.id)`,
  ).join(" + ");
  const inactive = num(
    (await db.all("SELECT COUNT(*) AS n FROM items WHERE is_active = 0"))[0]?.n,
  );
  const referenced = await db.all(`
    SELECT i.id, i.item_code, i.item_name, i.item_type, (${refSum}) AS refs
      FROM items i
     WHERE i.is_active = 0 AND (${refSum}) > 0
     ORDER BY i.id`);
  return { inactive, referenced, deletable: inactive - referenced.length };
}

async function verify(db) {
  const problems = [];
  const count = async (sql) => num((await db.all(sql))[0]?.n);
  const inactive = await count("SELECT COUNT(*) AS n FROM items WHERE is_active = 0");
  if (inactive) problems.push(`${inactive} inactive item(s) still present`);
  const orphans = await count(
    `SELECT COUNT(*) AS n FROM stock_movements m
       LEFT JOIN items i ON i.id = m.item_id
      WHERE i.id IS NULL`,
  );
  if (orphans) problems.push(`${orphans} stock movement(s) point at a missing item`);
  return problems;
}

// --- main ----------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const allowMain = args.includes("--allow-main");
const urlFlag = args.indexOf("--url");
const explicit = urlFlag >= 0 ? args[urlFlag + 1] : null;

const main = process.env.SQLITE_CLOUD_URL || envValue("SQLITE_CLOUD_URL");
const testdb = process.env.SQLITE_CLOUD_TESTDB_URL || envValue("SQLITE_CLOUD_TESTDB_URL");
const target = explicit || (args.includes("--main") ? main : testdb);

if (!target) {
  console.error("SQLITE_CLOUD_TESTDB_URL is not set (add it to web/.env) and no --url was passed.");
  process.exit(1);
}
if (main && target === main && !allowMain) {
  console.error("Refusing to run against SQLITE_CLOUD_URL (main). Pass --allow-main to override.");
  process.exit(1);
}

console.log(`${dryRun ? "DRY RUN" : "DELETE"} — inactive items`);
console.log(`  target: ${mask(target)}`);

const db = await connect(target);
try {
  const p = await plan(db);
  console.log(`  inactive items         ${p.inactive}`);
  console.log(`  safe to delete         ${p.deletable}`);
  if (p.referenced.length) {
    console.error(`\nABORTED — ${p.referenced.length} inactive item(s) are still referenced:`);
    for (const row of p.referenced) {
      console.error(`    ${row.item_code} ${row.item_name} (${row.item_type}) — ${row.refs} reference(s)`);
    }
    console.error("  Deactivate/remove those documents first, then re-run.");
    process.exitCode = 1;
  } else if (dryRun) {
    console.log("\n  DRY RUN — nothing changed.");
  } else {
    await db.exec("BEGIN");
    try {
      await db.run("DELETE FROM items WHERE is_active = 0");
      await db.exec("COMMIT");
    } catch (err) {
      try {
        await db.exec("ROLLBACK");
      } catch {
        // rollback best-effort; surface the original error
      }
      throw err;
    }
    const problems = await verify(db);
    console.log(`\n  deleted ${p.deletable} inactive item(s)`);
    if (problems.length) {
      console.error("  VERIFY FAILED:");
      for (const problem of problems) console.error(`    - ${problem}`);
      process.exitCode = 1;
    } else {
      console.log("  VERIFY OK — no inactive items left.");
    }
  }
} catch (err) {
  console.error(`  FAILED: ${err?.message ?? err}`);
  process.exitCode = 1;
} finally {
  await db.close();
}

// The cloud driver keeps sockets open; exit once done.
process.exit(process.exitCode ?? 0);
