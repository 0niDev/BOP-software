import type { SqlDatabase } from "../db/types.js";
import { insertRow, type InsertData } from "./base.js";

export interface BankAccountRow {
  id: number;
  company_id: number;
  account_id: number;
  bank_name: string;
  account_title: string;
  account_number: string;
  branch_code: string | null;
  iban: string | null;
  opening_balance: number;
  is_active: number;
  created_at: string;
}

export interface BankTransactionRow {
  id: number;
  bank_account_id: number;
  transaction_type: string;
  amount: number;
  transaction_date: string;
  reference_no: string | null;
  notes: string | null;
  journal_entry_id: number | null;
  created_at: string;
}

export interface ChequeRow {
  id: number;
  company_id: number;
  bank_account_id: number;
  party_id: number | null;
  cheque_number: string;
  cheque_type: "ISSUED" | "RECEIVED";
  amount: number;
  cheque_date: string;
  status: string;
  cleared_date: string | null;
  notes: string | null;
}

export class BankingRepository {
  constructor(private readonly db: SqlDatabase) {}

  async findBankAccountByNumber(
    accountNumber: string,
    companyId = 1,
  ): Promise<BankAccountRow | undefined> {
    return this.db.get<BankAccountRow>(
      "SELECT * FROM bank_accounts WHERE account_number = ? AND company_id = ?",
      [accountNumber, companyId],
    );
  }

  async insertBankAccount(data: InsertData): Promise<number> {
    return insertRow(this.db, "bank_accounts", data);
  }

  async findBankAccountById(id: number): Promise<BankAccountRow | undefined> {
    return this.db.get<BankAccountRow>("SELECT * FROM bank_accounts WHERE id = ?", [id]);
  }

  async listBankAccounts(companyId = 1): Promise<BankAccountRow[]> {
    return this.db.all<BankAccountRow>(
      "SELECT * FROM bank_accounts WHERE company_id = ? AND is_active = 1 ORDER BY bank_name",
      [companyId],
    );
  }

  async insertTransaction(data: InsertData): Promise<number> {
    return insertRow(this.db, "bank_transactions", data);
  }

  async listTransactions(companyId = 1, limit = 200): Promise<BankTransactionRow[]> {
    return this.db.all<BankTransactionRow>(
      `SELECT bt.* FROM bank_transactions bt
       JOIN bank_accounts ba ON ba.id = bt.bank_account_id
       WHERE ba.company_id = ?
       ORDER BY bt.transaction_date DESC, bt.id DESC LIMIT ?`,
      [companyId, limit],
    );
  }

  async insertCheque(data: InsertData): Promise<number> {
    return insertRow(this.db, "cheques", data);
  }

  async findChequeById(id: number): Promise<ChequeRow | undefined> {
    return this.db.get<ChequeRow>("SELECT * FROM cheques WHERE id = ?", [id]);
  }

  async listCheques(companyId = 1, status?: string): Promise<ChequeRow[]> {
    return this.db.all<ChequeRow>(
      "SELECT * FROM cheques WHERE company_id = ?" +
        (status ? " AND status = ?" : "") +
        " ORDER BY cheque_date DESC, id DESC LIMIT 200",
      status ? [companyId, status] : [companyId],
    );
  }

  async updateCheque(id: number, data: InsertData): Promise<void> {
    const cols = Object.keys(data);
    if (cols.length === 0) return;
    const assignments = cols.map((c) => `${c} = ?`).join(", ");
    await this.db.run(`UPDATE cheques SET ${assignments} WHERE id = ?`, [
      ...cols.map((c) => data[c] ?? null),
      id,
    ]);
  }
}
