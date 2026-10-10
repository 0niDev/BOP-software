import type { Row, SqlDatabase } from "../db/types.js";
import { Decimal, toStorage } from "../domain/money.js";
import { AccountingService, type TrialBalanceRow } from "./accountingService.js";

export interface TrialBalanceResult {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

export interface ProfitAndLossResult {
  revenue: number;
  expenses: number;
  netProfit: number;
}

export interface BalanceSheetResult {
  assets: number;
  liabilities: number;
  equity: number;
  netProfit: number;
  balanced: boolean;
}

export interface LedgerEntry {
  date: string;
  voucherNumber: string;
  voucherType: string;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
}

export class ReportService {
  private readonly accounting: AccountingService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.accounting = new AccountingService(db, companyId);
  }

  async trialBalance(): Promise<TrialBalanceResult> {
    const rows = await this.accounting.getTrialBalance(this.companyId);
    const totalDebit = rows.reduce((acc, r) => acc.plus(r.debit), new Decimal(0));
    const totalCredit = rows.reduce((acc, r) => acc.plus(r.credit), new Decimal(0));
    return {
      rows,
      totalDebit: toStorage(totalDebit),
      totalCredit: toStorage(totalCredit),
      balanced: totalDebit.minus(totalCredit).abs().lessThan(new Decimal("0.01")),
    };
  }

  async profitAndLoss(): Promise<ProfitAndLossResult> {
    const rows = await this.accounting.getTrialBalance(this.companyId);
    let revenue = new Decimal(0);
    let expenses = new Decimal(0);
    for (const row of rows) {
      if (row.accountType === "REVENUE") revenue = revenue.plus(row.credit).minus(row.debit);
      if (row.accountType === "EXPENSE") expenses = expenses.plus(row.debit).minus(row.credit);
    }
    return {
      revenue: toStorage(revenue),
      expenses: toStorage(expenses),
      netProfit: toStorage(revenue.minus(expenses)),
    };
  }

  async balanceSheet(): Promise<BalanceSheetResult> {
    const rows = await this.accounting.getTrialBalance(this.companyId);
    let assets = new Decimal(0);
    let liabilities = new Decimal(0);
    let equity = new Decimal(0);
    let netProfit = new Decimal(0);
    for (const row of rows) {
      const debit = new Decimal(row.debit);
      const credit = new Decimal(row.credit);
      switch (row.accountType) {
        case "ASSET":
          assets = assets.plus(debit).minus(credit);
          break;
        case "LIABILITY":
          liabilities = liabilities.plus(credit).minus(debit);
          break;
        case "EQUITY":
          equity = equity.plus(credit).minus(debit);
          break;
        case "REVENUE":
          netProfit = netProfit.plus(credit).minus(debit);
          break;
        case "EXPENSE":
          netProfit = netProfit.minus(debit).plus(credit);
          break;
      }
    }
    const equityWithProfit = equity.plus(netProfit);
    return {
      assets: toStorage(assets),
      liabilities: toStorage(liabilities),
      equity: toStorage(equityWithProfit),
      netProfit: toStorage(netProfit),
      balanced: assets
        .minus(liabilities)
        .minus(equityWithProfit)
        .abs()
        .lessThan(new Decimal("0.01")),
    };
  }

  /** Transaction ledger for a party, with a running balance. */
  async partyLedger(partyId: number, from?: string, to?: string): Promise<LedgerEntry[]> {
    let sql = `
      SELECT je.entry_date AS date, je.voucher_number, je.voucher_type,
             COALESCE(jel.description, je.narration) AS description,
             jel.debit, jel.credit
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.party_id = ? AND je.is_posted = 1`;
    const params: Array<string | number> = [partyId];
    if (from) {
      sql += " AND je.entry_date >= ?";
      params.push(from);
    }
    if (to) {
      sql += " AND je.entry_date <= ?";
      params.push(to);
    }
    sql += " ORDER BY je.entry_date, je.id";
    return this.withRunningBalance(await this.db.all<Row>(sql, params));
  }

  /** Cash book: every posted movement on the Cash in Hand account. */
  async cashBook(from?: string, to?: string): Promise<LedgerEntry[]> {
    let sql = `
      SELECT je.entry_date AS date, je.voucher_number, je.voucher_type,
             COALESCE(jel.description, je.narration) AS description,
             jel.debit, jel.credit
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      JOIN accounts a ON a.id = jel.account_id
      WHERE a.account_code = '1000' AND je.is_posted = 1`;
    const params: Array<string | number> = [];
    if (from) {
      sql += " AND je.entry_date >= ?";
      params.push(from);
    }
    if (to) {
      sql += " AND je.entry_date <= ?";
      params.push(to);
    }
    sql += " ORDER BY je.entry_date, je.id";
    return this.withRunningBalance(await this.db.all<Row>(sql, params));
  }

  private withRunningBalance(rows: Row[]): LedgerEntry[] {
    let balance = new Decimal(0);
    return rows.map((row) => {
      const debit = new Decimal(Number(row.debit ?? 0));
      const credit = new Decimal(Number(row.credit ?? 0));
      balance = balance.plus(debit).minus(credit);
      return {
        date: String(row.date ?? ""),
        voucherNumber: String(row.voucher_number ?? ""),
        voucherType: String(row.voucher_type ?? ""),
        description: row.description == null ? null : String(row.description),
        debit: toStorage(debit),
        credit: toStorage(credit),
        balance: toStorage(balance),
      };
    });
  }

  /** Trial balance rendered as CSV for download/export. */
  async trialBalanceCsv(): Promise<string> {
    const { rows, totalDebit, totalCredit } = await this.trialBalance();
    const escape = (value: string): string =>
      /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    const lines = ["Account Code,Account Name,Type,Debit,Credit"];
    for (const row of rows) {
      lines.push(
        [
          escape(row.accountCode),
          escape(row.accountName),
          row.accountType,
          row.debit.toFixed(2),
          row.credit.toFixed(2),
        ].join(","),
      );
    }
    lines.push(["", "", "TOTAL", totalDebit.toFixed(2), totalCredit.toFixed(2)].join(","));
    return lines.join("\n");
  }
}
