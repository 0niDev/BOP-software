"""Sales Controller for BOP Nutraceuticals ERP."""

from typing import List, Optional, Dict, Any
from datetime import date
from decimal import Decimal
from PySide6.QtWidgets import QMessageBox
from models.sales_invoice import SalesInvoice, SalesInvoiceItem, DocumentStatus
from models.party import Party
from models.item import Item
from services.sales_invoice_service import SalesInvoiceService
from services.inventory_service import InventoryService
from services.accounting_service import AccountingService


class SalesController:
    """Controller for sales invoice operations."""
    
    def __init__(
        self,
        sales_service: SalesInvoiceService,
        inventory_service: InventoryService,
        accounting_service: AccountingService
    ):
        self.sales_service = sales_service
        self.inventory_service = inventory_service
        self.accounting_service = accounting_service
    
    def create_sales_invoice(
        self,
        company_id: str,
        warehouse_id: str,
        party_id: str,
        items: List[Dict[str, Any]],
        narration: str = "",
        auto_post: bool = True
    ) -> tuple[bool, str, Optional[SalesInvoice]]:
        """
        Create a new sales invoice.
        
        Args:
            company_id: Company identifier
            warehouse_id: Warehouse identifier
            party_id: Customer party identifier
            items: List of dicts with keys: item_id, quantity, rate, discount (optional)
            narration: Invoice narration
            auto_post: Whether to automatically post the invoice
            
        Returns:
            Tuple of (success: bool, message: str, invoice: Optional[SalesInvoice])
        """
        try:
            # Validate stock availability
            for item_data in items:
                available_qty = self.inventory_service.get_available_stock(
                    company_id=company_id,
                    warehouse_id=warehouse_id,
                    item_id=item_data['item_id']
                )
                
                if available_qty < Decimal(str(item_data['quantity'])):
                    item = self.inventory_service.get_item_by_id(item_data['item_id'])
                    return False, f"Insufficient stock for {item.name if item else 'item'}. Available: {available_qty}", None
            
            # Create invoice
            invoice = self.sales_service.create_sales_invoice(
                company_id=company_id,
                warehouse_id=warehouse_id,
                party_id=party_id,
                items=items,
                narration=narration,
                auto_post=auto_post
            )
            
            if invoice:
                status_msg = "posted" if auto_post else "saved as draft"
                return True, f"Sales invoice {invoice.invoice_number} {status_msg} successfully.", invoice
            else:
                return False, "Failed to create sales invoice.", None
                
        except Exception as e:
            return False, f"Error creating sales invoice: {str(e)}", None
    
    def get_sales_invoice(self, invoice_id: str) -> Optional[SalesInvoice]:
        """Get sales invoice by ID."""
        try:
            return self.sales_service.get_sales_invoice(invoice_id)
        except Exception as e:
            return None
    
    def get_sales_invoice_by_number(self, company_id: str, invoice_number: str) -> Optional[SalesInvoice]:
        """Get sales invoice by invoice number."""
        try:
            invoices = self.sales_service.get_sales_register(company_id, date.min, date.max)
            for inv in invoices:
                if inv.invoice_number == invoice_number:
                    return inv
            return None
        except Exception:
            return None
    
    def update_sales_invoice(
        self,
        invoice_id: str,
        party_id: Optional[str] = None,
        items: Optional[List[Dict[str, Any]]] = None,
        narration: Optional[str] = None
    ) -> tuple[bool, str]:
        """Update existing sales invoice (draft only)."""
        try:
            invoice = self.sales_service.get_sales_invoice(invoice_id)
            
            if not invoice:
                return False, "Invoice not found."
            
            if invoice.status != DocumentStatus.DRAFT:
                return False, "Cannot update posted/cancelled invoice."
            
            updated = self.sales_service.update_sales_invoice(
                invoice_id=invoice_id,
                party_id=party_id,
                items=items,
                narration=narration
            )
            
            if updated:
                return True, "Invoice updated successfully."
            else:
                return False, "Failed to update invoice."
                
        except Exception as e:
            return False, f"Error updating invoice: {str(e)}"
    
    def post_sales_invoice(self, invoice_id: str) -> tuple[bool, str]:
        """Post a draft sales invoice."""
        try:
            result = self.sales_service.post_sales_invoice(invoice_id)
            
            if result:
                return True, "Invoice posted successfully."
            else:
                return False, "Failed to post invoice."
                
        except Exception as e:
            return False, f"Error posting invoice: {str(e)}"
    
    def cancel_sales_invoice(self, invoice_id: str, reason: str = "") -> tuple[bool, str]:
        """Cancel a posted sales invoice."""
        try:
            result = self.sales_service.cancel_sales_invoice(invoice_id, reason)
            
            if result:
                return True, "Invoice cancelled successfully."
            else:
                return False, "Failed to cancel invoice."
                
        except Exception as e:
            return False, f"Error cancelling invoice: {str(e)}"
    
    def get_sales_register(
        self,
        company_id: str,
        from_date: date,
        to_date: date,
        party_id: Optional[str] = None,
        status: Optional[DocumentStatus] = None
    ) -> List[SalesInvoice]:
        """Get sales register report."""
        try:
            return self.sales_service.get_sales_register(
                company_id=company_id,
                from_date=from_date,
                to_date=to_date,
                party_id=party_id,
                status=status
            )
        except Exception as e:
            return []
    
    def get_customer_outstanding(self, company_id: str, party_id: str) -> Decimal:
        """Get outstanding amount for a customer."""
        try:
            return self.sales_service.get_party_outstanding(company_id, party_id)
        except Exception:
            return Decimal('0.00')
    
    def validate_customer_credit_limit(
        self,
        company_id: str,
        party_id: str,
        invoice_amount: Decimal
    ) -> tuple[bool, str]:
        """Validate if invoice exceeds customer credit limit."""
        try:
            party = self.sales_service.party_repository.get_by_id(party_id)
            
            if not party:
                return True, "Party not found, proceeding anyway."
            
            current_outstanding = self.get_customer_outstanding(company_id, party_id)
            new_outstanding = current_outstanding + invoice_amount
            
            if party.credit_limit and new_outstanding > party.credit_limit:
                return False, f"Credit limit exceeded. Limit: {party.credit_limit}, New Outstanding: {new_outstanding}"
            
            return True, "Credit limit OK."
            
        except Exception as e:
            return False, f"Error checking credit limit: {str(e)}"
