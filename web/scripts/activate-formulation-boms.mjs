// Turn the legacy PharmaPro formulation recipes into live recipes on bulk items.
//
//   node scripts/activate-formulation-boms.mjs            # report (testdb only)
//   node scripts/activate-formulation-boms.mjs --apply    # write (testdb only)
//   node scripts/activate-formulation-boms.mjs --selftest
//
// Model: formulation consumes raw materials and outputs the UNPACKED (bulk)
// finished good. The legacy import already wrote the recipes against exactly
// those bulk items (e.g. "Magnet BOP Oral Powder"), but left every item and BOM
// inactive. This script activates one formulation BOM per bulk item whose
// product family still has an active pack-size finished good, and only when
// every component is an active item (otherwise production would fail on stock).
//
// It also removes the "Cloned from ..." BOMs that pointed the recipes at the
// pack-size items - that direction belongs to the packing stage, not here.
//
// Packing BOMs and pack-size items are left alone.
//
// Defaults to SQLITE_CLOUD_TESTDB_URL. Pass a path/URL to target one database;
// the cloud `main` database is refused unless --force-main is also given.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const webRoot = path.resolve(import.meta.dirname, "..");
const APPLY = process.argv.includes("--apply");
const FORCE_MAIN = process.argv.includes("--force-main");

const FILLER = new Set(["oral", "powder", "liquid", "liquild", "solution", "feed", "premix", "bop", "the", "for"]);
const UNITS = { l: "l", lit: "l", lits: "l", ltr: "l", liter: "l", liters: "l", litter: "l", kg: "kg", kgs: "kg", g: "g", gm: "g", gms: "g", gram: "g", grams: "g", ml: "ml", mls: "ml", mg: "mg" };

function tokens(name) {
  const raw = String(name)
    .replace(/\(unpacked\)/gi, " ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const next = raw[i + 1];
    if (/^\d+(?:\.\d+)?$/.test(raw[i]) && next && UNITS[next]) i++;
    else if (UNITS[raw[i]]) continue;
    else if (!FILLER.has(raw[i])) out.push(raw[i]);
  }
  return out;
}

/** Product family identity, ignoring pack size and packaging words. */
const productKey = (name) => tokens(name).sort().join(" ");

function envValue(key) {
  const file = path.join(webRoot, ".env");
  if (!existsSync(file)) return "";
  const line = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .find((raw) => raw.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
}

function targets() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const list =
    args.length > 0
      ? args
      : [process.env.SQLITE_CLOUD_TESTDB_URL || envValue("SQLITE_CLOUD_TESTDB_URL")].filter(Boolean);
  if (list.length === 0) {
    console.error("No target. Set SQLITE_CLOUD_TESTDB_URL or pass a path/URL.");
    process.exit(1);
  }
  for (const target of list) {
    const isMain = target.startsWith("sqlitecloud://") && /[?&/]main(?:$|[?&])/.test(target);
    if (isMain && !FORCE_MAIN) {
      console.error(`Refusing to touch the main cloud database without --force-main: ${target.replace(/apikey=[^&]+/, "apikey=***")}`);
      process.exit(1);
    }
  }
  return list;
}

async function connect(target) {
  if (target.startsWith("sqlitecloud://")) {
    const { Database } = await import("@sqlitecloud/drivers");
    const db = new Database(target);
    return { all: (sql) => db.sql(sql), exec: (sql) => db.sql(sql), close: async () => {} };
  }
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(target);
  return { all: (sql) => db.prepare(sql).all(), exec: (sql) => db.exec(sql), close: async () => db.close() };
}

async function load(db) {
  const items = await db.all(
    "SELECT id, company_id, item_code, item_name, item_type, unit, is_active FROM items",
  );
  const boms = await db.all(
    `SELECT id, company_id, finished_item_id, bom_name, output_quantity, phase, is_active, is_ghost
       FROM bill_of_materials`,
  );
  const components = await db.all(
    "SELECT bom_id, component_item_id, quantity_required, wastage_percent FROM bom_components",
  );
  return { items, boms, components };
}

/**
 * Decide which legacy formulation BOM becomes the live recipe for each bulk
 * item. Bulk items are simply the finished items the legacy formulation BOMs
 * already point at.
 */
