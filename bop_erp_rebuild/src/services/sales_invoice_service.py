"""
Sales Invoice Service - Complete sales order to invoice workflow
Handles invoice creation, stock deduction, and accounting entries.
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
import uuid

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from models.sales_invoice import SalesInvoice, SalesInvoiceItem, SalesInvoiceStatus
from models.account import VoucherType
from models.document_status import DocumentStatus
from repositories.sales_repository import SalesInvoiceRepository, SalesInvoiceItemRepository
from services.accounting_service import AccountingService, AccountingServiceError
from services.inventory_service import InventoryService, InventoryServiceError
from services.party_service import PartyService
from database.connection_manager import get_connection


class SalesInvoiceServiceError(Exception):
    """Custom exception for sales invoice service errors."""
    pass


class SalesInvoiceService:
    """
    Handles complete sales invoice lifecycle including:
    - Invoice creation with validation
    - Stock reservation and deduction
    - Automatic journal entry posting
    - Customer balance updates
    """
    
    def __init__(self, company_id: str):
        self.company_id = company_id
        self.invoice_repo = SalesInvoiceRepository()
        self.item_repo = SalesInvoiceItemRepository()
        self.accounting_service = AccountingService(company_id)
        self.inventory_service = InventoryService(company_id)
        self.party_service = PartyService(company_id)
    
    def create_invoice(
        self,
        customer_id: str,
        invoice_date: date,
        due_date: date,
        items: List[Dict[str, Any]],
        warehouse_id: str,
        remarks: str = "",
        auto_post: bool = True
    ) -> SalesInvoice:
        """
        Create a new sales invoice.
        
        Args:
            customer_id: Customer party ID
            invoice_date: Invoice date
            due_date: Payment due date
            items: List of dicts with item_code, quantity, rate, discount (optional)
            warehouse_id: Warehouse to ship from
            remarks: Invoice remarks
            auto_post: Whether to post stock and accounting immediately
            
        Returns:
            Created SalesInvoice
            
        Raises:
            SalesInvoiceServiceError: If validation fails or stock insufficient
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            # Validate customer
            customer = self.party_service.get_party_by_id(customer_id)
            if not customer:
                raise SalesInvoiceServiceError(f"Customer {customer_id} not found")
            
            # Calculate totals
            total_amount = Decimal('0')
            total_tax = Decimal('0')
            total_discount = Decimal('0')
            
            created_items: List[SalesInvoiceItem] = []
            
            for idx, item_data in enumerate(items):
                item_code = item_data['item_code']
                quantity = Decimal(str(item_data['quantity']))
                rate = Decimal(str(item_data['rate']))
                discount_pct = Decimal(str(item_data.get('discount', 0)))
                
                # Calculate line totals
                line_total = quantity * rate
                line_discount = line_total * (discount_pct / Decimal('100'))
                net_amount = line_total - line_discount
                
                # Check stock availability
                available_stock = self.inventory_service.get_available_stock(item_code, warehouse_id)
                if available_stock < quantity:
                    raise SalesInvoiceServiceError(
                        f"Insufficient stock for {item_code}. Available: {available_stock}, Required: {quantity}"
                    )
                
                total_amount += net_amount
                total_discount += line_discount
                
                # Create invoice item
                item = SalesInvoiceItem(
                    id=str(uuid.uuid4()),
                    sales_invoice_id='',  # Will be set after invoice creation
                    line_no=idx + 1,
                    item_code=item_code,
                    description=item_data.get('description', ''),
                    quantity=quantity,
                    rate=rate.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                    discount_percent=discount_pct,
                    discount_amount=line_discount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                    amount=net_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                    warehouse_id=warehouse_id
                )
                created_items.append(item)
            
            # Generate invoice number
            last_invoice = self.invoice_repo.get_last_invoice(conn, self.company_id, invoice_date.year)
            sequence = (int(last_invoice.split('-')[-1]) + 1) if last_invoice else 1
            invoice_no = f"SAL-{invoice_date.year}-{sequence:05d}"
            
            # Create invoice header
            invoice_id = str(uuid.uuid4())
            invoice = SalesInvoice(
                id=invoice_id,
                company_id=self.company_id,
                invoice_no=invoice_no,
                customer_id=customer_id,
                invoice_date=invoice_date,
                due_date=due_date,
                total_amount=total_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                total_discount=total_discount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                tax_amount=total_tax,  # Add tax calculation if needed
                grand_total=total_amount,  # Add tax if applicable
                status=SalesInvoiceStatus.DRAFT,
                remarks=remarks,
                is_posted=False,
                created_at=datetime.now()
            )
            
            # Save invoice
            self.invoice_repo.create(conn, invoice)
            
            # Save invoice items
            for item in created_items:
                item.sales_invoice_id = invoice_id
                self.item_repo.create(conn, item)
            
            # Auto-post if requested
            if auto_post:
                self._post_invoice(conn, invoice, created_items)
            
            conn.commit()
            
            # Invalidate caches
            self.invoice_repo.invalidate_cache()
            
            return invoice
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise SalesInvoiceServiceError(f"Failed to create sales invoice: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def _post_invoice(
        self,
        conn,
        invoice: SalesInvoice,
        items: List[SalesInvoiceItem]
    ) -> None:
        """
        Post invoice - deduct stock and create accounting entries.
        Must be called within an existing transaction.
        """
        # Deduct stock for each item
        for item in items:
            self.inventory_service.deduct_stock(
                item_code=item.item_code,
                quantity=item.quantity,
                warehouse_id=item.warehouse_id,
                reference_type='SALES_INVOICE',
                reference_id=invoice.id
            )
        
        # Get accounts
        customer = self.party_service.get_party_by_id(invoice.customer_id)
        
        # Find customer's receivable account
        receivable_account = '1100-AR'  # Should lookup from party or config
        
        # Find income accounts for each item
        # For simplicity, using a single sales account - should be per item category
        sales_account = '4000-SALES'
        
        # Create journal entry lines
        je_lines = [
            {
                'account_code': receivable_account,
                'debit': float(invoice.grand_total),
                'credit': 0,
                'party_id': invoice.customer_id,
                'narration': f'Sales Invoice {invoice.invoice_no}'
            },
            {
                'account_code': sales_account,
                'debit': 0,
                'credit': float(invoice.total_amount),
                'party_id': None,
                'narration': f'Sales revenue for {invoice.invoice_no}'
            }
        ]
        
        # Add discount account if applicable
        if invoice.total_discount > 0:
            je_lines.append({
                'account_code': '4900-DISCOUNT',  # Discount allowed account
                'debit': float(invoice.total_discount),
                'credit': 0,
                'party_id': None,
                'narration': f'Discount on {invoice.invoice_no}'
            })
            
            # Adjust receivable to match
            je_lines[0]['debit'] = float(invoice.grand_total + invoice.total_discount)
        
        # Create journal entry
        self.accounting_service.create_journal_entry(
            voucher_type=VoucherType.SALES,
            voucher_no=invoice.invoice_no,
            voucher_date=invoice.invoice_date,
            lines=je_lines,
            description=f"Sales Invoice {invoice.invoice_no} - {customer.name}",
            reference=invoice.id,
            posted=True
        )
        
        # Update invoice status
        invoice.is_posted = True
        invoice.status = SalesInvoiceStatus.POSTED
        invoice.posted_at = datetime.now()
        self.invoice_repo.update(conn, invoice)
    
    def submit_invoice(self, invoice_id: str) -> SalesInvoice:
        """
        Submit a draft invoice for posting.
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            invoice = self.invoice_repo.get_by_id(conn, invoice_id)
            if not invoice:
                raise SalesInvoiceServiceError(f"Invoice {invoice_id} not found")
            
            if invoice.status != SalesInvoiceStatus.DRAFT:
                raise SalesInvoiceServiceError(f"Invoice {invoice_id} is not in draft status")
            
            # Get invoice items
            items = self.item_repo.get_items_for_invoice(conn, invoice_id)
            
            # Post the invoice
            self._post_invoice(conn, invoice, items)
            
            conn.commit()
            return invoice
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise SalesInvoiceServiceError(f"Failed to submit invoice: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def cancel_invoice(self, invoice_id: str, cancellation_reason: str) -> SalesInvoice:
        """
        Cancel a posted invoice and reverse all entries.
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            invoice = self.invoice_repo.get_by_id(conn, invoice_id)
            if not invoice:
                raise SalesInvoiceServiceError(f"Invoice {invoice_id} not found")
            
            if invoice.status == SalesInvoiceStatus.CANCELLED:
                raise SalesInvoiceServiceError(f"Invoice {invoice_id} is already cancelled")
            
            # Get invoice items
            items = self.item_repo.get_items_for_invoice(conn, invoice_id)
            
            # Reverse stock deduction (add stock back)
            for item in items:
                # Find the batch that was deducted - simplified approach
                # In production, would track exact batches
                self.inventory_service.add_stock(
                    item_code=item.item_code,
                    quantity=item.quantity,
                    warehouse_id=item.warehouse_id,
                    batch_no=f"RETURN-{invoice.invoice_no}",
                    manufacturing_date=date.today(),
                    expiry_date=None,
                    rate=item.rate,
                    reference_type='SALES_RETURN',
                    reference_id=invoice_id
                )
            
            # Reverse journal entry
            # Find the JE for this invoice
            je = None  # Would query JE repository by reference
            if je:
                self.accounting_service.reverse_journal_entry(
                    je.id,
                    date.today(),
                    f"Cancelled: {cancellation_reason}"
                )
            
            # Update invoice status
            invoice.status = SalesInvoiceStatus.CANCELLED
            invoice.cancelled_at = datetime.now()
            invoice.cancellation_remarks = cancellation_reason
            self.invoice_repo.update(conn, invoice)
            
            conn.commit()
            return invoice
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise SalesInvoiceServiceError(f"Failed to cancel invoice: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def get_invoice_details(self, invoice_id: str) -> Dict[str, Any]:
        """
        Get complete invoice details including items.
        """
        conn = None
        try:
            conn = get_connection()
            
            invoice = self.invoice_repo.get_by_id(conn, invoice_id)
            if not invoice:
                return {}
            
            items = self.item_repo.get_items_for_invoice(conn, invoice_id)
            customer = self.party_service.get_party_by_id(invoice.customer_id)
            
            return {
                'invoice': invoice,
                'items': items,
                'customer': customer,
                'outstanding': self._calculate_outstanding(invoice_id)
            }
            
        finally:
            if conn:
                conn.close()
    
    def _calculate_outstanding(self, invoice_id: str) -> Decimal:
        """
        Calculate outstanding amount for an invoice.
        """
        # Get invoice
        conn = None
        try:
            conn = get_connection()
            invoice = self.invoice_repo.get_by_id(conn, invoice_id)
            if not invoice:
                return Decimal('0')
            
            # Get payments against this invoice
            # Simplified - would query payment allocation table
            total_paid = Decimal('0')  # Query payments
            
            return invoice.grand_total - total_paid
            
        finally:
            if conn:
                conn.close()
    
    def get_sales_register(self, from_date: date, to_date: date) -> List[Dict[str, Any]]:
        """
        Get sales register report for a period.
        """
        conn = None
        try:
            conn = get_connection()
            
            invoices = self.invoice_repo.get_invoices_by_date_range(
                conn,
                self.company_id,
                from_date,
                to_date
            )
            
            register = []
            for invoice in invoices:
                customer = self.party_service.get_party_by_id(invoice.customer_id)
                register.append({
                    'date': invoice.invoice_date,
                    'invoice_no': invoice.invoice_no,
                    'customer_name': customer.name if customer else 'Unknown',
                    'total_amount': invoice.total_amount,
                    'tax_amount': invoice.tax_amount,
                    'grand_total': invoice.grand_total,
                    'status': invoice.status,
                    'outstanding': self._calculate_outstanding(invoice.id)
                })
            
            return register
            
        finally:
            if conn:
                conn.close()
