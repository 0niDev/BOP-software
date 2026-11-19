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
import { AccountingService } from "../src/services/accountingService.js";
import { AccountService } from "../src/services/accountService.js";
import { assignDisplayCodes } from "../src/services/displayCodes.js";
import { ItemService } from "../src/services/itemService.js";
import { ReportService } from "../src/services/reportService.js";
import { ReportXlsx } from "../src/services/reportXlsx.js";
import { SalesInvoiceService } from "../src/services/salesInvoiceService.js";
import { PurchaseInvoiceService } from "../src/services/purchaseInvoiceService.js";
import { insertRow } from "../src/repositories/base.js";
import { accountId, closeDb, freshDb, type TestContext } from "./helpers/db.js";

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
    // The single-report workbook is the compact summary (notes 20-29), so its
    // labels come from the custom report rather than the standard 3-line sheet.
    const plFiles = open((await xlsx.profitAndLoss({})).buffer);
    const plStrings = strings(plFiles);
    expect(plStrings).toContain("Heading");
    expect(plStrings).toContain("Sales - Net");
    expect(plStrings).toContain("Profit/(Loss) C/F to B/Sheet");
    // The standard 3-line P&L still rides in the combined workbook.
    const allFiles = open((await xlsx.all({})).buffer);
    expect(worksheet(allFiles, 2)).toContain(`<v>${profitAndLoss.netProfit}</v>`);
    expect(strings(allFiles)).toContain("Revenue (net of returns)");

    const balanceSheet = await reports.balanceSheet(null);
    const bsFiles = open((await xlsx.balanceSheet({ kind: "balance-sheet" })).buffer);
    expect(worksheet(bsFiles)).toContain(`<v>${balanceSheet.assets}</v>`);
    expect(strings(bsFiles)).toContain(balanceSheet.balanced ? "YES" : "NO");
    // Assets Dr, liabilities and equity Cr, in their own column.
    expect(strings(bsFiles)).toContain("<t>Dr/Cr</t>");
    expect(strings(bsFiles)).toContain("<t>Dr</t>");
    expect(strings(bsFiles)).toContain("<t>Cr</t>");
    // The proof line must net to zero on a balanced ledger.
    expect(strings(bsFiles)).toContain("Assets - (Liabilities + Equity)");
    expect(worksheet(bsFiles)).toContain("<v>0</v>");

    const tbFiles = open((await xlsx.trialBalance({})).buffer);
    expect(strings(tbFiles)).toContain("Closing totals");
    expect(trialBalance.balanced).toBe(true);
    expect(strings(tbFiles)).toContain("YES");
  });

  it("lays the trial balance out in CoA sections with nested sub-accounts", async () => {
    const accounts = new AccountService(ctx.db);
    const child = await accounts.create({
      accountCode: "1001",
      accountName: "Cash — Petty Cash",
      accountType: "ASSET",
      parentAccountId: await accountId(ctx.db, "1000"),
    });

    const files = open((await xlsx.trialBalance({})).buffer);
    const text = strings(files);
    // Type bands in CoA order, each closed by its subtotal.
    for (const label of ["ASSETS (", "LIABILITIES (", "EQUITY (", "REVENUE (", "EXPENSES ("]) {
      expect(text).toContain(label);
    }
    expect(text).toContain("Total Assets");
    expect(text).toContain("Total Expenses");
    expect(text).not.toContain(`<t>${child.account_code}</t>`);
    // ...and prints the hierarchical display code instead (child of the first root).
    const codes = assignDisplayCodes(
      (await accounts.list(false)).map((account) => ({
        id: account.id,
        parentAccountId: account.parent_account_id,
        accountCode: account.account_code,
        isActive: account.is_active === 1,
      })),
    );
    expect(text).toContain(`<t>${codes.get(child.id)}</t>`);
    expect(text).toContain("Cash — Petty Cash");
    // The sub-account sits one level down, so its name cell is indented.
    expect(part(files, "xl/styles.xml")).toContain('indent="2"');
  });

  it("prints zero amounts as 0, not as empty cells", async () => {
    const accounts = new AccountService(ctx.db);
    const quiet = await accounts.create({
      accountCode: "1099",
      accountName: "Quiet Asset",
      accountType: "ASSET",
    });

    const files = open((await xlsx.trialBalance({})).buffer);
    // Shared strings are index-referenced, so find the row whose name cell is
    // this account and read its six money cells (columns D to I).
    const entries = part(files, "xl/sharedStrings.xml").split("<si>").slice(1);
    const index = entries.findIndex(
      (entry) => entry.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&") === quiet.account_name,
    );
    expect(index).toBeGreaterThanOrEqual(0);
    const row = worksheet(files)
      .match(/<row[^>]*>.*?<\/row>/gs)
      ?.find((block) => new RegExp(`<c r="B\\d+"[^>]*><v>${index}</v></c>`).test(block));
    expect(row).toBeDefined();
    for (const column of ["D", "E", "F", "G", "H", "I"]) {
      expect(row).toMatch(new RegExp(`<c r="${column}\\d+"[^>]*><v>0</v></c>`));
    }
  });

  it("prints the custom P&L heading notes", async () => {
    const files = open((await xlsx.custom("PL", {})).buffer);
    const text = strings(files);

    expect(text).toContain("Note");
    expect(text).toContain("Sales - Net");
    expect(text).toContain("Acc. Profit/(Loss) B/F (y/opening)");
    expect(text).toContain("29");
    // Each line carries the side it sits on, sales on the credit side.
    expect(text).toContain("<t>Dr/Cr</t>");
    expect(text).toContain("<t>Cr</t>");
  });

  it("prints the Notes to the Accounts", async () => {
    const files = open((await xlsx.notes({})).buffer);
    const text = strings(files);

    expect(sheetNames(files)).toEqual(["Notes"]);
    expect(text).toContain("Note No : 20");
    expect(text).toContain("Sales - Net");
    expect(text).toContain("Note No : 21");
    expect(text).toContain("Cost of Revenue");
    expect(text).toContain("*** End of Report ***");
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
    // The amount stays a number; the side it sits on rides in its own column.
    // A credit sale debits the customer's receivable, so the balance reads Dr.
    expect(strings(files)).toContain("<t>Dr/Cr</t>");
    expect(strings(files)).toContain("<t>Dr</t>");
  });

  it("prints every party's ledger with its closing balance and the grand total", async () => {
    const report = await reports.allPartyLedgers();
    const customer = report.parties.find((row) => row.partyId === ctx.ids.customerId);
    if (!customer) throw new Error("the customer should appear in the all-parties report");
    expect(customer.entries.length).toBeGreaterThan(0);
    expect(customer.closingBalance).toBe(750); // the 5 × 150 credit sale

    const sum = report.parties.reduce((total, row) => total + row.closingBalance, 0);
    expect(report.grandTotal).toBe(sum);
    // Opening balances stay off unless asked for.
    expect(
      report.parties.every((row) => row.entries.every((entry) => entry.voucherType !== "OPENING")),
    ).toBe(true);

    const files = open((await xlsx.allPartyLedgers({})).buffer);
    expect(sheetNames(files)).toEqual(["All Party Ledgers"]);
    expect(strings(files)).toContain("Grand total (all parties)");
    expect(worksheet(files)).toContain(`<v>${report.grandTotal}</v>`);

    // The party-type filter splits customers and suppliers.
    const customersOnly = await reports.allPartyLedgers(undefined, undefined, {
      partyType: "CUSTOMER",
    });
    expect(customersOnly.parties.some((row) => row.partyId === ctx.ids.customerId)).toBe(true);
    const suppliersOnly = await reports.allPartyLedgers(undefined, undefined, {
      partyType: "SUPPLIER",
    });
    expect(suppliersOnly.parties.some((row) => row.partyId === ctx.ids.customerId)).toBe(false);
  });

  it("exports the party product sales report with per-party totals", async () => {
    const file = await xlsx.partyProductSales({});
    const files = open(file.buffer);
    expect(file.fileName).toBe("party-product-sales_all-posted.xlsx");
    expect(sheetNames(files)).toEqual(["Party Product Sales"]);

    const text = strings(files);
    const report = await reports.partyProductSales();
    const party = report.parties.find((row) => row.partyId === ctx.ids.customerId);
    if (!party) throw new Error("the customer should appear in the product sales report");
    expect(text).toContain(party.code);
    expect(text).toContain("Grand total (all parties)");
    expect(worksheet(files)).toContain(`<v>${party.total}</v>`);
  });

  it("exports the party product purchases report with per-party totals", async () => {
    // A fresh raw material so the purchase does not disturb the demo finished
    // good's stock (the inventory test asserts its count).
    const rawItemId = await insertRow(ctx.db, "items", {
      company_id: 1,
      item_code: "PUR-REPORT",
      item_name: "Purchase Report Item",
      unit: "pcs",
      item_type: "RAW_MATERIAL",
      purchase_price: 80,
      selling_price: 0,
      is_active: 1,
    });
    const purchases = new PurchaseInvoiceService(ctx.db);
    await purchases.createPurchaseInvoice({
      supplierId: ctx.ids.supplierId,
      invoiceDate: saleDate,
      paymentType: "CREDIT",
      items: [{ itemId: rawItemId, quantity: 3, unitCost: 80 }],
    });

    const file = await xlsx.partyProductPurchases({});
    const files = open(file.buffer);
    expect(file.fileName).toBe("party-product-purchases_all-posted.xlsx");
    expect(sheetNames(files)).toEqual(["Party Product Purchases"]);

    const text = strings(files);
    const report = await reports.partyProductPurchases();
    const party = report.parties.find((row) => row.partyId === ctx.ids.supplierId);
    if (!party) throw new Error("the supplier should appear in the product purchases report");
    expect(text).toContain(party.code);
    expect(text).toContain("Grand total (all parties)");
    expect(worksheet(files)).toContain(`<v>${party.total}</v>`);
  });

  it("exports the inventory report with every item's id, name and stock", async () => {
    const items = await new ItemService(ctx.db).list();
    const file = await xlsx.inventory({});
    const files = open(file.buffer);

    expect(sheetNames(files)).toEqual(["Inventory"]);
    expect(file.fileName).toMatch(/^inventory_\d{4}-\d{2}-\d{2}\.xlsx$/);

    const text = strings(files);
    for (const header of ["ID", "Code", "Name", "Stock", "Status"]) {
      expect(text).toContain(header);
    }

    const item = items.find((row) => row.id === ctx.ids.itemId);
    if (!item) throw new Error("the demo item should be in the inventory list");
    expect(text).toContain(item.item_name);
    // Id and stock are real numbers, so a workbook column can be summed/filtered.
    const sheet = worksheet(files);
    expect(sheet).toContain(`<v>${item.id}</v>`);
    expect(sheet).toContain(`<v>${item.current_stock}</v>`);
    expect(item.current_stock).toBe(995); // 1000 opening less the 5 units sold above
    // Every listed item is printed, and the footer counts them.
    expect(text).toContain(`Total items`);
    expect(sheet).toContain(`<v>${items.length}</v>`);
  });

  it("applies the Items page stock filter to the inventory workbook", async () => {
    const zero = await xlsx.inventory({ stock: "zero" });
    const inStock = await xlsx.inventory({ stock: "in" });
    const zeroText = strings(open(zero.buffer));
    const inStockText = strings(open(inStock.buffer));

    expect(zeroText).toContain("zero stock only");
    expect(inStockText).toContain("in stock only");
    // The demo item has stock, so the two exports are disjoint.
    const item = await new ItemService(ctx.db).get(ctx.ids.itemId);
    expect(inStockText).toContain(item.item_name);
  });

  it("exports each side of the party balances with its advance column", async () => {
    const purchases = new PurchaseInvoiceService(ctx.db);
    await purchases.createPurchaseInvoice({
      supplierId: ctx.ids.supplierId,
      invoiceDate: "2026-10-09",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 2, unitCost: 100 }],
    });

    const payables = await xlsx.partyBalances({ kind: "payables", from: "", to: "" });
    expect(payables.fileName).toBe("payables_all-posted.xlsx");
    const payableFiles = open(payables.buffer);
    expect(sheetNames(payableFiles)).toEqual(["Payables"]);
    expect(strings(payableFiles)).toContain("Demo Supplier");
    expect(strings(payableFiles)).toContain("Paid in advance");

    const all = await reports.partyBalances();
    const supplier = all.find((row) => row.partyId === ctx.ids.supplierId)!;
    expect(supplier.side).toBe("PAYABLE");
    expect(worksheet(payableFiles)).toContain(`<v>${Math.abs(supplier.balance)}</v>`);

    const receivables = await xlsx.partyBalances({ kind: "receivables" });
    const receivableFiles = open(receivables.buffer);
    expect(sheetNames(receivableFiles)).toEqual(["Receivables"]);
    expect(strings(receivableFiles)).toContain("Demo Customer");
    const customer = all.find((row) => row.partyId === ctx.ids.customerId)!;
    expect(worksheet(receivableFiles)).toContain(`<v>${customer.balance}</v>`);
    expect(strings(receivableFiles)).toContain("Closing Dr");
  });

  it("rejects a party ledger request without a party", async () => {
    await expect(xlsx.partyLedger({ kind: "party-ledger" })).rejects.toThrow(/partyId is required/);
  });

  it("prints one journal voucher with its lines and totals", async () => {
    const accounting = new AccountingService(ctx.db);
    const created = await accounting.createManualJournal({
      entryDate: saleDate,
      narration: "Depreciation adjustment",
      lines: [
        { accountId: await accountId(ctx.db, "1000"), debit: 120.5 },
        { accountId: await accountId(ctx.db, "4000"), credit: 120.5 },
      ],
    });

    const file = await xlsx.journalVoucher(created.id);
    expect(file.fileName).toBe(`journal-voucher_${created.voucherNumber}.xlsx`);

    const files = open(file.buffer);
    expect(sheetNames(files)).toEqual(["Journal Voucher"]);
    expect(strings(files)).toContain(created.voucherNumber);
    expect(strings(files)).toContain("Depreciation adjustment");
    expect(strings(files)).toContain("Totals");
    // Debit and credit are real numbers, so Excel can total the columns.
    expect(worksheet(files)).toContain("<v>120.5</v>");
  });
});

describe("xlsx content type", () => {
  it("is the OpenXML spreadsheet mime type the routes send", () => {
    expect(SHEET_MIME).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });
});
