// Rebuild the inventory for one month from the documents, reversibly.
//
//   npm -w @bop-erp/server run rebuild:inventory                 # dry run, November
//   npm -w @bop-erp/server run rebuild:inventory -- --apply       # write it
//   npm -w @bop-erp/server run rebuild:inventory -- --restore 3   # undo rebuild #3
//   npm -w @bop-erp/server run rebuild:inventory -- --list
//
// Quantity per item = purchased − purchase returns + produced − consumed − sold
// + sales returned, for documents dated inside the range only. Finished goods
// use their own rule — production and packing output, less sales — because the
// factory is where they come from. October is not read at all. Stock dated
// before the range joins only with --keep-opening.
//
// The dry run writes a per-item CSV; --apply takes a JSON snapshot first, then
// rewrites batches and movements and posts the value difference to the inventory
// accounts — all in one transaction, verified item by item before it commits.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const flag = (name: string): boolean => args.includes(name);
const value = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const apply = flag("--apply");
const force = flag("--force");
const keepOpening = flag("--keep-opening");
const fgNetConsumption = flag("--fg-net-consumption");
const from = value("--from") ?? "2026-11-01";
const to = value("--to") ?? "2026-11-30";
const restoreArg = value("--restore");
const defaultDir = fileURLToPath(new URL("../../data/", import.meta.url));
const outArg = value("--out");
const outPath = resolve(outArg ?? `${defaultDir}inventory-plan-${from}-to-${to}.csv`);

const money = (n: number): string => n.toFixed(2);
const qty = (n: number): string => (Math.round(n * 10000) / 10000).toString();

function csvCell(cell: string | number): string {
  const text = String(cell);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main(): Promise<void> {
  const { getDb, closeDb } = await import("./db/index.js");
  const { env } = await import("./env.js");
  const { InventoryRebuildService } = await import("./services/inventoryRebuildService.js");

  const db = getDb();
  const service = new InventoryRebuildService(db, env.companyId);
  console.log(`inventory rebuild — engine=${env.dbEngine} company=${env.companyId} range=${from}..${to}`);

  if (flag("--list")) {
    const rows = await service.list();
    if (rows.length === 0) console.log("\n  no rebuilds recorded");
    for (const row of rows) {
      console.log(
        `  #${String(row.id).padStart(3)}  ${row.from_date}..${row.to_date}  items ${String(row.item_count).padStart(4)}` +
          `  qty ${qty(Number(row.total_quantity)).padStart(12)}  value ${money(Number(row.total_value)).padStart(14)}` +
          `  ${row.restored_at ? `restored ${row.restored_at}` : "ACTIVE"}`,
      );
    }
    await closeDb();
    return;
  }

  if (restoreArg) {
    const id = Number(restoreArg);
    if (!Number.isInteger(id)) throw new Error("--restore needs a rebuild id (see --list).");
    const result = await service.restore(id, null);
    console.log(`\nRestored rebuild #${id}: ${result.batches} batch rows, movements and the journal entry put back.`);
    await closeDb();
    return;
  }

  const plan = await service.plan({ from, to, keepOpening, fgNetConsumption });

  console.log(`\n### Money`);
  console.log("  account  type                quantity   target value    book value         delta");
  for (const account of plan.accounts) {
    console.log(
      `  ${account.accountCode}     ${account.type.padEnd(16)} ${qty(account.quantity).padStart(11)}` +
        ` ${money(account.targetValue).padStart(14)} ${money(account.currentValue).padStart(14)} ${money(account.delta).padStart(14)}`,
    );
  }
  console.log(
    `  ${"TOTAL".padEnd(19)} ${qty(plan.totals.quantity).padStart(11)} ${money(plan.totals.value).padStart(14)}` +
      ` ${money(plan.totals.currentValue).padStart(14)} ${money(plan.totals.delta).padStart(14)}`,
  );

  const changed = plan.lines.filter((line) => line.flags.includes("changes"));
  const negative = plan.lines.filter((line) => line.target < 0);
  const zeroCost = plan.lines.filter((line) => line.target !== 0 && line.unitCost <= 0);
  const unpurchased = plan.lines.filter((line) => line.target < 0 && line.purchased === 0);

  console.log(`\n### Items (${plan.lines.length} checked, ${changed.length} would change)`);
  console.log(`  negative after rebuild   ${String(negative.length).padStart(4)}`);
  console.log(`  negative, never bought   ${String(unpurchased.length).padStart(4)}`);
  console.log(`  stock with no cost       ${String(zeroCost.length).padStart(4)}`);
  for (const warning of plan.warnings) console.log(`  ! ${warning}`);
  for (const error of plan.errors) console.log(`  ERROR ${error}`);

  const show = changed.length > 0 ? changed : plan.lines.filter((line) => line.target !== 0);
  console.log("\n  code           name                                  now          rule        cost       value");
  for (const line of show.slice(0, 40)) {
    console.log(
      `  ${line.itemCode.padEnd(13)} ${line.itemName.slice(0, 36).padEnd(36)} ${qty(line.currentQty).padStart(10)}` +
        ` ${qty(line.target).padStart(12)} ${money(line.unitCost).padStart(11)} ${money(line.value).padStart(12)}` +
        `${line.flags.length ? `  [${line.flags.join(",")}]` : ""}`,
    );
  }
  if (show.length > 40) console.log(`  … and ${show.length - 40} more — every item is in the CSV`);

  const header = [
    "code", "name", "type", "unit", "purchased", "purchase_returns", "produced",
    "production_consumed", "packing_consumed", "sold", "sales_returned", "opening",
    "current_qty", "target_qty", "unit_cost", "current_value", "target_value", "flags",
  ];
  const lines = plan.lines.map((line) =>
    [
      line.itemCode, line.itemName, line.itemType, line.unit,
      qty(line.purchased), qty(line.purchaseReturns), qty(line.produced),
      qty(line.productionConsumed), qty(line.packingConsumed), qty(line.sold),
      qty(line.salesReturned), qty(line.opening), qty(line.currentQty), qty(line.target),
      money(line.unitCost), money(line.currentValue), money(line.value), line.flags.join(" "),
    ].map(csvCell).join(","),
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, [header.join(","), ...lines].join("\n") + "\n", "utf8");
  console.log(`\nPlan: ${outPath}`);

  if (plan.errors.length > 0) {
    console.log("\nRefusing to write while any item is in error. Fix the errors above and run again.");
    await closeDb();
    process.exitCode = 1;
    return;
  }

  if (!apply) {
    console.log("\nDry run — nothing written. Re-run with --apply to rebuild the inventory.");
    await closeDb();
    return;
  }

  const result = await service.apply({ from, to, keepOpening, fgNetConsumption, force });
  console.log(
    `\nRebuild #${result.rebuildId} written: ${result.changedItems} batch changes, ` +
      `${qty(result.totalQuantity)} qty, value ${money(result.totalValue)}, ` +
      `difference ${money(result.valueDelta)} to ${result.journalEntryId ? `entry #${result.journalEntryId}` : "no journal (already agreed)"}.`,
  );
  console.log(`Snapshot: ${result.snapshotFile}`);
  console.log(`Undo with: npm -w @bop-erp/server run rebuild:inventory -- --restore ${result.rebuildId}`);
  await closeDb();
}

main().catch(async (err) => {
  console.error(`\n${err instanceof Error ? err.message : err}`);
  const { closeDb } = await import("./db/index.js");
  await closeDb().catch(() => undefined);
  process.exit(1);
});
