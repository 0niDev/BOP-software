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
import type { SqlDatabase } from "../db/types.js";
import { PartyRepository } from "../repositories/partyRepository.js";
import { ReportService, type LedgerEntry } from "./reportService.js";
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

/** The Excel mime type, for the HTTP Content-Type header. */
export const SHEET_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const COMPANY_NAME = "BOP Nutraceuticals ERP";
const MONEY_FORMAT = "#,##0.00";

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

/** Money cell that stays blank when the amount is zero, like the report table. */
function moneyOrBlank(value: number, style: Style = {}): CellObject | null {
  return value === 0 ? null : money(value, style);
}

/** Human label for the reporting period, e.g. "2026-01-01 to 2026-03-31". */
function periodLabel(from?: string | null, to?: string | null): string {
  if (!from && !to) return "all posted entries";
  return `${from ?? "start"} to ${to ?? "today"}`;
}

/** File-name-safe period, e.g. "2026-01-01_to_2026-03-31". */
function periodSlug(from?: string | null, to?: string | null): string {
  if (!from && !to) return "all-posted";
  return `${from ?? "start"}_to_${to ?? "today"}`;
}

function generatedAt(): string {
  return `Generated ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`;
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
    text(entry.date),
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

export class ReportXlsx {
  private readonly reports: ReportService;
  private readonly parties: PartyRepository;
  private readonly accounting: AccountingService;

  constructor(db: SqlDatabase, companyId = 1) {
    this.reports = new ReportService(db, companyId);
    this.parties = new PartyRepository(db);
    this.accounting = new AccountingService(db, companyId);
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

  async trialBalance(options: DateRangeOptions): Promise<XlsxFile> {
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
      ...heading(`Journal Voucher — ${voucherNumber}`, `Dated ${String(entry.entry_date)}`),
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

  private async trialBalanceSheet(options: DateRangeOptions): Promise<SheetSpec> {
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
        ...section.rows.map(
          (row): Cell[] => [
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
        ),
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
        ...heading("Balance Sheet", asAt ? `as at ${asAt}` : "as at today (all posted entries)"),
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
