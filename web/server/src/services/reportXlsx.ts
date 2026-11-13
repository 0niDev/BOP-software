/**
 * Excel (.xlsx) rendering of the financial reports.
 *
 * The numbers come from ReportService / AccountingService — the very calls the
 * on-screen tabs and the CSV export use — so a workbook can never disagree with
 * the report it was printed from. Each report is its own downloadable workbook;
 * `all` puts the four period reports into one workbook (one sheet each), which
 * is the Excel counterpart of reportService.exportAllCsv().
 *
 * Layout mirrors the printed report: title block, frozen header row, money as
 * real numbers (so Excel can total them), and a totals/check row. Each report
 * has exactly one sheet builder, shared by the single-report workbook and the
 * combined one.
 */
import writeXlsxFile, { type Cell, type CellObject, type SheetData } from "write-excel-file/node";
import { AccountingService, type DateRangeOptions } from "./accountingService.js";
import { NotFoundError, ValidationError } from "../domain/errors.js";
import { formatDayMonthYear } from "../domain/dateValidation.js";
import type { ItemType } from "../domain/enums.js";
import type { SqlDatabase } from "../db/types.js";
import { PartyRepository } from "../repositories/partyRepository.js";
import type { ItemListRow } from "../repositories/itemRepository.js";
import { ItemService } from "./itemService.js";
import { ReportService, type LedgerEntry } from "./reportService.js";
import { CustomReportService, type CustomReportKind } from "./customReportService.js";
import { layoutTrialBalance } from "./trialBalanceLayout.js";

/** Reports that can be printed as a workbook. */
export type ReportKind =
  | "trial-balance"
  | "profit-and-loss"
  | "balance-sheet"
  | "cash-book"
  | "party-ledger"
  | "all";

export interface XlsxRequest extends DateRangeOptions {
  kind: ReportKind;
  /** Balance sheet "as at" date (defaults to the period end, else everything posted). */
  asAt?: string | null;
  /** Required for `party-ledger`. */
  partyId?: number;
}

export interface XlsxFile {
  fileName: string;
  buffer: Buffer;
}

/** Stock filter of the inventory workbook, mirroring the Items page. */
export type InventoryStockFilter = "all" | "in" | "zero";

export interface InventoryXlsxRequest {
  /** Defaults to true, like `GET /api/items`. */
  activeOnly?: boolean;
  search?: string;
  itemType?: ItemType;
  stock?: InventoryStockFilter;
}

/** The Excel mime type, for the HTTP Content-Type header. */
export const SHEET_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const COMPANY_NAME = "BOP Nutraceuticals ERP";
const MONEY_FORMAT = "#,##0.00";
/** Quantities (stock, min/max) — real numbers so Excel can total a column. */
const QUANTITY_FORMAT = "#,##0.###";

/** A style bag, passed straight through to a cell. */
type Style = Omit<CellObject, "value" | "type">;

const TITLE: Style = { fontWeight: "bold", fontSize: 15 };
const REPORT_TITLE: Style = { fontWeight: "bold", fontSize: 12 };
const SUBTITLE: Style = { textColor: "#6B7280" };
const HEADER: Style = { fontWeight: "bold", backgroundColor: "#EEF2F7", borderStyle: "thin" };
const TOTAL: Style = { fontWeight: "bold", borderStyle: "thin" };
/** Type band that opens each CoA section of the trial balance. */
const SECTION: Style = { fontWeight: "bold", backgroundColor: "#DDE3ED", columnSpan: 9 };
const MUTED: Style = { textColor: "#6B7280", fontStyle: "italic" };

type Columns = Array<{ width: number }>;

interface SheetSpec {
  data: SheetData;
  sheet: string;
  columns: Columns;
  stickyRowsCount: number;
  orientation?: "landscape";
}

function text(value: string, style: Style = {}): CellObject {
  return { value, type: String, ...style };
}

function money(value: number, style: Style = {}): CellObject {
  return { value, type: Number, format: MONEY_FORMAT, ...style };
}

/** A plain number cell (ids, quantities) with thousands separators. */
function quantity(value: number, style: Style = {}): CellObject {
  return { value, type: Number, format: QUANTITY_FORMAT, ...style };
}

