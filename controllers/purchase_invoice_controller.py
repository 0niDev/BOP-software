"""Controller for Purchase Invoices - translates service errors to UI messages."""
from __future__ import annotations

from models.purchase_invoice import PurchaseInvoice
from services.purchase_invoice_service import PurchaseInvoiceService
from utils.exceptions import ERPException
from utils.logger import get_logger

logger = get_logger(__name__)


class PurchaseInvoiceController:
    def __init__(self, purchase_invoice_service: PurchaseInvoiceService | None = None):
        self.service = purchase_invoice_service or PurchaseInvoiceService()

    def create_purchase_invoice(
        self,
        invoice_number: str,
        supplier_id: int,
        invoice_date: str,
        payment_type: str,
        items: list,
        notes: str | None,
        bank_account_id: int | None = None,  # ← ADD THIS
    ) -> tuple[bool, str | None]:
        """Attempts to create purchase invoice."""
        try:
            self.service.create_purchase_invoice(
                invoice_number=invoice_number,
                supplier_id=supplier_id,
                invoice_date=invoice_date,
                payment_type=payment_type,
                items=items,
                notes=notes,
                bank_account_id=bank_account_id,  # ← PASS IT
            )
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error creating purchase invoice")
            return False, "An unexpected error occurred while creating the purchase invoice."

    def get_purchase_invoice(self, invoice_id: int) -> tuple[PurchaseInvoice | None, str | None]:
        """Gets purchase invoice by ID"""
        try:
            invoice = self.service.get_purchase_invoice(invoice_id)
            if invoice is None:
                return None, "Purchase invoice not found."
            return invoice, None
        except ERPException as exc:
            return None, str(exc)
        except Exception:
            logger.exception("Unexpected error getting purchase invoice")
            return None, "An unexpected error occurred while retrieving the purchase invoice."

    def list_purchase_invoices(
        self, 
        status: str | None = None
    ) -> tuple[list[PurchaseInvoice], str | None]:
        """Lists purchase invoices"""
        try:
            invoices = self.service.list_purchase_invoices(status=status)
            return invoices, None
        except ERPException as exc:
            return [], str(exc)
        except Exception:
            logger.exception("Unexpected error listing purchase invoices")
            return [], "An unexpected error occurred while listing purchase invoices."

    def update_purchase_invoice(
        self,
        invoice_id: int,
        invoice_number: str,
        supplier_id: int,
        invoice_date: str,
        payment_type: str,
        items: list,
        notes: str | None,
        status: str,
        bank_account_id: int | None = None,  # ← ADD THIS
    ) -> tuple[bool, str | None]:
        """Attempts to update purchase invoice."""
        try:
            self.service.update_purchase_invoice(
                invoice_id=invoice_id,
                invoice_number=invoice_number,
                supplier_id=supplier_id,
                invoice_date=invoice_date,
                payment_type=payment_type,
                items=items,
                notes=notes,
                status=status,
                bank_account_id=bank_account_id,  # ← PASS IT
            )
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error updating purchase invoice")
            return False, "An unexpected error occurred while updating the purchase invoice."

    def delete_purchase_invoice(self, invoice_id: int) -> tuple[bool, str | None]:
        """Attempts to delete purchase invoice."""
        try:
            self.service.delete_purchase_invoice(invoice_id)
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error deleting purchase invoice")
            return False, "An unexpected error occurred while deleting the purchase invoice."