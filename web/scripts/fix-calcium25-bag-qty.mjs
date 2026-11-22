// Calcium 72 25 kg was packed with 0.4 bags per unit instead of 1. The BOM is
// fixed, but every packing order made before the fix still consumed 0.4 bags,
// understating its cost and leaving the bag stock too high.
//
//   node scripts/fix-calcium25-bag-qty.mjs --url "<sqlitecloud url>"
//   node scripts/fix-calcium25-bag-qty.mjs --url "<sqlitecloud url>" --apply
//
// Dry run unless --apply. Refuses anything but SQLite Cloud. The BOM must
// already say 1 bag per output unit. Writes, per affected completed packing
// order: the bag consumption quantity, one correcting PRODUCTION_CONSUME
// movement (recent orders only — older ones predate consumption tracking), the
// bag batch stock, the order cost and the finished batch cost. Then one
// balancing MANUFACTURING journal: extra cost still in stock goes to Finished
// Goods inventory, the rest (sold or removed by a stock reset) to COGS, with
// the same total credited out of Packing Material.
//
// Idempotent: consumption is set to the expected quantity, and the journal's
// fixed reference is skipped if it already exists.
const REFERENCE = "CALCIUM25-BAGFIX";
const BOM_NAME = "calcium 72 25 kg";
const BAG_ITEM = "BAG CALCIUM 72 [25 KG]";
const OUTPUT_ITEM = "Calcium 72 25 kg";
const MAX_TOTAL = 100_000;

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const urlFlag = args.indexOf("--url");
const url = urlFlag >= 0 ? args[urlFlag + 1] : "";

if (!url || !url.startsWith("sqlitecloud://")) {
  console.error('usage: node scripts/fix-calcium25-bag-qty.mjs --url "<sqlitecloud url>" [--apply]');
  process.exit(1);
}

process.env.ERP_DB_ENGINE = "sqlitecloud";
process.env.SQLITE_CLOUD_URL = url;

const n = (value) => Number(value ?? 0);
const q = (value) => Math.round(n(value) * 1e6) / 1e6;
const money = (value) => Math.round(n(value) * 100) / 100;
const mask = (value) => value.replace(/apikey=[^&]+/, "apikey=***");

