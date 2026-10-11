/**
 * Acceptance audit for the rich demo dataset.
 *
 * Seeds the full `seedRichDemoData` scenario and then recomputes every headline
 * report figure from the raw `journal_entry_lines` with plain SQL, so the
 * reporting services are checked against the ledger itself rather than against
 * their own output. Also ties the party sub-ledger and the dashboard tiles back
 * to the control accounts.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RICH_DEMO_DATE, seedRichDemoData } from "../src/seedData.js";
import { DashboardService } from "../src/services/dashboardService.js";
import { ReportService } from "../src/services/reportService.js";
import { freshDb, type TestContext } from "./helpers/db.js";

const COMPANY = 1;

/**
 * Every query below is joined the same way, so the independent recomputation
 * can never accidentally read a different slice of the ledger than the
 * services do (posted entries only, single company).
 */
const LEDGER = `
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  JOIN accounts a ON a.id = jel.account_id
  WHERE je.is_posted = 1 AND je.company_id = ?`;

let ctx: TestContext;
let reports: ReportService;
let dashboard: DashboardService;

beforeEach(async () => {
  ctx = await freshDb();
  await seedRichDemoData(ctx.db, ctx.ids);
  reports = new ReportService(ctx.db);
  dashboard = new DashboardService(ctx.db);
});

afterEach(async () => {
  await ctx.db.close();
});

async function scalar(sql: string, ...params: Array<string | number>): Promise<number> {
  const row = await ctx.db.get<{ v: number | null }>(sql, params);
  return Number(row?.v ?? 0);
}

async function count(sql: string, ...params: Array<string | number>): Promise<number> {
  const row = await ctx.db.get<{ n: number }>(sql, params);
  return Number(row?.n ?? 0);
}

