"""Payment repository for receipts and payments"""

from repositories.base_repository import BaseRepository
from models.payment import Payment, PaymentLine
from database import db


class PaymentRepository(BaseRepository[Payment]):
    """Repository for Payment operations"""
    
    def __init__(self):
        super().__init__(Payment, 'payments')
        self.lines_repo = PaymentLineRepository()
    
    def get_by_payment_number(self, payment_number: str, company_id: int) -> Payment | None:
        """Get payment by payment number"""
        return self.get_all(
            "payment_number = ? AND company_id = ?",
            (payment_number, company_id)
        )[0] if self.exists("payment_number = ? AND company_id = ?", (payment_number, company_id)) else None
    
    def get_by_company(self, company_id: int) -> list[Payment]:
        """Get all payments for a company"""
        return self.get_all("company_id = ?", (company_id,), "date DESC")
    
    def get_by_party(self, party_id: int, company_id: int) -> list[Payment]:
        """Get all payments for a party"""
        return self.get_all(
            "party_id = ? AND company_id = ?",
            (party_id, company_id),
            "date DESC"
        )
    
    def get_by_type(self, payment_type: str, company_id: int) -> list[Payment]:
        """Get payments by type (Receipt or Payment)"""
        return self.get_all(
            "payment_type = ? AND company_id = ?",
            (payment_type, company_id),
            "date DESC"
        )
    
    def get_by_date_range(self, company_id: int, start_date: str, end_date: str) -> list[Payment]:
        """Get payments within a date range"""
        return self.get_all(
            "company_id = ? AND date BETWEEN ? AND ?",
            (company_id, start_date, end_date),
            "date DESC"
        )
    
    def create_with_lines(self, payment: Payment) -> int:
        """Create payment with its lines in a transaction"""
        with db.transaction() as cursor:
            columns = [
                'payment_number', 'payment_type', 'date', 'company_id',
                'party_id', 'party_name', 'amount', 'payment_method',
                'bank_account_id', 'bank_name', 'cheque_number', 'cheque_date',
                'reference_number', 'narration', 'status'
            ]
            
            values = [
                payment.payment_number,
                payment.payment_type,
                payment.date.isoformat() if payment.date else None,
                payment.company_id,
                payment.party_id,
                payment.party_name,
                payment.amount,
                payment.payment_method.value,
                payment.bank_account_id,
                payment.bank_name,
                payment.cheque_number,
                payment.cheque_date.isoformat() if payment.cheque_date else None,
                payment.reference_number,
                payment.narration,
                payment.status.value
            ]
            
            placeholders = ','.join(['?' for _ in values])
            columns_str = ', '.join(columns)
            
            cursor.execute(
                f"INSERT INTO payments ({columns_str}) VALUES ({placeholders})",
                tuple(values)
            )
            payment_id = db.get_last_insert_id()
            payment.id = payment_id
            
            for line in payment.lines:
                line.payment_id = payment_id
                self.lines_repo.create_with_cursor(cursor, line)
        
        self._invalidate_cache(payment_id)
        return payment_id
    
    def post_payment(self, payment_id: int) -> bool:
        """Mark payment as posted"""
        from models.enums import DocumentStatus
        db.execute(
            """UPDATE payments 
               SET status = ?, is_posted = 1, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (DocumentStatus.APPROVED.value, payment_id)
        )
        self._invalidate_cache(payment_id)
        return True
    
    def cancel_payment(self, payment_id: int) -> bool:
        """Cancel a payment"""
        from models.enums import DocumentStatus
        db.execute(
            """UPDATE payments 
               SET status = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (DocumentStatus.CANCELLED.value, payment_id)
        )
        self._invalidate_cache(payment_id)
        return True


class PaymentLineRepository:
    """Repository for PaymentLine operations"""
    
    def create_with_cursor(self, cursor, line: PaymentLine) -> int:
        """Create a payment line using provided cursor"""
        cursor.execute(
            """INSERT INTO payment_lines 
               (payment_id, reference_type, reference_id, invoice_number,
                invoice_date, invoice_amount, amount_paid, balance_before,
                balance_after, narration)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                line.payment_id,
                line.reference_type,
                line.reference_id,
                line.invoice_number,
                line.invoice_date.isoformat() if line.invoice_date else None,
                line.invoice_amount,
                line.amount_paid,
                line.balance_before,
                line.balance_after,
                line.narration
            )
        )
        return db.get_last_insert_id()
    
    def get_by_payment(self, payment_id: int) -> list[PaymentLine]:
        """Get all lines for a payment"""
        rows = db.fetch_all(
            "SELECT * FROM payment_lines WHERE payment_id = ? ORDER BY id",
            (payment_id,)
        )
        return [PaymentLine.from_row(row) for row in rows]