/** Money cell that stays blank when the amount is zero, like the report table. */
function moneyOrBlank(value: number, style: Style = {}): CellObject | null {
  return value === 0 ? null : money(value, style);
}

/** Human label for the reporting period, e.g. "2026-01-01 to 2026-03-31". */
function periodLabel(from?: string | null, to?: string | null): string {
  if (!from && !to) return "all posted entries";
  return `${formatDayMonthYear(from) || "start"} to ${formatDayMonthYear(to) || "today"}`;
}

/** File-name-safe period, e.g. "2026-01-01_to_2026-03-31". */
function periodSlug(from?: string | null, to?: string | null): string {
  if (!from && !to) return "all-posted";
  return `${from ?? "start"}_to_${to ?? "today"}`;
}

/** What the inventory sheet covers, printed under its title. */
function inventoryScope(request: InventoryXlsxRequest, count: number): string {
  const parts: string[] = [];
  parts.push(request.activeOnly === false ? "active and inactive items" : "active items");
  if (request.itemType) parts.push(request.itemType);
  if (request.search) parts.push(`matching "${request.search}"`);
  if (request.stock === "in") parts.push("in stock only");
  if (request.stock === "zero") parts.push("zero stock only");
  return `${parts.join(" · ")} — ${count} item(s)`;
}

function generatedAt(): string {
  const now = new Date().toISOString();
  return `Generated ${formatDayMonthYear(now)} ${now.slice(11, 16)} UTC`;
}

/** Title block shared by every sheet: company, report name, period, timestamp. */
function heading(reportTitle: string, period: string): SheetData {
  return [
    [text(COMPANY_NAME, TITLE)],
    [text(reportTitle, REPORT_TITLE)],
    [text(period, SUBTITLE)],
    [text(generatedAt(), MUTED)],
    [],
  ];
}

const LEDGER_HEADER = [
  "Date",
  "Voucher",
  "Type",
  "Description",
  "Notes",
  "Debit",
  "Credit",
  "Balance",
];

const LEDGER_COLUMNS: Columns = [
  { width: 12 },
  { width: 12 },
  { width: 16 },
  { width: 40 },
  { width: 40 },
  { width: 14 },
  { width: 14 },
  { width: 16 },
];

function ledgerHeaderRow(): Cell[] {
  return LEDGER_HEADER.map((label) => text(label, HEADER));
}

function ledgerRows(entries: readonly LedgerEntry[]): SheetData {
  return entries.map((entry) => [
    text(formatDayMonthYear(entry.date)),
    text(entry.voucherNumber),
    text(entry.voucherType),
    entry.description ?? null,
    entry.notes ?? null,
    moneyOrBlank(entry.debit),
    moneyOrBlank(entry.credit),
    money(entry.balance),
  ]);
}

function ledgerFooter(entries: readonly LedgerEntry[]): SheetData {
  const debit = entries.reduce((acc, entry) => acc + entry.debit, 0);
  const credit = entries.reduce((acc, entry) => acc + entry.credit, 0);
  const closing = entries.length > 0 ? entries[entries.length - 1] : undefined;
  return [
    [],
    [
      text("Totals", TOTAL),
      null,
      null,
      null,
      null,
      money(debit, TOTAL),
      money(credit, TOTAL),
      money(closing ? closing.balance : 0, TOTAL),
    ],
  ];
}

const TRIAL_BALANCE_COLUMNS: Columns = [
  { width: 14 },
  { width: 40 },
  { width: 12 },
  { width: 15 },
  { width: 15 },
  { width: 14 },
  { width: 14 },
  { width: 15 },
  { width: 15 },
];

const TWO_COLUMN: Columns = [{ width: 32 }, { width: 18 }];

const INVENTORY_COLUMNS: Columns = [
  { width: 8 },
  { width: 16 },
  { width: 40 },
  { width: 18 },
  { width: 8 },
  { width: 15 },
  { width: 14 },
  { width: 10 },
  { width: 10 },
  { width: 12 },
  { width: 10 },
];

