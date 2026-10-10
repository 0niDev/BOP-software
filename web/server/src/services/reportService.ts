import type { Row, SqlDatabase } from "../db/types.js";
import { Decimal, toStorage } from "../domain/money.js";
import {
  AccountingService,
  type DateRangeOptions,
  type TrialBalanceRow,
} from "./accountingService.js";

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

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export class ReportService {
  private readonly accounting: AccountingService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.accounting = new AccountingService(db, companyId);
  }

  /**
   * Totals come from the **closing** columns so a scoped report still balances
   * (opening + period movement), while `rows[].debit/credit` remain the
   * movement inside the requested period.
   */
  async trialBalance(opts: DateRangeOptions = {}): Promise<TrialBalanceResult> {
    const rows = await this.accounting.getTrialBalance(this.companyId, opts);
    const totalDebit = rows.reduce((acc, r) => acc.plus(r.closingDebit), new Decimal(0));
    const totalCredit = rows.reduce((acc, r) => acc.plus(r.closingCredit), new Decimal(0));
    return {
      rows,
      totalDebit: toStorage(totalDebit),
      totalCredit: toStorage(totalCredit),
      balanced: totalDebit.minus(totalCredit).abs().lessThan(new Decimal("0.01")),
    };
  }

  /** Revenue and expenses for the period (P&L is a period statement). */
  async profitAndLoss(opts: DateRangeOptions = {}): Promise<ProfitAndLossResult> {
    const rows = await this.accounting.getTrialBalance(this.companyId, opts);
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

  /**
   * Position as at a date (cumulative, so the *closing* columns are used).
   * Without `asAt` this is the position as of everything posted.
   */
  async balanceSheet(asAt?: string | null): Promise<BalanceSheetResult> {
    const rows = await this.accounting.getTrialBalance(this.companyId, { to: asAt ?? null });
    let assets = new Decimal(0);
    let liabilities = new Decimal(0);
    let equity = new Decimal(0);
    let netProfit = new Decimal(0);
    for (const row of rows) {
      const debit = new Decimal(row.closingDebit);
      const credit = new Decimal(row.closingCredit);
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

  /**
   * Trial balance rendered as CSV for download/export, including the opening,
   * period and closing columns an accountant expects.
   */
  async trialBalanceCsv(opts: DateRangeOptions = {}): Promise<string> {
    const { rows, totalDebit, totalCredit } = await this.trialBalance(opts);
    const escape = csvEscape;
    const lines = [
      "Account Code,Account Name,Type,Opening Debit,Opening Credit,Debit,Credit,Closing Debit,Closing Credit",
    ];
    for (const row of rows) {
      lines.push(
        [
          escape(row.accountCode),
          escape(row.accountName),
          row.accountType,
          row.openingDebit.toFixed(2),
          row.openingCredit.toFixed(2),
          row.debit.toFixed(2),
          row.credit.toFixed(2),
          row.closingDebit.toFixed(2),
          row.closingCredit.toFixed(2),
        ].join(","),
      );
    }
    lines.push(
      ["", "", "TOTAL", "", "", "", "", totalDebit.toFixed(2), totalCredit.toFixed(2)].join(
        ",",
      ),
    );
    return lines.join("\n");
  }

  /**
   * "Export all reports" ported from report_view._generate_all_report_html:
   * the four tab reports for one period, concatenated into a single CSV (the
   * web equivalent of the Python "one workbook" export). Every section is
   * produced by the same services the individual tabs use, so the numbers
   * cannot drift.
   */
  async exportAllCsv(opts: DateRangeOptions = {}): Promise<string> {
    const from = opts.from ?? null;
    const to = opts.to ?? null;
    const periodLabel = `${from ?? "start"} to ${to ?? "today"}`;
    const lines: string[] = [
      `BOP Nutraceuticals ERP — all reports,${csvEscape(periodLabel)}`,
      "",
    ];

    // --- Trial balance -------------------------------------------------
    const { rows, totalDebit, totalCredit } = await this.trialBalance(opts);
    lines.push(`Trial Balance (${csvEscape(periodLabel)})`);
    lines.push(
      "Account Code,Account Name,Type,Opening Debit,Opening Credit,Debit,Credit,Closing Debit,Closing Credit",
    );
    for (const row of rows) {
      lines.push(
        [
          csvEscape(row.accountCode),
          csvEscape(row.accountName),
          row.accountType,
          row.openingDebit.toFixed(2),
          row.openingCredit.toFixed(2),
          row.debit.toFixed(2),
          row.credit.toFixed(2),
          row.closingDebit.toFixed(2),
          row.closingCredit.toFixed(2),
        ].join(","),
      );
    }
    lines.push(
      ["", "", "TOTAL", "", "", "", "", totalDebit.toFixed(2), totalCredit.toFixed(2)].join(","),
    );
    lines.push("");

    // --- Profit & loss (period movement) -------------------------------
    const pl = await this.profitAndLoss(opts);
    lines.push(`Profit & Loss (${csvEscape(periodLabel)})`);
    lines.push("Revenue,Expenses,Net Profit");
    lines.push([pl.revenue.toFixed(2), pl.expenses.toFixed(2), pl.netProfit.toFixed(2)].join(","));
    lines.push("");

    // --- Balance sheet (position as at the period end) ------------------
    const bs = await this.balanceSheet(to);
    lines.push(`Balance Sheet (as at ${csvEscape(to ?? "today")})`);
    lines.push("Assets,Liabilities,Equity (incl. net profit),Net Profit,Balanced");
    lines.push(
      [
        bs.assets.toFixed(2),
        bs.liabilities.toFixed(2),
        bs.equity.toFixed(2),
        bs.netProfit.toFixed(2),
        bs.balanced ? "YES" : "NO",
      ].join(","),
    );
    lines.push("");

    // --- Cash book -----------------------------------------------------
    const cash = await this.cashBook(from ?? undefined, to ?? undefined);
    lines.push(`Cash Book (${csvEscape(periodLabel)})`);
    lines.push("Date,Voucher,Type,Description,Debit,Credit,Balance");
    for (const entry of cash) {
      lines.push(
        [
          entry.date,
          csvEscape(entry.voucherNumber),
          csvEscape(entry.voucherType),
          csvEscape(entry.description ?? ""),
          entry.debit.toFixed(2),
          entry.credit.toFixed(2),
          entry.balance.toFixed(2),
        ].join(","),
      );
    }
    return lines.join("\n");
  }
}
