/**
 * PDF rendering of printable documents.
 *
 * The journal voucher is the form that gets signed and filed, and an Excel
 * workbook does not print like the on-screen voucher. Numbers come from
 * AccountingService — the same call the view dialog and the workbook export use
 * — so a printed voucher can never disagree with the screen. The chart of
 * accounts prints the same tree the page renders: accounts by type, each
 * control account followed by its parties.
 *
 * Layout is A4 portrait with the base-14 Helvetica faces, wrapped and paginated
 * here so the file opens in every viewer without embedded fonts.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { AccountingService } from "./accountingService.js";
import { AccountService, type AccountWithDeleteFlags } from "./accountService.js";
import { ReportService, type PartyBalanceRow } from "./reportService.js";
import { NotFoundError } from "../domain/errors.js";
import { formatDayMonthYear } from "../domain/dateValidation.js";
import type { SqlDatabase } from "../db/types.js";

/** The PDF mime type, for the HTTP Content-Type header. */
export const PDF_MIME = "application/pdf";

export interface PdfFile {
  fileName: string;
  buffer: Buffer;
}

const COMPANY_NAME = "BOP Nutraceuticals ERP";
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 46;
/** Space kept clear at the bottom of every page for the footer. */
const FOOTER = 56;

const INK = rgb(0.1, 0.12, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.82, 0.85, 0.89);
const BAND = rgb(0.93, 0.95, 0.97);

const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** Table columns, in points; together they span CONTENT_WIDTH. */
interface Column {
  label: string;
  width: number;
  align?: "right";
}

const COLUMNS: readonly Column[] = [
  { label: "Account Code", width: 72 },
  { label: "Account Name", width: 148 },
  { label: "Description", width: 163 },
  { label: "Debit", width: 60, align: "right" },
  { label: "Credit", width: 60, align: "right" },
];

interface VoucherLine {
  account_code: string;
  account_name: string;
  description: string | null;
  debit: number;
  credit: number;
}