async function main() {
  const { getDb, closeDb } = await import("../server/src/db/index.js");
  const { AccountingService } = await import("../server/src/services/accountingService.js");
  const db = getDb();

  console.log(`Database: ${mask(url)}`);

  const bom = await db.get(
    "SELECT id, bom_name, output_quantity FROM bill_of_materials WHERE lower(bom_name) = lower(?) AND phase = 'PACKING'",
    [BOM_NAME],
  );
  if (!bom) throw new Error(`Packing BOM '${BOM_NAME}' not found.`);

  const bagItem = await db.get(
    "SELECT id, item_name, purchase_price FROM items WHERE item_name = ?",
    [BAG_ITEM],
  );
  if (!bagItem) throw new Error(`Item '${BAG_ITEM}' not found.`);

  const outputItem = await db.get("SELECT id, item_name FROM items WHERE item_name = ?", [
    OUTPUT_ITEM,
  ]);
  if (!outputItem) throw new Error(`Item '${OUTPUT_ITEM}' not found.`);

  const bagLine = await db.get(
    "SELECT id, quantity_required FROM bom_components WHERE bom_id = ? AND component_item_id = ?",
    [bom.id, bagItem.id],
  );
  if (!bagLine) throw new Error("The packing BOM has no calcium bag line.");
  const perUnitBags = n(bagLine.quantity_required) / n(bom.output_quantity);
  if (Math.abs(perUnitBags - 1) > 1e-9) {
    throw new Error(
      `BOM ${bom.id} still uses ${perUnitBags} bags per unit; set it to 1 before fixing old packings.`,
    );
  }

  const bagUnitCost = n(bagItem.purchase_price) || 95;

  const orders = await db.all(
    `SELECT po.id, po.order_number, po.actual_quantity, po.production_cost,
            po.manufacturing_date,
            sb.id AS batch_id, sb.quantity_in_stock, sb.raw_unit_cost,
            sb.packing_unit_cost, sb.purchase_price
       FROM packing_orders po
       LEFT JOIN stock_batches sb
              ON sb.item_id = ? AND sb.batch_number = po.output_batch_number
      WHERE po.bom_id = ? AND po.status = 'COMPLETED'
      ORDER BY po.id`,
    [outputItem.id, bom.id],
  );

  const plan = [];
  for (const order of orders) {
    const actual = n(order.actual_quantity);
    if (actual <= 0) continue;
    const expected = q(actual * perUnitBags);

    const consumption = await db.get(
      "SELECT id, batch_id, quantity_consumed, unit_cost FROM packing_consumption WHERE packing_order_id = ? AND component_item_id = ?",
      [order.id, bagItem.id],
    );

    let oldBags;
    if (consumption) {
      oldBags = n(consumption.quantity_consumed);
    } else {
      // Orders before consumption tracking: infer the old bag count from the
      // stored cost, which was raw cost + 0.4 × bag cost per unit.
      const rawPerUnit = n(order.raw_unit_cost);
      const oldPerUnit = (n(order.production_cost) - rawPerUnit * actual) / actual;
      oldBags = q((oldPerUnit / bagUnitCost) * actual);
    }

    const delta = q(expected - oldBags);
    if (delta <= 1e-6) continue;

    let sold = 0;
    if (order.batch_id != null) {
      const moves = await db.get(
        `SELECT COALESCE(SUM(CASE WHEN movement_type IN ('SALE','SALE_RETURN') THEN quantity ELSE 0 END), 0) AS net
           FROM stock_movements WHERE batch_id = ?`,
        [order.batch_id],
      );
      sold = Math.max(0, -n(moves?.net));
    }
    const stock = Math.max(0, n(order.quantity_in_stock));
    const removed = Math.max(0, q(actual - sold - stock));

    const value = money(delta * bagUnitCost);
    const inStockValue = money((value * stock) / actual);
    const cogsValue = money(value - inStockValue);

    plan.push({
      order,
      actual,
      oldBags,
      expected,
      delta,
      value,
      batchId: consumption?.batch_id ?? null,
      inStockValue,
      cogsValue,
      sold,
      stock,
      removed,
    });
  }

  if (plan.length === 0) {
    console.log("Nothing to change.");
    await closeDb();
    return;
  }

  const total = money(plan.reduce((sum, row) => sum + row.value, 0));
  const totalStock = money(plan.reduce((sum, row) => sum + row.inStockValue, 0));
  const totalCogs = money(plan.reduce((sum, row) => sum + row.cogsValue, 0));

  console.log(
    "\n  order     date        units   bags        +bags   +cost     stock   sold  removed",
  );
  console.log(
    "  --------  ----------  ------  ----------  ------  --------  ------  ----  -------",
  );
  for (const row of plan) {
    console.log(
      `  ${row.order.order_number.padEnd(8)}  ${row.order.manufacturing_date}  ${String(row.actual).padStart(6)}  ` +
        `${String(row.oldBags).padStart(6)} -> ${String(row.expected).padEnd(6)}  ${String(row.delta).padStart(6)}  ` +
        `${row.value.toFixed(2).padStart(8)}  ${String(row.stock).padStart(6)}  ${String(row.sold).padStart(4)}  ${String(row.removed).padStart(7)}`,
    );
  }
  console.log(`\n  orders: ${plan.length}`);
  console.log(`  extra bags: ${q(plan.reduce((sum, row) => sum + row.delta, 0))} @ ${bagUnitCost}`);
  console.log(`  Journal: Dr Finished Goods ${totalStock.toFixed(2)}, Dr COGS ${totalCogs.toFixed(2)}, Cr Packing Material ${total.toFixed(2)}`);

  if (total > MAX_TOTAL) {
    throw new Error(`Total ${total.toFixed(2)} exceeds the ${MAX_TOTAL} safety cap; refusing.`);
  }

  const existing = await db.get("SELECT id FROM journal_entries WHERE reference_no = ?", [REFERENCE]);
  if (existing) {
    console.log(`\nCorrection journal already posted as entry #${existing.id}. Nothing to do.`);
    await closeDb();
    return;
  }

  if (!apply) {
    console.log("\nDry run — nothing written. Re-run with --apply.");
    await closeDb();
    return;
  }

  const accounts = await db.all(
    "SELECT id, account_code FROM accounts WHERE company_id = 1 AND account_code IN ('1210','1220','5000')",
  );
  const account = (code) => {
    const found = accounts.find((row) => row.account_code === code);
    if (!found) throw new Error(`Account ${code} not found.`);
    return found.id;
  };

  await db.transaction(async (tx) => {
    for (const row of plan) {
      const order = row.order;

      await tx.run("UPDATE packing_orders SET production_cost = ?, updated_at = ? WHERE id = ?", [
        money(n(order.production_cost) + row.value),
        new Date().toISOString(),
        order.id,
      ]);

      if (order.batch_id != null) {
        const packingPerUnit = n(order.packing_unit_cost) + row.value / row.actual;
        const rawPerUnit = n(order.raw_unit_cost);
        await tx.run(
          "UPDATE stock_batches SET packing_unit_cost = ?, purchase_price = ? WHERE id = ?",
          [money(packingPerUnit), money(rawPerUnit + packingPerUnit), order.batch_id],
        );
      }

      if (row.batchId != null) {
        await tx.run(
          "UPDATE packing_consumption SET quantity_consumed = ? WHERE packing_order_id = ? AND component_item_id = ?",
          [row.expected, order.id, bagItem.id],
        );
        const batch = await tx.get(
          "SELECT quantity_in_stock FROM stock_batches WHERE id = ?",
          [row.batchId],
        );
        await tx.run("UPDATE stock_batches SET quantity_in_stock = ? WHERE id = ?", [
          q(n(batch?.quantity_in_stock) - row.delta),
          row.batchId,
        ]);
        await tx.run(
          `INSERT INTO stock_movements
             (item_id, batch_id, warehouse_id, movement_type, quantity, unit_cost,
              reference_table, reference_id, movement_date, notes)
           VALUES (?, ?, 1, 'PRODUCTION_CONSUME', ?, ?, 'packing_orders', ?, ?, ?)`,
          [
            bagItem.id,
            row.batchId,
            -row.delta,
            bagUnitCost,
            order.id,
            new Date().toISOString().slice(0, 10),
            `Bag quantity correction (1 per 25 kg) - ${order.order_number}`,
          ],
        );
      }
    }

    const lines = [];
    if (totalStock > 0) {
      lines.push({
        accountId: account("1220"),
        debit: totalStock,
        description: "Calcium 72 25 kg packs still in stock revalued to 1 bag each",
      });
    }
    if (totalCogs > 0) {
      lines.push({
        accountId: account("5000"),
        debit: totalCogs,
        description: "Calcium 72 25 kg bags under-consumed on sold/cleared packs",
      });
    }
    lines.push({
      accountId: account("1210"),
      credit: total,
      description: "Calcium 72 25 kg bags consumed (0.4 -> 1 per pack)",
    });

    const accounting = new AccountingService(tx);
    const id = await accounting.postJournalEntry({
      voucherType: "MANUFACTURING",
      entryDate: new Date().toISOString().slice(0, 10),
      narration: `Cost correction: Calcium 72 25 kg now uses 1 bag per 25 kg (${plan.length} packing orders)`,
      referenceNo: REFERENCE,
      lines,
    });
    console.log(`\nPosted correction journal entry #${id} for ${total.toFixed(2)}.`);
  });

  await closeDb();
}

main()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
