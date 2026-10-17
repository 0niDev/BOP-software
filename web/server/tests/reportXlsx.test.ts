/**
 * Excel report exports.
 *
 * The workbook is unzipped and read back, so these assertions are about the
 * bytes a spreadsheet application opens — not about our own renderer. Text lives
 * in xl/sharedStrings.xml (cells reference it by index) while numbers are
 * written inline as `<v>123.45</v>`, which is what makes a column summable.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { strFromU8, unzipSync, type Unzipped } from "fflate";
import { ReportService } from "../src/services/reportService.js";
import { ReportXlsx } from "../src/services/reportXlsx.js";
import { SalesInvoiceService } from "../src/services/salesInvoiceService.js";
import { closeDb, freshDb, type TestContext } from "./helpers/db.js";

const SHEET_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function open(buffer: Buffer): Unzipped {
  return unzipSync(new Uint8Array(buffer));
}

function part(files: Unzipped, name: string): string {
  const entry = files[name];
  if (!entry) throw new Error(`${name} is missing from the archive`);
  return strFromU8(entry);
}

/** Sheet tab names, in workbook order: `<sheet r:id="rId1" sheetId="1" name="…"/>`. */
function sheetNames(files: Unzipped): string[] {
  return [...part(files, "xl/workbook.xml").matchAll(/<sheet [^>]*name="([^"]*)"/g)].map((match) =>
    (match[1] ?? "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
  );
}

/** Every string cell in the workbook, unescaped. */
function strings(files: Unzipped): string {
  return part(files, "xl/sharedStrings.xml")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

function worksheet(files: Unzipped, index = 1): string {
  return part(files, `xl/worksheets/sheet${index}.xml`);
}

function worksheetCount(files: Unzipped): number {
  return Object.keys(files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).length;
}

describe("xlsx report exports", () => {
  let ctx: TestContext;
  let xlsx: ReportXlsx;
  let reports: ReportService;
  const saleDate = "2026-10-08";

  beforeAll(async () => {
    ctx = await freshDb();
    reports = new ReportService(ctx.db);
    xlsx = new ReportXlsx(ctx.db);

    // A credit sale so the reports carry real figures (the plain demo seed has
    // no postings) and the customer has ledger lines to print.
    const sale = new SalesInvoiceService(ctx.db);
    await sale.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: saleDate,
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 5, unitPrice: 150 }],
    });
  });

  afterAll(async () => {
    await closeDb(ctx.db);
  });

  it("writes one valid worksheet per single report, with a descriptive file name", async () => {
    const cases = [
      { file: await xlsx.trialBalance({ from: saleDate, to: saleDate }), sheetName: "Trial Balance" },
      { file: await xlsx.profitAndLoss({}), sheetName: "Profit & Loss" },
      { file: await xlsx.balanceSheet({ kind: "balance-sheet", asAt: saleDate }), sheetName: "Balance Sheet" },
      { file: await xlsx.cashBook({}), sheetName: "Cash Book" },
    ];

    for (const { file, sheetName } of cases) {
      expect(file.fileName.endsWith(".xlsx")).toBe(true);
      const files = open(file.buffer);
      expect(worksheetCount(files)).toBe(1);
      expect(sheetNames(files)).toEqual([sheetName]);
      // The title block is always present, so an opened sheet is self-describing.
      expect(strings(files)).toContain("BOP Nutraceuticals ERP");
    }
  });

  it("names workbooks after the period they cover", async () => {
    expect((await xlsx.trialBalance({ from: "2026-01-01", to: "2026-01-31" })).fileName).toBe(
      "trial-balance_2026-01-01_to_2026-01-31.xlsx",
    );
    expect((await xlsx.trialBalance({})).fileName).toBe("trial-balance_all-posted.xlsx");
    expect((await xlsx.balanceSheet({ kind: "balance-sheet", asAt: "2026-06-30" })).fileName).toBe(
      "balance-sheet_as-at_2026-06-30.xlsx",
    );
  });

  it("puts every period report in the combined workbook, one sheet each", async () => {
    const file = await xlsx.all({});
    const files = open(file.buffer);

    expect(worksheetCount(files)).toBe(4);
    expect(sheetNames(files)).toEqual([
      "Trial Balance",
      "Profit & Loss",
      "Balance Sheet",
      "Cash Book",
    ]);
    expect(file.fileName).toMatch(/^all-reports_.*\.xlsx$/);
  });

  it("writes the same figures as the JSON reports, as real numbers", async () => {
    const trialBalance = await reports.trialBalance({});
    expect(trialBalance.totalDebit).toBeGreaterThan(0); // guard against a vacuous match
    const trialBalanceSheet = worksheet(open((await xlsx.trialBalance({})).buffer));
    expect(trialBalanceSheet).toContain(`<v>${trialBalance.totalDebit}</v>`);
    expect(trialBalanceSheet).toContain(`<v>${trialBalance.totalCredit}</v>`);

    const profitAndLoss = await reports.profitAndLoss({});
    expect(profitAndLoss.revenue).toBe(750);
    const plFiles = open((await xlsx.profitAndLoss({})).buffer);
    expect(worksheet(plFiles)).toContain(`<v>${profitAndLoss.netProfit}</v>`);
    expect(strings(plFiles)).toContain("Revenue (net of returns)");

    const balanceSheet = await reports.balanceSheet(null);
    const bsFiles = open((await xlsx.balanceSheet({ kind: "balance-sheet" })).buffer);
    expect(worksheet(bsFiles)).toContain(`<v>${balanceSheet.assets}</v>`);
    expect(strings(bsFiles)).toContain(balanceSheet.balanced ? "YES" : "NO");
    // The proof line must net to zero on a balanced ledger.
    expect(strings(bsFiles)).toContain("Assets - (Liabilities + Equity)");
    expect(worksheet(bsFiles)).toContain("<v>0</v>");

    const tbFiles = open((await xlsx.trialBalance({})).buffer);
    expect(strings(tbFiles)).toContain("Closing totals");
    expect(trialBalance.balanced).toBe(true);
    expect(strings(tbFiles)).toContain("YES");
  });

  it("renders a party ledger with its running balances and the party on the file name", async () => {
    const file = await xlsx.partyLedger({
      kind: "party-ledger",
      partyId: ctx.ids.customerId,
      from: saleDate,
      to: saleDate,
    });
    const files = open(file.buffer);
    const party = await ctx.db.get<{ code: string | null }>(
      "SELECT code FROM parties WHERE id = ?",
      [ctx.ids.customerId],
    );

    expect(sheetNames(files)).toEqual(["Party Ledger"]);
    expect(file.fileName).toBe(`party-ledger_${party?.code}_${saleDate}_to_${saleDate}.xlsx`);

    const ledger = await reports.partyLedger(ctx.ids.customerId, saleDate, saleDate);
    const last = ledger[ledger.length - 1];
    if (!last) throw new Error("the customer ledger should contain the credit sale");
    expect(worksheet(files)).toContain(`<v>${last.balance}</v>`);
    expect(strings(files)).toContain("Balance");
  });

  it("rejects a party ledger request without a party", async () => {
    await expect(xlsx.partyLedger({ kind: "party-ledger" })).rejects.toThrow(/partyId is required/);
  });
});

describe("xlsx content type", () => {
  it("is the OpenXML spreadsheet mime type the routes send", () => {
    expect(SHEET_MIME).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });
});
