import type { SqlDatabase } from "../db/types.js";
import { insertRow, type InsertData } from "./base.js";

export interface StockBatchRow {
  id: number;
  item_id: number;
  warehouse_id: number;
  batch_number: string;
  manufacturing_date: string | null;
  expiry_date: string | null;
  purchase_price: number;
  raw_unit_cost: number;
  packing_unit_cost: number;
  quantity_in_stock: number;
  received_date: string;
  is_active: number;
  created_at: string;
}

export class StockBatchRepository {
  constructor(private readonly db: SqlDatabase) {}

  /**
   * Batches with available stock for an item, oldest first (FIFO). Batches
   * with an expiry date sort before those without, so the soonest-to-expire
   * stock leaves the warehouse first.
   */
  async listAvailableFifo(itemId: number, warehouseId: number): Promise<StockBatchRow[]> {
    return this.db.all<StockBatchRow>(
      `SELECT * FROM stock_batches
       WHERE item_id = ? AND warehouse_id = ? AND is_active = 1 AND quantity_in_stock > 0
       ORDER BY CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END,
                expiry_date, received_date, id`,
      [itemId, warehouseId],
    );
  }

  async findById(id: number): Promise<StockBatchRow | undefined> {
    return this.db.get<StockBatchRow>("SELECT * FROM stock_batches WHERE id = ?", [id]);
  }

  async getAvailableStock(itemId: number, warehouseId: number): Promise<number> {
    const row = await this.db.get<{ qty: number | null }>(
      `SELECT SUM(quantity_in_stock) AS qty FROM stock_batches
       WHERE item_id = ? AND warehouse_id = ? AND is_active = 1`,
      [itemId, warehouseId],
    );
    return Number(row?.qty ?? 0);
  }

  async findByItemAndWarehouse(
    itemId: number,
    warehouseId: number,
  ): Promise<StockBatchRow | undefined> {
    const batches = await this.listAvailableFifo(itemId, warehouseId);
    return batches[0];
  }

  async findByNumber(
    itemId: number,
    warehouseId: number,
    batchNumber: string,
  ): Promise<StockBatchRow | undefined> {
    return this.db.get<StockBatchRow>(
      `SELECT * FROM stock_batches
       WHERE item_id = ? AND warehouse_id = ? AND batch_number = ?`,
      [itemId, warehouseId, batchNumber],
    );
  }

  /** Apply a signed change to a batch's on-hand quantity. */
  async adjustQuantity(batchId: number, delta: number): Promise<void> {
    await this.db.run(
      "UPDATE stock_batches SET quantity_in_stock = quantity_in_stock + ? WHERE id = ?",
      [delta, batchId],
    );
  }

  /** Add production output to a batch and refresh its unit costs. */
  async addToBatch(
    batchId: number,
    quantity: number,
    costs: { purchasePrice: number; rawUnitCost: number; packingUnitCost: number },
  ): Promise<void> {
    await this.db.run(
      `UPDATE stock_batches
       SET quantity_in_stock = quantity_in_stock + ?,
           purchase_price = ?, raw_unit_cost = ?, packing_unit_cost = ?
       WHERE id = ?`,
      [quantity, costs.purchasePrice, costs.rawUnitCost, costs.packingUnitCost, batchId],
    );
  }

  async insert(data: InsertData): Promise<number> {
    return insertRow(this.db, "stock_batches", data);
  }
}