function plan({ items, boms, components }) {
  const byId = new Map(items.map((i) => [Number(i.id), i]));
  const compsByBom = new Map();
  for (const c of components) {
    const id = Number(c.bom_id);
    if (!compsByBom.has(id)) compsByBom.set(id, []);
    compsByBom.get(id).push(c);
  }

  const activeFamilyKeys = new Set(
    items
      .filter((i) => Number(i.is_active) === 1 && i.item_type === "FINISHED_GOOD")
      .map((i) => productKey(i.item_name)),
  );
  const liveFormulationOwners = new Set(
    boms
      .filter((b) => b.phase === "FORMULATION" && Number(b.is_active) === 1)
      .map((b) => Number(b.finished_item_id)),
  );

  const groups = new Map(); // bulk item id -> legacy formulation BOMs
  for (const bom of boms) {
    if (bom.phase !== "FORMULATION" || Number(bom.is_active) === 1) continue;
    const id = Number(bom.finished_item_id);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(bom);
  }

  const rows = [];
  for (const [bulkId, candidates] of groups) {
    const bulk = byId.get(bulkId);
    if (!bulk || bulk.item_type !== "FINISHED_GOOD") continue;

    if (liveFormulationOwners.has(bulkId)) {
      rows.push({ bulk, status: "SKIP", note: "already has a live formulation BOM" });
      continue;
    }
    if (!activeFamilyKeys.has(productKey(bulk.item_name))) {
      rows.push({ bulk, status: "NO_FAMILY", note: "no active finished good for this product family" });
      continue;
    }

    const scored = candidates.map((bom) => {
      const comps = compsByBom.get(Number(bom.id)) ?? [];
      const items2 = comps.map((c) => byId.get(Number(c.component_item_id))).filter(Boolean);
      const inactive = items2.filter((i) => Number(i.is_active) !== 1);
      const finished = items2.filter((i) => i.item_type === "FINISHED_GOOD");
      return { bom, comps, inactive, finished };
    });
    scored.sort(
      (a, b) => a.inactive.length - b.inactive.length || b.comps.length - a.comps.length || a.bom.id - b.bom.id,
    );
    const best = scored[0];

    if (best.comps.length === 0) {
      rows.push({ bulk, status: "BLOCKED", template: best.bom, note: "recipe has no components" });
    } else if (best.finished.length > 0) {
      rows.push({
        bulk,
        status: "BLOCKED",
        template: best.bom,
        note: `consumes finished goods: ${best.finished.map((i) => i.item_name).join(", ")}`,
      });
    } else if (best.inactive.length > 0) {
      rows.push({
        bulk,
        status: "BLOCKED",
        template: best.bom,
        note: `inactive components: ${best.inactive.map((i) => i.item_name).join(", ")}`,
      });
    } else {
      rows.push({ bulk, status: "READY", template: best.bom, components: best.comps });
    }
  }
  return rows;
}

async function removeClones(db) {
  const rows = await db.all(
    "SELECT COUNT(*) AS n FROM bill_of_materials WHERE notes LIKE 'Cloned from %'",
  );
  const count = Number(rows?.[0]?.n ?? 0);
  if (count === 0) return 0;
  await db.exec(
    "DELETE FROM bom_components WHERE bom_id IN (SELECT id FROM bill_of_materials WHERE notes LIKE 'Cloned from %')",
  );
  await db.exec("DELETE FROM bill_of_materials WHERE notes LIKE 'Cloned from %'");
  return count;
}

async function run(db, { apply = APPLY } = {}) {
  const data = await load(db);
  const rows = plan(data);
  const buckets = { READY: [], BLOCKED: [], NO_FAMILY: [], SKIP: [] };
  for (const row of rows) buckets[row.status].push(row);

  const cloneRows = await db.all(
    "SELECT COUNT(*) AS n FROM bill_of_materials WHERE notes LIKE 'Cloned from %'",
  );
  const clones = Number(cloneRows?.[0]?.n ?? 0);

  for (const status of ["READY", "BLOCKED", "NO_FAMILY", "SKIP"]) {
    for (const row of buckets[status]) {
      const tpl = row.template ? ` <- ${row.template.bom_name}` : "";
      const note = row.note ? `  (${row.note})` : "";
      console.log(`  ${status.padEnd(9)} #${row.bulk.id} "${row.bulk.item_name}"${tpl}${note}`);
    }
  }

  console.log(
    `\n  READY=${buckets.READY.length}  BLOCKED=${buckets.BLOCKED.length}` +
      `  NO_FAMILY=${buckets.NO_FAMILY.length}  SKIP=${buckets.SKIP.length}` +
      `  clones-to-remove=${clones}` +
      (apply ? "" : "  — rerun with --apply to activate"),
  );

  if (!apply) return;

  const removed = await removeClones(db);
  if (removed) console.log(`  removed ${removed} pack-target clone BOM(s)`);

  for (const row of buckets.READY) {
    await db.exec(`UPDATE items SET is_active = 1 WHERE id = ${Number(row.bulk.id)}`);
    await db.exec(
      `UPDATE bill_of_materials SET is_active = 1, is_ghost = 0 WHERE id = ${Number(row.template.id)}`,
    );
    console.log(
      `  activated ${row.template.bom_name} -> #${row.bulk.id} "${row.bulk.item_name}" (${row.components.length} components)`,
    );
  }
  console.log(`\n  ${buckets.READY.length} bulk item(s) with a live formulation recipe`);
}