export class ReportXlsx {
  private readonly reports: ReportService;
  private readonly customReports: CustomReportService;
  private readonly parties: PartyRepository;
  private readonly accounting: AccountingService;
  private readonly items: ItemService;

  constructor(db: SqlDatabase, companyId = 1) {
    this.reports = new ReportService(db, companyId);
    this.customReports = new CustomReportService(db, companyId);
    this.parties = new PartyRepository(db);
    this.accounting = new AccountingService(db, companyId);
    this.items = new ItemService(db, companyId);
  }

  /** Render one report (or all of them) to an .xlsx buffer. */
  async build(request: XlsxRequest): Promise<XlsxFile> {
    switch (request.kind) {
      case "trial-balance":
        return this.trialBalance(request);
      case "profit-and-loss":
        return this.profitAndLoss(request);
      case "balance-sheet":
        return this.balanceSheet(request);
      case "cash-book":
        return this.cashBook(request);
      case "party-ledger":
        return this.partyLedger(request);
      case "all":
        return this.all(request);
      default:
        throw new ValidationError(`Unknown report '${String(request.kind)}'.`);
    }
  }

  async trialBalance(options: DateRangeOptions & { showUnpriced?: boolean }): Promise<XlsxFile> {
    return {
      fileName: `trial-balance_${periodSlug(options.from, options.to)}.xlsx`,
      buffer: await this.write([await this.trialBalanceSheet(options)]),
    };
  }

  async profitAndLoss(options: DateRangeOptions): Promise<XlsxFile> {
    return {
      fileName: `profit-and-loss_${periodSlug(options.from, options.to)}.xlsx`,
      buffer: await this.write([await this.profitAndLossSheet(options)]),
    };
  }

  async balanceSheet(request: XlsxRequest): Promise<XlsxFile> {
    const asAt = request.asAt ?? request.to ?? null;
    return {
      fileName: `balance-sheet_${asAt ? `as-at_${asAt}` : "as-at-today"}.xlsx`,
      buffer: await this.write([await this.balanceSheetSheet(asAt)]),
    };
  }

  async cashBook(options: DateRangeOptions): Promise<XlsxFile> {
    return {
      fileName: `cash-book_${periodSlug(options.from, options.to)}.xlsx`,
      buffer: await this.write([await this.cashBookSheet(options)]),
    };
  }

  /** The editable-heading P&L / balance sheet, printed exactly as the screen lays it out. */
  async custom(
    kind: CustomReportKind,
    options: { from?: string; to?: string; asAt?: string | null } = {},
  ): Promise<XlsxFile> {
    const report = await this.customReports.build(kind, options);
    const title = kind === "PL" ? "Custom Profit & Loss" : "Custom Balance Sheet";
    const subtitle =
      kind === "PL"
        ? periodLabel(options.from, options.to)
        : options.asAt
          ? `as at ${formatDayMonthYear(options.asAt)}`
          : "as at today (all posted entries)";
    const data: SheetData = [
      ...heading(title, subtitle),
      [text("Heading / Account", HEADER), text("Code", HEADER), text("Amount", HEADER)],
      ...report.headings.flatMap((line): SheetData => [
        [text(line.name, TOTAL), null, money(line.value, TOTAL)],
        ...line.rows.map(
          (row): Cell[] => [
            text(row.name, { indent: (row.depth + 1) * 2, ...(row.selected ? { fontWeight: "bold" } : {}) }),
            text(row.code),
            moneyOrBlank(row.value),
          ],
        ),
      ]),
      ...(report.unassigned.rows.length > 0
        ? [
            [text("Unassigned (not in any heading)", TOTAL), null, money(report.unassigned.value, TOTAL)] as Cell[],
            ...report.unassigned.rows.map(
              (row): Cell[] => [text(row.name), text(row.code), moneyOrBlank(row.value)],
            ),
          ]
        : ([] as Cell[][])),
      [],
      ...report.footer.map(
        (line): Cell[] => [text(line.label, TOTAL), null, money(line.value, TOTAL)],
      ),
      ...(report.balanced === null
        ? ([] as Cell[][])
        : [[text("Balanced", TOTAL), null, text(report.balanced ? "YES" : "NO", TOTAL)] as Cell[]]),
    ];
    const scope =
      kind === "PL"
        ? periodSlug(options.from, options.to)
        : options.asAt
          ? `as-at_${options.asAt}`
          : "as-at-today";
    return {
      fileName: `${kind === "PL" ? "custom-profit-and-loss" : "custom-balance-sheet"}_${scope}.xlsx`,
      buffer: await this.write([
        {
          data,
          sheet: title,
          columns: [{ width: 46 }, { width: 12 }, { width: 16 }],
          stickyRowsCount: 6,
        },
      ]),
    };
  }

