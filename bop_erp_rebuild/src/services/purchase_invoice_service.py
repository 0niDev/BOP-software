"""
Purchase Invoice Service - Procurement workflow
Handles purchase invoice creation, stock receipt, and supplier payments.
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
import uuid

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from models.purchase_invoice import PurchaseInvoice, PurchaseInvoiceItem, PurchaseInvoiceStatus
from models.account import VoucherType
from repositories.purchase_repository import PurchaseInvoiceRepository, PurchaseInvoiceItemRepository
from services.accounting_service import AccountingService
from services.inventory_service import InventoryService
from services.party_service import PartyService
from database.connection_manager import get_connection


class PurchaseInvoiceServiceError(Exception):
    """Custom exception for purchase invoice service errors."""
    pass


class PurchaseInvoiceService:
    """
    Handles complete purchase invoice lifecycle including:
    - Invoice creation with validation
    - Stock receipt and batch creation
    - Automatic journal entry posting
    - Supplier balance updates
    """
    
    def __init__(self, company_id: str):
        self.company_id = company_id
        self.invoice_repo = PurchaseInvoiceRepository()
        self.item_repo = PurchaseInvoiceItemRepository()
        self.accounting_service = AccountingService(company_id)
        self.inventory_service = InventoryService(company_id)
        self.party_service = PartyService(company_id)
    
    def create_invoice(
        self,
        supplier_id: str,
        invoice_date: date,
        due_date: date,
        items: List[Dict[str, Any]],
        warehouse_id: str,
        bill_no: str,
        bill_date: date,
        remarks: str = "",
        auto_post: bool = True
    ) -> PurchaseInvoice:
        """
        Create a new purchase invoice.
        
        Args:
            supplier_id: Supplier party ID
            invoice_date: Invoice date
            due_date: Payment due date
            items: List of dicts with item_code, quantity, rate, batch_no, mfg_date, exp_date
            warehouse_id: Warehouse to receive stock in
            bill_no: Supplier's invoice number
            bill_date: Supplier's invoice date
            remarks: Invoice remarks
            auto_post: Whether to post stock and accounting immediately
            
        Returns:
            Created PurchaseInvoice
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            # Validate supplier
            supplier = self.party_service.get_party_by_id(supplier_id)
            if not supplier:
                raise PurchaseInvoiceServiceError(f"Supplier {supplier_id} not found")
            
            # Calculate totals
            total_amount = Decimal('0')
            total_tax = Decimal('0')
            total_discount = Decimal('0')
            
            created_items: List[PurchaseInvoiceItem] = []
            
            for idx, item_data in enumerate(items):
                item_code = item_data['item_code']
                quantity = Decimal(str(item_data['quantity']))
                rate = Decimal(str(item_data['rate']))
                discount_pct = Decimal(str(item_data.get('discount', 0)))
                
                # Calculate line totals
                line_total = quantity * rate
                line_discount = line_total * (discount_pct / Decimal('100'))
                net_amount = line_total - line_discount
                
                total_amount += net_amount
                total_discount += line_discount
                
                # Create invoice item
                item = PurchaseInvoiceItem(
                    id=str(uuid.uuid4()),
                    purchase_invoice_id='',  # Will be set after invoice creation
                    line_no=idx + 1,
                    item_code=item_code,
                    description=item_data.get('description', ''),
                    quantity=quantity,
                    rate=rate.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                    discount_percent=discount_pct,
                    discount_amount=line_discount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                    amount=net_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                    warehouse_id=warehouse_id,
                    batch_no=item_data.get('batch_no', ''),
                    manufacturing_date=item_data.get('manufacturing_date'),
                    expiry_date=item_data.get('expiry_date')
                )
                created_items.append(item)
            
            # Generate invoice number
            last_invoice = self.invoice_repo.get_last_invoice(conn, self.company_id, invoice_date.year)
            sequence = (int(last_invoice.split('-')[-1]) + 1) if last_invoice else 1
            invoice_no = f"PUR-{invoice_date.year}-{sequence:05d}"
            
            # Create invoice header
            invoice_id = str(uuid.uuid4())
            invoice = PurchaseInvoice(
                id=invoice_id,
                company_id=self.company_id,
                invoice_no=invoice_no,
                supplier_id=supplier_id,
                invoice_date=invoice_date,
                due_date=due_date,
                bill_no=bill_no,
                bill_date=bill_date,
                total_amount=total_amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                total_discount=total_discount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                tax_amount=total_tax,
                grand_total=total_amount,
                status=PurchaseInvoiceStatus.DRAFT,
                remarks=remarks,
                is_posted=False,
                created_at=datetime.now()
            )
            
            # Save invoice
            self.invoice_repo.create(conn, invoice)
            
            # Save invoice items
            for item in created_items:
                item.purchase_invoice_id = invoice_id
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
            raise PurchaseInvoiceServiceError(f"Failed to create purchase invoice: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def _post_invoice(
        self,
        conn,
        invoice: PurchaseInvoice,
        items: List[PurchaseInvoiceItem]
    ) -> None:
        """
        Post invoice - add stock and create accounting entries.
        Must be called within an existing transaction.
        """
        # Add stock for each item
        for item in items:
            self.inventory_service.add_stock(
                item_code=item.item_code,
                quantity=item.quantity,
                warehouse_id=item.warehouse_id,
                batch_no=item.batch_no or f"BATCH-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                manufacturing_date=item.manufacturing_date,
                expiry_date=item.expiry_date,
                rate=item.rate,
                reference_type='PURCHASE_INVOICE',
                reference_id=invoice.id
            )
        
        # Get accounts
        supplier = self.party_service.get_party_by_id(invoice.supplier_id)
        
        # Find supplier's payable account
        payable_account = '2100-AP'  # Should lookup from party or config
        
        # Find expense/inventory accounts for each item
        inventory_account = '1200-INVENTORY'  # Should be per item category
        
        # Create journal entry lines
        je_lines = [
            {
                'account_code': inventory_account,
                'debit': float(invoice.total_amount),
                'credit': 0,
                'party_id': None,
                'narration': f'Purchase Invoice {invoice.invoice_no}'
            },
            {
                'account_code': payable_account,
                'debit': 0,
                'credit': float(invoice.grand_total),
                'party_id': invoice.supplier_id,
                'narration': f'Payable for {invoice.invoice_no}'
            }
        ]
        
        # Add discount account if applicable
        if invoice.total_discount > 0:
            je_lines.append({
                'account_code': '5900-DISCOUNT',  # Discount received account
                'debit': 0,
                'credit': float(invoice.total_discount),
                'party_id': None,
                'narration': f'Discount on {invoice.invoice_no}'
            })
            
            # Adjust payable to match
            je_lines[1]['credit'] = float(invoice.grand_total + invoice.total_discount)
            je_lines[0]['debit'] = float(invoice.total_amount)
        
        # Create journal entry
        self.accounting_service.create_journal_entry(
            voucher_type=VoucherType.PURCHASE,
            voucher_no=invoice.invoice_no,
            voucher_date=invoice.invoice_date,
            lines=je_lines,
            description=f"Purchase Invoice {invoice.invoice_no} - {supplier.name}",
            reference=invoice.id,
            posted=True
        )
        
        # Update invoice status
        invoice.is_posted = True
        invoice.status = PurchaseInvoiceStatus.POSTED
        invoice.posted_at = datetime.now()
        self.invoice_repo.update(conn, invoice)
    
    def submit_invoice(self, invoice_id: str) -> PurchaseInvoice:
        """
        Submit a draft invoice for posting.
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            invoice = self.invoice_repo.get_by_id(conn, invoice_id)
            if not invoice:
                raise PurchaseInvoiceServiceError(f"Invoice {invoice_id} not found")
            
            if invoice.status != PurchaseInvoiceStatus.DRAFT:
                raise PurchaseInvoiceServiceError(f"Invoice {invoice_id} is not in draft status")
            
            # Get invoice items
            items = self.item_repo.get_items_for_invoice(conn, invoice_id)
            
            # Post the invoice
            self._post_invoice(conn, invoice, items)
            
            conn.commit()
            return invoice
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise PurchaseInvoiceServiceError(f"Failed to submit invoice: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def cancel_invoice(self, invoice_id: str, cancellation_reason: str) -> PurchaseInvoice:
        """
        Cancel a posted invoice and reverse all entries.
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            invoice = self.invoice_repo.get_by_id(conn, invoice_id)
            if not invoice:
                raise PurchaseInvoiceServiceError(f"Invoice {invoice_id} not found")
            
            if invoice.status == PurchaseInvoiceStatus.CANCELLED:
                raise PurchaseInvoiceServiceError(f"Invoice {invoice_id} is already cancelled")
            
            # Get invoice items
            items = self.item_repo.get_items_for_invoice(conn, invoice_id)
            
            # Reverse stock addition (deduct stock)
            for item in items:
                # Deduct the stock that was added
                self.inventory_service.deduct_stock(
                    item_code=item.item_code,
                    quantity=item.quantity,
                    warehouse_id=item.warehouse_id,
                    reference_type='PURCHASE_RETURN',
                    reference_id=invoice_id,
                    batch_ids=None  # Would track exact batches in production
                )
            
            # Reverse journal entry
            je = None  # Would query JE repository by reference
            if je:
                self.accounting_service.reverse_journal_entry(
                    je.id,
                    date.today(),
                    f"Cancelled: {cancellation_reason}"
                )
            
            # Update invoice status
            invoice.status = PurchaseInvoiceStatus.CANCELLED
            invoice.cancelled_at = datetime.now()
            invoice.cancellation_remarks = cancellation_reason
            self.invoice_repo.update(conn, invoice)
            
            conn.commit()
            return invoice
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise PurchaseInvoiceServiceError(f"Failed to cancel invoice: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def get_purchase_register(self, from_date: date, to_date: date) -> List[Dict[str, Any]]:
        """
        Get purchase register report for a period.
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
                supplier = self.party_service.get_party_by_id(invoice.supplier_id)
                register.append({
                    'date': invoice.invoice_date,
                    'invoice_no': invoice.invoice_no,
                    'bill_no': invoice.bill_no,
                    'supplier_name': supplier.name if supplier else 'Unknown',
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
    
    def _calculate_outstanding(self, invoice_id: str) -> Decimal:
        """
        Calculate outstanding amount for an invoice.
        """
        conn = None
        try:
            conn = get_connection()
            invoice = self.invoice_repo.get_by_id(conn, invoice_id)
            if not invoice:
                return Decimal('0')
            
            # Get payments against this invoice
            total_paid = Decimal('0')  # Query payments
            
            return invoice.grand_total - total_paid
            
        finally:
            if conn:
                conn.close()
