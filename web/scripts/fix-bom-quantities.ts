// Three BOM lines carry a component quantity 1000x too large, so every run of
// those formulations consumes 1000x the component and overstates both the
// consumption and the finished-goods cost. The siblings in the same BOM sit
// around 0.0005 KG, which is what these should be.
//
//   npx tsx scripts/fix-bom-quantities.ts                     # dry run, cloud from .env
//   npx tsx scripts/fix-bom-quantities.ts --db fixed          # dry run, other cloud db
//   npx tsx scripts/fix-bom-quantities.ts --local             # dry run, ERP_LOCAL_DB
//   ... --apply                                               # write
//
// Idempotent: each row is matched by id AND its current value, so a re-run
// after the fix reports "already correct" instead of writing again.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const apply = args.includes("--apply");

/** component row id, expected current quantity, correct quantity. */
const FIXES = [
  { id: 6168, from: 0.5, to: 0.0005, label: "UDDER BOOST / Vitamin H" },
  { id: 6645, from: 0.5, to: 0.0005, label: "ADEK GOLD / Vitamin D" },
  { id: 6503, from: 0.2, to: 0.0005, label: "GOLDEN P / Vitamin B6" },
];

const dbArg = args.indexOf("--db");
const localArg = args.indexOf("--local");
const useLocal = localArg >= 0;

if (useLocal) {
  process.env.ERP_DB_ENGINE = "local";
  const target = args[localArg + 1];
  if (target && !target.startsWith("--")) process.env.ERP_LOCAL_DB = target;
} else if (dbArg >= 0) {
  const envFile = path.resolve(import.meta.dirname, "..", ".env");
  if (!existsSync(envFile)) throw new Error("web/.env not found.");
  const line = readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .find((raw) => raw.trim().startsWith("SQLITE_CLOUD_URL="));
  if (!line) throw new Error("SQLITE_CLOUD_URL is not set in web/.env.");
  const url = line
    .slice(line.indexOf("=") + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
  process.env.ERP_DB_ENGINE = "sqlitecloud";
  process.env.SQLITE_CLOUD_URL = url.replace(/(:\d+\/)[^?]*/, `$1${args[dbArg + 1]}`);
}

async function main(): Promise<void> {
  const { getDb, closeDb } = await import("../server/src/db/index.js");
  const { env } = await import("../server/src/env.js");
  const db = getDb();
  console.log(
    `Database: ${
      useLocal
        ? `${env.localDbPath} (local — stop the service first)`
        : (process.env.SQLITE_CLOUD_URL ?? "").replace(/apikey=[^&]+/, "apikey=***")
    }`,
  );

  const pending: Array<{ id: number; to: number; label: string }> = [];
  for (const fix of FIXES) {
    const row = await db.get<{ quantity_required: number }>(
      "SELECT quantity_required FROM bom_components WHERE id = ?",
      [fix.id],
    );
    if (!row) {
      console.log(`  skip ${fix.label}: component row ${fix.id} not found`);
      continue;
    }
    const current = Number(row.quantity_required);
    if (Math.abs(current - fix.to) < 1e-9) {
      console.log(`  ok   ${fix.label}: already ${fix.to}`);
      continue;
    }
    if (Math.abs(current - fix.from) > 1e-9) {
      console.log(`  skip ${fix.label}: row ${fix.id} is ${current}, expected ${fix.from} — left alone`);
      continue;
    }
    console.log(`  fix  ${fix.label}: ${current} -> ${fix.to}`);
    pending.push({ id: fix.id, to: fix.to, label: fix.label });
  }

  if (pending.length === 0) {
    console.log("Nothing to change.");
    await closeDb();
    return;
  }
  if (!apply) {
    console.log("Dry run — nothing written. Re-run with --apply.");
    await closeDb();
    return;
  }
  for (const change of pending) {
    await db.run("UPDATE bom_components SET quantity_required = ? WHERE id = ?", [
      change.to,
      change.id,
    ]);
  }
  console.log(`Updated ${pending.length} BOM line(s).`);
  await closeDb();
}

main().then(
  () => process.exit(0),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
