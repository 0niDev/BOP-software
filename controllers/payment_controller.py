"""Controller for payments."""
from __future__ import annotations

from services.payment_service import PaymentService
from utils.exceptions import ERPException
from utils.logger import get_logger

logger = get_logger(__name__)


class PaymentController:
    def __init__(self, payment_service: PaymentService | None = None):
        self.service = payment_service or PaymentService()

    def pay_supplier(
        self,
        supplier_id: int,
        amount: float,
        payment_date: str,
        payment_method: str = "BANK",
        reference_no: str | None = None,
        notes: str | None = None,
        purchase_invoice_id: int | None = None,  # ← ADD THIS
    ) -> tuple[bool, str | None]:
        """Record a payment to a supplier."""
        try:
            self.service.pay_supplier(
                supplier_id=supplier_id,
                amount=amount,
                payment_date=payment_date,
                payment_method=payment_method,
                reference_no=reference_no,
                notes=notes,
                purchase_invoice_id=purchase_invoice_id,  # ← PASS IT
            )
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error recording payment")
            return False, "An unexpected error occurred."

    def receive_payment(
        self,
        customer_id: int,
        amount: float,
        payment_date: str,
        payment_method: str = "CASH",
        reference_no: str | None = None,
        notes: str | None = None,
        sales_invoice_id: int | None = None,  # ← ADD THIS
    ) -> tuple[bool, str | None]:
        """Record a payment received from a customer."""
        try:
            self.service.receive_payment(
                customer_id=customer_id,
                amount=amount,
                payment_date=payment_date,
                payment_method=payment_method,
                reference_no=reference_no,
                notes=notes,
                sales_invoice_id=sales_invoice_id,  # ← PASS IT
            )
            return True, None
        except ERPException as exc:
            return False, str(exc)
        except Exception:
            logger.exception("Unexpected error recording receipt")
            return False, "An unexpected error occurred."


