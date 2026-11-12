import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ItemService } from "../src/services/itemService.js";
import { PartyService } from "../src/services/partyService.js";
import { PaymentService } from "../src/services/paymentService.js";
import { ReportService } from "../src/services/reportService.js";
import { SalesInvoiceService } from "../src/services/salesInvoiceService.js";
import { accountId, freshDb, type TestContext } from "./helpers/db.js";

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

  it("splits finished goods into sold and in stock on the trial balance", async () => {
    await seedActivity();
    const { rows } = await reports.trialBalance();
    const fg = rows.find((row) => row.accountCode === "1220");
    // 5 + 2 units on the invoices, each at the demo stock's cost of 100.
    expect(fg?.soldValue).toBeCloseTo(700, 2);

    // A sale that never relieved stock still counts as sold: the invoice says so.
    await ctx.db.run("UPDATE stock_batches SET quantity_in_stock = 0");
    const afterReset = await reports.trialBalance();
    expect(afterReset.rows.find((row) => row.accountCode === "1220")?.soldValue).toBeCloseTo(700, 2);
    // Only finished goods get the sold memo line; material accounts get the
    // consumed one instead (nothing issued in this fixture, so it is zero).
    expect(rows.find((row) => row.accountCode === "1200")?.soldValue).toBeUndefined();
    expect(rows.find((row) => row.accountCode === "1200")?.usedValue).toBe(0);
    expect(rows.find((row) => row.accountCode === "1210")?.usedValue).toBe(0);
    expect(fg?.usedValue).toBeUndefined();

    // The memo line follows the report date.
    const early = await reports.trialBalance({ to: "2026-10-08" });
    expect(early.rows.find((row) => row.accountCode === "1220")?.soldValue).toBeCloseTo(500, 2);
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
      notes: "Delivered to site A",
      items: [{ itemId: ctx.ids.itemId, quantity: 2, unitPrice: 150 }],
    });
    await payments.receivePayment({
      customerId: ctx.ids.customerId,
      amount: 300,
      paymentDate: "2026-10-10",
      paymentMethod: "CASH",
      notes: "Collected by hand",
    });

    const ledger = await reports.partyLedger(ctx.ids.customerId);
    expect(ledger).toHaveLength(2);
    expect(ledger[0]!.debit).toBe(300);
    expect(ledger[0]!.balance).toBe(300);
    expect(ledger[0]!.notes).toBe("Delivered to site A");
    expect(ledger[1]!.credit).toBe(300);
    expect(ledger[1]!.balance).toBe(0);
    expect(ledger[1]!.notes).toBe("Collected by hand");
  });

  it("reports each party's closing balance for the Chart of Accounts", async () => {
    await seedActivity();
    const ledger = await reports.partyLedger(ctx.ids.customerId);
    const customer = (await reports.partyBalances()).find(
      (row) => row.partyId === ctx.ids.customerId,
    );

    expect(customer?.balance).toBe(ledger.at(-1)!.balance);
    // The demo customer has no linked account, so it falls back to A/R.
    expect(customer?.accountId).toBe(await accountId(ctx.db, "1100"));
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
    const csv = await reports.trialBalanceCsv({ showZero: true });
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "Account Code,Account Name,Type,Opening Debit,Opening Credit,Debit,Credit,Closing Debit,Closing Credit",
    );
    expect(lines[lines.length - 1]).toContain("TOTAL");
    // One header + one line per account + any inventory memo line + the TOTAL line.
    const { rows } = await reports.trialBalance();
    const memoLines = rows.reduce(
      (count, row) => count + (row.tagBreakdown?.length ? row.tagBreakdown.length + 1 : 0),
      0,
    );
    expect(lines).toHaveLength(rows.length + memoLines + 2);
  });

  it("organizes the all-reports bundle's trial balance like the CoA", async () => {
    await seedActivity();
    const lines = (await reports.exportAllCsv()).split("\n");

    // One band per type, in CoA order, each closed by a subtotal row.
    const bands = lines
      .map((line) => /^([A-Z]+) \(\d+\)/.exec(line)?.[1])
      .filter((label): label is string => label !== undefined);
    expect(bands).toEqual(["ASSETS", "LIABILITIES", "EQUITY", "REVENUE", "EXPENSES"]);
    expect(lines.some((line) => line.startsWith(",Total Assets,"))).toBe(true);
    expect(lines.some((line) => line.startsWith(",Total Expenses,"))).toBe(true);
    // The grand total line is still the one the acceptance test reads.
    expect(lines.some((line) => line.startsWith(",,TOTAL,"))).toBe(true);
  });

  it("breaks inventory accounts down by tag, replaying membership as at the report end", async () => {
    const items = new ItemService(ctx.db);
    const tag = await items.createTag("bottle");
    await items.setTagItems(tag.id, { add: [ctx.ids.itemId] });

    const current = await reports.trialBalance();
    expect(current.rows.find((row) => row.accountCode === "1220")?.tagBreakdown).toEqual([
      { name: "bottle", value: 100_000 },
    ]);

    // Before the assignment the same stock is untagged.
    const before = await reports.trialBalance({ to: "2024-06-30" });
    expect(before.rows.find((row) => row.accountCode === "1220")?.tagBreakdown).toEqual([
      { name: "Untagged", value: 100_000 },
    ]);

    // Backdate the assignment: the report now sees the tag on that date.
    await ctx.db.run(
      "UPDATE item_tag_history SET changed_at = '2024-01-01 00:00:00' WHERE tag_id = ?",
      [tag.id],
    );
    const backdated = await reports.trialBalance({ to: "2024-06-30" });
    expect(backdated.rows.find((row) => row.accountCode === "1220")?.tagBreakdown).toEqual([
      { name: "bottle", value: 100_000 },
    ]);
  });

  it("shows a tag under every inventory account whose items carry it", async () => {
    const items = new ItemService(ctx.db);
    const raw = await items.create({
      itemName: "Raw X",
      unit: "KG",
      itemType: "RAW_MATERIAL",
    });
    await items.addOpeningStock({ itemId: raw.id, quantity: 10, unitCost: 50 });
    const tag = await items.createTag("bottle");
    await items.setTagItems(tag.id, { add: [raw.id, ctx.ids.itemId] });

    const tb = await reports.trialBalance();
    expect(tb.rows.find((row) => row.accountCode === "1200")?.tagBreakdown).toEqual([
      { name: "bottle", value: 500 },
    ]);
    expect(tb.rows.find((row) => row.accountCode === "1220")?.tagBreakdown).toEqual([
      { name: "bottle", value: 100_000 },
    ]);
    const csv = await reports.trialBalanceCsv({ showZero: true });
    expect(csv).toContain("↳ bottle");
    // The memo block closes with the stock-vs-GL gap, using the account's own
    // (GL) closing balance rather than a second GL row.
    const rawRow = tb.rows.find((row) => row.accountCode === "1200")!;
    expect(csv).toContain("Difference (stock - GL)");
    expect(csv).toContain(`,${(500 - rawRow.closingDebit).toFixed(2)},`);
    expect(csv).not.toContain("GL balance");
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

  it("sums each party's spend per product across its invoices", async () => {
    const parties = new PartyService(ctx.db);
    const buyer = await parties.create({ name: "Product Buyer", partyType: "CUSTOMER" });
    await sales.createSalesInvoice({
      customerId: buyer.id,
      invoiceDate: "2030-01-01",
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 1, unitPrice: 100 }],
    });
    await sales.createSalesInvoice({
      customerId: buyer.id,
      invoiceDate: "2030-01-02",
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 2, unitPrice: 100 }],
    });

    const all = await reports.partyProductSales();
    const party = all.parties.find((p) => p.partyId === buyer.id);
    expect(party?.code).toBe(buyer.code);
    expect(party?.name).toBe("Product Buyer");
    // The same product bought twice is one row, summed.
    expect(party?.products).toHaveLength(1);
    expect(party?.products[0]?.value).toBe(300);
    expect(party?.total).toBe(300);
    expect(all.grandTotal).toBeCloseTo(
      all.parties.reduce((sum, p) => sum + p.total, 0),
      2,
    );

    // A second party makes sure the report does not collapse into one row.
    const other = await parties.create({ name: "Second Buyer", partyType: "CUSTOMER" });
    await sales.createSalesInvoice({
      customerId: other.id,
      invoiceDate: "2030-01-03",
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 5, unitPrice: 100 }],
    });
    const withBoth = await reports.partyProductSales();
    expect(withBoth.parties.map((p) => p.partyId).sort()).toEqual(
      [buyer.id, other.id].sort(),
    );
    expect(withBoth.grandTotal).toBe(800);

    // The date window keeps only the first invoice.
    const firstDay = await reports.partyProductSales("2030-01-01", "2030-01-01");
    expect(firstDay.parties.find((p) => p.partyId === buyer.id)?.total).toBe(100);
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
