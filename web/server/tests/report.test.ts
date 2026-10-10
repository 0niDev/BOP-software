import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PaymentService } from "../src/services/paymentService.js";
import { ReportService } from "../src/services/reportService.js";
import { SalesInvoiceService } from "../src/services/salesInvoiceService.js";
import { freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let reports: ReportService;
let sales: SalesInvoiceService;
let payments: PaymentService;

beforeEach(async () => {
  ctx = await freshDb();
  reports = new ReportService(ctx.db);
  sales = new SalesInvoiceService(ctx.db);
  payments = new PaymentService(ctx.db);
});
afterEach(async () => {
  await ctx.db.close();
});

/** A cash sale plus a credit sale, so several accounts are in play. */
async function seedActivity(): Promise<void> {
  await sales.createSalesInvoice({
    customerId: ctx.ids.customerId,
    invoiceDate: "2026-10-08",
    paymentType: "CASH",
    items: [{ itemId: ctx.ids.itemId, quantity: 5, unitPrice: 150 }],
  });
  await sales.createSalesInvoice({
    customerId: ctx.ids.customerId,
    invoiceDate: "2026-10-09",
    paymentType: "CREDIT",
    items: [{ itemId: ctx.ids.itemId, quantity: 2, unitPrice: 150 }],
  });
}

describe("ReportService", () => {
  it("produces a trial balance that balances", async () => {
    await seedActivity();
    const result = await reports.trialBalance();
    expect(result.balanced).toBe(true);
    expect(result.totalDebit).toBe(result.totalCredit);
  });

  it("produces a balance sheet that balances after trading activity", async () => {
    await seedActivity();
    const sheet = await reports.balanceSheet();
    expect(sheet.balanced).toBe(true);
    // Assets = Liabilities + Equity (+ current-period profit).
    expect(sheet.assets).toBeCloseTo(sheet.liabilities + sheet.equity, 2);
  });

  it("shows a running balance in the party ledger and clears it on receipt", async () => {
    await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 2, unitPrice: 150 }],
    });
    await payments.receivePayment({
      customerId: ctx.ids.customerId,
      amount: 300,
      paymentDate: "2026-10-10",
      paymentMethod: "CASH",
    });

    const ledger = await reports.partyLedger(ctx.ids.customerId);
    expect(ledger).toHaveLength(2);
    expect(ledger[0]!.debit).toBe(300);
    expect(ledger[0]!.balance).toBe(300);
    expect(ledger[1]!.credit).toBe(300);
    expect(ledger[1]!.balance).toBe(0);
  });

  it("records cash sales in the cash book", async () => {
    await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 5, unitPrice: 150 }],
    });
    const book = await reports.cashBook();
    expect(book.length).toBeGreaterThan(0);
    const entry = book.find((e) => e.debit === 750)!;
    expect(entry).toBeDefined();
    expect(entry.balance).toBe(750);
  });

  it("renders a trial balance CSV with opening/period/closing columns and totals", async () => {
    await seedActivity();
    const csv = await reports.trialBalanceCsv();
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "Account Code,Account Name,Type,Opening Debit,Opening Credit,Debit,Credit,Closing Debit,Closing Credit",
    );
    expect(lines[lines.length - 1]).toContain("TOTAL");
    // One header + one line per account + the TOTAL line.
    const { rows } = await reports.trialBalance();
    expect(lines).toHaveLength(rows.length + 2);
  });

  it("scopes the trial balance to a period and carries earlier entries as opening", async () => {
    await seedActivity(); // cash sale 750 on 2026-10-08, credit sale 300 on 2026-10-09

    const scoped = await reports.trialBalance({ from: "2026-10-09", to: "2026-10-09" });
    expect(scoped.balanced).toBe(true);
    expect(scoped.totalDebit).toBe(scoped.totalCredit);

    const cash = scoped.rows.find((r) => r.accountCode === "1000")!;
    expect(cash.openingDebit).toBe(750);
    expect(cash.debit).toBe(0);
    expect(cash.credit).toBe(0);
    expect(cash.closingDebit).toBe(750);

    const receivable = scoped.rows.find((r) => r.accountCode === "1100")!;
    expect(receivable.openingDebit).toBe(0);
    expect(receivable.debit).toBe(300); // the credit sale lands in the period
    expect(receivable.closingDebit).toBe(300);

    // A range ending on the last posting date carries every entry, so its
    // closing columns must equal the unbounded report account by account.
    const all = await reports.trialBalance();
    const upToLast = await reports.trialBalance({ to: "2026-10-09" });
    expect(upToLast.totalDebit).toBe(all.totalDebit);
    expect(upToLast.totalCredit).toBe(all.totalCredit);
    expect(upToLast.rows.map((r) => r.closingDebit)).toEqual(
      all.rows.map((r) => r.closingDebit),
    );

    // A range stopping on day one excludes day two's entries.
    const firstDay = await reports.trialBalance({ to: "2026-10-08" });
    expect(firstDay.balanced).toBe(true);
    expect(firstDay.totalDebit).toBeLessThan(all.totalDebit);
    expect(firstDay.rows.find((r) => r.accountCode === "1100")!.closingDebit).toBe(0);
  });

  it("reports P&L for the requested period only", async () => {
    await seedActivity();

    const firstDay = await reports.profitAndLoss({ from: "2026-10-08", to: "2026-10-08" });
    expect(firstDay.revenue).toBe(750);
    expect(firstDay.expenses).toBe(500); // COGS of the 5-unit cash sale
    expect(firstDay.netProfit).toBe(250);

    const secondDay = await reports.profitAndLoss({ from: "2026-10-09", to: "2026-10-09" });
    expect(secondDay.revenue).toBe(300);
    expect(secondDay.expenses).toBe(200);
    expect(secondDay.netProfit).toBe(100);

    // Both days together equal the unbounded report.
    const all = await reports.profitAndLoss();
    expect(all.revenue).toBe(firstDay.revenue + secondDay.revenue);
    expect(all.expenses).toBe(firstDay.expenses + secondDay.expenses);
    expect(all.netProfit).toBe(firstDay.netProfit + secondDay.netProfit);
  });

  it("values the balance sheet as at a date and stays balanced", async () => {
    await seedActivity();

    const asAtFirst = await reports.balanceSheet("2026-10-08");
    expect(asAtFirst.balanced).toBe(true);
    expect(asAtFirst.assets).toBeCloseTo(asAtFirst.liabilities + asAtFirst.equity, 2);
    expect(asAtFirst.netProfit).toBe(250); // only day one

    const asAtSecond = await reports.balanceSheet("2026-10-09");
    expect(asAtSecond.balanced).toBe(true);
    expect(asAtSecond.netProfit).toBe(350); // 250 + 100
    expect(asAtSecond.assets).toBeGreaterThan(asAtFirst.assets);
  });
});
