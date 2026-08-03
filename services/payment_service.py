"""Payment service - record payments to suppliers and receipts from customers."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from database.connection import DatabaseConnection, get_db
from models.enums import VoucherType
from services.accounting_service import AccountingService, JournalLine
from repositories.party_repository import PartyRepository
from repositories.account_repository import AccountRepository
from utils.exceptions import ValidationError
from utils.logger import get_logger

logger = get_logger(__name__)


# Global dashboard service instance for cache invalidation
_dashboard_service_instance = None


def get_dashboard_service():
    """Get or create the global dashboard service instance."""
    global _dashboard_service_instance
    if _dashboard_service_instance is None:
        from services.dashboard_service import DashboardService
        _dashboard_service_instance = DashboardService()
    return _dashboard_service_instance


class PaymentService:
    """Service for recording payments to suppliers and receipts from customers."""

    def __init__(self, db: DatabaseConnection | None = None):
        self.db = db or get_db()
        self.party_repo = PartyRepository(self.db)
        self.account_repo = AccountRepository(self.db)
        self.accounting_service = AccountingService(self.db)
    
    def pay_supplier(
        self,
        supplier_id: int,
        amount: float,
        payment_date: str,
        payment_method: str = "BANK",
        reference_no: str | None = None,
        notes: str | None = None,
        purchase_invoice_id: int | None = None,
    ) -> int:
        """
        Record a payment to a supplier.
        """
        # Validate supplier
        supplier = self.party_repo.get_by_id(supplier_id)
        if not supplier:
            raise ValidationError("Supplier does not exist.")
        
        if supplier["party_type"] not in ["SUPPLIER", "BOTH"]:
            raise ValidationError(
                f"Cannot pay {supplier['name']} ({supplier['party_type']}). "
                "Only suppliers can be paid."
            )
        
        if amount <= 0:
            raise ValidationError("Amount must be greater than 0.")
        
        # Get accounts
        ap_account = self.account_repo.find_by_code("2000")
        if not ap_account:
            raise ValidationError("Accounts Payable account (2000) not found.")

        # Get payment account
        if payment_method == "CASH":
            payment_account = self.account_repo.find_by_code("1000")
            if not payment_account:
                raise ValidationError("Cash account (1000) not found.")
        elif payment_method in ["BANK", "CHEQUE"]:
            payment_account = self.account_repo.find_by_code("1010")
            if not payment_account:
                raise ValidationError("Bank account (1010) not found.")
        else:
            raise ValidationError("Invalid payment method.")
        
        # Prepare journal entry
        journal_lines = [
            JournalLine(
                account_id=ap_account["id"],
                debit=amount,
                credit=0,
                party_id=supplier_id,  # ✅ ADD THIS - links payment to supplier
                description=f"Payment to {supplier['name']}"
            ),
            JournalLine(
                account_id=payment_account["id"],
                debit=0,
                credit=amount,
                description=f"Payment to {supplier['name']}"
            )
        ]
        
        # Post journal entry
        with self.db.transaction():
            # Generate voucher number
            voucher_number = self.accounting_service.journal_repo.next_voucher_number(
                1, VoucherType.PAYMENT.value
            )
            
            self.accounting_service.post_journal_entry(
                voucher_type=VoucherType.PAYMENT,
                entry_date=payment_date,
                lines=journal_lines,
                source_table="payments",
                source_id=None,
                voucher_number=voucher_number,
                narration=f"Payment to {supplier['name']} - {reference_no or ''}"
            )
            
            # Save payment record
            self.db.execute("""
                INSERT INTO payments (
                    company_id, voucher_number, party_id, payment_date,
                    payment_method, amount, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """, (1, voucher_number, supplier_id, payment_date, payment_method, amount, notes))
            
            payment_id = self.db.last_insert_id()
            
            # Update purchase invoice paid amount if provided
            if purchase_invoice_id:
                self.db.execute("""
                    UPDATE purchase_invoices 
                    SET paid_amount = paid_amount + ? 
                    WHERE id = ?
                """, (amount, purchase_invoice_id))
                logger.info(f"✅ Updated paid_amount for purchase invoice {purchase_invoice_id}: +{amount}")
            
            # Invalidate dashboard cache to force refresh on next view
            try:
                dashboard_service = get_dashboard_service()
                dashboard_service.invalidate_cache()
                logger.info("✅ Dashboard cache invalidated after payment")
            except Exception as e:
                logger.warning(f"Could not invalidate dashboard cache: {e}")
            
            logger.info(f"Payment {voucher_number} recorded: Rs. {amount:,.2f} to {supplier['name']}")
            return payment_id

    def receive_payment(
        self,
        customer_id: int,
        amount: float,
        payment_date: str,
        payment_method: str = "CASH",
        reference_no: str | None = None,
        notes: str | None = None,
        sales_invoice_id: int | None = None,
    ) -> int:
        """
        Record a payment received from a customer.
        """
        # Validate customer
        customer = self.party_repo.get_by_id(customer_id)
        if not customer:
            raise ValidationError("Customer does not exist.")
        if customer["party_type"] not in ["CUSTOMER", "BOTH"]:
            raise ValidationError("Selected party is not a customer.")
        
        if amount <= 0:
            raise ValidationError("Amount must be greater than 0.")
        
        # ============================================================
        # FIX: Check if payment exceeds outstanding balance
        # ============================================================
        if sales_invoice_id:
            invoice = self.db.fetch_one("""
                SELECT total_amount, paid_amount FROM sales_invoices WHERE id = ?
            """, (sales_invoice_id,))
            
            if invoice:
                outstanding = invoice["total_amount"] - invoice["paid_amount"]
                if amount > outstanding:
                    raise ValidationError(
                        f"Payment amount (Rs. {amount:,.2f}) exceeds outstanding balance "
                        f"(Rs. {outstanding:,.2f}). Please reduce payment to Rs. {outstanding:,.2f} or less."
                    )
        
        # Get accounts
        ar_account = self.account_repo.find_by_code("1100")
        if not ar_account:
            raise ValidationError("Accounts Receivable account (1100) not found.")
        
        # Get receipt account
        if payment_method == "CASH":
            receipt_account = self.account_repo.find_by_code("1000")
            if not receipt_account:
                raise ValidationError("Cash account (1000) not found.")
        elif payment_method in ["BANK", "CHEQUE"]:
            receipt_account = self.account_repo.find_by_code("1010")
            if not receipt_account:
                raise ValidationError("Bank account (1010) not found.")
        else:
            raise ValidationError("Invalid payment method.")
        
        # Prepare journal entry
        journal_lines = [
            JournalLine(
                account_id=receipt_account["id"],
                debit=amount,
                credit=0,
                description=f"Payment from {customer['name']}"
            ),
            JournalLine(
                account_id=ar_account["id"],
                debit=0,
                credit=amount,
                party_id=customer_id,
                description=f"Payment from {customer['name']}"
            )
        ]
        
        # Post journal entry
        with self.db.transaction():
            voucher_number = self.accounting_service.journal_repo.next_voucher_number(
                1, VoucherType.RECEIPT.value
            )
            
            self.accounting_service.post_journal_entry(
                voucher_type=VoucherType.RECEIPT,
                entry_date=payment_date,
                lines=journal_lines,
                source_table="receipts",
                source_id=None,
                voucher_number=voucher_number,
                narration=f"Receipt from {customer['name']} - {reference_no or ''}"
            )
            
            # Save receipt record
            self.db.execute("""
                INSERT INTO receipts (
                    company_id, voucher_number, party_id, receipt_date,
                    payment_method, amount, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """, (1, voucher_number, customer_id, payment_date, payment_method, amount, notes))
            
            receipt_id = self.db.last_insert_id()
            
            # Update sales invoice paid amount if provided
            if sales_invoice_id:
                self.db.execute("""
                    UPDATE sales_invoices 
                    SET paid_amount = paid_amount + ? 
                    WHERE id = ?
                """, (amount, sales_invoice_id))
                logger.info(f"✅ Updated paid_amount for sales invoice {sales_invoice_id}: +{amount}")
            
            # Invalidate dashboard cache to force refresh on next view
            try:
                dashboard_service = get_dashboard_service()
                dashboard_service.invalidate_cache()
                logger.info("✅ Dashboard cache invalidated after receipt")
            except Exception as e:
                logger.warning(f"Could not invalidate dashboard cache: {e}")
            
            logger.info(f"Receipt {voucher_number} recorded: Rs. {amount:,.2f} from {customer['name']}")
            return receipt_id