  async partyLedger(request: XlsxRequest): Promise<XlsxFile> {
    if (request.partyId === undefined) {
      throw new ValidationError("partyId is required for the party ledger.");
    }
    const party = await this.parties.requireById(request.partyId);
    return {
      fileName: `party-ledger_${party.code ?? request.partyId}_${periodSlug(request.from, request.to)}.xlsx`,
      buffer: await this.write([
        await this.partyLedgerSheet(request.partyId, party.name, party.code, request),
      ]),
    };
  }

  /**
   * Every active party's ledger in one sheet: a party header row with its
   * closing balance, its entries below, then the grand total of all parties.
   * Same entries the on-screen all-parties report shows.
   */
  async allPartyLedgers(
    options: DateRangeOptions & { showOpening?: boolean },
  ): Promise<XlsxFile> {
    const report = await this.reports.allPartyLedgers(
      options.from ?? undefined,
      options.to ?? undefined,
      { showOpening: options.showOpening },
    );
    const PARTY: Style = { fontWeight: "bold", backgroundColor: "#DDE3ED" };
    const data: SheetData = [
      ...heading("All Party Ledgers", periodLabel(options.from, options.to)),
      ledgerHeaderRow(),
    ];
    for (const party of report.parties) {
      data.push([
        text(`${party.name}${party.code ? ` (${party.code})` : ""}`, PARTY),
        null,
        null,
        null,
        null,
        null,
        null,
        money(party.closingBalance, PARTY),
      ]);
      data.push(...ledgerRows(party.entries));
      data.push([]);
    }
    data.push([
      text("Grand total (all parties)", TOTAL),
      null,
      null,
      null,
      null,
      null,
      null,
      money(report.grandTotal, TOTAL),
    ]);
    return {
      fileName: `all-party-ledgers_${periodSlug(options.from, options.to)}.xlsx`,
      buffer: await this.write([
        {
          data,
          sheet: "All Party Ledgers",
          columns: LEDGER_COLUMNS,
          stickyRowsCount: 6,
          orientation: "landscape",
        },
      ]),
    };
  }

  /**
   * Every party's product purchases in one sheet: a party band with that
   * party's total, its products below, then the grand total. Same figures the
   * on-screen party product sales report shows.
   */
  async partyProductSales(options: DateRangeOptions): Promise<XlsxFile> {
    const report = await this.reports.partyProductSales(
      options.from ?? undefined,
      options.to ?? undefined,
    );
    const PARTY: Style = { fontWeight: "bold", backgroundColor: "#DDE3ED" };
    const data: SheetData = [
      ...heading("Party Product Sales", periodLabel(options.from, options.to)),
      [
        text("Party", HEADER),
        text("Code", HEADER),
        text("Product", HEADER),
        text("Value", HEADER),
      ],
    ];
    for (const party of report.parties) {
      data.push([
        text(party.name, PARTY),
        text(party.code, PARTY),
        text("Party total", PARTY),
        money(party.total, PARTY),
      ]);
      for (const product of party.products) {
        data.push([null, null, text(product.itemName), money(product.value)]);
      }
      data.push([]);
    }
    data.push([
      text("Grand total (all parties)", TOTAL),
      null,
      null,
      money(report.grandTotal, TOTAL),
    ]);
    return {
      fileName: `party-product-sales_${periodSlug(options.from, options.to)}.xlsx`,
      buffer: await this.write([
        {
          data,
          sheet: "Party Product Sales",
          columns: [{ width: 32 }, { width: 14 }, { width: 40 }, { width: 16 }],
          stickyRowsCount: 6,
        },
      ]),
    };
  }

