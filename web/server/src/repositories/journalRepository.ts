import type { Row, SqlDatabase } from "../db/types.js";
import { AppError, ValidationError } from "../domain/errors.js";
import { insertRow, type InsertData } from "./base.js";

export interface JournalEntryHeader {
  company_id: number;
  voucher_number: string;
  voucher_type: string;
  entry_date: string;
  reference_no?: string | null;
  narration?: string | null;
  source_table?: string | null;
  source_id?: number | null;
  is_posted?: number;
  created_by?: number | null;
}

export interface JournalLineRow {
  account_id: number;
  debit: number;
  credit: number;
  party_id?: number | null;
  description?: string | null;
}

/** Maps a voucher type to the numbering_sequences document_type. */
const NUMBERING_DOC_TYPE: Record<string, string> = {
  SALES: "SALES_INVOICE",
  PURCHASE: "PURCHASE_INVOICE",
  PAYMENT: "PAYMENT",
  RECEIPT: "RECEIPT",
  JOURNAL: "JOURNAL_VOUCHER",
  OPENING: "OPENING",
  CUSTOMER: "CUSTOMER",
  SUPPLIER: "SUPPLIER",
};

export class JournalRepository {
  constructor(private readonly db: SqlDatabase) {}

  /**
   * Insert one journal entry header plus all of its lines. Must be called
   * inside a transaction together with whatever else must commit atomically
   * (e.g. the sales invoice row).
   */
  async insertEntry(header: JournalEntryHeader, lines: JournalLineRow[]): Promise<number> {
    if (lines.length < 2) {
      throw new ValidationError("A journal entry needs at least two lines.");
    }
    const entryId = await insertRow(this.db, "journal_entries", {
      ...header,
      is_posted: header.is_posted ?? 1,
    });
    for (const [order, line] of lines.entries()) {
      const row: InsertData = {
        journal_entry_id: entryId,
        account_id: line.account_id,
        debit: line.debit,
        credit: line.credit,
        description: line.description ?? null,
        line_order: order,
      };
      if (line.party_id !== undefined && line.party_id !== null) {
        row.party_id = line.party_id;
      }
      await insertRow(this.db, "journal_entry_lines", row);
    }
    return entryId;
  }

  /**
   * Atomically allocate the next voucher number, e.g. SI-00002. Uses an
   * upsert-with-RETURNING identical to the Python implementation so numbers
   * stay gap-free and consistent with the existing data.
   */
  async nextVoucherNumber(companyId: number, documentType: string): Promise<string> {
    const seqDocType = NUMBERING_DOC_TYPE[documentType] ?? documentType;
    const row = await this.db.get<{ prefix: string; next_number: number; padding: number }>(
      `INSERT INTO numbering_sequences (company_id, document_type, prefix, next_number, padding)
       VALUES (?, ?, ?, 1, 5)
       ON CONFLICT(company_id, document_type) DO UPDATE SET
           next_number = next_number + 1
       RETURNING prefix, next_number, padding`,
      [companyId, seqDocType, `${seqDocType}-`],
    );
    if (!row) {
      throw new AppError("Failed to allocate a voucher number.", "NUMBERING_ERROR", 500);
    }
    return `${row.prefix}${String(row.next_number).padStart(Number(row.padding), "0")}`;
  }

  async findLinesForEntry(journalEntryId: number): Promise<Row[]> {
    return this.db.all<Row>(
      `SELECT jel.*, a.account_code, a.account_name
       FROM journal_entry_lines jel
       JOIN accounts a ON a.id = jel.account_id
       WHERE jel.journal_entry_id = ?
       ORDER BY jel.line_order`,
      [journalEntryId],
    );
  }

  async findEntriesForAccount(
    accountId: number,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<Row[]> {
    let sql = `
      SELECT je.id, je.voucher_number, je.voucher_type, je.entry_date,
             je.narration, jel.debit, jel.credit, jel.description
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE jel.account_id = ? AND je.is_posted = 1`;
    const params: Array<string | number> = [accountId];
    if (dateFrom) {
      sql += " AND je.entry_date >= ?";
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += " AND je.entry_date <= ?";
      params.push(dateTo);
    }
    sql += " ORDER BY je.entry_date, je.id";
    return this.db.all<Row>(sql, params);
  }

  async findBySource(sourceTable: string, sourceId: number): Promise<Row | undefined> {
    return this.db.get<Row>(
      "SELECT * FROM journal_entries WHERE source_table = ? AND source_id = ?",
      [sourceTable, sourceId],
    );
  }
}
