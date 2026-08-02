"""Journal Entry repository for accounting transactions"""

from repositories.base_repository import BaseRepository
from models.journal_entry import JournalEntry, JournalEntryLine
from database import db


class JournalEntryRepository(BaseRepository[JournalEntry]):
    """Repository for Journal Entry operations"""
    
    def __init__(self):
        super().__init__(JournalEntry, 'journal_entries')
        self.lines_repo = JournalEntryLineRepository()
    
    def get_by_voucher_number(self, voucher_number: str, company_id: int) -> JournalEntry | None:
        """Get journal entry by voucher number"""
        return self.get_all(
            "voucher_number = ? AND company_id = ?",
            (voucher_number, company_id)
        )[0] if self.exists("voucher_number = ? AND company_id = ?", (voucher_number, company_id)) else None
    
    def get_by_company(self, company_id: int) -> list[JournalEntry]:
        """Get all journal entries for a company"""
        return self.get_all("company_id = ?", (company_id,), "date DESC, voucher_number")
    
    def get_posted_entries(self, company_id: int) -> list[JournalEntry]:
        """Get all posted journal entries"""
        return self.get_all(
            "company_id = ? AND is_posted = ?",
            (company_id, 1),
            "date DESC"
        )
    
    def get_by_date_range(self, company_id: int, start_date: str, end_date: str) -> list[JournalEntry]:
        """Get journal entries within a date range"""
        return self.get_all(
            "company_id = ? AND date BETWEEN ? AND ? AND is_posted = ?",
            (company_id, start_date, end_date, 1),
            "date DESC"
        )
    
    def get_by_source(self, source_type: str, source_id: int) -> JournalEntry | None:
        """Get journal entry linked to a source document"""
        entries = self.get_all(
            "source_type = ? AND source_id = ?",
            (source_type, source_id)
        )
        return entries[0] if entries else None
    
    def create_with_lines(self, entry: JournalEntry) -> int:
        """Create journal entry with its lines in a transaction"""
        with db.transaction() as cursor:
            # Insert header
            columns = [
                'voucher_number', 'voucher_type', 'date', 'company_id',
                'narration', 'status', 'total_debit', 'total_credit',
                'is_posted', 'reference_number', 'reference_date',
                'source_type', 'source_id'
            ]
            
            values = [
                entry.voucher_number,
                entry.voucher_type.value,
                entry.date.isoformat() if entry.date else None,
                entry.company_id,
                entry.narration,
                entry.status.value,
                entry.total_debit,
                entry.total_credit,
                entry.is_posted,
                entry.reference_number,
                entry.reference_date.isoformat() if entry.reference_date else None,
                entry.source_type,
                entry.source_id
            ]
            
            placeholders = ','.join(['?' for _ in values])
            columns_str = ', '.join(columns)
            
            cursor.execute(
                f"INSERT INTO journal_entries ({columns_str}) VALUES ({placeholders})",
                tuple(values)
            )
            entry_id = db.get_last_insert_id()
            entry.id = entry_id
            
            # Insert lines
            for line in entry.lines:
                line.journal_entry_id = entry_id
                self.lines_repo.create_with_cursor(cursor, line)
        
        self._invalidate_cache(entry_id)
        return entry_id
    
    def update_with_lines(self, entry: JournalEntry) -> bool:
        """Update journal entry with its lines in a transaction"""
        if not entry.id:
            raise ValueError("Cannot update entry without ID")
        
        with db.transaction() as cursor:
            # Update header
            cursor.execute(
                """UPDATE journal_entries SET
                    voucher_number = ?, voucher_type = ?, date = ?, company_id = ?,
                    narration = ?, status = ?, total_debit = ?, total_credit = ?,
                    reference_number = ?, reference_date = ?,
                    source_type = ?, source_id = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?""",
                (
                    entry.voucher_number,
                    entry.voucher_type.value,
                    entry.date.isoformat() if entry.date else None,
                    entry.company_id,
                    entry.narration,
                    entry.status.value,
                    entry.total_debit,
                    entry.total_credit,
                    entry.reference_number,
                    entry.reference_date.isoformat() if entry.reference_date else None,
                    entry.source_type,
                    entry.source_id,
                    entry.id
                )
            )
            
            # Delete existing lines and insert new ones
            cursor.execute("DELETE FROM journal_entry_lines WHERE journal_entry_id = ?", (entry.id,))
            
            for line in entry.lines:
                line.journal_entry_id = entry.id
                self.lines_repo.create_with_cursor(cursor, line)
        
        self._invalidate_cache(entry.id)
        return True
    
    def post_entry(self, entry_id: int, user_id: int) -> bool:
        """Post a journal entry"""
        from datetime import datetime
        db.execute(
            """UPDATE journal_entries 
               SET is_posted = 1, posted_at = ?, posted_by = ?, status = 'Approved', updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (datetime.now().isoformat(), user_id, entry_id)
        )
        self._invalidate_cache(entry_id)
        return True
    
    def cancel_entry(self, entry_id: int) -> bool:
        """Cancel a journal entry"""
        db.execute(
            """UPDATE journal_entries 
               SET status = 'Cancelled', updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (entry_id,)
        )
        self._invalidate_cache(entry_id)
        return True


class JournalEntryLineRepository:
    """Repository for Journal Entry Line operations"""
    
    def create_with_cursor(self, cursor, line: JournalEntryLine) -> int:
        """Create a journal entry line using provided cursor"""
        cursor.execute(
            """INSERT INTO journal_entry_lines 
               (journal_entry_id, account_id, account_code, account_name,
                debit, credit, narration, party_id, party_name,
                reference_type, reference_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                line.journal_entry_id,
                line.account_id,
                line.account_code,
                line.account_name,
                line.debit,
                line.credit,
                line.narration,
                line.party_id,
                line.party_name,
                line.reference_type,
                line.reference_id
            )
        )
        return db.get_last_insert_id()
    
    def get_by_entry(self, journal_entry_id: int) -> list[JournalEntryLine]:
        """Get all lines for a journal entry"""
        rows = db.fetch_all(
            "SELECT * FROM journal_entry_lines WHERE journal_entry_id = ? ORDER BY id",
            (journal_entry_id,)
        )
        return [JournalEntryLine.from_row(row) for row in rows]
    
    def get_by_account(self, account_id: int, company_id: int) -> list[JournalEntryLine]:
        """Get all lines for an account"""
        query = """
            SELECT jel.* FROM journal_entry_lines jel
            JOIN journal_entries je ON jel.journal_entry_id = je.id
            WHERE jel.account_id = ? AND je.company_id = ?
            ORDER BY je.date DESC
        """
        rows = db.fetch_all(query, (account_id, company_id))
        return [JournalEntryLine.from_row(row) for row in rows]
