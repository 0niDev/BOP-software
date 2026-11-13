import type { SqlDatabase } from "../db/types.js";
import { AccountingService } from "./accountingService.js";
import { CustomReportService, type CustomReportResult } from "./customReportService.js";
import {
  ReportService,
  type BalanceSheetResult,
  type ProfitAndLossResult,
  type TrialBalanceResult,
} from "./reportService.js";

export interface ReportsBundle {
  trialBalance: TrialBalanceResult;
  profitAndLoss: ProfitAndLossResult;
  balanceSheet: BalanceSheetResult;
  customPl: CustomReportResult;
  customBs: CustomReportResult;
}

export interface ReportsBundleOptions {
  from?: string | null;
  to?: string | null;
  asAt?: string | null;
}

/**
 * The five reports the page shows, from one trial-balance read instead of five.
 * The P&L period and the balance-sheet date need different scopes only when a
 * `from` date is set; otherwise both resolve to the same query and run once.
 */
export async function buildReportsBundle(
  db: SqlDatabase,
  companyId: number,
  opts: ReportsBundleOptions = {},
): Promise<ReportsBundle> {
  const from = opts.from || null;
  const to = opts.to || null;
  const asAt = opts.asAt || null;

  const accounting = new AccountingService(db, companyId);
  const reports = new ReportService(db, companyId);
  const custom = new CustomReportService(db, companyId);

  const periodRows = await accounting.getTrialBalance(companyId, { from, to });
  // The balance sheet reads everything up to `asAt`; the P&L period also skips
  // everything before `from`, so they only share rows when `from` is empty.
  const sameScope = from === null && to === asAt;
  const sheetRows = sameScope
    ? periodRows
    : await accounting.getTrialBalance(companyId, { to: asAt });

  return {
    trialBalance: await reports.trialBalanceFrom(periodRows, to),
    profitAndLoss: reports.profitAndLossFrom(periodRows),
    balanceSheet: reports.balanceSheetFrom(sheetRows),
    customPl: await custom.buildFromRows("PL", periodRows),
    customBs: await custom.buildFromRows("BS", sheetRows),
  };
}
