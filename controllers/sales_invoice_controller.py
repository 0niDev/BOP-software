"""Controller for Sales Invoices - translates service errors to UI messages."""
from __future__ import annotations

from models.sales_invoice import SalesInvoice
from services.sales_invoice_service import SalesInvoiceService
from utils.exceptions import ERPException
from utils.logger import get_logger

logger = get_logger(__name__)


class SalesInvoiceController:
    """Controller for sales invoice operations."""
    
    def __init__(self, sales_invoice_service: SalesInvoiceService | None = None):
        self.service = sales_invoice_service or SalesInvoiceService()

    


    def get_sales_invoice(self, invoice_id: int) -> tuple[SalesInvoice | None, str | None]:
        """Gets sales invoice by ID."""
        try:
            invoice = self.service.get_sales_invoice(invoice_id)
            if invoice is None:
                return None, "Sales invoice not found."
            return invoice, None
        except ERPException as exc:
            return None, str(exc)
        except Exception:
            logger.exception("Unexpected error getting sales invoice")
            return None, "An unexpected error occurred while retrieving the sales invoice."

    def list_sales_invoices(
        self, 
        status: str | None = None
    ) -> tuple[list[SalesInvoice], str | None]:
        """Lists sales invoices."""
        try:
            invoices = self.service.list_sales_invoices(status=status)
            return invoices, None
        except ERPException as exc:
            return [], str(exc)
        except Exception:
            logger.exception("Unexpected error listing sales invoices")
            return [], "An unexpected error occurred while listing sales invoices."


    def delete_sales_invoice(self, invoice_id: int) -> tuple[bool, str | None]:
        """Attempts to delete sales invoice."""
        try:
            self.service.delete_sales_invoice(invoice_id)
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error deleting sales invoice")
            return False, "An unexpected error occurred while deleting the sales invoice."



    def create_sales_invoice(
        self,
        invoice_number: str,
        customer_id: int,
        invoice_date: str,
        payment_type: str,
        items: list,
        notes: str | None,
        bank_account_id: int | None = None,  # ← ADD THIS
    ) -> tuple[bool, str | None]:
        """Attempts to create sales invoice."""
        try:
            self.service.create_sales_invoice(
                invoice_number=invoice_number,
                customer_id=customer_id,
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
            logger.exception("Unexpected error creating sales invoice")
            return False, "An unexpected error occurred while creating the sales invoice."


    def update_sales_invoice(
        self,
        invoice_id: int,
        invoice_number: str,
        customer_id: int,
        invoice_date: str,
        payment_type: str,
        items: list,
        notes: str | None,
        status: str,
        bank_account_id: int | None = None,  # ← ADD THIS
    ) -> tuple[bool, str | None]:
        """Attempts to update sales invoice."""
        try:
            self.service.update_sales_invoice(
                invoice_id=invoice_id,
                invoice_number=invoice_number,
                customer_id=customer_id,
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
            logger.exception("Unexpected error updating sales invoice")
            return False, "An unexpected error occurred while updating the sales invoice."