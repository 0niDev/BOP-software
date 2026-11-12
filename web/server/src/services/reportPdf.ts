/**
 * PDF rendering of printable documents.
 *
 * The journal voucher is the form that gets signed and filed, and an Excel
 * workbook does not print like the on-screen voucher. Numbers come from
 * AccountingService — the same call the view dialog and the workbook export use
 * — so a printed voucher can never disagree with the screen.
 *
 * Layout is A4 portrait with the base-14 Helvetica faces, wrapped and paginated
 * here so the file opens in every viewer without embedded fonts.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { AccountingService } from "./accountingService.js";
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

  // --- footer ------------------------------------------------------------
  const pages = doc.getPages();
  pages.forEach((current, index) => {
    paint(
      current,
      `${COMPANY_NAME} · generated ${todayIso()}`,
      MARGIN,
      PAGE_HEIGHT - FOOTER / 2,
      8,
      regular,
      MUTED,
    );
    const label = `Page ${index + 1} of ${pages.length}`;
    const width = regular.widthOfTextAtSize(label, 8);
    paint(current, label, MARGIN + CONTENT_WIDTH - width, PAGE_HEIGHT - FOOTER / 2, 8, regular, MUTED);
  });

  return doc.save();
}

export class ReportPdf {
  private readonly accounting: AccountingService;

  constructor(db: SqlDatabase, companyId = 1) {
    this.accounting = new AccountingService(db, companyId);
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
}
