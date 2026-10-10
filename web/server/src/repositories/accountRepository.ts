import type { SqlDatabase } from "../db/types.js";
import type { AccountType } from "../domain/enums.js";
import { isDebitNormal } from "../domain/enums.js";
import { NotFoundError } from "../domain/errors.js";
import { round2 } from "../domain/money.js";
import { insertRow, type InsertData } from "./base.js";

export interface AccountRow {
  id: number;
  company_id: number;
  account_code: string;
  account_name: string;
  parent_account_id: number | null;
  account_type: AccountType;
  account_subtype: string | null;
  opening_balance: number;
  is_system_account: number;
  is_active: number;
  created_at: string;
}

export class AccountRepository {
  constructor(private readonly db: SqlDatabase) {}

  async findByCode(code: string, companyId = 1): Promise<AccountRow | undefined> {
    return this.db.get<AccountRow>(
      "SELECT * FROM accounts WHERE account_code = ? AND company_id = ?",
      [code, companyId],
    );
  }

  async requireByCode(code: string, companyId = 1): Promise<AccountRow> {
    const account = await this.findByCode(code, companyId);
    if (!account) {
      throw new NotFoundError(`Account '${code}' not found for company ${companyId}.`);
    }
    return account;
  }

  async findById(id: number): Promise<AccountRow | undefined> {
    return this.db.get<AccountRow>("SELECT * FROM accounts WHERE id = ?", [id]);
  }

  async listForCompany(companyId = 1, activeOnly = true): Promise<AccountRow[]> {
    const sql =
      "SELECT * FROM accounts WHERE company_id = ?" +
      (activeOnly ? " AND is_active = 1" : "") +
      " ORDER BY account_code";
    return this.db.all<AccountRow>(sql, [companyId]);
  }

  /**
   * Current balance from posted journal lines only. `opening_balance` is a
   * display field and is deliberately not added (the Python app posts every
   * opening balance as its own OPENING journal entry, so adding it would
   * double-count).
   */
  async getCurrentBalance(accountId: number): Promise<number> {
    const account = await this.findById(accountId);
    if (!account) throw new NotFoundError(`Account ${accountId} not found.`);
    const totals = await this.db.get<{ total_debit: number; total_credit: number }>(
      `SELECT COALESCE(SUM(debit), 0) AS total_debit,
              COALESCE(SUM(credit), 0) AS total_credit
       FROM journal_entry_lines jel
       JOIN journal_entries je ON je.id = jel.journal_entry_id
       WHERE jel.account_id = ? AND je.is_posted = 1`,
      [accountId],
    );
    const debit = Number(totals?.total_debit ?? 0);
    const credit = Number(totals?.total_credit ?? 0);
    const balance = isDebitNormal(account.account_type) ? debit - credit : credit - debit;
    return round2(balance).toNumber();
  }

  /** Direct sub-accounts, used to block deactivating a parent with active children. */
  async findChildren(parentAccountId: number): Promise<AccountRow[]> {
    return this.db.all<AccountRow>(
      "SELECT * FROM accounts WHERE parent_account_id = ? ORDER BY account_code",
      [parentAccountId],
    );
  }

  async update(id: number, data: InsertData): Promise<void> {
    const cols = Object.keys(data);
    if (cols.length === 0) return;
    await this.db.run(
      `UPDATE accounts SET ${cols.map((col) => `${col} = ?`).join(", ")} WHERE id = ?`,
      [...cols.map((col) => data[col] ?? null), id],
    );
  }

  async deactivate(id: number): Promise<void> {
    await this.db.run("UPDATE accounts SET is_active = 0 WHERE id = ?", [id]);
  }

  async codeExists(code: string, companyId = 1): Promise<boolean> {
    const row = await this.db.get<{ id: number }>(
      "SELECT id FROM accounts WHERE account_code = ? AND company_id = ?",
      [code, companyId],
    );
    return row !== undefined;
  }

  async insert(data: InsertData): Promise<number> {
    return insertRow(this.db, "accounts", data);
  }
}
