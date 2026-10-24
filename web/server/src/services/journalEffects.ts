/**
 * Shared ledger-side effects used by every "reverse this document" path.
 *
 * A document's journal entry is deleted (not reversed) when the document itself
 * is being edited or deleted: the replacement entry is posted immediately after,
 * inside the same transaction, so the ledger never holds a half-corrected pair.
 * Journal lines are removed explicitly because SQLite only honours
 * ON DELETE CASCADE when foreign keys are enabled (the hosted driver's pragma
 * is not guaranteed).
 */
import type { Row, SqlDatabase } from "../db/types.js";

export async function deleteJournalBySource(
  db: SqlDatabase,
  sourceTable: string,
  sourceId: number,
): Promise<void> {
  await db.run(
    `DELETE FROM journal_entry_lines WHERE journal_entry_id IN
       (SELECT id FROM journal_entries WHERE source_table = ? AND source_id = ?)`,
    [sourceTable, sourceId],
  );
  await db.run("DELETE FROM journal_entries WHERE source_table = ? AND source_id = ?", [
    sourceTable,
    sourceId,
  ]);
}

/** Payments and receipts post a journal keyed only by voucher number. */
export async function deleteJournalByVoucher(
  db: SqlDatabase,
  companyId: number,
  voucherNumber: string,
): Promise<void> {
  await db.run(
    `DELETE FROM journal_entry_lines WHERE journal_entry_id IN
       (SELECT id FROM journal_entries WHERE company_id = ? AND voucher_number = ?)`,
    [companyId, voucherNumber],
  );
  await db.run("DELETE FROM journal_entries WHERE company_id = ? AND voucher_number = ?", [
    companyId,
    voucherNumber,
  ]);
}

export async function deleteJournalById(db: SqlDatabase, journalEntryId: number): Promise<void> {
  await db.run("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?", [journalEntryId]);
  await db.run("DELETE FROM journal_entries WHERE id = ?", [journalEntryId]);
}

export async function findJournalByVoucher(
  db: SqlDatabase,
  companyId: number,
  voucherNumber: string,
): Promise<Row | undefined> {
  return db.get<Row>(
    "SELECT * FROM journal_entries WHERE company_id = ? AND voucher_number = ?",
    [companyId, voucherNumber],
  );
}
