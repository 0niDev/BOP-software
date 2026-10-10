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

  it("renders a trial balance CSV with totals", async () => {
    await seedActivity();
    const csv = await reports.trialBalanceCsv();
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Account Code,Account Name,Type,Debit,Credit");
    expect(lines[lines.length - 1]).toContain("TOTAL");
  });
});
