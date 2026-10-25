// Purge all manufacturing data from the TEST database: BOMs, production
// orders, their consumption rows, the production stock movements, the batches
// production created, and the MANUFACTURING journal entries.
//
//   node scripts/purge-manufacturing.mjs --dry-run
//   node scripts/purge-manufacturing.mjs
//   node scripts/purge-manufacturing.mjs --url data/e2e.sqlite --dry-run
//
// Target: SQLITE_CLOUD_TESTDB_URL (process env or web/.env). SQLITE_CLOUD_URL
// (main) is refused outright — this script must never touch production.
//
// Raw/packing stock consumed by the orders is added back to its batches, so the
// stock ledger and the books stay consistent after the purge. If any batch
// production created has been sold (or is otherwise referenced), the script
// aborts without changing anything and lists the blockers.
//
// Idempotent: a second run finds nothing to do and exits 0.

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

async function transaction(db, fn) {
  await db.exec("BEGIN");
  try {
    const result = await fn();
    await db.exec("COMMIT");
    return result;
  } catch (err) {
    try {
      await db.exec("ROLLBACK");
    } catch {
      // rollback best-effort; surface the original error
    }
    throw err;
  }
}

const num = (v) => Number(v ?? 0);
const placeholders = (list) => list.map(() => "?").join(", ");

function summarize(rows, format) {
  return rows.length ? rows.map(format).join("\n    ") : "(none)";
}

/** Everything the purge is about to remove, plus anything blocking it. */
async function plan(db) {
  const orders = await db.all(
    "SELECT id, order_number, status FROM production_orders ORDER BY id",
  );
  const boms = await db.all("SELECT id, bom_name, is_temp FROM bill_of_materials ORDER BY id");
  const componentCount = num(
    (await db.all("SELECT COUNT(*) AS n FROM bom_components"))[0]?.n,
  );
  const consumption = await db.all(
    `SELECT batch_id, SUM(quantity_consumed) AS quantity
       FROM production_consumption
      GROUP BY batch_id
      ORDER BY batch_id`,
  );
  const journalEntries = await db.all(
    "SELECT id, voucher_number FROM journal_entries WHERE voucher_type = 'MANUFACTURING' ORDER BY id",
  );
  const produced = await db.all(
    `SELECT DISTINCT batch_id AS id FROM stock_movements
      WHERE movement_type = 'PRODUCTION_IN' AND reference_table = 'production_orders'`,
  );
  const unpacked = await db.all(
    "SELECT id FROM stock_batches WHERE batch_number LIKE 'UNPACKED-%'",
  );
  const producedIds = [...new Set([...produced, ...unpacked].map((r) => num(r.id)))];

  // Consumption on a batch that is itself production output is not restored —
  // the batch is going away with the output it belongs to.
  const restore = consumption.filter((row) => !producedIds.includes(num(row.batch_id)));
  const restoreItems = await db.all(
    `SELECT i.id AS item_id, i.item_name, SUM(pc.quantity_consumed) AS quantity
       FROM production_consumption pc
       JOIN items i ON i.id = pc.component_item_id
      GROUP BY i.id
      ORDER BY i.item_name`,
  );

  // Anything that still points at a batch we would delete blocks the purge.
  const blockers = [];
  if (producedIds.length) {
    const ph = placeholders(producedIds);
    const checks = [
      [
        "sales invoice lines",
        `SELECT si.invoice_number AS ref, sii.quantity
           FROM sales_invoice_items sii
           JOIN sales_invoices si ON si.id = sii.invoice_id
          WHERE sii.batch_id IN (${ph})`,
        producedIds,
      ],
      [
        "purchase invoice lines",
        `SELECT pi.invoice_number AS ref, pii.quantity
           FROM purchase_invoice_items pii
           JOIN purchase_invoices pi ON pi.id = pii.invoice_id
          WHERE pii.batch_id IN (${ph})`,
        producedIds,
      ],
      [
        "stock losses",
        `SELECT id AS ref, quantity FROM stock_losses WHERE batch_id IN (${ph})`,
        producedIds,
      ],
    ];
    for (const [label, sql, params] of checks) {
      const rows = await db.all(sql, params);
      if (rows.length) blockers.push({ label, rows });
    }
  }

  const unpackedItems = num(
    (await db.all("SELECT COUNT(*) AS n FROM items WHERE item_name LIKE '(unpacked) %'"))[0]?.n,
  );

  return {
    orders,
    boms,
    componentCount,
    consumption,
    restore,
    restoreItems,
    journalEntries,
    producedIds,
    blockers,
    unpackedItems,
  };
}

