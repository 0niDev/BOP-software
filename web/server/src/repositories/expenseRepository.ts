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
  /** Legacy: category of a pre-account expense (the category system is retired). */
  category_id: number | null;
  /** COA account the expense posts Dr to (level-4 leaf or childless header). */
  account_id: number | null;
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
  category_name: string | null;
  /** Ledger posting, resolved for display: e.account_id, else legacy category account, else 6000. */
  ledger_code: string;
  ledger_name: string;
}

export class ExpenseRepository {
  constructor(private readonly db: SqlDatabase) {}

  /** Only used to resolve legacy audit payloads (restore of pre-account deletes). */
  async findCategoryById(id: number): Promise<ExpenseCategoryRow | undefined> {
    return this.db.get<ExpenseCategoryRow>("SELECT * FROM expense_categories WHERE id = ?", [id]);
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

  async listExpenses(companyId = 1, limit = 200): Promise<ExpenseListRow[]> {
    return this.db.all<ExpenseListRow>(
      `SELECT e.*, c.name AS category_name,
              COALESCE(a.account_code, ca.account_code, '6000') AS ledger_code,
              COALESCE(a.account_name, ca.account_name,
                       (SELECT account_name FROM accounts
                         WHERE account_code = '6000' AND company_id = e.company_id)) AS ledger_name
         FROM expenses e
         LEFT JOIN expense_categories c ON c.id = e.category_id
         LEFT JOIN accounts a ON a.id = e.account_id
         LEFT JOIN accounts ca ON ca.id = c.account_id
        WHERE e.company_id = ?
        ORDER BY e.expense_date DESC, e.id DESC LIMIT ?`,
      [companyId, limit],
    );
  }
}
