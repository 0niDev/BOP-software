// Give the active finished goods real formulation BOMs, cloned from the
// historical PharmaPro ghost BOMs.
//
//   node scripts/clone-legacy-formulation-boms.mjs            # report only
//   node scripts/clone-legacy-formulation-boms.mjs --apply    # insert READY clones
//   node scripts/clone-legacy-formulation-boms.mjs --selftest
//
// Background: the 1,156 BOMs imported from PharmaPro are historical records
// (is_active=0, is_ghost=1) pointing at ghost items. They were never live
// recipes. The live products are the active items created by the inventory
// re-import, and they have no BOM at all - which is why production has nothing
// to run and stock lands on the wrong (old) item.
//
// This script finds, for every active finished good, the matching legacy
// FORMULATION recipe and clones it onto the active item as a live BOM.
// A recipe is READY when all of its components are active items (production
// can consume them); otherwise it is BLOCKED and reported, never written.
//
// Packing BOMs are not cloned: the pack step lets the operator pick packing
// materials and saves them as the packing BOM, and the legacy packing recipes
// reference per-product bottles/labels that no longer exist under those names.
//
// Report mode targets the local dev DB plus SQLITE_CLOUD_URL and
// SQLITE_CLOUD_TESTDB_URL, like backfill-bom-phase.mjs. Pass a path/URL to
// run against one database.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const webRoot = path.resolve(import.meta.dirname, "..");
const APPLY = process.argv.includes("--apply");

const FILLER = new Set(["oral", "powder", "liquid", "liquild", "solution", "feed", "premix", "bop", "the", "for"]);
const UNITS = { l: "l", lit: "l", lits: "l", ltr: "l", liter: "l", liters: "l", litter: "l", kg: "kg", kgs: "kg", g: "g", gm: "g", gms: "g", gram: "g", grams: "g", ml: "ml", mls: "ml", mg: "mg" };

const q = (v) => `'${String(v).replace(/'/g, "''")}'`;

const sizeToken = (v, u) =>
  u === "ml" && v >= 1000 ? `size:${v / 1000}l` : u === "g" && v >= 1000 ? `size:${v / 1000}kg` : `size:${v}${u}`;

/** Lowercase, split letter/digit runs, canonicalize units, drop filler words. */
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
    if (/^\d+(?:\.\d+)?$/.test(raw[i]) && next && UNITS[next]) {
      out.push(sizeToken(Number(raw[i]), UNITS[next]));
      i++;
    } else if (UNITS[raw[i]]) {
      out.push(`u:${UNITS[raw[i]]}`);
    } else if (!FILLER.has(raw[i])) {
      out.push(raw[i]);
    }
  }
  return out;
}

/** Product identity without pack size: "MAGNET BOP 1 KG" -> "magnet". */
const productKey = (name) =>
  tokens(name)
    .filter((t) => !t.startsWith("size:") && !t.startsWith("u:"))
    .sort()
    .join(" ");

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
  if (args.length > 0) return args;
  const list = [];
  const dev = path.join(webRoot, "data/dev.sqlite");
  if (existsSync(dev)) list.push(dev);
  const main = process.env.SQLITE_CLOUD_URL || envValue("SQLITE_CLOUD_URL");
  if (main) list.push(main);
  const testdb = process.env.SQLITE_CLOUD_TESTDB_URL || envValue("SQLITE_CLOUD_TESTDB_URL");
  if (testdb) list.push(testdb);
  return list;
}

/** Minimal SQLite facade over either the cloud driver or the local node:sqlite. */
async function connect(target) {
  if (target.startsWith("sqlitecloud://")) {
    const { Database } = await import("@sqlitecloud/drivers");
    const db = new Database(target);
    return {
      all: (sql) => db.sql(sql),
      exec: (sql) => db.sql(sql),
      close: async () => {},
    };
  }
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(target);
  return {
    all: (sql) => db.prepare(sql).all(),
    exec: (sql) => db.exec(sql),
    close: async () => db.close(),
  };
}