function printPlan(p, dryRun) {
  console.log(`  production orders      ${p.orders.length}`);
  console.log(`  BOMs                   ${p.boms.length} (${p.boms.filter((b) => b.is_temp).length} temporary)`);
  console.log(`  BOM components         ${p.componentCount}`);
  console.log(`  consumption rows       ${p.consumption.length}`);
  console.log(`  production batches     ${p.producedIds.length}`);
  console.log(`  MANUFACTURING vouchers ${p.journalEntries.length}`);
  if (p.restore.length) {
    console.log(`  stock to restore       ${p.restore.length} batch(es):`);
    console.log(
      `    ${summarize(
        p.restoreItems,
        (r) => `${r.item_name}: +${Number(r.quantity).toFixed(2)}`,
      )}`,
    );
  }
  if (p.unpackedItems) {
    console.log(`  note: ${p.unpackedItems} item(s) still carry the "(unpacked)" name — items are left untouched.`);
  }
  if (p.orders.length) {
    console.log("  orders:");
    console.log(
      `    ${summarize(p.orders, (o) => `${o.order_number} [${o.status}]`)}`,
    );
  }
  console.log(dryRun ? "\n  DRY RUN — nothing changed." : "\n  deleting …");
}

async function purge(db) {
  const p = await plan(db);
  if (p.blockers.length) {
    console.error("\nABORTED — produced stock is in use, nothing was deleted:");
    for (const blocker of p.blockers) {
      console.error(`  ${blocker.label}:`);
      console.error(`    ${summarize(blocker.rows, (r) => `${r.ref} (qty ${r.quantity})`)}`);
    }
    console.error("  Remove or reassign those documents first, then re-run.");
    process.exitCode = 1;
    return { aborted: true };
  }
  return p;
}

async function verify(db) {
  const problems = [];
  const count = async (sql) => num((await db.all(sql))[0]?.n);

  const left = {
    orders: await count("SELECT COUNT(*) AS n FROM production_orders"),
    boms: await count("SELECT COUNT(*) AS n FROM bill_of_materials"),
    components: await count("SELECT COUNT(*) AS n FROM bom_components"),
    consumption: await count("SELECT COUNT(*) AS n FROM production_consumption"),
    vouchers: await count("SELECT COUNT(*) AS n FROM journal_entries WHERE voucher_type = 'MANUFACTURING'"),
  };
  for (const [label, n] of Object.entries(left)) {
    if (n !== 0) problems.push(`${n} ${label} still present`);
  }

  const orphanMovements = await count(
    `SELECT COUNT(*) AS n FROM stock_movements m
       LEFT JOIN stock_batches b ON b.id = m.batch_id
      WHERE b.id IS NULL`,
  );
  if (orphanMovements) problems.push(`${orphanMovements} stock movement(s) point at a missing batch`);

  const orphanSales = await count(
    `SELECT COUNT(*) AS n FROM sales_invoice_items sii
       LEFT JOIN stock_batches b ON b.id = sii.batch_id
      WHERE sii.batch_id IS NOT NULL AND b.id IS NULL`,
  );
  if (orphanSales) problems.push(`${orphanSales} sales line(s) point at a missing batch`);

  const orphanPurchases = await count(
    `SELECT COUNT(*) AS n FROM purchase_invoice_items pii
       LEFT JOIN stock_batches b ON b.id = pii.batch_id
      WHERE pii.batch_id IS NOT NULL AND b.id IS NULL`,
  );
  if (orphanPurchases) problems.push(`${orphanPurchases} purchase line(s) point at a missing batch`);

  const tb = (await db.all(
    "SELECT COALESCE(SUM(debit), 0) AS debit, COALESCE(SUM(credit), 0) AS credit FROM journal_entry_lines",
  ))[0];
  const debit = num(tb?.debit);
  const credit = num(tb?.credit);
  if (Math.abs(debit - credit) > 0.005) {
    problems.push(`journal entry lines no longer balance (debit ${debit} != credit ${credit})`);
  }

  return { problems, debit, credit };
}

