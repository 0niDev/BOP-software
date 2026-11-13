import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../src/http/app.js";
import { AccountService } from "../src/services/accountService.js";
import { AccountingService } from "../src/services/accountingService.js";
import {
  CustomReportService,
  NET_PROFIT_ACCOUNT_ID,
  OPENING_PROFIT_ACCOUNT_ID,
} from "../src/services/customReportService.js";
import { ReportService } from "../src/services/reportService.js";
import { ReportXlsx } from "../src/services/reportXlsx.js";
import { SalesInvoiceService } from "../src/services/salesInvoiceService.js";
import { accountId, freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let custom: CustomReportService;
let reports: ReportService;
let accounting: AccountingService;
let accountService: AccountService;

beforeEach(async () => {
  ctx = await freshDb();
  custom = new CustomReportService(ctx.db);
  reports = new ReportService(ctx.db);
  accounting = new AccountingService(ctx.db);
  accountService = new AccountService(ctx.db);
});
afterEach(async () => {
  await ctx.db.close();
});

/** One cash sale, so revenue, COGS and stock all move. */
async function seedSale(): Promise<void> {
  const sales = new SalesInvoiceService(ctx.db);
  await sales.createSalesInvoice({
    customerId: ctx.ids.customerId,
    invoiceDate: "2026-10-08",
    paymentType: "CASH",
    items: [{ itemId: ctx.ids.itemId, quantity: 5, unitPrice: 150 }],
  });
}

describe("CustomReportService", () => {
  it("defaults to the printed P&L layout with its note numbers", async () => {
    const result = await custom.build("PL");

    expect(result.headings.map((heading) => heading.name)).toEqual([
      "Sales - Net",
      "Cost of Sales",
      "Gross Profit/(Loss)",
      "Operating Expenses",
      "Administrative Expenses",
      "Selling & Distribution",
      "Operating Profit/(Loss)",
      "Other Income",
      "Financial Charges",
      "Others",
      "Profit/(Loss) Before Taxation",
      "Taxation (Current)",
      "Profit/(Loss) After Taxation",
      "Prior Year Adjustment",
      "Acc. Profit/(Loss) B/F (y/opening)",
      "Profit/(Loss) C/F to B/Sheet",
    ]);
    expect(result.headings.filter((heading) => heading.note).map((heading) => heading.note)).toEqual([
      "20",
      "21",
      "22",
      "23",
      "24",
      "25",
      "26",
      "27",
      "28",
      "29",
    ]);
    expect(result.balanced).toBeNull();
  });

  it("calculates the P&L subtotals from selected accounts and opening B/F", async () => {
    const revenue = await accountId(ctx.db, "4000");
    const costOfSales = await accountId(ctx.db, "5000");
    const admin = await accountId(ctx.db, "6000");
    const selling = await accountId(ctx.db, "6100");
    const retained = await accountId(ctx.db, "3100");
    const cash = await accountId(ctx.db, "1000");
    const otherIncome = await accountService.create({
      accountName: "Other Income Test",
      accountType: "REVENUE",
    });
    const finance = await accountService.create({
      accountName: "Finance Cost Test",
      accountType: "EXPENSE",
    });
    const others = await accountService.create({
      accountName: "Other Expense Test",
      accountType: "EXPENSE",
    });
    const tax = await accountService.create({
      accountName: "Current Tax Test",
      accountType: "EXPENSE",
    });

    const post = (entryDate: string, accountIdValue: number, amount: number) =>
      accounting.createManualJournal({
        entryDate,
        narration: "custom P&L test",
        lines: [
          { accountId: accountIdValue, debit: amount, credit: 0 },
          { accountId: cash, debit: 0, credit: amount },
        ],
      });
    const postCredit = (entryDate: string, accountIdValue: number, amount: number) =>
      accounting.createManualJournal({
        entryDate,
        narration: "custom P&L test",
        lines: [
          { accountId: cash, debit: amount, credit: 0 },
          { accountId: accountIdValue, debit: 0, credit: amount },
        ],
      });

    // Opening balances at 30 September: retained earnings 200, plus net profit 60.
    await postCredit("2026-09-30", retained, 200);
    await postCredit("2026-09-30", revenue, 100);
    await post("2026-09-30", costOfSales, 40);

    // October movement.
    await postCredit("2026-10-10", revenue, 1000);
    await post("2026-10-10", costOfSales, 300);
    await post("2026-10-10", admin, 100);
    await post("2026-10-10", selling, 50);
    await postCredit("2026-10-10", otherIncome.id, 40);
    await post("2026-10-10", finance.id, 20);
    await post("2026-10-10", others.id, 10);
    await post("2026-10-10", tax.id, 30);

    const template = await custom.getTemplate("PL");
    const assign = (headingId: string, accountIds: number[]): void => {
      const heading = template.find((item) => item.id === headingId);
      if (!heading) throw new Error(`missing default heading ${headingId}`);
      heading.accountIds = accountIds;
    };
    assign("sales-net", [revenue]);
    assign("cost-of-sales", [costOfSales]);
    assign("administrative-expenses", [admin]);
    assign("selling-distribution", [selling]);
    assign("other-income", [otherIncome.id]);
    assign("financial-charges", [finance.id]);
    assign("others", [others.id]);
    assign("taxation-current", [tax.id]);
    assign("accumulated-profit-bf", [OPENING_PROFIT_ACCOUNT_ID, retained]);
    await custom.saveTemplate("PL", { headings: template });

    const result = await custom.build("PL", {
      from: "2026-10-01",
      to: "2026-10-31",
    });
    const values = Object.fromEntries(
      result.headings.map((heading) => [heading.id, heading.value]),
    );
    expect(values).toMatchObject({
      "sales-net": 1000,
      "cost-of-sales": 300,
      "gross-profit": 700,
      "administrative-expenses": 100,
      "selling-distribution": 50,
      "operating-expenses": 150,
      "operating-profit": 550,
      "other-income": 40,
      "financial-charges": 20,
      others: 10,
      "profit-before-tax": 560,
      "taxation-current": 30,
      "profit-after-tax": 530,
      "prior-year-adjustment": 0,
      "accumulated-profit-bf": 260,
      "profit-cf": 790,
    });
    const bf = result.headings.find((heading) => heading.id === "accumulated-profit-bf");
    expect(bf?.rows.map((row) => [row.name, row.value])).toEqual([
      ["Opening profit/(loss) before period", 60],
      ["Retained Earnings", 200],
    ]);
    expect(result.unassigned.value).toBe(0);
  });

  it("counts a picked parent and its sub-accounts once", async () => {
    const parent = await accountService.create({ accountName: "Direct Costs", accountType: "EXPENSE" });
    const child = await accountService.create({
      accountName: "Packaging",
      accountType: "EXPENSE",
      parentAccountId: parent.id,
    });
    const cashId = await accountId(ctx.db, "1000");
    await accounting.createManualJournal({
      entryDate: "2026-10-10",
      narration: "packaging used",
      lines: [
        { accountId: child.id, debit: 100 },
        { accountId: cashId, credit: 100 },
      ],
    });

    await custom.saveTemplate("PL", {
      headings: [
        {
          id: "costs",
          name: "Costs",
          kind: "accounts",
          accountIds: [parent.id, child.id],
          parts: [],
        },
      ],
    });
    const both = await custom.build("PL");
    expect(both.headings[0]?.value).toBe(100);
    expect(
      both.headings[0]?.rows.map((row) => [row.name, row.depth, row.value, row.selected]),
    ).toEqual([
      ["Direct Costs", 0, 0, true],
      ["Packaging", 1, 100, true],
    ]);

    // Picking only the parent still covers the child's value and lines.
    await custom.saveTemplate("PL", {
      headings: [
        { id: "costs", name: "Costs", kind: "accounts", accountIds: [parent.id], parts: [] },
      ],
    });
    const parentOnly = await custom.build("PL");
    expect(parentOnly.headings[0]?.value).toBe(100);
    expect(parentOnly.headings[0]?.rows.map((row) => row.name)).toEqual([
      "Direct Costs",
      "Packaging",
    ]);
  });

  it("keeps unassigned accounts visible so the headings tie out", async () => {
    await seedSale();
    const revenueId = await accountId(ctx.db, "4000");
    await custom.saveTemplate("PL", {
      headings: [
        { id: "sales", name: "Sales", kind: "accounts", accountIds: [revenueId], parts: [] },
      ],
    });
    const standard = await reports.profitAndLoss();
    const result = await custom.build("PL");
    const headingTotal = result.headings.reduce((total, heading) => total + heading.value, 0);
    // Values keep their natural sign (revenue and expenses are both positive),
    // so nothing is lost: the whole report sums to revenue + expenses, and the
    // sign flip gives back the standard net profit.
    expect(headingTotal + result.unassigned.value).toBe(standard.revenue + standard.expenses);
    expect(headingTotal - result.unassigned.value).toBe(standard.netProfit);
    // Every expense account is unassigned, and the section says so.
    expect(result.unassigned.rows.length).toBeGreaterThan(0);
    expect(result.unassigned.rows.every((row) => row.value !== 0)).toBe(true);
  });

  it("rejects a subtotal that names a missing or non-account heading", async () => {
    await expect(
      custom.saveTemplate("PL", {
        headings: [
          {
            id: "total",
            name: "Total",
            kind: "subtotal",
            accountIds: [],
            parts: [{ headingId: "nope", sign: 1 }],
          },
        ],
      }),
    ).rejects.toThrow(/not an account heading/);

    await expect(
      custom.saveTemplate("PL", {
        headings: [
          { id: "first", name: "First", kind: "subtotal", accountIds: [], parts: [] },
          {
            id: "second",
            name: "Second",
            kind: "subtotal",
            accountIds: [],
            parts: [{ headingId: "first", sign: -1 }],
          },
        ],
      }),
    ).rejects.toThrow(/not an account heading/);
  });

  it("rejects an account from another statement and round-trips a saved template", async () => {
    const cashId = await accountId(ctx.db, "1000");
    await expect(
      custom.saveTemplate("PL", {
        headings: [
          { id: "x", name: "X", kind: "accounts", accountIds: [cashId], parts: [] },
        ],
      }),
    ).rejects.toThrow(/cannot be used/);

    const revenueId = await accountId(ctx.db, "4000");
    await custom.saveTemplate("PL", {
      headings: [
        {
          id: "sales",
          name: " Sales ",
          kind: "accounts",
          accountIds: [revenueId, 999_999],
          parts: [],
        },
      ],
    });
    expect(await custom.getTemplate("PL")).toEqual([
      { id: "sales", name: "Sales", kind: "accounts", accountIds: [revenueId], parts: [] },
    ]);
  });

  it("balances the default balance sheet and matches the standard statement", async () => {
    await seedSale();
    const standard = await reports.balanceSheet();
    const result = await custom.build("BS");

    expect(result.balanced).toBe(true);
    const footer = new Map(result.footer.map((line) => [line.label, line.value]));
    expect(footer.get("Assets")).toBe(standard.assets);
    expect(footer.get("Liabilities")).toBe(standard.liabilities);
    expect(footer.get("Equity (incl. net profit)")).toBe(standard.equity);
    expect(footer.get("Net profit")).toBe(standard.netProfit);
    expect(result.unassigned.rows).toEqual([]);

    const equity = result.headings.find((heading) => heading.name === "Equity");
    expect(
      equity?.rows.some(
        (row) =>
          row.accountId === NET_PROFIT_ACCOUNT_ID && row.value === standard.netProfit,
      ),
    ).toBe(true);
  });

  it("writes the custom report as CSV and Excel", async () => {
    await seedSale();
    const csv = await custom.customCsv("PL");
    expect(csv).toContain("Custom Profit & Loss");
    expect(csv).toContain("Sales - Net");
    expect(csv).toContain("Profit/(Loss) C/F to B/Sheet");
    expect(csv).toContain("Heading,Account Code,Account,Amount,Note");
    expect(csv).toContain("Sales - Net,,,0.00,20");

    const file = await new ReportXlsx(ctx.db).custom("PL");
    expect(file.fileName).toMatch(/^custom-profit-and-loss_/);
    expect(file.buffer.subarray(0, 2).toString()).toBe("PK");
  });
});

/**
 * The plain `/custom/:kind` route would swallow `pl.csv`, so the order of the
 * three GETs and the HTTP template round trip are worth one check.
 */
describe("custom report routes", () => {
  let server: Server;
  let baseUrl: string;
  let token: string;

  beforeEach(async () => {
    server = createApp(ctx.db).listen(0);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no port");
    baseUrl = `http://127.0.0.1:${address.port}`;
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });
    token = ((await res.json()) as { token: string }).token;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const get = (path: string): Promise<Response> =>
    fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${token}` } });

  it("serves the report, saves a template, and downloads CSV and Excel", async () => {
    await seedSale();
    const revenueId = await accountId(ctx.db, "4000");

    const initial = await get("/api/reports/custom/pl");
    expect(initial.status).toBe(200);
    expect(((await initial.json()) as { headings: unknown[] }).headings).toHaveLength(16);

    const saved = await fetch(`${baseUrl}/api/reports/custom/pl`, {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        headings: [
          { id: "sales", name: "Sales", kind: "accounts", accountIds: [revenueId], parts: [] },
        ],
      }),
    });
    expect(saved.status).toBe(200);
    expect(await (await get("/api/reports/custom/pl")).json()).toMatchObject({
      headings: [{ name: "Sales", value: 750 }],
    });

    const csv = await get("/api/reports/custom/pl.csv");
    expect(csv.status).toBe(200);
    expect(csv.headers.get("content-type")).toContain("text/csv");
    expect(await csv.text()).toContain("Sales");

    const xlsx = await get("/api/reports/custom/pl.xlsx");
    expect(xlsx.status).toBe(200);
    expect(Buffer.from(await xlsx.arrayBuffer()).subarray(0, 2).toString()).toBe("PK");

    expect((await get("/api/reports/custom/zz")).status).toBe(400);
  });
});
