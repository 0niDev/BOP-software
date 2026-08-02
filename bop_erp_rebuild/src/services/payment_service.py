"""
Payment Service - Payment and receipt processing
Handles customer receipts, supplier payments, and payment allocations.
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
import uuid

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from models.payment import Payment, PaymentMethod, PaymentType
from models.account import VoucherType
from repositories.payment_repository import PaymentRepository
from services.accounting_service import AccountingService, AccountingServiceError
from services.party_service import PartyService
from database.connection_manager import get_connection


class PaymentServiceError(Exception):
    """Custom exception for payment service errors."""
    pass


class PaymentService:
    """
    Handles all payment operations including:
    - Customer receipts (payments received)
    - Supplier payments (payments made)
    - Payment method tracking (Cash, Bank, Cheque, etc.)
    - Payment allocation to invoices
    - Journal entry creation
    """
    
    def __init__(self, company_id: str):
        self.company_id = company_id
        self.payment_repo = PaymentRepository()
        self.accounting_service = AccountingService(company_id)
        self.party_service = PartyService(company_id)
    
    def create_receipt(
        self,
        customer_id: str,
        amount: Decimal,
        payment_date: date,
        payment_method: PaymentMethod,
        reference_no: str = "",
        bank_account_id: Optional[str] = None,
        remarks: str = ""
    ) -> Payment:
        """
        Create a customer receipt (payment received).
        
        Args:
            customer_id: Customer who is paying
            amount: Amount received
            payment_date: Date of payment
            payment_method: Method of payment (CASH, BANK, CHEQUE, etc.)
            reference_no: Cheque number or transaction reference
            bank_account_id: Bank account if payment method is BANK/CHEQUE
            remarks: Payment remarks
            
        Returns:
            Created Payment
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            # Validate customer
            customer = self.party_service.get_party_by_id(customer_id)
            if not customer:
                raise PaymentServiceError(f"Customer {customer_id} not found")
            
            # Generate receipt number
            last_receipt = self.payment_repo.get_last_receipt(conn, self.company_id, payment_date.year)
            sequence = (int(last_receipt.split('-')[-1]) + 1) if last_receipt else 1
            receipt_no = f"RCV-{payment_date.year}-{sequence:05d}"
            
            # Determine accounts based on payment method
            if payment_method in [PaymentMethod.CASH]:
                debit_account = '1000-CASH'
            elif payment_method in [PaymentMethod.BANK, PaymentMethod.CHEQUE]:
                if not bank_account_id:
                    raise PaymentServiceError("Bank account required for this payment method")
                # Get bank account code from bank_accounts table
                debit_account = '1050-BANK'  # Simplified
            else:
                raise PaymentServiceError(f"Unsupported payment method: {payment_method}")
            
            credit_account = '1100-AR'  # Accounts Receivable
            
            # Create journal entry
            je_lines = [
                {
                    'account_code': debit_account,
                    'debit': float(amount),
                    'credit': 0,
                    'party_id': None,
                    'narration': f'Receipt {receipt_no} from {customer.name}'
                },
                {
                    'account_code': credit_account,
                    'debit': 0,
                    'credit': float(amount),
                    'party_id': customer_id,
                    'narration': f'Payment received from {customer.name}'
                }
            ]
            
            self.accounting_service.create_journal_entry(
                voucher_type=VoucherType.RECEIPT,
                voucher_no=receipt_no,
                voucher_date=payment_date,
                lines=je_lines,
                description=f"Receipt {receipt_no} - {customer.name}",
                reference="",
                posted=True
            )
            
            # Create payment record
            payment_id = str(uuid.uuid4())
            payment = Payment(
                id=payment_id,
                company_id=self.company_id,
                payment_type=PaymentType.RECEIPT,
                payment_no=receipt_no,
                party_id=customer_id,
                payment_date=payment_date,
                amount=amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                payment_method=payment_method,
                reference_no=reference_no,
                bank_account_id=bank_account_id,
                remarks=remarks,
                is_allocated=False,
                is_posted=True,
                created_at=datetime.now()
            )
            
            self.payment_repo.create(conn, payment)
            
            conn.commit()
            return payment
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise PaymentServiceError(f"Failed to create receipt: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def create_payment(
        self,
        supplier_id: str,
        amount: Decimal,
        payment_date: date,
        payment_method: PaymentMethod,
        reference_no: str = "",
        bank_account_id: Optional[str] = None,
        remarks: str = ""
    ) -> Payment:
        """
        Create a supplier payment (payment made).
        
        Args:
            supplier_id: Supplier being paid
            amount: Amount to pay
            payment_date: Date of payment
            payment_method: Method of payment
            reference_no: Cheque number or transaction reference
            bank_account_id: Bank account if payment method is BANK/CHEQUE
            remarks: Payment remarks
            
        Returns:
            Created Payment
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            # Validate supplier
            supplier = self.party_service.get_party_by_id(supplier_id)
            if not supplier:
                raise PaymentServiceError(f"Supplier {supplier_id} not found")
            
            # Generate payment number
            last_payment = self.payment_repo.get_last_payment(conn, self.company_id, payment_date.year)
            sequence = (int(last_payment.split('-')[-1]) + 1) if last_payment else 1
            payment_no = f"PMT-{payment_date.year}-{sequence:05d}"
            
            # Determine accounts based on payment method
            if payment_method in [PaymentMethod.CASH]:
                credit_account = '1000-CASH'
            elif payment_method in [PaymentMethod.BANK, PaymentMethod.CHEQUE]:
                if not bank_account_id:
                    raise PaymentServiceError("Bank account required for this payment method")
                credit_account = '1050-BANK'  # Simplified
            else:
                raise PaymentServiceError(f"Unsupported payment method: {payment_method}")
            
            debit_account = '2100-AP'  # Accounts Payable
            
            # Create journal entry
            je_lines = [
                {
                    'account_code': debit_account,
                    'debit': float(amount),
                    'credit': 0,
                    'party_id': supplier_id,
                    'narration': f'Payment {payment_no} to {supplier.name}'
                },
                {
                    'account_code': credit_account,
                    'debit': 0,
                    'credit': float(amount),
                    'party_id': None,
                    'narration': f'Payment made to {supplier.name}'
                }
            ]
            
            self.accounting_service.create_journal_entry(
                voucher_type=VoucherType.PAYMENT,
                voucher_no=payment_no,
                voucher_date=payment_date,
                lines=je_lines,
                description=f"Payment {payment_no} - {supplier.name}",
                reference="",
                posted=True
            )
            
            # Create payment record
            payment_id = str(uuid.uuid4())
            payment = Payment(
                id=payment_id,
                company_id=self.company_id,
                payment_type=PaymentType.PAYMENT,
                payment_no=payment_no,
                party_id=supplier_id,
                payment_date=payment_date,
                amount=amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                payment_method=payment_method,
                reference_no=reference_no,
                bank_account_id=bank_account_id,
                remarks=remarks,
                is_allocated=False,
                is_posted=True,
                created_at=datetime.now()
            )
            
            self.payment_repo.create(conn, payment)
            
            conn.commit()
            return payment
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise PaymentServiceError(f"Failed to create payment: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def allocate_payment(
        self,
        payment_id: str,
        invoice_ids: List[Dict[str, Any]]
    ) -> None:
        """
        Allocate a payment to specific invoices.
        
        Args:
            payment_id: Payment ID to allocate
            invoice_ids: List of dicts with invoice_id and amount
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            payment = self.payment_repo.get_by_id(conn, payment_id)
            if not payment:
                raise PaymentServiceError(f"Payment {payment_id} not found")
            
            total_allocated = Decimal('0')
            
            for inv_data in invoice_ids:
                invoice_id = inv_data['invoice_id']
                amount = Decimal(str(inv_data['amount']))
                
                # Create allocation record (would be in payment_allocations table)
                # For now, simplified
                
                total_allocated += amount
            
            if total_allocated != payment.amount:
                raise PaymentServiceError(
                    f"Allocation amounts don't match payment. Total: {total_allocated}, Payment: {payment.amount}"
                )
            
            # Mark payment as allocated
            payment.is_allocated = True
            self.payment_repo.update(conn, payment)
            
            conn.commit()
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise PaymentServiceError(f"Failed to allocate payment: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def get_cash_book(self, from_date: date, to_date: date) -> List[Dict[str, Any]]:
        """
        Get cash book report for a period.
        Shows all cash and bank transactions.
        """
        conn = None
        try:
            conn = get_connection()
            
            payments = self.payment_repo.get_payments_by_date_range(
                conn,
                self.company_id,
                from_date,
                to_date
            )
            
            cash_book = []
            cash_balance = Decimal('0')
            bank_balance = Decimal('0')
            
            for payment in payments:
                if payment.payment_method == PaymentMethod.CASH:
                    if payment.payment_type == PaymentType.RECEIPT:
                        cash_balance += payment.amount
                    else:
                        cash_balance -= payment.amount
                    
                    cash_book.append({
                        'date': payment.payment_date,
                        'voucher_no': payment.payment_no,
                        'party': payment.party_id,
                        'particulars': payment.remarks,
                        'receipt': payment.amount if payment.payment_type == PaymentType.RECEIPT else Decimal('0'),
                        'payment': payment.amount if payment.payment_type == PaymentType.PAYMENT else Decimal('0'),
                        'cash_balance': cash_balance,
                        'bank_balance': None
                    })
                else:
                    if payment.payment_type == PaymentType.RECEIPT:
                        bank_balance += payment.amount
                    else:
                        bank_balance -= payment.amount
                    
                    cash_book.append({
                        'date': payment.payment_date,
                        'voucher_no': payment.payment_no,
                        'party': payment.party_id,
                        'particulars': payment.remarks,
                        'receipt': payment.amount if payment.payment_type == PaymentType.RECEIPT else Decimal('0'),
                        'payment': payment.amount if payment.payment_type == PaymentType.PAYMENT else Decimal('0'),
                        'cash_balance': None,
                        'bank_balance': bank_balance
                    })
            
            return cash_book
            
        finally:
            if conn:
                conn.close()
    
    def get_bank_reconciliation(
        self,
        bank_account_id: str,
        as_of_date: date
    ) -> Dict[str, Any]:
        """
        Get bank reconciliation statement.
        Compares book balance with bank statement balance.
        """
        conn = None
        try:
            conn = get_connection()
            
            # Get book balance from accounting service
            book_balance = self.accounting_service.get_account_balance('1050-BANK', as_of_date)
            
            # Get uncleared cheques (issued but not presented)
            uncleared_payments = self.payment_repo.get_uncleared_payments(
                conn,
                bank_account_id,
                as_of_date
            )
            
            # Get unpresented receipts (deposited but not cleared)
            uncleared_receipts = self.payment_repo.get_uncleared_receipts(
                conn,
                bank_account_id,
                as_of_date
            )
            
            total_uncleared_payments = sum(p.amount for p in uncleared_payments)
            total_uncleared_receipts = sum(r.amount for r in uncleared_receipts)
            
            # Reconciled balance = Book balance - Uncleared payments + Uncleared receipts
            reconciled_balance = book_balance - total_uncleared_payments + total_uncleared_receipts
            
            return {
                'bank_account_id': bank_account_id,
                'as_of_date': as_of_date,
                'book_balance': book_balance,
                'uncleared_payments': [
                    {
                        'payment_no': p.payment_no,
                        'date': p.payment_date,
                        'amount': p.amount,
                        'party': p.party_id
                    }
                    for p in uncleared_payments
                ],
                'uncleared_receipts': [
                    {
                        'receipt_no': r.payment_no,
                        'date': r.payment_date,
                        'amount': r.amount,
                        'party': r.party_id
                    }
                    for r in uncleared_receipts
                ],
                'total_uncleared_payments': total_uncleared_payments,
                'total_uncleared_receipts': total_uncleared_receipts,
                'reconciled_balance': reconciled_balance
            }
            
        finally:
            if conn:
                conn.close()
    
    def get_payment_summary(self, party_id: str) -> Dict[str, Any]:
        """
        Get payment summary for a party.
        """
        conn = None
        try:
            conn = get_connection()
            
            receipts = self.payment_repo.get_receipts_for_party(conn, party_id, self.company_id)
            payments = self.payment_repo.get_payments_for_party(conn, party_id, self.company_id)
            
            total_received = sum(r.amount for r in receipts)
            total_paid = sum(p.amount for p in payments)
            
            return {
                'party_id': party_id,
                'total_receipts': total_received,
                'total_payments': total_paid,
                'net_balance': total_received - total_paid,
                'receipt_count': len(receipts),
                'payment_count': len(payments)
            }
            
        finally:
            if conn:
                conn.close()