// --- main ----------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const urlFlag = args.indexOf("--url");
const explicit = urlFlag >= 0 ? args[urlFlag + 1] : null;

const main = process.env.SQLITE_CLOUD_URL || envValue("SQLITE_CLOUD_URL");
const testdb = process.env.SQLITE_CLOUD_TESTDB_URL || envValue("SQLITE_CLOUD_TESTDB_URL");
const target = explicit || testdb;

if (!target) {
  console.error("SQLITE_CLOUD_TESTDB_URL is not set (add it to web/.env) and no --url was passed.");
  process.exit(1);
}
if (main && target === main) {
  console.error("Refusing to run against SQLITE_CLOUD_URL (main). This script is testdb-only.");
  process.exit(1);
}

console.log(`${dryRun ? "DRY RUN" : "PURGE"} — manufacturing data`);
console.log(`  target: ${mask(target)}`);

const db = await connect(target);
try {
  if (dryRun) {
    const p = await purge(db);
    if (!p.aborted) printPlan(p, true);
  } else {
    const p = await purge(db);
    if (!p.aborted) {
      printPlan(p, false);
      const settings = { orders: p.orders.length, boms: p.boms.length, consumed: p.restore.length };

      await transaction(db, async () => {
        // 1. Give consumed raw/packing stock back to its batches.
        for (const row of p.restore) {
          await db.run(
            "UPDATE stock_batches SET quantity_in_stock = quantity_in_stock + ? WHERE id = ?",
            [num(row.quantity), num(row.batch_id)],
          );
        }
        // 2. Production consumption trail.
        await db.run("DELETE FROM production_consumption");
        // 3. Manufacturing ledger (headers then lines).
        await db.run(
          `DELETE FROM journal_entry_lines
            WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE voucher_type = 'MANUFACTURING')`,
        );
        await db.run("DELETE FROM journal_entries WHERE voucher_type = 'MANUFACTURING'");
        // 4. Stock movements of the production batches and every production
        //    movement (covers component batches whose consumption is undone).
        if (p.producedIds.length) {
          await db.run(
            `DELETE FROM stock_movements WHERE batch_id IN (${placeholders(p.producedIds)})`,
            p.producedIds,
          );
        }
        await db.run("DELETE FROM stock_movements WHERE reference_table = 'production_orders'");
        // 5. The output batches themselves (UNPACKED + renamed/packed/split).
        if (p.producedIds.length) {
          await db.run(
            `DELETE FROM stock_batches WHERE id IN (${placeholders(p.producedIds)})`,
            p.producedIds,
          );
        }
        // 6. Orders, then the recipes.
        await db.run("DELETE FROM production_orders");
        await db.run("DELETE FROM bom_components");
        await db.run("DELETE FROM bill_of_materials");
        // 7. A clean slate gets its numbers back (a fresh sequence starts at 2,
        //    so the next issued number is 1).
        await db.run(
          `UPDATE numbering_sequences SET next_number = 2
            WHERE document_type IN ('PRODUCTION_ORDER', 'BOM', 'MANUFACTURING')`,
        );
      });

      const { problems, debit, credit } = await verify(db);
      console.log(
        `\n  removed: ${settings.orders} order(s), ${settings.boms} BOM(s), ` +
          `${settings.consumed} stock batch(es) restored`,
      );
      console.log(`  trial balance: ${debit.toFixed(2)} = ${credit.toFixed(2)}`);
      if (problems.length) {
        console.error("  VERIFY FAILED:");
        for (const problem of problems) console.error(`    - ${problem}`);
        process.exitCode = 1;
      } else {
        console.log("  VERIFY OK — manufacturing is empty, stock and books are consistent.");
      }
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
