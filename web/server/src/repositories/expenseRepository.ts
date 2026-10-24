import type { SqlDatabase } from "../db/types.js";
import type { PaymentMethod } from "../domain/enums.js";
import { insertRow, type InsertData } from "./base.js";

export interface ExpenseCategoryRow {
  id: number;
  company_id: number;
  name: string;
  account_id: number | null;
  is_active: number;
  created_at: string;
}

export interface ExpenseRow {
  id: number;
  company_id: number;
  voucher_number: string;
  category_id: number;
  expense_date: string;
  amount: number;
  payment_method: PaymentMethod;
  /** `UNPAID` = pay-later bill sitting on Accounts Payable. */
  status: "PAID" | "UNPAID";
  due_date: string | null;
  settlement_journal_entry_id: number | null;
  bank_account_id: number | null;
  cheque_id: number | null;
  description: string | null;
  created_by: number | null;
  created_at: string;
}

export interface ExpenseListRow extends ExpenseRow {
  category_name: string;
}

export class ExpenseRepository {
  constructor(private readonly db: SqlDatabase) {}

  async insertCategory(data: InsertData): Promise<number> {
    return insertRow(this.db, "expense_categories", data);
  }

  async findCategoryById(id: number): Promise<ExpenseCategoryRow | undefined> {
    return this.db.get<ExpenseCategoryRow>("SELECT * FROM expense_categories WHERE id = ?", [id]);
  }

  async updateCategory(id: number, data: InsertData): Promise<void> {
    const cols = Object.keys(data);
    if (cols.length === 0) return;
    await this.db.run(
      `UPDATE expense_categories SET ${cols.map((col) => `${col} = ?`).join(", ")} WHERE id = ?`,
      [...cols.map((col) => data[col] ?? null), id],
    );
  }

  async categoryNameExists(name: string, companyId = 1): Promise<boolean> {
    const row = await this.db.get<{ id: number }>(
      "SELECT id FROM expense_categories WHERE name = ? AND company_id = ?",
      [name, companyId],
    );
    return row !== undefined;
  }

  async listCategories(companyId = 1, activeOnly = true): Promise<ExpenseCategoryRow[]> {
    return this.db.all<ExpenseCategoryRow>(
      "SELECT * FROM expense_categories WHERE company_id = ?" +
        (activeOnly ? " AND is_active = 1" : "") +
        " ORDER BY name",
      [companyId],
    );
  }

  async insertExpense(data: InsertData): Promise<number> {
    return insertRow(this.db, "expenses", data);
  }

  async voucherExists(voucherNumber: string, companyId = 1): Promise<boolean> {
    const row = await this.db.get<{ id: number }>(
      "SELECT id FROM expenses WHERE company_id = ? AND voucher_number = ?",
      [companyId, voucherNumber],
    );
    return row !== undefined;
  }

  async findExpenseById(id: number): Promise<ExpenseRow | undefined> {
    return this.db.get<ExpenseRow>("SELECT * FROM expenses WHERE id = ?", [id]);
  }

  async updateExpense(id: number, data: InsertData): Promise<void> {
    const cols = Object.keys(data);
    if (cols.length === 0) return;
    const assignments = cols.map((c) => `${c} = ?`).join(", ");
    await this.db.run(`UPDATE expenses SET ${assignments} WHERE id = ?`, [
      ...cols.map((c) => data[c] ?? null),
      id,
    ]);
  }

  async deleteExpense(id: number): Promise<void> {
    await this.db.run("DELETE FROM expenses WHERE id = ?", [id]);
  }

  /** Every expense in one category, for re-posting when the category is relinked. */
  async listExpensesForCategory(companyId: number, categoryId: number): Promise<ExpenseRow[]> {
    return this.db.all<ExpenseRow>(
      "SELECT * FROM expenses WHERE company_id = ? AND category_id = ? ORDER BY id",
      [companyId, categoryId],
    );
  }

  async listExpenses(companyId = 1, limit = 200): Promise<ExpenseListRow[]> {
    return this.db.all<ExpenseListRow>(
      `SELECT e.*, c.name AS category_name
       FROM expenses e JOIN expense_categories c ON c.id = e.category_id
       WHERE e.company_id = ?
       ORDER BY e.expense_date DESC, e.id DESC LIMIT ?`,
      [companyId, limit],
    );
  }
}
