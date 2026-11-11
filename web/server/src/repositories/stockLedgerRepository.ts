import type { SqlDatabase } from "../db/types.js";
import { insertRow } from "./base.js";

export interface StockLedgerResetRow {
  id: number;
  company_id: number;
  reason: string | null;
  batch_count: number;
  total_quantity: number;
  total_value: number;
  snapshot_file: string | null;
  created_by: number | null;
  created_at: string;
  restored_at: string | null;
  restored_by: number | null;
}

/** One batch as it stood when a reset zeroed it. */
export interface StockLedgerBatchRow {
  batch_id: number;
  item_id: number;
  warehouse_id: number;
  quantity: number;
  unit_cost: number;
}

export interface NewStockLedgerReset {
  company_id: number;
  reason: string | null;
  batch_count: number;
  total_quantity: number;
  total_value: number;
  snapshot_file: string | null;
  created_by: number | null;
}

/** Storage for reversible stock-ledger resets. */
export class StockLedgerRepository {
  constructor(private readonly db: SqlDatabase) {}

  /**
   * Every batch in the company that still carries stock. The unit cost uses the
   * same `raw + packing, else purchase price` expression as the COGS code and the
   * inventory tag report, so the reset value agrees with the books' valuation.
   */
  async listBatches(companyId: number): Promise<StockLedgerBatchRow[]> {
    return this.db.all<StockLedgerBatchRow>(
      `SELECT sb.id AS batch_id,
              sb.item_id,
              sb.warehouse_id,
              sb.quantity_in_stock AS quantity,
              CASE WHEN (sb.raw_unit_cost + sb.packing_unit_cost) > 0
                   THEN sb.raw_unit_cost + sb.packing_unit_cost
                   ELSE sb.purchase_price END AS unit_cost
         FROM stock_batches sb
         JOIN items i ON i.id = sb.item_id
        WHERE i.company_id = ? AND sb.is_active = 1 AND sb.quantity_in_stock <> 0
        ORDER BY sb.id`,
      [companyId],
    );
  }

  async insertReset(input: NewStockLedgerReset): Promise<number> {
    return insertRow(this.db, "stock_ledger_resets", {
      company_id: input.company_id,
      reason: input.reason,
      batch_count: input.batch_count,
      total_quantity: input.total_quantity,
      total_value: input.total_value,
      snapshot_file: input.snapshot_file,
      created_by: input.created_by,
    });
  }

  async insertLine(resetId: number, batch: StockLedgerBatchRow): Promise<void> {
    await insertRow(this.db, "stock_ledger_reset_lines", {
      reset_id: resetId,
      batch_id: batch.batch_id,
      item_id: batch.item_id,
      quantity: batch.quantity,
      unit_cost: batch.unit_cost,
    });
  }

  async list(companyId: number): Promise<StockLedgerResetRow[]> {
    return this.db.all<StockLedgerResetRow>(
      "SELECT * FROM stock_ledger_resets WHERE company_id = ? ORDER BY id DESC",
      [companyId],
    );
  }

  async findById(id: number, companyId: number): Promise<StockLedgerResetRow | undefined> {
    return this.db.get<StockLedgerResetRow>(
      "SELECT * FROM stock_ledger_resets WHERE id = ? AND company_id = ?",
      [id, companyId],
    );
  }

  async lines(resetId: number): Promise<StockLedgerBatchRow[]> {
    return this.db.all<StockLedgerBatchRow>(
      `SELECT l.batch_id,
              l.item_id,
              sb.warehouse_id,
              l.quantity,
              l.unit_cost
         FROM stock_ledger_reset_lines l
         JOIN stock_batches sb ON sb.id = l.batch_id
        WHERE l.reset_id = ?
        ORDER BY l.id`,
      [resetId],
    );
  }

  /**
   * A quantity change must also reach the movement ledger: on-hand stock is
   * expected to equal SUM(stock_movements) for every item, and a reset that only
   * edits batches would leave the two disagreeing forever.
   */
  async insertAdjustment(input: {
    itemId: number;
    batchId: number;
    warehouseId: number;
    quantity: number;
    unitCost: number;
    resetId: number;
    notes: string;
    createdBy: number | null;
  }): Promise<void> {
    await insertRow(this.db, "stock_movements", {
      item_id: input.itemId,
      batch_id: input.batchId,
      warehouse_id: input.warehouseId,
      movement_type: "ADJUSTMENT",
      quantity: input.quantity,
      unit_cost: input.unitCost,
      reference_table: "stock_ledger_resets",
      reference_id: input.resetId,
      notes: input.notes,
      created_by: input.createdBy,
    });
  }

  /** Stamp the reset as undone; returns the stamped row. */
  async markRestored(
    id: number,
    companyId: number,
    restoredBy: number | null,
  ): Promise<StockLedgerResetRow | undefined> {
    await this.db.run(
      "UPDATE stock_ledger_resets SET restored_at = datetime('now'), restored_by = ? WHERE id = ? AND company_id = ?",
      [restoredBy, id, companyId],
    );
    return this.findById(id, companyId);
  }
}
