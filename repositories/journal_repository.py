"""
Data access for journal_entries / journal_entry_lines -- the physical
ledger every other module (sales, purchases, banking, manufacturing,
expenses) writes to via the AccountingService.
"""
from __future__ import annotations

from utils.logger import get_logger
from utils.exceptions import DatabaseError
from repositories.base_repository import BaseRepository

logger = get_logger(__name__)


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
            DatabaseError: If any account_id in lines doesn't exist in accounts table
        """
        logger.error(f"JournalRepository.insert_entry() CALLED with header={header}, lines count={len(lines)}")
        logger.error(f"JournalRepository.insert_entry() lines data: {lines}")
        
        if not lines:
            logger.error("JournalRepository.insert_entry() lines list is EMPTY!")
            raise ValueError("Cannot insert journal entry without lines. "
                           "Every journal entry must have at least 2 lines.")
        
        # Validate all account_ids exist before inserting
        logger.error(f"JournalRepository.insert_entry() STARTING validation of {len(lines)} account IDs")
        for order, line in enumerate(lines):
            account_id = line.get("account_id")
            logger.error(f"JournalRepository.insert_entry() validating line {order}: account_id={account_id}, debit={line.get('debit')}, credit={line.get('credit')}")
            
            if account_id is None:
                logger.error(f"JournalRepository.insert_entry() line {order} has NO account_id!")
                raise ValueError(f"Line {order} has no account_id")
            
            # Check if account exists - get FULL details
            account_check = self.db.fetch_one("SELECT id, account_code, account_name, company_id, is_active, account_type FROM accounts WHERE id = ?", (account_id,))
            logger.error(f"JournalRepository.insert_entry() line {order}: account_check result={account_check}")
            
            if account_check is None:
                logger.error(f"JournalRepository.insert_entry() line {order}: account_id={account_id} DOES NOT EXIST in accounts table!")
                
                # Debug: List ALL accounts in the database
                all_accounts = self.db.fetch_all("SELECT id, account_code, account_name, company_id, is_active FROM accounts ORDER BY id")
                logger.error(f"JournalRepository.insert_entry() ALL accounts in DB ({len(all_accounts)}):")
                for acc in all_accounts:
                    logger.error(f"  Account: id={acc['id']}, code={acc['account_code']}, name={acc['account_name']}, company_id={acc['company_id']}, is_active={acc['is_active']}")
                
                raise DatabaseError(
                    f"Account ID {account_id} does not exist in the database. "
                    f"Line data: account_id={account_id}, debit={line.get('debit')}, credit={line.get('credit')}. "
                    f"Available account IDs: {[acc['id'] for acc in all_accounts]}"
                )
            logger.error(f"JournalRepository.insert_entry() line {order}: account_id={account_id} EXISTS (code={account_check['account_code']}, name={account_check['account_name']}, company_id={account_check['company_id']}, is_active={account_check['is_active']})")
        
        logger.error(f"JournalRepository.insert_entry() ALL account validations PASSED")
        
        # Build column names and placeholders for header insert
        columns = list(header.keys())
        values = [header[col] for col in columns]
        placeholders = ', '.join(['?'] * len(values))
        col_names = ', '.join(columns)
        
        # Insert header - caller is responsible for wrapping in transaction if needed
        self.db.execute(
            f"INSERT INTO journal_entries ({col_names}) VALUES ({placeholders})",
            values
        )
        
        # Get the last inserted ID - must be done immediately after insert
        entry_id = self.db.fetch_one("SELECT last_insert_rowid()").fetchone()[0]
        
        logger.error(f"JournalRepository.insert_entry() inserted header with entry_id={entry_id}")
        
        if not entry_id or entry_id <= 0:
            logger.error(f"JournalRepository.insert_entry() FAILED to get valid entry_id, got {entry_id}")
            raise DatabaseError("Failed to get generated journal entry ID")
        
        for order, line in enumerate(lines):
            line = dict(line)
            line["journal_entry_id"] = entry_id
            line.setdefault("line_order", order)
            # Only include party_id if it's not None (to avoid FOREIGN KEY constraint failure)
            if line.get("party_id") is None:
                line.pop("party_id", None)
            columns = list(line.keys())
            placeholders = ", ".join("?" for _ in columns)
            col_list = ", ".join(columns)
            logger.error(f"JournalRepository.insert_entry() inserting line {order}: account_id={line.get('account_id')}, debit={line.get('debit')}, credit={line.get('credit')}, columns={columns}, values={list(line.values())}")
            try:
                result = self.db.execute(
                    f"INSERT INTO journal_entry_lines ({col_list}) VALUES ({placeholders})",
                    tuple(line.values()),
                )
                logger.error(f"JournalRepository.insert_entry() line {order} inserted successfully, result={result}")
            except Exception as e:
                logger.error(f"JournalRepository.insert_entry() FAILED to insert line {order}: {e}")
                logger.error(f"JournalRepository.insert_entry() line data that failed: {line}")
                
                # Extra debug: check the account one more time right before insert
                acc_id = line.get('account_id')
                acc_check = self.db.fetch_one("SELECT id, account_code, account_name, company_id, is_active FROM accounts WHERE id = ?", (acc_id,))
                logger.error(f"JournalRepository.insert_entry() PRE-INSERT check for account_id={acc_id}: {acc_check}")
                
                # List all accounts again
                all_accounts = self.db.fetch_all("SELECT id, account_code, account_name, company_id FROM accounts ORDER BY id")
                logger.error(f"JournalRepository.insert_entry() ALL accounts at time of failure ({len(all_accounts)}):")
                for acc in all_accounts:
                    logger.error(f"  Account: id={acc['id']}, code={acc['account_code']}, name={acc['account_name']}, company_id={acc['company_id']}")
                
                raise
        logger.error(f"JournalRepository.insert_entry() ALL lines inserted successfully, returning entry_id={entry_id}")
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