describe("rich demo acceptance audit", () => {
  it("loads every module and re-running it adds nothing", async () => {
    expect(await count("SELECT COUNT(*) AS n FROM parties WHERE company_id = ?", COMPANY)).toBe(4);
    expect(await count("SELECT COUNT(*) AS n FROM items WHERE company_id = ?", COMPANY)).toBe(4);
    expect(await count("SELECT COUNT(*) AS n FROM stock_batches")).toBeGreaterThanOrEqual(4);
    expect(
      await count("SELECT COUNT(*) AS n FROM bank_accounts WHERE company_id = ?", COMPANY),
    ).toBeGreaterThanOrEqual(1);
    expect(await count("SELECT COUNT(*) AS n FROM cheques WHERE company_id = ?", COMPANY)).toBeGreaterThanOrEqual(1);
    expect(await count("SELECT COUNT(*) AS n FROM expenses WHERE company_id = ?", COMPANY)).toBeGreaterThanOrEqual(2);
    expect(
      await count("SELECT COUNT(*) AS n FROM expense_items WHERE company_id = ?", COMPANY),
    ).toBeGreaterThanOrEqual(1);
    expect(await count("SELECT COUNT(*) AS n FROM asset_details")).toBeGreaterThanOrEqual(1);
    expect(
      await count("SELECT COUNT(*) AS n FROM bill_of_materials WHERE company_id = ?", COMPANY),
    ).toBeGreaterThanOrEqual(1);
    expect(
      await count("SELECT COUNT(*) AS n FROM production_orders WHERE company_id = ?", COMPANY),
    ).toBeGreaterThanOrEqual(1);
    expect(
      await count("SELECT COUNT(*) AS n FROM sales_returns WHERE company_id = ?", COMPANY),
    ).toBeGreaterThanOrEqual(1);
    expect(
      await count("SELECT COUNT(*) AS n FROM purchase_returns WHERE company_id = ?", COMPANY),
    ).toBeGreaterThanOrEqual(1);

    const types = await ctx.db.all<{ voucher_type: string }>(
      "SELECT DISTINCT voucher_type FROM journal_entries WHERE company_id = ?",
      [COMPANY],
    );
    const present = new Set(types.map((row) => row.voucher_type));
    const expected = [
      "OPENING",
      "PURCHASE",
      "PURCHASE_RETURN",
      "SALES",
      "SALES_RETURN",
      "RECEIPT",
      "PAYMENT",
      "JOURNAL",
      "MANUFACTURING",
    ];
    expect([...expected].filter((type) => !present.has(type))).toEqual([]);

    const before = await count("SELECT COUNT(*) AS n FROM journal_entries WHERE company_id = ?", COMPANY);
    await seedRichDemoData(ctx.db, ctx.ids);
    expect(await count("SELECT COUNT(*) AS n FROM journal_entries WHERE company_id = ?", COMPANY)).toBe(before);
  });

  it("posts only balanced entries and never leaks a draft into the reports", async () => {
    const unbalanced = await ctx.db.all<{ voucher_number: string }>(
      `SELECT je.voucher_number
       FROM journal_entry_lines jel
       JOIN journal_entries je ON je.id = jel.journal_entry_id
       WHERE je.company_id = ?
       GROUP BY je.id
       HAVING ABS(SUM(jel.debit) - SUM(jel.credit)) >= 0.01`,
      [COMPANY],
    );
    expect(unbalanced).toEqual([]);
    expect(
      await count("SELECT COUNT(*) AS n FROM journal_entries WHERE company_id = ? AND is_posted <> 1", COMPANY),
    ).toBe(0);
  });

  it("trial balance matches an independent ledger recomputation", async () => {
    const { rows, totalDebit, totalCredit, balanced } = await reports.trialBalance();
    expect(balanced).toBe(true);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);

    const raw = await ctx.db.all<{ account_code: string; net: number }>(
      `SELECT a.account_code, SUM(jel.debit) - SUM(jel.credit) AS net ${LEDGER} GROUP BY a.account_code`,
      [COMPANY],
    );
    const rawByCode = new Map(raw.map((row) => [row.account_code, Number(row.net)]));
    for (const row of rows) {
      const rawNet = rawByCode.get(row.accountCode) ?? 0;
      // The closing columns place the balance in the account's normal column, so
      // debit-minus-credit recovers the raw signed movement.
      expect(
        row.closingDebit - row.closingCredit,
        `account ${row.accountCode} (${row.accountType})`,
      ).toBeCloseTo(rawNet, 2);
      // `place()` normalises the sign, so a closing balance lives in exactly one column.
      expect(row.closingDebit).toBeGreaterThanOrEqual(0);
      expect(row.closingCredit).toBeGreaterThanOrEqual(0);
      expect(
        row.closingDebit === 0 || row.closingCredit === 0,
        `account ${row.accountCode} should carry only one closing column`,
      ).toBe(true);
    }
    // Every account that carries posted movement must appear in the report
    // (active accounts with no movement are listed as well, so the report is a
    // superset of the ledger's used accounts).
    const reportCodes = new Set(rows.map((row) => row.accountCode));
    expect([...rawByCode.keys()].filter((code) => !reportCodes.has(code))).toEqual([]);

    // Totals are the net balance of each account placed in the matching
    // column, so recompute them from the raw per-account nets.
    const round2 = (value: number): number => Math.round(value * 100) / 100;
    let expectedDebit = 0;
    let expectedCredit = 0;
    for (const row of raw) {
      const net = Number(row.net);
      expectedDebit += Math.max(net, 0);
      expectedCredit += Math.max(-net, 0);
    }
    expect(totalDebit).toBeCloseTo(round2(expectedDebit), 2);
    expect(totalCredit).toBeCloseTo(round2(expectedCredit), 2);

    // The ledger itself balances gross-for-gross (double entry).
    const grossDebit = await scalar(`SELECT COALESCE(SUM(jel.debit), 0) AS v ${LEDGER}`, COMPANY);
    const grossCredit = await scalar(`SELECT COALESCE(SUM(jel.credit), 0) AS v ${LEDGER}`, COMPANY);
    expect(grossDebit).toBeCloseTo(grossCredit, 2);
  });

  it("P&L equals an independent revenue/expense recomputation", async () => {
    const period = await reports.profitAndLoss({ from: RICH_DEMO_DATE, to: RICH_DEMO_DATE });

    const periodRevenue = await scalar(
      `SELECT COALESCE(SUM(CASE WHEN a.account_type = 'REVENUE' THEN jel.credit - jel.debit ELSE 0 END), 0) AS v
       ${LEDGER} AND je.entry_date >= ? AND je.entry_date <= ?`,
      COMPANY,
      RICH_DEMO_DATE,
      RICH_DEMO_DATE,
    );
    const periodExpenses = await scalar(
      `SELECT COALESCE(SUM(CASE WHEN a.account_type = 'EXPENSE' THEN jel.debit - jel.credit ELSE 0 END), 0) AS v
       ${LEDGER} AND je.entry_date >= ? AND je.entry_date <= ?`,
      COMPANY,
      RICH_DEMO_DATE,
      RICH_DEMO_DATE,
    );

    expect(period.revenue).toBeCloseTo(periodRevenue, 2);
    expect(period.expenses).toBeCloseTo(periodExpenses, 2);
    expect(period.netProfit).toBeCloseTo(periodRevenue - periodExpenses, 2);
    // The dataset genuinely contains both sides, so the comparison is meaningful.
    expect(period.revenue).toBeGreaterThan(0);
    expect(period.expenses).toBeGreaterThan(0);

    const allTime = await reports.profitAndLoss();
    const allRevenue = await scalar(
      `SELECT COALESCE(SUM(CASE WHEN a.account_type = 'REVENUE' THEN jel.credit - jel.debit ELSE 0 END), 0) AS v ${LEDGER}`,
      COMPANY,
    );
    const allExpenses = await scalar(
      `SELECT COALESCE(SUM(CASE WHEN a.account_type = 'EXPENSE' THEN jel.debit - jel.credit ELSE 0 END), 0) AS v ${LEDGER}`,
      COMPANY,
    );
    expect(allTime.revenue).toBeCloseTo(allRevenue, 2);
    expect(allTime.expenses).toBeCloseTo(allExpenses, 2);
  });

  it("balance sheet balances and equals the raw type sums", async () => {
    const sheet = await reports.balanceSheet();
    expect(sheet.balanced).toBe(true);

    const sums = await ctx.db.get<{
      assets: number;
      liabilities: number;
      equity: number;
      revenue: number;
      expenses: number;
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN a.account_type = 'ASSET' THEN jel.debit - jel.credit ELSE 0 END), 0) AS assets,
         COALESCE(SUM(CASE WHEN a.account_type = 'LIABILITY' THEN jel.credit - jel.debit ELSE 0 END), 0) AS liabilities,
         COALESCE(SUM(CASE WHEN a.account_type = 'EQUITY' THEN jel.credit - jel.debit ELSE 0 END), 0) AS equity,
         COALESCE(SUM(CASE WHEN a.account_type = 'REVENUE' THEN jel.credit - jel.debit ELSE 0 END), 0) AS revenue,
         COALESCE(SUM(CASE WHEN a.account_type = 'EXPENSE' THEN jel.debit - jel.credit ELSE 0 END), 0) AS expenses
       ${LEDGER}`,
      [COMPANY],
    );
    const assets = Number(sums?.assets ?? 0);
    const liabilities = Number(sums?.liabilities ?? 0);
    const equity = Number(sums?.equity ?? 0);
    const netProfit = Number(sums?.revenue ?? 0) - Number(sums?.expenses ?? 0);

    expect(sheet.assets).toBeCloseTo(assets, 2);
    expect(sheet.liabilities).toBeCloseTo(liabilities, 2);
    expect(sheet.netProfit).toBeCloseTo(netProfit, 2);
    // The service folds the current-period profit into equity.
    expect(sheet.equity).toBeCloseTo(equity + netProfit, 2);
    expect(sheet.assets).toBeCloseTo(sheet.liabilities + sheet.equity, 2);
    expect(sheet.assets).toBeGreaterThan(0);
  });

  it("party sub-ledger ties to the control accounts and the cash book ties to Cash in Hand", async () => {
    const arControl = await scalar(
      `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) AS v ${LEDGER} AND a.account_code = '1100'`,
      COMPANY,
    );
    const arParties = await scalar(
      `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) AS v ${LEDGER} AND a.account_code = '1100' AND jel.party_id IS NOT NULL`,
      COMPANY,
    );
    expect(arParties).toBeCloseTo(arControl, 2);

    const apControl = await scalar(
      `SELECT COALESCE(SUM(jel.credit - jel.debit), 0) AS v ${LEDGER} AND a.account_code = '2000'`,
      COMPANY,
    );
    const apParties = await scalar(
      `SELECT COALESCE(SUM(jel.credit - jel.debit), 0) AS v ${LEDGER} AND a.account_code = '2000' AND jel.party_id IS NOT NULL`,
      COMPANY,
    );
    expect(apParties).toBeCloseTo(apControl, 2);

    const customer = await ctx.db.get<{ id: number }>(
      "SELECT id FROM parties WHERE company_id = ? AND code = 'DEMO-CUST2'",
      [COMPANY],
    );
    expect(customer).toBeDefined();
    const ledger = await reports.partyLedger(customer!.id);
    expect(ledger.length).toBeGreaterThan(0);
    const rawCustomer = await scalar(
      `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) AS v ${LEDGER} AND jel.party_id = ?`,
      COMPANY,
      customer!.id,
    );
    expect(ledger[ledger.length - 1]!.balance).toBeCloseTo(rawCustomer, 2);

    const cashBook = await reports.cashBook();
    const cashControl = await scalar(
      `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) AS v ${LEDGER} AND a.account_code = '1000'`,
      COMPANY,
    );
    expect(cashBook.length).toBeGreaterThan(0);
    expect(cashBook[cashBook.length - 1]!.balance).toBeCloseTo(cashControl, 2);
  });

  it("dashboard tiles agree with the ledger control accounts and the stock table", async () => {
    const data = await dashboard.get();

    const cash = await scalar(
      `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) AS v ${LEDGER} AND a.account_code IN ('1000','1020')`,
      COMPANY,
    );
    const bank = await scalar(
      `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) AS v ${LEDGER} AND a.account_code = '1010'`,
      COMPANY,
    );
    const receivable = await scalar(
      `SELECT COALESCE(SUM(jel.debit - jel.credit), 0) AS v ${LEDGER} AND a.account_code = '1100'`,
      COMPANY,
    );
    const payable = await scalar(
      `SELECT COALESCE(SUM(jel.credit - jel.debit), 0) AS v ${LEDGER} AND a.account_code = '2000'`,
      COMPANY,
    );
    expect(data.balances.cash).toBeCloseTo(cash, 2);
    expect(data.balances.bank).toBeCloseTo(bank, 2);
    expect(data.receivablesPayables.receivable).toBeCloseTo(receivable, 2);
    expect(data.receivablesPayables.payable).toBeCloseTo(payable, 2);

    const stockValue = await scalar(
      `SELECT COALESCE(SUM(sb.quantity_in_stock * sb.purchase_price), 0) AS v
       FROM stock_batches sb JOIN items i ON i.id = sb.item_id
       WHERE sb.is_active = 1 AND i.is_active = 1 AND i.company_id = ? AND sb.quantity_in_stock > 0`,
      COMPANY,
    );
    expect(data.balances.inventory).toBeCloseTo(stockValue, 2);
    expect(data.inventory.totalItems).toBe(
      await count("SELECT COUNT(*) AS n FROM items WHERE company_id = ? AND is_active = 1", COMPANY),
    );
    expect(data.balances.inventory).toBeGreaterThan(0);
    expect(data.balances.bank).toBeGreaterThan(0);

    const today = new Date().toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 7)}-01`;
    const monthRevenue = await scalar(
      `SELECT COALESCE(SUM(CASE WHEN a.account_type = 'REVENUE' THEN jel.credit ELSE 0 END), 0) AS v
       ${LEDGER} AND je.entry_date >= ? AND je.entry_date <= ?`,
      COMPANY,
      monthStart,
      today,
    );
    const monthExpenses = await scalar(
      `SELECT COALESCE(SUM(CASE WHEN a.account_type = 'EXPENSE' THEN jel.debit ELSE 0 END), 0) AS v
       ${LEDGER} AND je.entry_date >= ? AND je.entry_date <= ?`,
      COMPANY,
      monthStart,
      today,
    );
    expect(data.profitLoss.revenue).toBeCloseTo(monthRevenue, 2);
    expect(data.profitLoss.expenses).toBeCloseTo(monthExpenses, 2);
  });

  it("exports all reports for a period with a balanced trial balance", async () => {
    const csv = await reports.exportAllCsv({ from: RICH_DEMO_DATE, to: RICH_DEMO_DATE });
    for (const section of ["Trial Balance", "Profit & Loss", "Balance Sheet", "Cash Book"]) {
      expect(csv).toContain(section);
    }
    const total = csv.split("\n").find((line) => line.startsWith(",,TOTAL,"));
    expect(total).toBeDefined();
    const [debit, credit] = total!.split(",").slice(-2);
    expect(Number(debit)).toBeCloseTo(Number(credit), 2);
    expect(csv).toContain("YES"); // the balance sheet reports as balanced
  });
});