  /**
   * One workbook holding the four period reports, one sheet each — the Excel
   * counterpart of reportService.exportAllCsv(). The balance sheet is printed
   * as at the period end, exactly like that CSV.
   */
  async all(options: DateRangeOptions): Promise<XlsxFile> {
    const sheets = await Promise.all([
      this.trialBalanceSheet(options),
      this.profitAndLossSheet(options),
      this.balanceSheetSheet(options.to ?? null),
      this.cashBookSheet(options),
    ]);
    return {
      fileName: `all-reports_${periodSlug(options.from, options.to)}.xlsx`,
      buffer: await this.write(sheets),
    };
  }

  /**
   * The inventory report: one row per item with its identity, pricing, min/max
   * and on-hand stock — the same rows and the same `current_stock` figure the
   * Items page renders, so the workbook always matches the screen.
   */
  async inventory(request: InventoryXlsxRequest = {}): Promise<XlsxFile> {
    const rows = await this.inventoryRows(request);
    const data: SheetData = [
      ...heading("Inventory Stock Report", inventoryScope(request, rows.length)),
      [
        text("ID", HEADER),
        text("Code", HEADER),
        text("Name", HEADER),
        text("Type", HEADER),
        text("Unit", HEADER),
        text("Purchase Price", HEADER),
        text("Selling Price", HEADER),
        text("Min Stock", HEADER),
        text("Max Stock", HEADER),
        text("Stock", HEADER),
        text("Status", HEADER),
      ],
      ...(rows.length === 0
        ? [[text("No items match the current filters.", MUTED)] as Cell[]]
        : rows.map(
            (row): Cell[] => [
              quantity(row.id),
              text(row.item_code),
              text(row.item_name),
              text(row.item_type),
              text(row.unit),
              money(row.purchase_price),
              money(row.selling_price),
              quantity(row.minimum_stock),
              quantity(row.maximum_stock),
              quantity(row.current_stock),
              text(row.is_active === 1 ? "Active" : "Inactive"),
            ],
          )),
      [],
      [text("Total items", TOTAL), quantity(rows.length, TOTAL)],
    ];

    return {
      fileName: `inventory_${new Date().toISOString().slice(0, 10)}.xlsx`,
      buffer: await this.write([
        {
          data,
          sheet: "Inventory",
          columns: INVENTORY_COLUMNS,
          stickyRowsCount: 6,
          orientation: "landscape",
        },
      ]),
    };
  }

  /** Item rows for the workbook, with the page's stock filter applied. */
  private async inventoryRows(request: InventoryXlsxRequest): Promise<ItemListRow[]> {
    const rows = await this.items.list({
      activeOnly: request.activeOnly !== false,
      search: request.search,
      itemType: request.itemType,
    });
    const stock = request.stock ?? "all";
    if (stock === "all") return rows;
    return stock === "zero"
      ? rows.filter((row) => Number(row.current_stock) === 0)
      : rows.filter((row) => Number(row.current_stock) !== 0);
  }

