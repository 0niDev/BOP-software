"""
Data access for journal_entries / journal_entry_lines -- the physical
ledger every other module (sales, purchases, banking, manufacturing,
expenses) writes to via the AccountingService.
"""
from __future__ import annotations

from repositories.base_repository import BaseRepository


class JournalRepository(BaseRepository):
    table_name = "journal_entries"

    def insert_entry(self, header: dict, lines: list[dict]) -> int:
        """
        Inserts one journal_entries row plus all its journal_entry_lines
        rows. Caller (AccountingService) is expected to wrap this in
        `db.transaction()` together with whatever else must commit
        atomically (e.g. the sales invoice row itself).
        
        Raises:
            ValueError: If lines list is empty - every journal entry must have at least 2 lines
        """
        if not lines:
            raise ValueError("Cannot insert journal entry without lines. "
                           "Every journal entry must have at least 2 lines.")
        
        entry_id = self.insert(header)
        for order, line in enumerate(lines):
            line = dict(line)
            line["journal_entry_id"] = entry_id
            line.setdefault("line_order", order)
            columns = list(line.keys())
            placeholders = ", ".join("?" for _ in columns)
            col_list = ", ".join(columns)
            self.db.execute(
                f"INSERT INTO journal_entry_lines ({col_list}) VALUES ({placeholders})",
                tuple(line.values()),
            )
        return entry_id

    def next_voucher_number(self, company_id: int, document_type: str) -> str:
        """Get next voucher number for the given document type.
        
        Uses atomic UPDATE ... RETURNING to prevent race conditions
        when multiple threads request numbers simultaneously.
        
        Args:
            company_id: Company identifier
            document_type: Type of document (e.g., 'SALES', 'PURCHASE')
            
        Returns:
            Formatted voucher number string
        """
        # Map voucher types to numbering sequence document types
        doc_type_mapping = {
            'SALES': 'SALES_INVOICE',
            'PURCHASE': 'PURCHASE_INVOICE',
            'PAYMENT': 'PAYMENT',
            'RECEIPT': 'RECEIPT',
            'JOURNAL': 'JOURNAL_VOUCHER',
            'OPENING': 'OPENING',
            'CUSTOMER': 'CUSTOMER',
            'SUPPLIER': 'SUPPLIER',
        }
        seq_doc_type = doc_type_mapping.get(document_type, document_type)
        
        # Atomic increment and fetch in one operation to prevent race conditions
        result = self.db.fetch_one(
            """
            INSERT INTO numbering_sequences (company_id, document_type, prefix, next_number, padding)
            VALUES (?, ?, ?, 1, 5)
            ON CONFLICT(company_id, document_type) DO UPDATE SET
                next_number = next_number + 1
            RETURNING prefix, next_number, padding
            """,
            (company_id, seq_doc_type, f"{seq_doc_type}-"),
        )
        
        prefix, next_number, padding = result["prefix"], result["next_number"], result["padding"]
        return f"{prefix}{str(next_number).zfill(padding)}"
    def find_lines_for_entry(self, journal_entry_id: int) -> list[dict]:
        return self.db.fetch_all(
            "SELECT jel.*, a.account_code, a.account_name FROM journal_entry_lines jel "
            "JOIN accounts a ON a.id = jel.account_id "
            "WHERE jel.journal_entry_id = ? ORDER BY jel.line_order",
            (journal_entry_id,),
        )

    def find_entries_for_account(
        self, account_id: int, date_from: str | None = None, date_to: str | None = None
    ) -> list[dict]:
        sql = """
            SELECT je.id, je.voucher_number, je.voucher_type, je.entry_date,
                   je.narration, jel.debit, jel.credit, jel.description
            FROM journal_entry_lines jel
            JOIN journal_entries je ON je.id = jel.journal_entry_id
            WHERE jel.account_id = ? AND je.is_posted = 1
        """
        params: list = [account_id]
        if date_from:
            sql += " AND je.entry_date >= ?"
            params.append(date_from)
        if date_to:
            sql += " AND je.entry_date <= ?"
            params.append(date_to)
        sql += " ORDER BY je.entry_date, je.id"
        return self.db.fetch_all(sql, tuple(params))

    def find_by_source(self, source_table: str, source_id: int) -> dict | None:
        return self.db.fetch_one(
            "SELECT * FROM journal_entries WHERE source_table = ? AND source_id = ?",
            (source_table, source_id),
        )
