/**
 * Reversible "zero out the stock ledger".
 *
 * Zeroing sets every batch quantity to 0 but first records the exact quantity
 * (and cost) each batch held, so the whole reset can be undone later with a
 * delta update. Deliberately stock-only: no journal entry is posted, because
 * the accounting side of a stock rewrite is a separate, dated adjustment the
 * operator has to make explicitly. The reset header keeps the name of the
 * database snapshot taken immediately before it ran.
 */
import type { SqlDatabase } from "../db/types.js";
import { NotFoundError, ValidationError } from "../domain/errors.js";
import { Decimal, dec, round2, toQuantity, toStorage } from "../domain/money.js";
import {
  StockLedgerRepository,
  type StockLedgerResetRow,
} from "../repositories/stockLedgerRepository.js";

export interface ZeroStockLedgerInput {
  reason?: string | null;
  createdBy?: number | null;
  /** Snapshot written just before the reset (the route owns the backup service). */
  snapshotFile?: string | null;
}

export interface ZeroStockLedgerResult {
  resetId: number;
  batchCount: number;
  totalQuantity: number;
  totalValue: number;
  snapshotFile: string | null;
}

export interface RestoreStockLedgerResult {
  resetId: number;
  batchCount: number;
  restoredAt: string;
}

export class StockLedgerService {
  private readonly resets: StockLedgerRepository;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.resets = new StockLedgerRepository(db);
  }

  /** Reset history, newest first. */
  async list(): Promise<StockLedgerResetRow[]> {
    return this.resets.list(this.companyId);
  }

  /** Zero every batch quantity, recording what was removed so it can be undone. */
  async zero(input: ZeroStockLedgerInput = {}): Promise<ZeroStockLedgerResult> {
    const batches = await this.resets.listBatches(this.companyId);
    if (batches.length === 0) {
      throw new ValidationError("Every stock batch is already at zero.");
    }

    let totalQuantity = new Decimal(0);
    let totalValue = new Decimal(0);
    for (const batch of batches) {
      const quantity = dec(batch.quantity);
      totalQuantity = totalQuantity.plus(quantity);
      totalValue = totalValue.plus(quantity.times(dec(batch.unit_cost)));
    }
    const reason = input.reason?.trim() ? input.reason.trim() : null;

    return this.db.transaction(async () => {
      const resetId = await this.resets.insertReset({
        company_id: this.companyId,
        reason,
        batch_count: batches.length,
        total_quantity: toQuantity(totalQuantity),
        total_value: toStorage(round2(totalValue)),
        snapshot_file: input.snapshotFile ?? null,
        created_by: input.createdBy ?? null,
      });
      for (const batch of batches) {
        await this.resets.insertLine(resetId, batch);
        await this.db.run("UPDATE stock_batches SET quantity_in_stock = 0 WHERE id = ?", [
          batch.batch_id,
        ]);
        // Offset the batch in the movement ledger too, otherwise on-hand and
        // SUM(stock_movements) disagree for every batch this reset touched.
        await this.resets.insertAdjustment({
          itemId: batch.item_id,
          batchId: batch.batch_id,
          warehouseId: batch.warehouse_id,
          quantity: -batch.quantity,
          unitCost: batch.unit_cost,
          resetId,
          notes: `Stock ledger zeroed (reset #${resetId})`,
          createdBy: input.createdBy ?? null,
        });
      }
      return {
        resetId,
        batchCount: batches.length,
        totalQuantity: toQuantity(totalQuantity),
        totalValue: toStorage(round2(totalValue)),
        snapshotFile: input.snapshotFile ?? null,
      };
    });
  }

  /**
   * Undo a reset by adding each batch's recorded quantity back (a delta, so it
   * is the exact inverse of the zero). Stock added after the reset lives in
   * other batches and is untouched — but it does mean a restore after loading
   * new stock counts the old batches again, which the UI warns about.
   */
  async restore(
    resetId: number,
    restoredBy: number | null = null,
  ): Promise<RestoreStockLedgerResult> {
    const reset = await this.resets.findById(resetId, this.companyId);
    if (!reset) throw new NotFoundError(`Stock ledger reset ${resetId} not found.`);
    if (reset.restored_at) {
      throw new ValidationError(`This reset was already restored on ${reset.restored_at}.`);
    }
    const lines = await this.resets.lines(resetId);
    if (lines.length === 0) {
      throw new ValidationError("This reset has no batch lines to restore.");
    }

    return this.db.transaction(async () => {
      for (const line of lines) {
        await this.db.run(
          "UPDATE stock_batches SET quantity_in_stock = quantity_in_stock + ? WHERE id = ?",
          [line.quantity, line.batch_id],
        );
        await this.resets.insertAdjustment({
          itemId: line.item_id,
          batchId: line.batch_id,
          warehouseId: line.warehouse_id,
          quantity: line.quantity,
          unitCost: line.unit_cost,
          resetId,
          notes: `Stock ledger restored (reset #${resetId})`,
          createdBy: restoredBy,
        });
      }
      const updated = await this.resets.markRestored(resetId, this.companyId, restoredBy);
      return {
        resetId,
        batchCount: lines.length,
        restoredAt: updated?.restored_at ?? "",
      };
    });
  }
}