/** "1,234.50" — the same grouping the rest of the app prints. */
function money(value: number): string {
  const fixed = Math.abs(value).toFixed(2);
  const [whole = "0", fraction = "00"] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${value < 0 ? "-" : ""}${grouped}.${fraction}`;
}

/** Today as an ISO date, so the stamp matches the rest of the app. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * WinAnsi (the base-14 font encoding) covers Latin-1 plus a handful of
 * typographic marks; any other code point would make drawText throw, so it is
 * replaced rather than failing the export.
 */
function clean(value: string): string {
  return value.replace(/[^\u0000-\u00FF\u20AC\u2013\u2014\u2018\u2019\u201C\u201D\u2026]/g, "?");
}

/** Break text into lines that fit `width`, keeping explicit line breaks. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of clean(text).split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(next, size) > width) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Draw one string on the current page, top edge at `top`. */
function paint(
  page: PDFPage,
  value: string,
  x: number,
  top: number,
  size: number,
  font: PDFFont,
  color = INK,
): void {
  page.drawText(clean(value), {
    x,
    // A baseline about 80% down the line box looks right for Helvetica.
    y: PAGE_HEIGHT - (top + size * 0.8),
    size,
    font,
    color,
  });
}

/** Footer on every page: the company stamp left, "Page n of m" right. */
function drawFooters(doc: PDFDocument, font: PDFFont): void {
  const pages = doc.getPages();
  pages.forEach((current, index) => {
    paint(
      current,
      `${COMPANY_NAME} · generated ${todayIso()}`,
      MARGIN,
      PAGE_HEIGHT - FOOTER / 2,
      8,
      font,
      MUTED,
    );
    const label = `Page ${index + 1} of ${pages.length}`;
    const width = font.widthOfTextAtSize(label, 8);
    paint(current, label, MARGIN + CONTENT_WIDTH - width, PAGE_HEIGHT - FOOTER / 2, 8, font, MUTED);
  });
}

/**
 * One manual journal voucher: title block, header facts, every line and the
 * debit/credit totals. Long descriptions wrap; the table repeats its header on
 * each page and the footer numbers the pages.
 */
async function renderJournalVoucher(
  entry: Record<string, unknown>,
  lines: readonly VoucherLine[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let top = MARGIN;

  const newPage = (): void => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    top = MARGIN;
  };

  const ensure = (space: number): void => {
    if (top + space > PAGE_HEIGHT - FOOTER) newPage();
  };

  const draw = (value: string, x: number, size: number, font: PDFFont, color = INK): void => {
    paint(page, value, x, top, size, font, color);
  };

  const drawTableHeader = (): void => {
    page.drawRectangle({
      x: MARGIN,
      y: PAGE_HEIGHT - top - 20,
      width: CONTENT_WIDTH,
      height: 20,
      color: BAND,
    });
    let x = MARGIN;
    for (const column of COLUMNS) {
      const labelWidth = bold.widthOfTextAtSize(column.label, 9);
      paint(
        page,
        column.label,
        column.align === "right" ? x + column.width - 6 - labelWidth : x + 6,
        top + 5,
        9,
        bold,
        MUTED,
      );
      x += column.width;
    }
    top += 20;
  };

  const voucherNumber = String(entry.voucher_number);
  const dateLabel = formatDayMonthYear(String(entry.entry_date));

  // --- title block -------------------------------------------------------
  draw(COMPANY_NAME, MARGIN, 9, regular, MUTED);
  top += 15;
  draw("JOURNAL VOUCHER", MARGIN, 18, bold);
  const numberWidth = bold.widthOfTextAtSize(clean(voucherNumber), 12);
  draw(voucherNumber, MARGIN + CONTENT_WIDTH - numberWidth, 18, bold, MUTED);
  top += 28;
  draw(`Dated ${dateLabel}`, MARGIN, 10, regular, MUTED);
  top += 22;

  // --- header facts ------------------------------------------------------
  const fact = (label: string, value: string): void => {
    const labelWidth = bold.widthOfTextAtSize(label, 9);
    draw(label, MARGIN, 9, bold, MUTED);
    const wrapped = wrap(value, regular, 10, CONTENT_WIDTH - labelWidth - 14);
    ensure(wrapped.length * 14);
    wrapped.forEach((line, index) => {
      draw(line, MARGIN + labelWidth + 14, 10, regular);
      if (index < wrapped.length - 1) top += 14;
    });
    top += 18;
  };
  fact("Narration", String(entry.narration ?? "—"));
  fact("Reference", String(entry.reference_no ?? "—"));

  // --- lines -------------------------------------------------------------
  top += 6;
  ensure(60);
  drawTableHeader();

  for (const line of lines) {
    const cells = [
      String(line.account_code),
      String(line.account_name),
      line.description ?? "",
      Number(line.debit) ? money(Number(line.debit)) : "",
      Number(line.credit) ? money(Number(line.credit)) : "",
    ];
    const wrapped = cells.map((cell, index) =>
      wrap(cell, regular, 9, (COLUMNS[index]?.width ?? 60) - 12),
    );
    const rowHeight = Math.max(20, Math.max(...wrapped.map((part) => part.length)) * 12 + 8);

    if (top + rowHeight > PAGE_HEIGHT - FOOTER) {
      newPage();
      drawTableHeader();
    }

    let x = MARGIN;
    for (const [index, column] of COLUMNS.entries()) {
      const part = wrapped[index] ?? [];
      part.forEach((text, row) => {
        const textWidth = regular.widthOfTextAtSize(text, 9);
        paint(
          page,
          text,
          column.align === "right" ? x + column.width - 6 - textWidth : x + 6,
          top + 6 + row * 12,
          9,
          regular,
        );
      });
      x += column.width;
    }
    page.drawLine({
      start: { x: MARGIN, y: PAGE_HEIGHT - top - rowHeight },
      end: { x: MARGIN + CONTENT_WIDTH, y: PAGE_HEIGHT - top - rowHeight },
      thickness: 0.5,
      color: RULE,
    });
    top += rowHeight;
  }

  // --- totals ------------------------------------------------------------
  const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
  const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit), 0);
  ensure(50);
  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - top },
    end: { x: MARGIN + CONTENT_WIDTH, y: PAGE_HEIGHT - top },
    thickness: 1,
    color: INK,
  });
  top += 9;

  let x = MARGIN;
  for (const column of COLUMNS) {
    const value =
      column.label === "Debit" ? money(totalDebit) : column.label === "Credit" ? money(totalCredit) : "";
    const text = column.label === "Description" ? "Totals" : value;
    const textWidth = bold.widthOfTextAtSize(clean(text), 10);
    paint(
      page,
      text,
      column.align === "right" ? x + column.width - 6 - textWidth : x + 6,
      top,
      10,
      bold,
    );
    x += column.width;
  }
  top += 24;

  drawFooters(doc, regular);
  return doc.save();
}

/** One printed line of the chart of accounts: a type band, account or party. */
interface CoaRow {
  kind: "section" | "account" | "party";
  /** Band caption for a section row. */
  label?: string;
  code?: string;
  name?: string;
  subtype?: string;
  balance?: number;
}

/** Section order, matching the on-screen Chart of Accounts. */
const COA_SECTIONS: ReadonlyArray<{ type: string; label: string }> = [
  { type: "ASSET", label: "Assets" },
  { type: "LIABILITY", label: "Liabilities" },
  { type: "EQUITY", label: "Equity" },
  { type: "REVENUE", label: "Revenue" },
  { type: "EXPENSE", label: "Expenses" },
];

const COA_COLUMNS: readonly Column[] = [
  { label: "Code", width: 80 },
  { label: "Account", width: 230 },
  { label: "Type / Subtype", width: 105 },
  { label: "Balance", width: 88.28, align: "right" },
];

/**
 * Flatten the account tree and the party sub-ledgers into printable rows, in
 * the same order and grouping the page uses: zero/unattached parties in a
 * "Parties" band first, then each account type, with a control account's
 * parties directly beneath it.
 */
export function buildCoaRows(
  accounts: readonly AccountWithDeleteFlags[],
  parties: readonly PartyBalanceRow[],
): CoaRow[] {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const codeOrder = (a: AccountWithDeleteFlags, b: AccountWithDeleteFlags): number =>
    a.display_code.localeCompare(b.display_code, undefined, { numeric: true });

  const childrenByParent = new Map<number, AccountWithDeleteFlags[]>();
  const roots: AccountWithDeleteFlags[] = [];
  for (const account of accounts) {
    const parentId = account.parent_account_id;
    if (parentId == null || !byId.has(parentId)) {
      roots.push(account);
      continue;
    }
    const list = childrenByParent.get(parentId) ?? [];
    list.push(account);
    childrenByParent.set(parentId, list);
  }
  roots.sort(codeOrder);
  for (const list of childrenByParent.values()) list.sort(codeOrder);

  const partiesByAccount = new Map<number, PartyBalanceRow[]>();
  const unattached: PartyBalanceRow[] = [];
  for (const party of parties) {
    const account = byId.get(party.accountId);
    if (!account) {
      unattached.push(party);
      continue;
    }
    const list = partiesByAccount.get(account.id) ?? [];
    list.push(party);
    partiesByAccount.set(account.id, list);
  }
  // Largest balance first, then name — the page's order.
  for (const list of partiesByAccount.values()) {
    list.sort(
      (a, b) => Math.abs(b.balance) - Math.abs(a.balance) || a.name.localeCompare(b.name),
    );
  }
  unattached.sort((a, b) => a.name.localeCompare(b.name));

  const partyRow = (party: PartyBalanceRow): CoaRow => ({
    kind: "party",
    code: party.code,
    name: party.name,
    subtype: party.isActive === 1 ? "party" : "party · inactive",
    balance: party.balance,
  });

  const accountRow = (account: AccountWithDeleteFlags): CoaRow => ({
    kind: "account",
    code: account.display_code,
    name: account.account_name,
    subtype: [account.account_subtype ?? "", account.is_active === 1 ? "" : "inactive"]
      .filter(Boolean)
      .join(" · "),
    balance: account.opening_balance,
  });

  const rows: CoaRow[] = [];
  if (unattached.length > 0) {
    rows.push({ kind: "section", label: "Parties" });
    for (const party of unattached) rows.push(partyRow(party));
  }

  for (const section of COA_SECTIONS) {
    const typeRoots = roots.filter((account) => account.account_type === section.type);
    if (typeRoots.length === 0) continue;
    rows.push({ kind: "section", label: section.label });
    const walk = (account: AccountWithDeleteFlags): void => {
      rows.push(accountRow(account));
      for (const child of childrenByParent.get(account.id) ?? []) walk(child);
      for (const party of partiesByAccount.get(account.id) ?? []) rows.push(partyRow(party));
    };
    for (const root of typeRoots) walk(root);
  }
  return rows;
}

/**
 * The chart of accounts: type bands, every account (inactive marked) and each
 * control account's parties with their closing balances. Long names wrap; the
 * table header and the current band repeat on each page.
 */
async function renderChartOfAccounts(rows: readonly CoaRow[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let top = MARGIN;
  let band: string | null = null;

  const newPage = (): void => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    top = MARGIN;
  };

  const drawTableHeader = (): void => {
    page.drawRectangle({
      x: MARGIN,
      y: PAGE_HEIGHT - top - 20,
      width: CONTENT_WIDTH,
      height: 20,
      color: BAND,
    });
    let x = MARGIN;
    for (const column of COA_COLUMNS) {
      const labelWidth = bold.widthOfTextAtSize(column.label, 9);
      paint(
        page,
        column.label,
        column.align === "right" ? x + column.width - 6 - labelWidth : x + 6,
        top + 5,
        9,
        bold,
        MUTED,
      );
      x += column.width;
    }
    top += 20;
  };

  const drawBand = (label: string): void => {
    page.drawRectangle({
      x: MARGIN,
      y: PAGE_HEIGHT - top - 18,
      width: CONTENT_WIDTH,
      height: 18,
      color: BAND,
    });
    paint(page, label.toUpperCase(), MARGIN + 6, top + 4, 9, bold, MUTED);
    top += 18;
  };

  // --- title block -------------------------------------------------------
  paint(page, COMPANY_NAME, MARGIN, top, 9, regular, MUTED);
  top += 15;
  paint(page, "CHART OF ACCOUNTS", MARGIN, top, 18, bold);
  const stamp = `generated ${todayIso()}`;
  paint(page, stamp, MARGIN + CONTENT_WIDTH - regular.widthOfTextAtSize(stamp, 9), top + 6, 9, regular, MUTED);
  top += 28;
  paint(
    page,
    "Account rows show the account's opening balance; party rows show the party's closing ledger balance.",
    MARGIN,
    top,
    9,
    regular,
    MUTED,
  );
  top += 22;
  drawTableHeader();

  // --- rows ---------------------------------------------------------------
  for (const row of rows) {
    if (row.kind === "section") {
      if (top + 36 > PAGE_HEIGHT - FOOTER) {
        newPage();
        drawTableHeader();
      }
      band = row.label ?? null;
      drawBand(row.label ?? "");
      continue;
    }

    const cells = [
      row.code ?? "",
      row.name ?? "",
      row.subtype ?? "",
      row.balance ? money(row.balance) : "",
    ];
    const wrapped = cells.map((cell, index) =>
      wrap(cell, regular, 9, (COA_COLUMNS[index]?.width ?? 60) - 12),
    );
    const rowHeight = Math.max(18, Math.max(...wrapped.map((part) => part.length)) * 12 + 6);

    if (top + rowHeight > PAGE_HEIGHT - FOOTER) {
      newPage();
      drawTableHeader();
      if (band) drawBand(band);
    }

    let x = MARGIN;
    for (const [index, column] of COA_COLUMNS.entries()) {
      const part = wrapped[index] ?? [];
      part.forEach((text, line) => {
        const textWidth = regular.widthOfTextAtSize(text, 9);
        paint(
          page,
          text,
          column.align === "right" ? x + column.width - 6 - textWidth : x + 6,
          top + 5 + line * 12,
          9,
          regular,
        );
      });
      x += column.width;
    }
    page.drawLine({
      start: { x: MARGIN, y: PAGE_HEIGHT - top - rowHeight },
      end: { x: MARGIN + CONTENT_WIDTH, y: PAGE_HEIGHT - top - rowHeight },
      thickness: 0.5,
      color: RULE,
    });
    top += rowHeight;
  }

  drawFooters(doc, regular);
  return doc.save();
}

export class ReportPdf {
  private readonly accounting: AccountingService;
  private readonly accounts: AccountService;
  private readonly reports: ReportService;

  constructor(db: SqlDatabase, companyId = 1) {
    this.accounting = new AccountingService(db, companyId);
    this.accounts = new AccountService(db, companyId);
    this.reports = new ReportService(db, companyId);
  }

  /**
   * One manual journal voucher as a standalone PDF. Entries owned by another
   * document are rejected by the accounting service, exactly as the workbook
   * export does.
   */
  async journalVoucher(id: number): Promise<PdfFile> {
    const entry = await this.accounting.getJournalEntry("journal_entries", id);
    if (!entry) throw new NotFoundError(`Journal voucher ${id} not found.`);
    const voucherNumber = String(entry.voucher_number);
    const lines = (entry.lines ?? []) as VoucherLine[];

    return {
      fileName: `journal-voucher_${voucherNumber}.pdf`,
      buffer: Buffer.from(await renderJournalVoucher(entry, lines)),
    };
  }

  /**
   * The whole Chart of Accounts as a printable PDF: inactive accounts are
   * included and marked, so the printout is the full chart, not just the tab
   * and search the page happens to be showing.
   */
  async chartOfAccounts(): Promise<PdfFile> {
    const [accounts, parties] = await Promise.all([
      this.accounts.listWithDeleteFlags(false),
      this.reports.partyBalances(),
    ]);
    return {
      fileName: `chart-of-accounts_${todayIso()}.pdf`,
      buffer: Buffer.from(await renderChartOfAccounts(buildCoaRows(accounts, parties))),
    };
  }
}
