/**
 * Rebuild the inventory from the month's documents — and undo it again.
 *
 * The quantity a company should be holding is not an opinion: it is what it
 * bought, plus what the factory produced, less what it consumed, sold or
 * returned. Finished goods are the factory's business only — what production
 * and packing output, less what was sold — because they are rarely bought.
 * This service does that arithmetic for one date range (November by default),
 * then rewrites the batches to match and posts the value difference to the
 * inventory accounts, in a single transaction whose result is verified before
 * it commits.
 *
 * Reversible: before writing, every batch quantity and every stock movement is
 * saved to a JSON snapshot and recorded under an `inventory_rebuilds` row. A
 * restore puts the batches, the movement ledger and the journal entry back.
 *
 * Nothing outside the date range is read: October (the test month) contributes
 * no purchases, no production and no consumption. Stock dated before the range
 * is only carried in when `keepOpening` is set.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SqlDatabase } from "../db/types.js";
import { ConflictError, NotFoundError, ValidationError } from "../domain/errors.js";
import { AccountingService, type JournalLineInput } from "./accountingService.js";

/** The account each material type lives in. */
const INVENTORY_ACCOUNT: Record<string, string> = {
  RAW_MATERIAL: "1200",
  PACKING_MATERIAL: "1210",
  FINISHED_GOOD: "1220",
};
const COGS = "5000";
const IN_SCOPE_TYPES = Object.keys(INVENTORY_ACCOUNT);
const DEFAULT_OPENING = false;

const MOVE_REF = "inventory_rebuild";

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;
const money = (n: number): number => round2(n);

export interface RebuildOptions {
  from: string;
  to: string;
  /** Count stock dated before `from` as the starting balance (default false). */
  keepOpening?: boolean;
  /**
   * Also subtract finished goods that were consumed by production/packing.
   * Off by default: the rule is output − sales, and loose stock packed into a
   * saleable item would otherwise stay on the books twice.
   */
  fgNetConsumption?: boolean;
  createdBy?: number | null;
  /** Allow a second rebuild on top of one that was never restored. */
  force?: boolean;
  /** Where the JSON snapshot goes. Defaults to <repo>/data/inventory-rebuild-<stamp>.json. */
  snapshotDir?: string;
}

export interface RebuildLine {
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  unit: string;
  purchased: number;
  purchaseReturns: number;
  produced: number;
  productionConsumed: number;
  packingConsumed: number;
  sold: number;
  salesReturned: number;
  opening: number;
  target: number;
  currentQty: number;
  unitCost: number;
  value: number;
  currentValue: number;
  flags: string[];
}

export interface RebuildAccountLine {
  type: string;
  accountCode: string;
  accountId: number;
  quantity: number;
  targetValue: number;
  currentValue: number;
  delta: number;
}

export interface RebuildPlan {
  from: string;
  to: string;
  keepOpening: boolean;
  lines: RebuildLine[];
  accounts: RebuildAccountLine[];
  cogsAccountId: number | null;
  totals: { quantity: number; value: number; currentValue: number; delta: number; items: number };
  warnings: string[];
  /** Anything in here aborts an apply before a single write. */
  errors: string[];
}

export interface ApplyResult {
  rebuildId: number;
  journalEntryId: number | null;
  itemCount: number;
  changedItems: number;
  totalQuantity: number;
  totalValue: number;
  valueDelta: number;
  snapshotFile: string;
}

export interface RebuildRow {
  id: number;
  company_id: number;
  from_date: string;
  to_date: string;
  journal_entry_id: number | null;
  item_count: number;
  total_quantity: number;
  total_value: number;
  snapshot_file: string | null;
  created_at: string;
  restored_at: string | null;
  reason: string | null;
}

type ItemRow = {
  item_id: number;
  item_code: string;
  item_name: string;
  item_type: string;
  unit: string;
  purchased: number;
  purchase_returns: number;
  produced: number;
  production_consumed: number;
  packing_consumed: number;
  sold: number;
  sales_returned: number;
  opening: number;
  current_qty: number;
  current_value: number;
  unit_cost: number;
};

type BatchRow = {
  id: number;
  item_id: number;
  warehouse_id: number;
  batch_number: string;
  quantity_in_stock: number;
  purchase_price: number;
  raw_unit_cost: number;
  packing_unit_cost: number;
  is_active: number;
};

type MovementRow = {
  id: number;
  item_id: number;
  batch_id: number;
  warehouse_id: number;
  movement_type: string;
  quantity: number;
  unit_cost: number;
  reference_table: string | null;
  reference_id: number | null;
  movement_date: string;
  notes: string | null;
  created_by: number | null;
};

