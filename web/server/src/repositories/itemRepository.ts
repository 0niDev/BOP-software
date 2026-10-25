import type { SqlDatabase } from "../db/types.js";
import { NotFoundError } from "../domain/errors.js";
import type { ItemType } from "../domain/enums.js";
import { insertRow, type InsertData } from "./base.js";

/** An item row plus its on-hand quantity (the list view's stock column). */
export interface ItemListRow extends ItemRow {
  current_stock: number;
}

export interface ItemRow {
  id: number;
  company_id: number;
  item_code: string;
  item_name: string;
  generic_name: string | null;
  formula: string | null;
  strength: string | null;
  dosage_form: string | null;
  unit: string;
  manufacturer: string | null;
  category_id: number | null;
  item_type: ItemType;
  purchase_price: number;
  selling_price: number;
  minimum_stock: number;
  maximum_stock: number;
  tax_rate_id: number | null;
  notes: string | null;
  is_active: number;
  created_at: string;
}

export class ItemRepository {
  constructor(private readonly db: SqlDatabase) {}

  async findById(id: number): Promise<ItemRow | undefined> {
    return this.db.get<ItemRow>("SELECT * FROM items WHERE id = ?", [id]);
  }

  async requireById(id: number): Promise<ItemRow> {
    const item = await this.findById(id);
    if (!item) throw new NotFoundError(`Item ${id} not found.`);
    return item;
  }

  async findByCode(code: string, companyId = 1): Promise<ItemRow | undefined> {
    return this.db.get<ItemRow>(
      "SELECT * FROM items WHERE item_code = ? AND company_id = ?",
      [code, companyId],
    );
  }

  /** First item with this exact name (names are not unique, unlike codes). */
  async findByName(name: string, companyId = 1): Promise<ItemRow | undefined> {
    return this.db.get<ItemRow>(
      "SELECT * FROM items WHERE item_name = ? AND company_id = ? ORDER BY id LIMIT 1",
      [name, companyId],
    );
  }

  /**
   * Items with their on-hand quantity. The stock figure is the sum of the
   * active batches' remaining quantity — the same definition the dashboard's
   * low-stock widget uses — evaluated per item so the list needs no extra
   * round trip.
   */
  async list(
    companyId = 1,
    opts: { activeOnly?: boolean; search?: string; itemType?: ItemType } = {},
  ): Promise<ItemListRow[]> {
    let sql = `
      SELECT i.*,
             COALESCE((SELECT SUM(sb.quantity_in_stock)
                         FROM stock_batches sb
                        WHERE sb.item_id = i.id AND sb.is_active = 1), 0) AS current_stock
        FROM items i
       WHERE i.company_id = ?`;
    const params: Array<string | number> = [companyId];
    if (opts.activeOnly !== false) sql += " AND i.is_active = 1";
    if (opts.itemType) {
      sql += " AND i.item_type = ?";
      params.push(opts.itemType);
    }
    if (opts.search) {
      sql += " AND (i.item_name LIKE ? OR i.item_code LIKE ?)";
      const like = `%${opts.search}%`;
      params.push(like, like);
    }
    sql += " ORDER BY i.item_name";
    return this.db.all<ItemListRow>(sql, params);
  }

  async update(id: number, data: InsertData): Promise<void> {
    const cols = Object.keys(data);
    if (cols.length === 0) return;
    await this.db.run(
      `UPDATE items SET ${cols.map((col) => `${col} = ?`).join(", ")} WHERE id = ?`,
      [...cols.map((col) => data[col] ?? null), id],
    );
  }

  async deactivate(id: number): Promise<void> {
    await this.db.run("UPDATE items SET is_active = 0 WHERE id = ?", [id]);
  }

  async insert(data: InsertData): Promise<number> {
    return insertRow(this.db, "items", data);
  }
}
