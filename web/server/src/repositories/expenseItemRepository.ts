import type { SqlDatabase } from "../db/types.js";
import { NotFoundError } from "../domain/errors.js";
import { insertRow, type InsertData } from "./base.js";

export type ExpenseFrequency = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";

export interface ExpenseItemRow {
  id: number;
  company_id: number;
  category_id: number;
  name: string;
  amount: number | null;
  frequency: ExpenseFrequency | null;
  next_run_date: string | null;
  is_active: number;
  created_at: string;
  updated_at: string | null;
}

export class ExpenseItemRepository {
  constructor(private readonly db: SqlDatabase) {}

  async findById(id: number): Promise<ExpenseItemRow | undefined> {
    return this.db.get<ExpenseItemRow>("SELECT * FROM expense_items WHERE id = ?", [id]);
  }

  async requireById(id: number): Promise<ExpenseItemRow> {
    const item = await this.findById(id);
    if (!item) throw new NotFoundError(`Expense item ${id} not found.`);
    return item;
  }

  async list(
    companyId = 1,
    opts: { categoryId?: number; activeOnly?: boolean } = {},
  ): Promise<ExpenseItemRow[]> {
    let sql = "SELECT * FROM expense_items WHERE company_id = ?";
    const params: Array<string | number> = [companyId];
    if (opts.categoryId != null) {
      sql += " AND category_id = ?";
      params.push(opts.categoryId);
    }
    if (opts.activeOnly !== false) sql += " AND is_active = 1";
    sql += " ORDER BY name";
    return this.db.all<ExpenseItemRow>(sql, params);
  }

  async findByName(categoryId: number, name: string, companyId = 1): Promise<ExpenseItemRow | undefined> {
    return this.db.get<ExpenseItemRow>(
      "SELECT * FROM expense_items WHERE company_id = ? AND category_id = ? AND name = ?",
      [companyId, categoryId, name],
    );
  }

  /** Active recurring items whose next bill is due on or before `onDate`. */
  async listDue(companyId: number, onDate: string): Promise<ExpenseItemRow[]> {
    return this.db.all<ExpenseItemRow>(
      `SELECT * FROM expense_items
        WHERE company_id = ? AND is_active = 1
          AND frequency IS NOT NULL AND next_run_date IS NOT NULL
          AND next_run_date <= ?
          AND EXISTS (
            SELECT 1 FROM expense_categories c
             WHERE c.id = expense_items.category_id AND c.is_active = 1
          )
        ORDER BY next_run_date, id`,
      [companyId, onDate],
    );
  }

  async insert(data: InsertData): Promise<number> {
    return insertRow(this.db, "expense_items", data);
  }

  async update(id: number, data: InsertData): Promise<void> {
    const cols = Object.keys(data);
    if (cols.length === 0) return;
    await this.db.run(
      `UPDATE expense_items SET ${cols.map((col) => `${col} = ?`).join(", ")} WHERE id = ?`,
      [...cols.map((col) => data[col] ?? null), id],
    );
  }

  async deactivate(id: number): Promise<void> {
    await this.db.run("UPDATE expense_items SET is_active = 0 WHERE id = ?", [id]);
  }
}
