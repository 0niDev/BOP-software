/**
 * PDF report exports.
 *
 * pdf-lib compresses its content streams, so the assertions inflate every
 * FlateDecode stream and read the text operators back — the same text a viewer
 * extracts from the file. The document is also parsed back with pdf-lib, which
 * proves the bytes are a valid PDF rather than merely starting with `%PDF`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { unzlibSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import { AccountingService } from "../src/services/accountingService.js";
import { ReportPdf } from "../src/services/reportPdf.js";
import { accountId, freshDb, type TestContext } from "./helpers/db.js";

/**
 * The text drawn on every page, concatenated. Streams are sliced by the
 * `/Length` in their dictionary rather than searching for `endstream`, because
 * compressed bytes can contain that word; pdf-lib writes every text operand as
 * a hex string (`<4A4F...> Tj`).
 */
function pageText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  let text = "";
  for (const match of raw.matchAll(/(\d+) 0 obj\r?\n([\s\S]*?)stream\r?\n/g)) {
    const dict = match[2] ?? "";
    if (!dict.includes("/FlateDecode")) continue;
    const length = Number(/\/Length (\d+)/.exec(dict)?.[1] ?? 0);
    const start = (match.index ?? 0) + match[0].length;
    // Wrap fflate's Uint8Array: its own toString ignores the encoding.
    const content = Buffer.from(unzlibSync(buffer.subarray(start, start + length))).toString(
      "latin1",
    );
    for (const operand of content.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) {
      text += `${Buffer.from(operand[1] ?? "", "hex").toString("latin1")}\n`;
    }
  }
  return text;
}

describe("pdf journal voucher", () => {
  let ctx: TestContext;
  let accounting: AccountingService;
  let pdf: ReportPdf;

  beforeEach(async () => {
    ctx = await freshDb();
    accounting = new AccountingService(ctx.db);
    pdf = new ReportPdf(ctx.db);
  });
  afterEach(async () => {
    await ctx.db.close();
  });

  it("prints the voucher, its lines and its totals", async () => {
    const cashId = await accountId(ctx.db, "1000");
    const revenueId = await accountId(ctx.db, "4000");
    const created = await accounting.createManualJournal({
      entryDate: "2026-10-20",
      narration: "Depreciation adjustment",
      lines: [
        { accountId: cashId, debit: 120.5, description: "October charge" },
        { accountId: revenueId, credit: 120.5 },
      ],
    });

    const file = await pdf.journalVoucher(created.id);
    expect(file.fileName).toBe(`journal-voucher_${created.voucherNumber}.pdf`);
    expect(file.buffer.subarray(0, 5).toString()).toBe("%PDF-");

    // It parses as a PDF with exactly one page for a two-line voucher.
    const parsed = await PDFDocument.load(file.buffer);
    expect(parsed.getPageCount()).toBe(1);

    const text = pageText(file.buffer);
    expect(text).toContain("JOURNAL VOUCHER");
    expect(text).toContain(created.voucherNumber);
    expect(text).toContain("Depreciation adjustment");
    expect(text).toContain("October charge");
    expect(text).toContain("Totals");
    expect(text).toContain("120.50");
    expect(text).toContain("Page 1 of 1");
  });

  it("rejects a voucher that does not exist", async () => {
    await expect(pdf.journalVoucher(9999)).rejects.toThrow(/not found/i);
  });
});