async function load(db) {
  const items = await db.all(
    "SELECT id, company_id, item_code, item_name, item_type, is_active FROM items",
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

/** Decide, per active finished good, which legacy recipe to clone. */
function plan({ items, boms, components }) {
  const byId = new Map(items.map((i) => [Number(i.id), i]));
  const compsByBom = new Map();
  for (const c of components) {
    const id = Number(c.bom_id);
    if (!compsByBom.has(id)) compsByBom.set(id, []);
    compsByBom.get(id).push(c);
  }

  const templates = new Map(); // productKey -> [inactive formulation boms]
  for (const bom of boms) {
    if (bom.phase !== "FORMULATION" || Number(bom.is_active) === 1) continue;
    const owner = byId.get(Number(bom.finished_item_id));
    if (!owner) continue;
    const key = productKey(owner.item_name);
    if (!templates.has(key)) templates.set(key, []);
    templates.get(key).push(bom);
  }

  const activeFormulation = new Set(
    boms
      .filter((b) => b.phase === "FORMULATION" && Number(b.is_active) === 1)
      .map((b) => Number(b.finished_item_id)),
  );

  const rows = [];
  for (const item of items) {
    if (Number(item.is_active) !== 1 || item.item_type !== "FINISHED_GOOD") continue;
    if (item.item_name.startsWith("(unpacked) ")) {
      rows.push({ item, status: "ARTIFACT", note: "unpacked production artifact, not a product" });
      continue;
    }
    if (activeFormulation.has(Number(item.id))) {
      rows.push({ item, status: "SKIP", note: "already has an active formulation BOM" });
      continue;
    }

    const candidates = templates.get(productKey(item.item_name)) ?? [];
    if (candidates.length === 0) {
      rows.push({ item, status: "NO_TEMPLATE", note: "no legacy formulation recipe" });
      continue;
    }

    const scored = candidates.map((bom) => {
      const comps = compsByBom.get(Number(bom.id)) ?? [];
      const inactive = comps
        .map((c) => byId.get(Number(c.component_item_id)))
        .filter((i) => i && Number(i.is_active) !== 1);
      return { bom, comps, inactive };
    });
    scored.sort((a, b) => a.inactive.length - b.inactive.length || b.comps.length - a.comps.length || a.bom.id - b.bom.id);
    const best = scored[0];

    if (best.inactive.length === 0 && best.comps.length > 0) {
      rows.push({ item, status: "READY", template: best.bom, components: best.comps });
    } else {
      rows.push({
        item,
        status: "BLOCKED",
        template: best.bom,
        note:
          best.comps.length === 0
            ? "template has no components"
            : `inactive components: ${best.inactive.map((i) => i.item_name).join(", ")}`,
      });
    }
  }
  return rows;
}

async function nextBomNames(db, companyId, count) {
  // bom_name has no UNIQUE constraint, and the legacy import already used
  // BOM-00001..BOM-01157 without advancing the sequence. Start above the
  // highest numeric name actually present so clones can never collide.
  const rows = await db.all(
    `SELECT MAX(CAST(SUBSTR(bom_name, 5) AS INTEGER)) AS max_n
       FROM bill_of_materials
      WHERE bom_name LIKE 'BOM-%' AND SUBSTR(bom_name, 5) NOT LIKE '%[^0-9]%'`,
  );
  const start = Number(rows?.[0]?.max_n ?? 0) + 1;
  const names = Array.from({ length: count }, (_, i) => `BOM-${String(start + i).padStart(5, "0")}`);
  await db.exec(
    `INSERT INTO numbering_sequences (company_id, document_type, prefix, next_number, padding)
     VALUES (${Number(companyId)}, 'BOM', 'BOM-', ${start + count}, 5)
     ON CONFLICT(company_id, document_type) DO UPDATE SET
       next_number = MAX(next_number, ${start + count})`,
  );
  return names;
}

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const templateName = (notes) => /^Cloned from (BOM-\d+)/.exec(String(notes ?? ""))?.[1] ?? null;

/** Clone one recipe: insert the BOM, get its id, then its components. */
async function cloneOne(db, row, bomName) {
  const notes = `Cloned from ${row.template.bom_name} (legacy formulation template) for "${row.item.item_name}"`;
  const inserted = await db.all(
    `INSERT INTO bill_of_materials
       (company_id, finished_item_id, bom_name, output_quantity, notes, phase, is_active, is_temp, is_ghost)
     VALUES (${Number(row.item.company_id)}, ${Number(row.item.id)}, ${q(bomName)}, ${Number(row.template.output_quantity)},
             ${q(notes)}, 'FORMULATION', 1, 0, 0)
     RETURNING id`,
  );
  const bomId = Number(inserted?.[0]?.id);
  if (!bomId) throw new Error(`could not insert BOM for ${row.item.item_name}`);
  await insertComponents(db, bomId, row.components);
  return { bomName, bomId, itemId: row.item.id, itemName: row.item.item_name, componentCount: row.components.length };
}

async function insertComponents(db, bomId, components) {
  for (const group of chunk(components, 100)) {
    const values = group
      .map(
        (c) =>
          `(${Number(bomId)}, ${Number(c.component_item_id)}, ${Number(c.quantity_required)}, ${Number(c.wastage_percent)})`,
      )
      .join(",\n");
    await db.exec(
      `INSERT INTO bom_components (bom_id, component_item_id, quantity_required, wastage_percent) VALUES ${values}`,
    );
  }
}

async function cloneAll(db, rows) {
  if (rows.length === 0) return [];
  const names = await nextBomNames(db, Number(rows[0].item.company_id), rows.length);
  const created = [];
  for (let i = 0; i < rows.length; i++) created.push(await cloneOne(db, rows[i], names[i]));
  return created;
}

/** A crash between the BOM insert and its components leaves an empty clone. */
async function repairEmptyClones(db, componentsByBom) {
  const empty = await db.all(
    `SELECT b.id, b.notes FROM bill_of_materials b
      WHERE b.is_active = 1 AND b.notes LIKE 'Cloned from %'
        AND NOT EXISTS (SELECT 1 FROM bom_components c WHERE c.bom_id = b.id)`,
  );
  let repaired = 0;
  for (const bom of empty) {
    const template = templateName(bom.notes);
    const source = template ? componentsByBom.get(template) : null;
    if (!source?.length) {
      console.log(`  WARN empty clone #${bom.id} has no resolvable template (${bom.notes})`);
      continue;
    }
    await insertComponents(db, Number(bom.id), source);
    repaired++;
  }
  if (repaired) console.log(`  repaired ${repaired} empty clone(s) from their templates`);
  return repaired;
}

async function run(db, { apply = APPLY } = {}) {
  const data = await load(db);
  const rows = plan(data);
  const buckets = { READY: [], BLOCKED: [], NO_TEMPLATE: [], SKIP: [], ARTIFACT: [] };
  for (const row of rows) buckets[row.status].push(row);

  const componentsByBomId = new Map();
  for (const c of data.components) {
    const id = Number(c.bom_id);
    if (!componentsByBomId.has(id)) componentsByBomId.set(id, []);
    componentsByBomId.get(id).push(c);
  }
  const legacyComponents = new Map();
  for (const bom of data.boms) {
    if (Number(bom.is_ghost) !== 1) continue;
    legacyComponents.set(bom.bom_name, componentsByBomId.get(Number(bom.id)) ?? []);
  }

  for (const status of ["READY", "BLOCKED", "NO_TEMPLATE", "SKIP", "ARTIFACT"]) {
    for (const row of buckets[status]) {
      const tpl = row.template ? ` <- ${row.template.bom_name}` : "";
      const note = row.note ? `  (${row.note})` : "";
      console.log(`  ${status.padEnd(10)} #${row.item.id} "${row.item.item_name}"${tpl}${note}`);
    }
  }

  console.log(
    `\n  READY=${buckets.READY.length}  BLOCKED=${buckets.BLOCKED.length}  NO_TEMPLATE=${buckets.NO_TEMPLATE.length}` +
      `  SKIP=${buckets.SKIP.length}  ARTIFACT=${buckets.ARTIFACT.length}` +
      (apply ? "" : "  — rerun with --apply to clone the READY recipes"),
  );

  if (apply) {
    await repairEmptyClones(db, legacyComponents);
    const created = await cloneAll(db, buckets.READY);
    for (const row of created) {
      console.log(`  cloned ${row.bomName} for #${row.itemId} "${row.itemName}" (${row.componentCount} components)`);
    }
    console.log(`\n  ${created.length} formulation BOM(s) created`);
  }
}

/** In-memory check: READY clones, BLOCKED does not, originals untouched. */
async function selftest() {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(":memory:");
  const shim = { all: (s) => db.prepare(s).all(), exec: (s) => db.exec(s), close: () => db.close() };
  db.exec(`
    CREATE TABLE items (id INTEGER PRIMARY KEY, company_id INT, item_code TEXT, item_name TEXT, item_type TEXT, is_active INT);
    CREATE TABLE bill_of_materials (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INT, finished_item_id INT, bom_name TEXT,
      output_quantity REAL, notes TEXT, phase TEXT, is_active INT, is_temp INT, is_ghost INT);
    CREATE TABLE bom_components (id INTEGER PRIMARY KEY AUTOINCREMENT, bom_id INT, component_item_id INT,
      quantity_required REAL, wastage_percent REAL);
    CREATE TABLE numbering_sequences (company_id INT, document_type TEXT, prefix TEXT, next_number INT, padding INT,
      UNIQUE(company_id, document_type));
    INSERT INTO items VALUES
      (1, 1, 'GHOST1', 'Scour Guard', 'FINISHED_GOOD', 0),
      (2, 1, 'NEW1', 'SCOUR GUARD 100 ML', 'FINISHED_GOOD', 1),
      (3, 1, 'NEW2', 'KIRZAN BOP 100 ML', 'FINISHED_GOOD', 1),
      (10, 1, 'RM1', 'Kaolin', 'RAW_MATERIAL', 1),
      (11, 1, 'RM2', 'Old Ghost Salt', 'RAW_MATERIAL', 0);
    INSERT INTO bill_of_materials (company_id, finished_item_id, bom_name, output_quantity, phase, is_active, is_temp, is_ghost)
      VALUES (1, 1, 'BOM-00003', 1, 'FORMULATION', 0, 0, 1),
             (1, 3, 'BOM-00009', 1, 'FORMULATION', 0, 0, 1);
    INSERT INTO bom_components (bom_id, component_item_id, quantity_required, wastage_percent)
      VALUES (1, 10, 0.15, 0), (2, 11, 0.2, 0);
  `);
  await run(shim, { apply: true });
  const live = db.prepare("SELECT * FROM bill_of_materials WHERE is_active = 1").all();
  const liveComps = db.prepare("SELECT * FROM bom_components WHERE bom_id = ?").all(live[0]?.id);
  const ghostCount = db.prepare("SELECT COUNT(*) AS n FROM bill_of_materials WHERE is_ghost = 1").get();
  db.close();

  const ok =
    live.length === 1 &&
    live[0].finished_item_id === 2 &&
    live[0].phase === "FORMULATION" &&
    liveComps.length === 1 &&
    Number(ghostCount.n) === 2;
  if (!ok) throw new Error(`selftest failed: ${JSON.stringify({ live, liveComps, ghostCount })}`);
  console.log("selftest ok");
}

const list = process.argv.includes("--selftest") ? [] : targets();
if (process.argv.includes("--selftest")) {
  await selftest();
} else if (list.length === 0) {
  console.error("No database targets. Set SQLITE_CLOUD_URL / SQLITE_CLOUD_TESTDB_URL or pass a URL/path.");
  process.exit(1);
} else {
  for (const target of list) {
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