/** In-memory check: READY activates item + BOM, BLOCKED does not, clones removed. */
async function selftest() {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(":memory:");
  const shim = { all: (s) => db.prepare(s).all(), exec: (s) => db.exec(s), close: () => db.close() };
  db.exec(`
    CREATE TABLE items (id INTEGER PRIMARY KEY, company_id INT, item_code TEXT, item_name TEXT, item_type TEXT, unit TEXT, is_active INT);
    CREATE TABLE bill_of_materials (id INTEGER PRIMARY KEY, company_id INT, finished_item_id INT, bom_name TEXT,
      output_quantity REAL, notes TEXT, phase TEXT, is_active INT, is_ghost INT);
    CREATE TABLE bom_components (id INTEGER PRIMARY KEY, bom_id INT, component_item_id INT,
      quantity_required REAL, wastage_percent REAL);
    INSERT INTO items VALUES
      (1, 1, 'BULK1', 'Magnet BOP Oral Powder', 'FINISHED_GOOD', 'UNIT', 0),
      (2, 1, 'FG1',   'MAGNET BOP 1 KG',       'FINISHED_GOOD', 'KG',   1),
      (3, 1, 'BULK2', 'Kirzan BOP',            'FINISHED_GOOD', 'UNIT', 0),
      (4, 1, 'FG2',   'KIRZAN BOP 100 ML',     'FINISHED_GOOD', 'ML',   1),
      (10, 1, 'RM1',  'Kaolin',                'RAW_MATERIAL',  'KG',   1),
      (11, 1, 'RM2',  'Ghost Salt',            'RAW_MATERIAL',  'KG',   0);
    INSERT INTO bill_of_materials (id, company_id, finished_item_id, bom_name, output_quantity, notes, phase, is_active, is_ghost)
      VALUES (1, 1, 1, 'BOM-00008', 1, NULL, 'FORMULATION', 0, 1),
             (2, 1, 3, 'BOM-00009', 1, NULL, 'FORMULATION', 0, 1),
             (3, 1, 2, 'BOM-01158', 1, 'Cloned from BOM-00008 (legacy formulation template) for "MAGNET BOP 1 KG"', 'FORMULATION', 1, 0);
    INSERT INTO bom_components VALUES (1, 1, 10, 0.5, 0), (2, 2, 11, 0.2, 0);
  `);
  await run(shim, { apply: true });

  const bulk1 = db.prepare("SELECT is_active FROM items WHERE id = 1").get();
  const bulk2 = db.prepare("SELECT is_active FROM items WHERE id = 3").get();
  const bom1 = db.prepare("SELECT is_active, is_ghost FROM bill_of_materials WHERE id = 1").get();
  const bom2 = db.prepare("SELECT is_active FROM bill_of_materials WHERE id = 2").get();
  const clones = db.prepare("SELECT COUNT(*) AS n FROM bill_of_materials WHERE notes LIKE 'Cloned from %'").get();
  const comps = db.prepare("SELECT COUNT(*) AS n FROM bom_components").get();
  db.close();

  const ok =
    Number(bulk1.is_active) === 1 &&
    Number(bom1.is_active) === 1 &&
    Number(bom1.is_ghost) === 0 &&
    Number(bulk2.is_active) === 0 &&
    Number(bom2.is_active) === 0 &&
    Number(clones.n) === 0 &&
    Number(comps.n) === 2; // clone component gone, legacy components untouched
  if (!ok) throw new Error(`selftest failed: ${JSON.stringify({ bulk1, bulk2, bom1, bom2, clones, comps })}`);
  console.log("selftest ok");
}

if (process.argv.includes("--selftest")) {
  await selftest();
} else {
  for (const target of targets()) {
    console.log(`\n${target.startsWith("sqlitecloud://") ? "cloud" : "local"}: ${target.replace(/apikey=[^&]+/, "apikey=***")}`);
    const db = await connect(target);
    try {
      await run(db);
    } catch (err) {
      console.error(`  FAILED: ${err?.message ?? err}`);
      process.exitCode = 1;
    } finally {
      await db.close();
    }
  }
}

// The cloud driver keeps sockets open; exit once every target is done.
process.exit(process.exitCode ?? 0);
