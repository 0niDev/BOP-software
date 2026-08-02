"""Purchase Controller for BOP Nutraceuticals ERP."""

from typing import List, Optional, Dict, Any
from datetime import date
from decimal import Decimal
from models.purchase_invoice import PurchaseInvoice, DocumentStatus
from services.purchase_invoice_service import PurchaseInvoiceService
from services.inventory_service import InventoryService


class PurchaseController:
    """Controller for purchase invoice operations."""
    
    def __init__(
        self,
        purchase_service: PurchaseInvoiceService,
        inventory_service: InventoryService
    ):
        self.purchase_service = purchase_service
        self.inventory_service = inventory_service
    
    def create_purchase_invoice(
        self,
        company_id: str,
        warehouse_id: str,
        party_id: str,
        items: List[Dict[str, Any]],
        narration: str = "",
        auto_post: bool = True
    ) -> tuple[bool, str, Optional[PurchaseInvoice]]:
        """Create a new purchase invoice."""
        try:
            invoice = self.purchase_service.create_purchase_invoice(
                company_id=company_id,
                warehouse_id=warehouse_id,
                party_id=party_id,
                items=items,
                narration=narration,
                auto_post=auto_post
            )
            
            if invoice:
                status_msg = "posted" if auto_post else "saved as draft"
                return True, f"Purchase invoice {invoice.invoice_number} {status_msg} successfully.", invoice
            else:
                return False, "Failed to create purchase invoice.", None
                
        except Exception as e:
            return False, f"Error creating purchase invoice: {str(e)}", None
    
    def get_purchase_invoice(self, invoice_id: str) -> Optional[PurchaseInvoice]:
        """Get purchase invoice by ID."""
        try:
            return self.purchase_service.get_purchase_invoice(invoice_id)
        except Exception:
            return None
    
    def update_purchase_invoice(
        self,
        invoice_id: str,
        party_id: Optional[str] = None,
        items: Optional[List[Dict[str, Any]]] = None,
        narration: Optional[str] = None
    ) -> tuple[bool, str]:
        """Update existing purchase invoice (draft only)."""
        try:
            invoice = self.purchase_service.get_purchase_invoice(invoice_id)
            
            if not invoice:
                return False, "Invoice not found."
            
            if invoice.status != DocumentStatus.DRAFT:
                return False, "Cannot update posted/cancelled invoice."
            
            updated = self.purchase_service.update_purchase_invoice(
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
    
    def post_purchase_invoice(self, invoice_id: str) -> tuple[bool, str]:
        """Post a draft purchase invoice."""
        try:
            result = self.purchase_service.post_purchase_invoice(invoice_id)
            
            if result:
                return True, "Invoice posted successfully."
            else:
                return False, "Failed to post invoice."
                
        except Exception as e:
            return False, f"Error posting invoice: {str(e)}"
    
    def cancel_purchase_invoice(self, invoice_id: str, reason: str = "") -> tuple[bool, str]:
        """Cancel a posted purchase invoice."""
        try:
            result = self.purchase_service.cancel_purchase_invoice(invoice_id, reason)
            
            if result:
                return True, "Invoice cancelled successfully."
            else:
                return False, "Failed to cancel invoice."
                
        except Exception as e:
            return False, f"Error cancelling invoice: {str(e)}"
    
    def get_purchase_register(
        self,
        company_id: str,
        from_date: date,
        to_date: date,
        party_id: Optional[str] = None,
        status: Optional[DocumentStatus] = None
    ) -> List[PurchaseInvoice]:
        """Get purchase register report."""
        try:
            return self.purchase_service.get_purchase_register(
                company_id=company_id,
                from_date=from_date,
                to_date=to_date,
                party_id=party_id,
                status=status
            )
        except Exception:
            return []
    
    def get_supplier_outstanding(self, company_id: str, party_id: str) -> Decimal:
        """Get outstanding amount for a supplier."""
        try:
            return self.purchase_service.get_party_outstanding(company_id, party_id)
        except Exception:
            return Decimal('0.00')