type Snapshot = {
  companyId: number;
  from: string;
  to: string;
  createdAt: string;
  maxMovementId: number;
  batches: BatchRow[];
  createdBatchIds: number[];
  movements: MovementRow[];
};

function defaultSnapshotDir(): string {
  return fileURLToPath(new URL("../../../data/", import.meta.url));
}

export class InventoryRebuildService {
  private readonly accounting: AccountingService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.accounting = new AccountingService(db);
  }

  /** Create the bookkeeping tables if this database predates them. */
  async ensureTables(): Promise<void> {
    await this.db.exec(`
CREATE TABLE IF NOT EXISTS inventory_rebuilds (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id       INTEGER NOT NULL REFERENCES companies(id),
    from_date        TEXT NOT NULL,
    to_date          TEXT NOT NULL,
    journal_entry_id INTEGER REFERENCES journal_entries(id),
    item_count       INTEGER NOT NULL DEFAULT 0,
    total_quantity   REAL NOT NULL DEFAULT 0,
    total_value      REAL NOT NULL DEFAULT 0,
    snapshot_file    TEXT,
    reason           TEXT,
    created_by       INTEGER REFERENCES users(id),
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    restored_at      TEXT,
    restored_by      INTEGER REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS inventory_rebuild_lines (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    rebuild_id      INTEGER NOT NULL REFERENCES inventory_rebuilds(id) ON DELETE CASCADE,
    item_id         INTEGER NOT NULL REFERENCES items(id),
    batch_id        INTEGER NOT NULL REFERENCES stock_batches(id),
    quantity_before REAL NOT NULL,
    quantity_after  REAL NOT NULL,
    unit_cost       REAL NOT NULL DEFAULT 0,
    value_before    REAL NOT NULL DEFAULT 0,
    value_after     REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rebuild_lines_rebuild ON inventory_rebuild_lines(rebuild_id);
`);
  }

  async list(): Promise<RebuildRow[]> {
    await this.ensureTables();
    return this.db.all<RebuildRow>(
      "SELECT * FROM inventory_rebuilds WHERE company_id = ? ORDER BY id DESC",
      [this.companyId],
    );
  }

  /**
   * The arithmetic, with every item checked. Read-only: safe to run at any
   * time, and the same plan `apply()` will use.
   */
  async plan(
    options: Pick<RebuildOptions, "from" | "to" | "keepOpening" | "fgNetConsumption">,
  ): Promise<RebuildPlan> {
    const from = options.from;
    const to = options.to;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new ValidationError("Dates must be YYYY-MM-DD.");
    }
    if (from > to) throw new ValidationError("The start date is after the end date.");
    const keepOpening = options.keepOpening ?? DEFAULT_OPENING;
    const fgNetConsumption = options.fgNetConsumption ?? false;

    const rows = await this.db.all<ItemRow>(
      `SELECT i.id item_id, i.item_code, i.item_name, i.item_type, i.unit,
              COALESCE(p.qty, 0) purchased,
              COALESCE(pr.qty, 0) purchase_returns,
              COALESCE(out.qty, 0) produced,
              COALESCE(c.prod, 0) production_consumed,
              COALESCE(c.pack, 0) packing_consumed,
              COALESCE(s.qty, 0) sold,
              COALESCE(sr.qty, 0) sales_returned,
              COALESCE(o.qty, 0) opening,
              COALESCE(b.qty, 0) current_qty,
              COALESCE(b.value, 0) current_value,
              -- Cost preference: what we last paid, then what the batch was
              -- already carried at (manufactured items have no purchase), then
              -- the item's own price.
              COALESCE(cost.unit_cost, batch_cost.cost, i.purchase_price, 0) unit_cost
         FROM items i
         LEFT JOIN (
              SELECT pii.item_id, SUM(pii.quantity) qty
                FROM purchase_invoice_items pii
                JOIN purchase_invoices pi ON pi.id = pii.invoice_id
               WHERE pi.company_id = ? AND pi.status = 'CONFIRMED'
                 AND pi.invoice_date BETWEEN ? AND ?
               GROUP BY pii.item_id
         ) p ON p.item_id = i.id
         LEFT JOIN (
              SELECT pri.item_id, SUM(pri.quantity) qty
                FROM purchase_return_items pri
                JOIN purchase_returns prr ON prr.id = pri.return_id
               WHERE prr.company_id = ? AND prr.return_date BETWEEN ? AND ?
               GROUP BY pri.item_id
         ) pr ON pr.item_id = i.id
         LEFT JOIN (
              SELECT item_id, SUM(qty) qty FROM (
                   SELECT bm.finished_item_id item_id, po.actual_quantity qty
                     FROM production_orders po
                     JOIN bill_of_materials bm ON bm.id = po.bom_id
                    WHERE po.company_id = ? AND po.status = 'COMPLETED'
                      AND po.is_ghost = 0 AND po.actual_quantity > 0
                      AND po.manufacturing_date BETWEEN ? AND ?
                   UNION ALL
                   SELECT bm.finished_item_id, pk.actual_quantity
                     FROM packing_orders pk
                     JOIN bill_of_materials bm ON bm.id = pk.bom_id
                    WHERE pk.company_id = ? AND pk.status = 'COMPLETED'
                      AND pk.actual_quantity > 0
                      AND pk.manufacturing_date BETWEEN ? AND ?
              ) GROUP BY item_id
         ) out ON out.item_id = i.id
         LEFT JOIN (
              SELECT item_id, SUM(prod) prod, SUM(pack) pack FROM (
                   SELECT pc.component_item_id item_id, pc.quantity_consumed prod, 0 pack
                     FROM production_consumption pc
                     JOIN production_orders po ON po.id = pc.production_order_id
                    WHERE po.company_id = ? AND po.status <> 'CANCELLED'
                      AND po.is_ghost = 0
                      AND po.manufacturing_date BETWEEN ? AND ?
                   UNION ALL
                   SELECT kc.component_item_id, 0, kc.quantity_consumed
                     FROM packing_consumption kc
                     JOIN packing_orders pk ON pk.id = kc.packing_order_id
                    WHERE pk.company_id = ? AND pk.status <> 'CANCELLED'
                      AND pk.manufacturing_date BETWEEN ? AND ?
              ) GROUP BY item_id
         ) c ON c.item_id = i.id
         LEFT JOIN (
              SELECT sii.item_id, SUM(sii.quantity) qty
                FROM sales_invoice_items sii
                JOIN sales_invoices si ON si.id = sii.invoice_id
               WHERE si.company_id = ? AND si.status = 'CONFIRMED'
                 AND si.invoice_date BETWEEN ? AND ?
               GROUP BY sii.item_id
         ) s ON s.item_id = i.id
         LEFT JOIN (
              SELECT sri.item_id, SUM(sri.quantity) qty
                FROM sales_return_items sri
                JOIN sales_returns sr2 ON sr2.id = sri.return_id
               WHERE sr2.company_id = ? AND sr2.return_date BETWEEN ? AND ?
               GROUP BY sri.item_id
         ) sr ON sr.item_id = i.id
         LEFT JOIN (
              SELECT sm.item_id, SUM(sm.quantity) qty
                FROM stock_movements sm
               WHERE sm.movement_date < ?
               GROUP BY sm.item_id
         ) o ON o.item_id = i.id
         LEFT JOIN (
              SELECT sb.item_id,
                     SUM(sb.quantity_in_stock) qty,
                     SUM(CASE WHEN sb.quantity_in_stock > 0
                              THEN sb.quantity_in_stock
                                   * COALESCE(NULLIF(sb.raw_unit_cost + sb.packing_unit_cost, 0),
                                              NULLIF(sb.purchase_price, 0), i2.purchase_price, 0)
                              ELSE 0 END) value
                FROM stock_batches sb
                JOIN items i2 ON i2.id = sb.item_id
               WHERE sb.is_active = 1
               GROUP BY sb.item_id
         ) b ON b.item_id = i.id
         -- Last confirmed cost, newest invoice first, for valuing the target.
         LEFT JOIN (
              SELECT pii.item_id, pii.unit_cost
                FROM purchase_invoice_items pii
                JOIN purchase_invoices pi ON pi.id = pii.invoice_id
               WHERE pi.company_id = ? AND pi.status = 'CONFIRMED'
                 AND pii.id = (SELECT MAX(x.id) FROM purchase_invoice_items x
                                 JOIN purchase_invoices y ON y.id = x.invoice_id
                                WHERE x.item_id = pii.item_id AND y.status = 'CONFIRMED'
                                  AND y.company_id = ?)
         ) cost ON cost.item_id = i.id
         LEFT JOIN (
              SELECT sb.item_id, MAX(CASE WHEN sb.raw_unit_cost + sb.packing_unit_cost > 0
                                          THEN sb.raw_unit_cost + sb.packing_unit_cost
                                          ELSE sb.purchase_price END) cost
                FROM stock_batches sb
               WHERE sb.is_active = 1
               GROUP BY sb.item_id
         ) batch_cost ON batch_cost.item_id = i.id
        WHERE i.company_id = ? AND i.item_type IN (${IN_SCOPE_TYPES.map(() => "?").join(",")})
        ORDER BY i.item_type, i.item_code`,
      [
        this.companyId, from, to,
        this.companyId, from, to,
        this.companyId, from, to,
        this.companyId, from, to,
        this.companyId, from, to,
        this.companyId, from, to,
        this.companyId, from, to,
        this.companyId, from, to,
        from,
        this.companyId, this.companyId,
        this.companyId,
        ...IN_SCOPE_TYPES,
      ],
    );

    const errors: string[] = [];
    const warnings: string[] = [];

    const accounts = await this.db.all<{ id: number; account_code: string }>(
      `SELECT id, account_code FROM accounts WHERE company_id = ?
        AND account_code IN (${[...Object.values(INVENTORY_ACCOUNT), COGS].map(() => "?").join(",")})`,
      [this.companyId, ...Object.values(INVENTORY_ACCOUNT), COGS],
    );
    const accountId = new Map(accounts.map((row) => [row.account_code, row.id]));
    for (const code of [...Object.values(INVENTORY_ACCOUNT), COGS]) {
      if (!accountId.has(code)) errors.push(`Account ${code} is missing — cannot post the difference.`);
    }

    const lines: RebuildLine[] = [];
    for (const row of rows) {
      const purchased = Number(row.purchased);
      const purchaseReturns = Number(row.purchase_returns);
      const produced = Number(row.produced);
      const productionConsumed = Number(row.production_consumed);
      const packingConsumed = Number(row.packing_consumed);
      const sold = Number(row.sold);
      const salesReturned = Number(row.sales_returned);
      const opening = keepOpening ? Number(row.opening) : 0;
      const unitCost = Number(row.unit_cost);

      // Finished goods: what the factory made, less what was sold. Raw and
      // packing materials: what was bought, less what went into production.
      const target =
        row.item_type === "FINISHED_GOOD"
          ? round4(
              opening +
                produced -
                sold +
                salesReturned -
                (fgNetConsumption ? productionConsumed + packingConsumed : 0),
            )
          : round4(
              opening + purchased - purchaseReturns + produced - productionConsumed - packingConsumed - sold + salesReturned,
            );
      const currentQty = Number(row.current_qty);
      const currentValue = money(Number(row.current_value));
      // Stock is never carried at a negative value — the report and the trial
      // balance both value a shortfall at zero, so the rebuild does too.
      const value = money(Math.max(target, 0) * unitCost);

      const flags: string[] = [];
      if (target < 0) flags.push("negative");
      // A finished good that packing consumed is usually the loose stock the
      // packed item was made from — worth seeing before the numbers land.
      if (row.item_type === "FINISHED_GOOD" && packingConsumed > 0) flags.push("packed-from");
      if (target !== 0 && unitCost <= 0) flags.push("no-cost");
      if (Math.abs(target - currentQty) > 1e-6) flags.push("changes");
      if (sold > 0 && purchased === 0 && produced === 0) flags.push("sold-not-bought");

      const numbers = [
        purchased, purchaseReturns, produced, productionConsumed, packingConsumed,
        sold, salesReturned, opening, target, currentQty, unitCost, value,
      ];
      if (numbers.some((n) => !Number.isFinite(n))) {
        errors.push(`${row.item_code} ${row.item_name}: a quantity is not a number — fix the source document.`);
      }

      lines.push({
        itemId: Number(row.item_id),
        itemCode: row.item_code,
        itemName: row.item_name,
        itemType: row.item_type,
        unit: row.unit,
        purchased: round4(purchased),
        purchaseReturns: round4(purchaseReturns),
        produced: round4(produced),
        productionConsumed: round4(productionConsumed),
        packingConsumed: round4(packingConsumed),
        sold: round4(sold),
        salesReturned: round4(salesReturned),
        opening: round4(opening),
        target,
        currentQty: round4(currentQty),
        unitCost,
        value,
        currentValue,
        flags,
      });
    }

    // Current book balance per inventory account, so the delta is the real gap.
    const gl = await this.db.all<{ account_code: string; net: number }>(
      `SELECT a.account_code, ROUND(SUM(jel.debit - jel.credit), 2) net
         FROM journal_entry_lines jel
         JOIN accounts a ON a.id = jel.account_id
         JOIN journal_entries je ON je.id = jel.journal_entry_id
        WHERE je.company_id = ? AND a.account_code IN (${Object.values(INVENTORY_ACCOUNT).map(() => "?").join(",")})
        GROUP BY a.id`,
      [this.companyId, ...Object.values(INVENTORY_ACCOUNT)],
    );
    const glByCode = new Map(gl.map((row) => [row.account_code, Number(row.net)]));

    const accountLines: RebuildAccountLine[] = [];
    for (const [type, code] of Object.entries(INVENTORY_ACCOUNT)) {
      const ofType = lines.filter((line) => line.itemType === type);
      const targetValue = money(ofType.reduce((sum, line) => sum + line.value, 0));
      const currentValue = money(glByCode.get(code) ?? 0);
      const account = accountId.get(code);
      if (account == null) continue;
      accountLines.push({
        type,
        accountCode: code,
        accountId: account,
        quantity: round4(ofType.reduce((sum, line) => sum + line.target, 0)),
        targetValue,
        currentValue,
        delta: money(targetValue - currentValue),
      });
    }

    const zeroCost = lines.filter((line) => line.target !== 0 && line.unitCost <= 0);
    if (zeroCost.length > 0) {
      warnings.push(
        `${zeroCost.length} items would hold stock with no cost, so their value stays 0: ` +
          zeroCost.slice(0, 5).map((line) => line.itemCode).join(", ") +
          (zeroCost.length > 5 ? "…" : ""),
      );
    }
    const negative = lines.filter((line) => line.target < 0);
    if (negative.length > 0) {
      warnings.push(`${negative.length} items end up negative — that is the rule, not an error.`);
    }
    const packedFrom = lines.filter((line) => line.flags.includes("packed-from"));
    if (packedFrom.length > 0 && !fgNetConsumption) {
      warnings.push(
        `${packedFrom.length} finished goods were consumed by packing; under the ` +
          "finished-goods rule (output − sold) their packing consumption is not subtracted.",
      );
    }

    const totals = {
      quantity: round4(lines.reduce((sum, line) => sum + line.target, 0)),
      value: money(lines.reduce((sum, line) => sum + line.value, 0)),
      currentValue: money(lines.reduce((sum, line) => sum + line.currentValue, 0)),
      delta: money(accountLines.reduce((sum, line) => sum + line.delta, 0)),
      items: lines.length,
    };

    return {
      from,
      to,
      keepOpening,
      lines,
      accounts: accountLines,
      cogsAccountId: accountId.get(COGS) ?? null,
      totals,
      warnings,
      errors,
    };
  }

  /**
   * Rewrite the stock to the plan. One transaction; if any item fails the
   * verification the whole thing rolls back and nothing is written.
   */
  async apply(options: RebuildOptions): Promise<ApplyResult> {
    await this.ensureTables();

    const active = await this.db.get<{ id: number; created_at: string }>(
      `SELECT id, created_at FROM inventory_rebuilds
        WHERE company_id = ? AND restored_at IS NULL ORDER BY id DESC LIMIT 1`,
      [this.companyId],
    );
    if (active && !options.force) {
      throw new ConflictError(
        `Rebuild #${active.id} (${active.created_at}) is still active. Restore it first, or pass --force to stack a new one.`,
      );
    }

    const plan = await this.plan(options);
    if (plan.errors.length > 0) {
      throw new ValidationError(`Refusing to write:\n  ${plan.errors.join("\n  ")}`);
    }

    // Targets per item, and the batch each one lands on.
    const byItem = new Map(plan.lines.map((line) => [line.itemId, line]));
    const batches = await this.db.all<BatchRow>(
      "SELECT * FROM stock_batches ORDER BY id",
    );
    const batchesByItem = new Map<number, BatchRow[]>();
    for (const batch of batches) {
      const list = batchesByItem.get(batch.item_id);
      if (list) list.push(batch);
      else batchesByItem.set(batch.item_id, [batch]);
    }
    // The batch that keeps the stock must be an active one: an inactive batch
    // is invisible to the reports, so putting the quantity there would leave
    // the item looking empty and the valuation short.
    for (const list of batchesByItem.values()) {
      list.sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.id - b.id);
    }
    const warehouse = await this.db.get<{ id: number }>(
      "SELECT id FROM warehouses WHERE company_id = ? ORDER BY id LIMIT 1",
      [this.companyId],
    );
    if (!warehouse) throw new ValidationError("No warehouse exists to put the stock in.");

    const inScopeIds = plan.lines.map((line) => line.itemId);
    const placeholders = inScopeIds.map(() => "?").join(",");
    const movements = await this.db.all<MovementRow>(
      `SELECT * FROM stock_movements WHERE item_id IN (${placeholders}) ORDER BY id`,
      inScopeIds,
    );
    const maxMovementId =
      (await this.db.get<{ id: number | null }>("SELECT MAX(id) id FROM stock_movements"))?.id ?? 0;

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const snapshotFile = resolve(
      options.snapshotDir ?? defaultSnapshotDir(),
      `inventory-rebuild-${stamp}.json`,
    );
    const createdBatchIds: number[] = [];

    return this.db.transaction(async (tx) => {
      const accounting = new AccountingService(tx);

      const inserted = await tx.run(
        `INSERT INTO inventory_rebuilds (company_id, from_date, to_date, snapshot_file, reason, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          this.companyId,
          plan.from,
          plan.to,
          snapshotFile,
          `Inventory rebuilt from documents ${plan.from}..${plan.to}` +
            (plan.keepOpening ? " (opening stock included)" : " (October ignored)"),
          options.createdBy ?? null,
        ],
      );
      const rebuildId = Number(inserted.lastInsertRowid);

      let changedItems = 0;

      for (const line of plan.lines) {
        const itemBatches = batchesByItem.get(line.itemId) ?? [];
        const canonical = itemBatches[0];

        if (!canonical) {
          if (line.target === 0) continue;
          const result = await tx.run(
            `INSERT INTO stock_batches
               (item_id, warehouse_id, batch_number, purchase_price, raw_unit_cost,
                packing_unit_cost, quantity_in_stock, received_date, is_active)
             VALUES (?, ?, ?, ?, 0, 0, ?, ?, 1)`,
            [
              line.itemId,
              warehouse.id,
              `RBLD-${line.itemCode}`,
              line.unitCost,
              line.target,
              plan.from,
            ],
          );
          const batchId = Number(result.lastInsertRowid);
          createdBatchIds.push(batchId);
          await tx.run(
            `INSERT INTO inventory_rebuild_lines
               (rebuild_id, item_id, batch_id, quantity_before, quantity_after, unit_cost, value_before, value_after)
             VALUES (?, ?, ?, 0, ?, ?, 0, ?)`,
            [rebuildId, line.itemId, batchId, line.target, line.unitCost, line.value],
          );
          changedItems += 1;
          continue;
        }

        let remaining = line.target;
        for (let index = 0; index < itemBatches.length; index += 1) {
          const batch = itemBatches[index]!;
          const after = index === 0 ? remaining : 0;
          remaining = round4(remaining - after);
          const before = Number(batch.quantity_in_stock);
          if (Math.abs(before - after) < 1e-9) continue;
          await tx.run("UPDATE stock_batches SET quantity_in_stock = ? WHERE id = ?", [after, batch.id]);
          // One cost per item on the batch the rebuild keeps, so the batch
          // valuation and the journal post the same number by construction.
          if (index === 0) {
            await tx.run(
              "UPDATE stock_batches SET purchase_price = ?, raw_unit_cost = 0, packing_unit_cost = 0 WHERE id = ?",
              [line.unitCost, batch.id],
            );
          }
          const batchCost =
            Number(batch.raw_unit_cost) + Number(batch.packing_unit_cost) > 0
              ? Number(batch.raw_unit_cost) + Number(batch.packing_unit_cost)
              : Number(batch.purchase_price) || line.unitCost;
          await tx.run(
            `INSERT INTO inventory_rebuild_lines
               (rebuild_id, item_id, batch_id, quantity_before, quantity_after, unit_cost, value_before, value_after)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              rebuildId,
              line.itemId,
              batch.id,
              before,
              after,
              batchCost,
              money(before * batchCost),
              money(after * batchCost),
            ],
          );
          changedItems += 1;
        }
      }

      // The movement ledger is regenerated for these items, so on-hand and
      // SUM(stock_movements) agree by construction instead of drifting apart.
      await tx.run(`DELETE FROM stock_movements WHERE item_id IN (${placeholders})`, inScopeIds);
      for (const line of plan.lines) {
        if (line.target === 0) continue;
        const itemBatches = batchesByItem.get(line.itemId) ?? [];
        const batchId =
          itemBatches[0]?.id ??
          (await tx.get<{ id: number }>(
            "SELECT id FROM stock_batches WHERE item_id = ? ORDER BY id DESC LIMIT 1",
            [line.itemId],
          ))?.id;
        if (batchId == null) throw new ValidationError(`${line.itemCode}: no batch to attach the movement to.`);
        await tx.run(
          `INSERT INTO stock_movements
             (item_id, batch_id, warehouse_id, movement_type, quantity, unit_cost,
              reference_table, reference_id, movement_date, notes, created_by)
           VALUES (?, ?, ?, 'OPENING', ?, ?, ?, ?, ?, ?, ?)`,
          [
            line.itemId,
            batchId,
            itemBatches[0]?.warehouse_id ?? warehouse.id,
            line.target,
            line.unitCost,
            MOVE_REF,
            rebuildId,
            plan.from,
            `Inventory rebuilt from documents ${plan.from}..${plan.to} (#${rebuildId})`,
            options.createdBy ?? null,
          ],
        );
      }

      // Value difference, per inventory account, against COGS: the rebuild says
      // what consumption actually was, so that is the account it belongs to.
      const net = money(plan.accounts.reduce((sum, account) => sum + account.delta, 0));
      const lines: JournalLineInput[] = [];
      for (const account of plan.accounts) {
        if (Math.abs(account.delta) < 0.01) continue;
        lines.push({
          accountId: account.accountId,
          ...(account.delta > 0 ? { debit: account.delta } : { credit: -account.delta }),
          description: `Inventory rebuilt — ${account.type}`,
        });
      }
      if (Math.abs(net) >= 0.01) {
        if (plan.cogsAccountId == null) throw new ValidationError(`Account ${COGS} is missing.`);
        lines.push({
          accountId: plan.cogsAccountId,
          ...(net > 0 ? { credit: net } : { debit: -net }),
          description: `Inventory rebuilt — consumption ${plan.from}..${plan.to}`,
        });
      }

      let journalEntryId: number | null = null;
      if (lines.length >= 2) {
        journalEntryId = await accounting.postJournalEntry({
          voucherType: "JOURNAL",
          entryDate: plan.to,
          narration: `Inventory rebuilt from documents ${plan.from}..${plan.to}`,
          referenceNo: `INVENTORY-REBUILD-${rebuildId}`,
          sourceTable: "inventory_rebuilds",
          sourceId: rebuildId,
          lines,
        });
        await tx.run("UPDATE inventory_rebuilds SET journal_entry_id = ? WHERE id = ?", [
          journalEntryId,
          rebuildId,
        ]);
      }

      // --- verification: every item, inside the transaction -------------------
      const problems: string[] = [];
      for (const line of plan.lines) {
        const batch = await tx.get<{ qty: number }>(
          "SELECT ROUND(COALESCE(SUM(quantity_in_stock), 0), 4) qty FROM stock_batches WHERE item_id = ?",
          [line.itemId],
        );
        const movement = await tx.get<{ qty: number }>(
          "SELECT ROUND(COALESCE(SUM(quantity), 0), 4) qty FROM stock_movements WHERE item_id = ?",
          [line.itemId],
        );
        if (Math.abs(Number(batch?.qty ?? 0) - line.target) > 0.0001) {
          problems.push(`${line.itemCode}: batches ${batch?.qty} vs target ${line.target}`);
        }
        if (Math.abs(Number(movement?.qty ?? 0) - line.target) > 0.0001) {
          problems.push(`${line.itemCode}: movements ${movement?.qty} vs target ${line.target}`);
        }
      }
      if (problems.length > 0) {
        throw new ValidationError(`Verification failed, rolled back:\n  ${problems.slice(0, 20).join("\n  ")}`);
      }

      await tx.run(
        "UPDATE inventory_rebuilds SET item_count = ?, total_quantity = ?, total_value = ? WHERE id = ?",
        [plan.totals.items, plan.totals.quantity, plan.totals.value, rebuildId],
      );

      // Snapshot of the state this run replaced, written last so it can only be
      // read on a database that committed.
      const snapshot: Snapshot = {
        companyId: this.companyId,
        from: plan.from,
        to: plan.to,
        createdAt: new Date().toISOString(),
        maxMovementId,
        batches,
        createdBatchIds,
        movements,
      };
      mkdirSync(dirname(snapshotFile), { recursive: true });
      writeFileSync(snapshotFile, JSON.stringify(snapshot), "utf8");

      return {
        rebuildId,
        journalEntryId,
        itemCount: plan.totals.items,
        changedItems,
        totalQuantity: plan.totals.quantity,
        totalValue: plan.totals.value,
        valueDelta: net,
        snapshotFile,
      };
    });
  }

  /** Put everything back exactly as it was before rebuild `rebuildId`. */
  async restore(rebuildId: number, restoredBy: number | null = null): Promise<{ ok: true; batches: number }> {
    await this.ensureTables();
    const rebuild = await this.db.get<RebuildRow>(
      "SELECT * FROM inventory_rebuilds WHERE id = ? AND company_id = ?",
      [rebuildId, this.companyId],
    );
    if (!rebuild) throw new NotFoundError(`Rebuild ${rebuildId} not found.`);
    if (rebuild.restored_at) throw new ValidationError(`Rebuild ${rebuildId} was already restored on ${rebuild.restored_at}.`);

    const later = await this.db.get<{ id: number }>(
      `SELECT id FROM inventory_rebuilds
        WHERE company_id = ? AND id > ? AND restored_at IS NULL ORDER BY id LIMIT 1`,
      [this.companyId, rebuildId],
    );
    if (later) {
      throw new ConflictError(
        `Rebuild #${later.id} came after #${rebuildId}. Restore the newest one first.`,
      );
    }
    if (!rebuild.snapshot_file) throw new ValidationError("This rebuild has no snapshot file to restore from.");

    const snapshot: Snapshot = JSON.parse(readFileSync(rebuild.snapshot_file, "utf8")) as Snapshot;

    const lines = await this.db.all<{
      item_id: number;
      batch_id: number;
      quantity_before: number;
    }>("SELECT item_id, batch_id, quantity_before FROM inventory_rebuild_lines WHERE rebuild_id = ?", [
      rebuildId,
    ]);

    return this.db.transaction(async (tx) => {
      // Refuse if new stock work happened on these items since the rebuild:
      // replaying the old ledger would erase it.
      const newer = await tx.get<{ n: number }>(
        `SELECT COUNT(*) n FROM stock_movements
          WHERE id > ? AND reference_table IS NOT ? AND item_id IN
                (SELECT item_id FROM inventory_rebuild_lines WHERE rebuild_id = ?)`,
        [snapshot.maxMovementId, MOVE_REF, rebuildId],
      );
      if (Number(newer?.n ?? 0) > 0) {
        throw new ConflictError(
          `${newer?.n} stock movements were recorded after this rebuild. ` +
            "Undo those documents first, or take a fresh snapshot instead of restoring.",
        );
      }

      // Drop what the rebuild generated, then replay the snapshot.
      await tx.run("DELETE FROM stock_movements WHERE reference_table = ? AND reference_id = ?", [
        MOVE_REF,
        rebuildId,
      ]);
      for (const movement of snapshot.movements) {
        await tx.run(
          `INSERT INTO stock_movements
             (item_id, batch_id, warehouse_id, movement_type, quantity, unit_cost,
              reference_table, reference_id, movement_date, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            movement.item_id,
            movement.batch_id,
            movement.warehouse_id,
            movement.movement_type,
            movement.quantity,
            movement.unit_cost,
            movement.reference_table,
            movement.reference_id,
            movement.movement_date,
            movement.notes,
            movement.created_by,
          ],
        );
      }

      for (const line of lines) {
        await tx.run("UPDATE stock_batches SET quantity_in_stock = ? WHERE id = ?", [
          line.quantity_before,
          line.batch_id,
        ]);
      }
      for (const batchId of snapshot.createdBatchIds) {
        await tx.run("DELETE FROM stock_batches WHERE id = ?", [batchId]);
      }

      if (rebuild.journal_entry_id != null) {
        const original = await tx.all<{
          account_id: number;
          debit: number;
          credit: number;
          description: string | null;
        }>(
          "SELECT account_id, debit, credit, description FROM journal_entry_lines WHERE journal_entry_id = ? ORDER BY id",
          [rebuild.journal_entry_id],
        );
        if (original.length > 0) {
          await new AccountingService(tx).postJournalEntry({
            voucherType: "JOURNAL",
            entryDate: new Date().toISOString().slice(0, 10),
            narration: `Reversal - inventory rebuild #${rebuildId}`,
            referenceNo: `REV-INVENTORY-REBUILD-${rebuildId}`,
            sourceTable: "inventory_rebuilds",
            sourceId: rebuildId,
            lines: original.map((line) => ({
              accountId: Number(line.account_id),
              ...(Number(line.credit) > 0
                ? { debit: Number(line.credit) }
                : { credit: Number(line.debit) }),
              description: `Reversal - ${line.description ?? ""}`.trim(),
            })),
          });
        }
      }

      await tx.run(
        "UPDATE inventory_rebuilds SET restored_at = datetime('now'), restored_by = ? WHERE id = ?",
        [restoredBy, rebuildId],
      );
      return { ok: true as const, batches: lines.length };
    });
  }
}