  /**
   * One manual journal voucher as a standalone workbook: title block, header
   * facts, every line, and the debit/credit totals. Same money formatting as
   * the reports, so the workbook is the printable form of that voucher.
   */
  async journalVoucher(id: number): Promise<XlsxFile> {
    const entry = await this.accounting.getJournalEntry("journal_entries", id);
    if (!entry) throw new NotFoundError(`Journal voucher ${id} not found.`);
    const lines = entry.lines as Array<{
      account_code: string;
      account_name: string;
      description: string | null;
      debit: number;
      credit: number;
    }>;
    const voucherNumber = String(entry.voucher_number);
    const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
    const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit), 0);

    const data: SheetData = [
      ...heading(`Journal Voucher — ${voucherNumber}`, `Dated ${formatDayMonthYear(String(entry.entry_date))}`),
      [text("Narration", HEADER), text(String(entry.narration ?? "—"))],
      [text("Reference", HEADER), text(String(entry.reference_no ?? "—"))],
      [],
      [
        text("Account Code", HEADER),
        text("Account Name", HEADER),
        text("Description", HEADER),
        text("Debit", HEADER),
        text("Credit", HEADER),
      ],
      ...lines.map(
        (line): Cell[] => [
          text(String(line.account_code)),
          text(String(line.account_name)),
          line.description ?? null,
          moneyOrBlank(Number(line.debit)),
          moneyOrBlank(Number(line.credit)),
        ],
      ),
      [null, null, text("Totals", TOTAL), money(totalDebit, TOTAL), money(totalCredit, TOTAL)],
    ];

    return {
      fileName: `journal-voucher_${voucherNumber}.xlsx`,
      buffer: await this.write([
        {
          data,
          sheet: "Journal Voucher",
          columns: [
            { width: 14 },
            { width: 34 },
            { width: 40 },
            { width: 14 },
            { width: 14 },
          ],
          stickyRowsCount: 8,
        },
      ]),
    };
  }

  // --- one builder per report, shared by the single and combined workbooks ---

  private async trialBalanceSheet(options: DateRangeOptions & { showUnpriced?: boolean }): Promise<SheetSpec> {
    const report = await this.reports.trialBalance(options);
    // Same organization as the CoA page: type sections in CoA order, accounts
    // nested under their parent, and a closing subtotal per section.
    const sections = layoutTrialBalance(report.rows);
    const data: SheetData = [
      ...heading("Trial Balance", periodLabel(options.from, options.to)),
      [
        text("Account Code", HEADER),
        text("Account Name", HEADER),
        text("Type", HEADER),
        text("Opening Debit", HEADER),
        text("Opening Credit", HEADER),
        text("Period Debit", HEADER),
        text("Period Credit", HEADER),
        text("Closing Debit", HEADER),
        text("Closing Credit", HEADER),
      ],
      ...sections.flatMap((section): SheetData => [
        [text(`${section.label.toUpperCase()} (${section.rows.length})`, SECTION)],
        ...section.rows.flatMap((row): SheetData => {
          const tags = row.tagBreakdown ?? [];
          // level 1 tucks a line under the memo line above it, e.g. a tag
          // breaking down the "In stock" total.
          const memo = (label: string, value: number, level = 0): Cell[] => [
            null,
            text(label, { ...MUTED, indent: row.depth * 2 + 2 + level * 2 }),
            null,
            null,
            null,
            null,
            null,
            money(value, MUTED),
            null,
          ];
          const stock = tags.reduce((total, tag) => total + tag.value, 0);
          const sold = row.soldValue;
          const used = row.usedValue;
          // Finished goods: the account should equal sold + still-on-shelf.
          const expectedInStock = sold == null ? row.closingDebit : row.closingDebit - sold;
          return [
            [
              text(row.displayCode),
              text(row.accountName, {
                indent: row.depth * 2,
                ...(row.hasChildren ? { fontWeight: "bold" } : {}),
              }),
              text(row.accountType),
              moneyOrBlank(row.openingDebit),
              moneyOrBlank(row.openingCredit),
              moneyOrBlank(row.debit),
              moneyOrBlank(row.credit),
              moneyOrBlank(row.closingDebit),
              moneyOrBlank(row.closingCredit),
            ],
            // Finished goods split into already-sold cost and what is on hand;
            // the other inventory accounts keep their per-tag lines.
            ...(sold != null
              ? [
                  memo("↳ Sold FG (per invoices)", sold),
                  memo("↳ FG in stock", stock),
                ]
              : used != null
                ? [
                    memo("↳ Used in production", used),
                    memo("↳ In stock", stock),
                    ...tags.map((tag): Cell[] => memo(`· ${tag.name}`, tag.value, 1)),
                  ]
                : tags.map((tag): Cell[] => memo(`↳ ${tag.name}`, tag.value))),
            // The memo block ends with the stock-vs-GL gap, once per account.
            ...(tags.length > 0 || sold != null || used != null
              ? [              memo("Difference (stock - GL)", stock - expectedInStock)]
              : []),
            // Opt-in: items behind the figure whose unit costs nothing.
            ...(options.showUnpriced === true && row.unpricedItems?.length
              ? [
                  memo(`Unpriced items (${row.unpricedItems!.length})`, 0),
                  ...row.unpricedItems!.map(
                    (item) =>
                      memo(`  ${item.name}`, item.quantity, 1),
                  ),
                ]
              : []),
          ];
        }),
        [
          null,
          text(`Total ${section.label}`, TOTAL),
          null,
          null,
          null,
          null,
          null,
          money(section.closingDebit, TOTAL),
          money(section.closingCredit, TOTAL),
        ],
        [],
      ]),
      [
        null,
        null,
        text("Closing totals", TOTAL),
        null,
        null,
        null,
        null,
        money(report.totalDebit, TOTAL),
        money(report.totalCredit, TOTAL),
      ],
      [],
      [
        text("Balanced", TOTAL),
        text(report.balanced ? "YES" : "NO", TOTAL),
        ...(report.balanced ? [] : [text("Debits and credits differ — investigate", MUTED)]),
      ],
    ];

    return {
      data,
      sheet: "Trial Balance",
      columns: TRIAL_BALANCE_COLUMNS,
      stickyRowsCount: 6,
      orientation: "landscape",
    };
  }

  private async profitAndLossSheet(options: DateRangeOptions): Promise<SheetSpec> {
    const report = await this.reports.profitAndLoss(options);
    return {
      data: [
        ...heading("Profit & Loss", periodLabel(options.from, options.to)),
        [text("Metric", HEADER), text("Amount", HEADER)],
        [text("Revenue (net of returns)"), money(report.revenue)],
        [text("Expenses (COGS and expense accounts)"), money(report.expenses)],
        [text("Net Profit", TOTAL), money(report.netProfit, TOTAL)],
      ],
      sheet: "Profit & Loss",
      columns: TWO_COLUMN,
      stickyRowsCount: 6,
    };
  }

  private async balanceSheetSheet(asAt: string | null): Promise<SheetSpec> {
    const report = await this.reports.balanceSheet(asAt);
    const difference = report.assets - (report.liabilities + report.equity);
    return {
      data: [
        ...heading("Balance Sheet", asAt ? `as at ${formatDayMonthYear(asAt)}` : "as at today (all posted entries)"),
        [text("Metric", HEADER), text("Amount", HEADER)],
        [text("Assets"), money(report.assets)],
        [text("Liabilities"), money(report.liabilities)],
        [text("Equity (incl. net profit)"), money(report.equity)],
        [text("Net Profit"), money(report.netProfit)],
        [],
        [text("Assets - (Liabilities + Equity)", TOTAL), money(difference, TOTAL)],
        [text("Balanced", TOTAL), text(report.balanced ? "YES" : "NO", TOTAL)],
      ],
      sheet: "Balance Sheet",
      columns: TWO_COLUMN,
      stickyRowsCount: 6,
    };
  }

  private async cashBookSheet(options: DateRangeOptions): Promise<SheetSpec> {
    const entries = await this.reports.cashBook(options.from ?? undefined, options.to ?? undefined);
    return {
      data: [
        ...heading("Cash Book — Cash in Hand (1000)", periodLabel(options.from, options.to)),
        ledgerHeaderRow(),
        ...ledgerRows(entries),
        ...ledgerFooter(entries),
      ],
      sheet: "Cash Book",
      columns: LEDGER_COLUMNS,
      stickyRowsCount: 6,
      orientation: "landscape",
    };
  }

  private async partyLedgerSheet(
    partyId: number,
    partyName: string,
    partyCode: string | null,
    options: DateRangeOptions,
  ): Promise<SheetSpec> {
    const entries = await this.reports.partyLedger(
      partyId,
      options.from ?? undefined,
      options.to ?? undefined,
    );
    return {
      data: [
        ...heading(
          `Party Ledger — ${partyName} (${partyCode ?? "no code"})`,
          periodLabel(options.from, options.to),
        ),
        ledgerHeaderRow(),
        ...ledgerRows(entries),
        ...ledgerFooter(entries),
      ],
      sheet: "Party Ledger",
      columns: LEDGER_COLUMNS,
      stickyRowsCount: 6,
      orientation: "landscape",
    };
  }

  /** Write one workbook from the given sheets. */
  private async write(sheets: SheetSpec[]): Promise<Buffer> {
    return writeXlsxFile(sheets).toBuffer();
  }
}
