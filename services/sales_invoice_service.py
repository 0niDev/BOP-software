"""Business rules for Sales Invoices (creation, validation, accounting)."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List

from database.connection import DatabaseConnection, get_db
from models.enums import VoucherType
from models.sales_invoice import SalesInvoice, SalesInvoiceItem
from models.item import Item
from models.party import Party
from repositories.sales_invoice_repository import (
    SalesInvoiceRepository,
    SalesInvoiceItemRepository
)
from repositories.item_repository import ItemRepository
from repositories.party_repository import PartyRepository
from repositories.account_repository import AccountRepository
from repositories.stock_batch_repository import StockBatchRepository
from services.accounting_service import AccountingService, JournalLine
from utils.exceptions import ValidationError, InsufficientStockError
from utils.logger import get_logger

logger = get_logger(__name__)


class SalesInvoiceService:
    """Service for managing sales invoices with automatic accounting."""

    def __init__(self, db: DatabaseConnection | None = None):
        self.db = db or get_db()
        self.invoice_repo = SalesInvoiceRepository(self.db)
        self.item_repo = SalesInvoiceItemRepository(self.db)
        self.item_master_repo = ItemRepository(self.db)
        self.party_repo = PartyRepository(self.db)
        self.account_repo = AccountRepository(self.db)
        self.accounting_service = AccountingService(self.db)
        self.stock_repo = StockBatchRepository(self.db)

    def _update_stock(
        self,
        item_id: int,
        warehouse_id: int,
        quantity: float,
        positive: bool = False,
    ) -> None:
        """Update stock when selling items."""
        item = self.item_master_repo.get_by_id(item_id)
        if not item:
            logger.warning(f"Item {item_id} not found for stock update")
            return
        
        change = quantity if positive else -quantity
        logger.info(f"Updating stock for {item['item_code']}: {change}")
        
        existing_batch = self.stock_repo.find_by_item_and_warehouse(item_id, warehouse_id)
        
        if existing_batch:
            current_qty = existing_batch["quantity_in_stock"]
            logger.info(f"Current stock for {item['item_code']}: {current_qty}")
            
            if not positive and current_qty < quantity:
                logger.warning(f"Insufficient stock for {item['item_code']}: "
                            f"Available: {current_qty}, Required: {quantity}")
                raise ValidationError(f"Insufficient stock for {item['item_name']}. "
                                    f"Available: {current_qty}, Required: {quantity}")
            
            if positive:
                new_quantity = current_qty + quantity
                self.stock_repo.update_quantity(existing_batch["id"], quantity)
            else:
                new_quantity = current_qty - quantity
                self.stock_repo.update_quantity(existing_batch["id"], -quantity)
            
            logger.info(f"Updated stock for {item['item_code']}: {current_qty} -> {new_quantity}")
        else:
            logger.warning(f"No stock found for {item['item_code']}")
            if not positive:
                raise ValidationError(f"No stock available for {item['item_name']}")

    def create_sales_invoice(
        self,
        invoice_number: str,
        customer_id: int,
        invoice_date: str,
        payment_type: str,
        items: List[dict],
        notes: str | None = None,
        company_id: int = 1,
        warehouse_id: int = 1,
        created_by: int | None = None,
        bank_account_id: int | None = None,
    ) -> SalesInvoice:
        """Creates a sales invoice with automatic journal entry and stock update."""
        invoice_number = invoice_number.strip()
        if not invoice_number:
            raise ValidationError("Invoice number is required.")
        if not customer_id:
            raise ValidationError("Customer is required.")
        if not invoice_date:
            raise ValidationError("Invoice date is required.")
        if payment_type not in ["CASH", "BANK", "CHEQUE", "CREDIT"]:
            raise ValidationError("Invalid payment type.")
        if not items:
            raise ValidationError("At least one item is required.")

        customer_dict = self.party_repo.get_by_id(customer_id)
        if not customer_dict:
            raise ValidationError("Customer does not exist.")
        if not customer_dict.get("is_active", 0):
            raise ValidationError("Customer is not active.")
        if customer_dict.get("party_type") not in ["CUSTOMER", "BOTH"]:
            raise ValidationError("Selected party is not a customer.")
        
        customer = Party.from_row(customer_dict)

        validated_items = []
        subtotal = Decimal('0')
        discount_amount = Decimal('0')
        tax_amount = Decimal('0')
        
        for item_data in items:
            item_id = item_data.get("item_id")
            quantity = Decimal(str(item_data.get("quantity", 0)))
            unit_price = Decimal(str(item_data.get("unit_price", 0)))
            discount = Decimal(str(item_data.get("discount_amount", 0)))
            tax = Decimal(str(item_data.get("tax_amount", 0)))
            batch_id = item_data.get("batch_id")
            
            if not item_id or quantity <= 0:
                raise ValidationError(f"Invalid quantity for item {item_id}")
            if unit_price < 0:
                raise ValidationError(f"Unit price cannot be negative for item {item_id}")
            
            item_dict = self.item_master_repo.get_by_id(item_id)
            if not item_dict:
                raise ValidationError(f"Item {item_id} does not exist.")
            item = Item.from_row(item_dict)
            
            if not item.is_active:
                raise ValidationError(f"Item {item.item_name} is not active.")
            
            stock_batch = self.stock_repo.find_by_item_and_warehouse(item_id, warehouse_id)
            available_stock = stock_batch["quantity_in_stock"] if stock_batch else 0
            
            logger.info(f"Stock check for {item.item_code}: Available: {available_stock}, Required: {quantity}")
            
            if available_stock < quantity:
                raise InsufficientStockError(
                    f"Insufficient stock for {item.item_name}. "
                    f"Available: {available_stock}, Required: {quantity}"
                )
            
            line_total = (quantity * unit_price) - discount + tax
            if line_total < 0:
                raise ValidationError(f"Line total cannot be negative for item {item.item_name}")
            
            validated_items.append({
                "item_id": item_id,
                "batch_id": batch_id,
                "quantity": float(quantity),
                "unit_price": float(unit_price),
                "discount_amount": float(discount),
                "tax_amount": float(tax),
                "line_total": float(line_total),
                "item_name": item.item_name,
                "item_code": item.item_code,
            })
            
            subtotal += quantity * unit_price
            discount_amount += discount
            tax_amount += tax

        total_amount = subtotal - discount_amount + tax_amount
        
        # ✅ FIX: Create invoice WITH bank_account_id
        invoice = SalesInvoice(
            invoice_number=invoice_number,
            customer_id=customer_id,
            invoice_date=invoice_date,
            payment_type=payment_type,
            bank_account_id=bank_account_id,  # ← THIS WAS MISSING!
            subtotal=float(subtotal),
            discount_amount=float(discount_amount),
            tax_amount=float(tax_amount),
            total_amount=float(total_amount),
            notes=notes,
            company_id=company_id,
            warehouse_id=warehouse_id,
            created_by=created_by
        )

        revenue_account_dict = self.account_repo.find_by_code("4000")
        if not revenue_account_dict:
            raise ValidationError("Sales Revenue account (4000) not found.")
        revenue_account_id = revenue_account_dict["id"]

        tax_account_dict = self.account_repo.find_by_code("2100")
        tax_account_id = tax_account_dict["id"] if tax_account_dict else None

        # Determine debit account based on payment type
        debit_account_id = None
        debit_description = ""

        if payment_type == "CREDIT":
            debit_account_dict = self.account_repo.find_by_code("1100")
            if not debit_account_dict:
                raise ValidationError("Accounts Receivable account (1100) not found.")
            debit_account_id = debit_account_dict["id"]
            debit_description = f"Credit sale to {customer.name}"
        elif payment_type == "CASH":
            debit_account_dict = self.account_repo.find_by_code("1000")
            if not debit_account_dict:
                raise ValidationError("Cash account (1000) not found.")
            debit_account_id = debit_account_dict["id"]
            debit_description = "Cash sale"
        elif payment_type in ["BANK", "CHEQUE"]:
            if bank_account_id:
                bank_account = self.db.fetch_one("""
                    SELECT id, bank_name, account_id FROM bank_accounts WHERE id = ?
                """, (bank_account_id,))
                if bank_account:
                    debit_account_id = bank_account["account_id"]
                    bank_name = bank_account.get("bank_name", "Selected Bank")
                    debit_description = f"{payment_type} sale - {bank_name}"
                    logger.info(f"✅ Using specific bank account: {bank_name}")
                else:
                    raise ValidationError("Selected bank account not found.")
            else:
                debit_account_dict = self.account_repo.find_by_code("1010")
                if not debit_account_dict:
                    raise ValidationError("Bank account (1010) not found.")
                debit_account_id = debit_account_dict["id"]
                debit_description = f"{payment_type} sale"

        if debit_account_id is None:
            raise ValidationError(f"Could not determine debit account for payment type: {payment_type}")

        journal_lines = [
            JournalLine(
                account_id=debit_account_id,
                debit=float(total_amount),
                credit=0.0,
                party_id=customer_id if payment_type == "CREDIT" else None,
                description=debit_description
            ),
            JournalLine(
                account_id=revenue_account_id,
                debit=0.0,
                credit=float(subtotal - discount_amount),
                description="Sales revenue"
            )
        ]
        
        if tax_amount > 0 and tax_account_id:
            journal_lines.append(
                JournalLine(
                    account_id=tax_account_id,
                    debit=0.0,
                    credit=float(tax_amount),
                    description="Sales tax"
                )
            )

        with self.db.transaction():
            invoice.id = self.invoice_repo.insert_unique(invoice.to_dict())
            
            for item_data in validated_items:
                clean_item_data = {
                    "invoice_id": invoice.id,
                    "item_id": item_data["item_id"],
                    "batch_id": item_data.get("batch_id"),
                    "quantity": item_data["quantity"],
                    "unit_price": item_data["unit_price"],
                    "discount_amount": item_data["discount_amount"],
                    "tax_amount": item_data["tax_amount"],
                    "line_total": item_data["line_total"],
                }
                item = SalesInvoiceItem(**clean_item_data)
                self.item_repo.insert(item.to_dict())
                
                self._update_stock(
                    item_id=item_data["item_id"],
                    warehouse_id=warehouse_id,
                    quantity=item_data["quantity"],
                    positive=False,
                )
            
            self.accounting_service.post_journal_entry(
                voucher_type=VoucherType.SALES,
                entry_date=invoice_date,
                lines=journal_lines,
                source_table="sales_invoices",
                source_id=invoice.id,
                narration=f"Sales invoice {invoice_number} to {customer.name}"
            )
            # ============================================================
            # ADD COGS ENTRY HERE (BEFORE bank transaction)
            # ============================================================
            # Calculate total COGS
            cogs_total = Decimal('0')
            for item_data in validated_items:
                item_dict = self.item_master_repo.get_by_id(item_data["item_id"])
                if item_dict:
                    purchase_price = Decimal(str(item_dict.get("purchase_price", 0)))
                    cogs_total += purchase_price * Decimal(str(item_data["quantity"]))

            if cogs_total > 0:
                cogs_account = self.account_repo.find_by_code("5000")
                if not cogs_account:
                    logger.warning("COGS account (5000) not found - skipping COGS entry")
                else:
                    inventory_account = self.account_repo.find_by_code("1220")  # Finished Goods
                    if not inventory_account:
                        inventory_account = self.account_repo.find_by_code("1200")  # Raw Materials
                    
                    if inventory_account:
                        self.accounting_service.post_journal_entry(
                            voucher_type=VoucherType.JOURNAL,
                            entry_date=invoice_date,
                            lines=[
                                JournalLine(
                                    account_id=cogs_account["id"],
                                    debit=float(cogs_total),
                                    credit=0,
                                    description=f"COGS for {invoice_number}"
                                ),
                                JournalLine(
                                    account_id=inventory_account["id"],
                                    debit=0,
                                    credit=float(cogs_total),
                                    description=f"Reduce inventory for {invoice_number}"
                                )
                            ],
                            source_table="sales_invoices",
                            source_id=invoice.id,
                            narration=f"Cost of Goods Sold for {invoice_number}"
                        )
                        logger.info(f"✅ Posted COGS: Rs. {cogs_total:,.2f} for invoice {invoice_number}")

            
            if payment_type in ["BANK", "CHEQUE"] and bank_account_id:
                self.db.execute("""
                    INSERT INTO bank_transactions (
                        bank_account_id,
                        transaction_type,
                        amount,
                        transaction_date,
                        reference_no,
                        notes,
                        created_at
                    ) VALUES (?, 'DEPOSIT', ?, ?, ?, ?, datetime('now'))
                """, (
                    bank_account_id,
                    float(total_amount),
                    invoice_date,
                    invoice_number,
                    f"Sales invoice {invoice_number} - {payment_type} payment"
                ))
                logger.info(f"✅ Recorded bank deposit for invoice {invoice_number} to bank account {bank_account_id}")

        logger.info("Created sales invoice %s for customer %s (id=%s) - Payment: %s", 
                   invoice_number, customer_id, invoice.id, payment_type)
        
        invoice.items = [SalesInvoiceItem.from_row(row) for row in self.item_repo.find_by_invoice_id(invoice.id)]
        return invoice

    def get_sales_invoice(self, invoice_id: int) -> SalesInvoice | None:
        row = self.invoice_repo.get_by_id(invoice_id)
        if not row:
            return None
        invoice = SalesInvoice.from_row(row)
        invoice.items = [SalesInvoiceItem.from_row(row) for row in self.item_repo.find_by_invoice_id(invoice_id)]
        return invoice

    def list_sales_invoices(
        self, 
        company_id: int = 1, 
        status: str | None = None
    ) -> list[SalesInvoice]:
        rows = self.invoice_repo.find_all_for_company(company_id, status)
        invoices = []
        for row in rows:
            invoice = SalesInvoice.from_row(row)
            invoice.items = [SalesInvoiceItem.from_row(row) for row in self.item_repo.find_by_invoice_id(invoice.id)]
            invoices.append(invoice)
        return invoices

    def update_sales_invoice(
        self,
        invoice_id: int,
        invoice_number: str,
        customer_id: int,
        invoice_date: str,
        payment_type: str,
        items: List[dict],
        notes: str | None,
        status: str,
        bank_account_id: int | None = None,
    ) -> None:
        """Updates sales invoice with complete journal reversal."""
        existing_invoice = self.get_sales_invoice(invoice_id)
        if not existing_invoice:
            raise ValidationError("Invoice not found.")
        
        paid_row = self.db.fetch_one("""
            SELECT paid_amount FROM sales_invoices WHERE id = ?
        """, (invoice_id,))
        
        actual_paid = paid_row["paid_amount"] if paid_row else 0
        
        if actual_paid > 0 and existing_invoice.payment_type != payment_type:
            raise ValidationError(
                f"Cannot change payment type from {existing_invoice.payment_type} to {payment_type}. "
                f"Invoice is already paid (Rs. {actual_paid:,.2f}). "
                "Please cancel the invoice and create a new one with the correct payment type."
            )
        
        invoice_number = invoice_number.strip()
        if not invoice_number:
            raise ValidationError("Invoice number is required.")
        if not customer_id:
            raise ValidationError("Customer is required.")
        if not invoice_date:
            raise ValidationError("Invoice date is required.")
        if payment_type not in ["CASH", "BANK", "CHEQUE", "CREDIT"]:
            raise ValidationError("Invalid payment type.")
        if not items:
            raise ValidationError("At least one item is required.")
        
        customer_dict = self.party_repo.get_by_id(customer_id)
        if not customer_dict:
            raise ValidationError("Customer does not exist.")
        if not customer_dict.get("is_active", 0):
            raise ValidationError("Customer is not active.")
        if customer_dict.get("party_type") not in ["CUSTOMER", "BOTH"]:
            raise ValidationError("Selected party is not a customer.")
        customer = Party.from_row(customer_dict)
        
        validated_items = []
        subtotal = Decimal('0')
        discount_amount = Decimal('0')
        tax_amount = Decimal('0')
        
        for item_data in items:
            item_id = item_data.get("item_id")
            quantity = Decimal(str(item_data.get("quantity", 0)))
            unit_price = Decimal(str(item_data.get("unit_price", 0)))
            discount = Decimal(str(item_data.get("discount_amount", 0)))
            tax = Decimal(str(item_data.get("tax_amount", 0)))
            batch_id = item_data.get("batch_id")
            
            if not item_id or quantity <= 0:
                raise ValidationError(f"Invalid quantity for item {item_id}")
            if unit_price < 0:
                raise ValidationError(f"Unit price cannot be negative for item {item_id}")
            
            item_dict = self.item_master_repo.get_by_id(item_id)
            if not item_dict:
                raise ValidationError(f"Item {item_id} does not exist.")
            item = Item.from_row(item_dict)
            
            if not item.is_active:
                raise ValidationError(f"Item {item.item_name} is not active.")
            
            stock_batch = self.stock_repo.find_by_item_and_warehouse(item_id, 1)
            available_stock = stock_batch["quantity_in_stock"] if stock_batch else 0
            
            original_item = next((i for i in existing_invoice.items if i.item_id == item_id), None)
            original_qty = float(original_item.quantity) if original_item and original_item.quantity else 0.0
            
            net_change = float(quantity) - original_qty
            
            if net_change > 0 and available_stock < net_change:
                raise InsufficientStockError(
                    f"Insufficient stock for {item.item_name}. "
                    f"Available: {available_stock}, Required additional: {net_change}"
                )
            
            line_total = (quantity * unit_price) - discount + tax
            if line_total < 0:
                raise ValidationError(f"Line total cannot be negative for item {item.item_name}")
            
            validated_items.append({
                "item_id": item_id,
                "batch_id": batch_id,
                "quantity": float(quantity),
                "unit_price": float(unit_price),
                "discount_amount": float(discount),
                "tax_amount": float(tax),
                "line_total": float(line_total),
                "item_name": item.item_name,
                "item_code": item.item_code,
            })
            
            subtotal += quantity * unit_price
            discount_amount += discount
            tax_amount += tax

        total_amount = subtotal - discount_amount + tax_amount
        
        paid_amount = existing_invoice.paid_amount
        
        revenue_account_dict = self.account_repo.find_by_code("4000")
        if not revenue_account_dict:
            raise ValidationError("Sales Revenue account (4000) not found.")
        revenue_account_id = revenue_account_dict["id"]
        
        tax_account_dict = self.account_repo.find_by_code("2100")
        tax_account_id = tax_account_dict["id"] if tax_account_dict else None

        debit_account_id = None
        debit_description = ""

        if payment_type == "CREDIT":
            debit_account_dict = self.account_repo.find_by_code("1100")
            if not debit_account_dict:
                raise ValidationError("Accounts Receivable account (1100) not found.")
            debit_account_id = debit_account_dict["id"]
            debit_description = f"Credit sale to {customer.name}"
        elif payment_type == "CASH":
            debit_account_dict = self.account_repo.find_by_code("1000")
            if not debit_account_dict:
                raise ValidationError("Cash account (1000) not found.")
            debit_account_id = debit_account_dict["id"]
            debit_description = "Cash sale"
        elif payment_type in ["BANK", "CHEQUE"]:
            if bank_account_id:
                bank_account = self.db.fetch_one("""
                    SELECT id, bank_name, account_id FROM bank_accounts WHERE id = ?
                """, (bank_account_id,))
                if bank_account:
                    debit_account_id = bank_account["account_id"]
                    bank_name = bank_account.get("bank_name", "Selected Bank")
                    debit_description = f"{payment_type} sale - {bank_name}"
                else:
                    raise ValidationError("Selected bank account not found.")
            else:
                debit_account_dict = self.account_repo.find_by_code("1010")
                if not debit_account_dict:
                    raise ValidationError("Bank account (1010) not found.")
                debit_account_id = debit_account_dict["id"]
                debit_description = f"{payment_type} sale"

        if debit_account_id is None:
            raise ValidationError(f"Could not determine debit account for payment type: {payment_type}")
        
        new_journal_lines = [
            JournalLine(
                account_id=debit_account_id,
                debit=float(total_amount),
                credit=0.0,
                party_id=customer_id if payment_type == "CREDIT" else None,
                description=debit_description
            ),
            JournalLine(
                account_id=revenue_account_id,
                debit=0.0,
                credit=float(subtotal - discount_amount),
                description="Sales revenue"
            )
        ]
        
        if tax_amount > 0 and tax_account_id:
            new_journal_lines.append(
                JournalLine(
                    account_id=tax_account_id,
                    debit=0.0,
                    credit=float(tax_amount),
                    description="Sales tax"
                )
            )
        
        old_journal_lines = []
        if existing_invoice.total_amount > 0:
            if existing_invoice.payment_type == "CREDIT":
                old_debit_account = self.account_repo.find_by_code("1100")
            elif existing_invoice.payment_type == "CASH":
                old_debit_account = self.account_repo.find_by_code("1000")
            else:
                old_debit_account = self.account_repo.find_by_code("1010")
            
            old_debit_account_id = old_debit_account["id"] if old_debit_account else debit_account_id
            
            old_journal_lines = [
                JournalLine(
                    account_id=old_debit_account_id,
                    debit=0.0,
                    credit=float(existing_invoice.total_amount),
                    party_id=existing_invoice.customer_id if existing_invoice.payment_type == "CREDIT" else None,
                    description="Reverse sales to customer"
                ),
                JournalLine(
                    account_id=revenue_account_id,
                    debit=float(existing_invoice.subtotal - existing_invoice.discount_amount),
                    credit=0.0,
                    description="Reverse sales revenue"
                )
            ]
            if existing_invoice.tax_amount > 0 and tax_account_id:
                old_journal_lines.append(
                    JournalLine(
                        account_id=tax_account_id,
                        debit=float(existing_invoice.tax_amount),
                        credit=0.0,
                        description="Reverse sales tax"
                    )
                )
        
        with self.db.transaction():
            self.invoice_repo.update(
                invoice_id,
                {
                    "invoice_number": invoice_number,
                    "customer_id": customer_id,
                    "invoice_date": invoice_date,
                    "payment_type": payment_type,
                    "bank_account_id": bank_account_id,
                    "subtotal": float(subtotal),
                    "discount_amount": float(discount_amount),
                    "tax_amount": float(tax_amount),
                    "total_amount": float(total_amount),
                    "paid_amount": paid_amount,
                    "notes": notes,
                    "status": status,
                    "updated_at": datetime.now().isoformat()
                }
            )
            
            self.item_repo.delete_by_invoice_id(invoice_id)
            for item_data in validated_items:
                clean_item_data = {
                    "invoice_id": invoice_id,
                    "item_id": item_data["item_id"],
                    "batch_id": item_data.get("batch_id"),
                    "quantity": item_data["quantity"],
                    "unit_price": item_data["unit_price"],
                    "discount_amount": item_data["discount_amount"],
                    "tax_amount": item_data["tax_amount"],
                    "line_total": item_data["line_total"],
                }
                item = SalesInvoiceItem(**clean_item_data)
                self.item_repo.insert(item.to_dict())

                original_item = next((i for i in existing_invoice.items if i.item_id == item_data["item_id"]), None)
                original_qty = float(original_item.quantity) if original_item and original_item.quantity else 0.0
                new_qty = item_data["quantity"]

                if new_qty > original_qty:
                    self._update_stock(
                        item_id=item_data["item_id"],
                        warehouse_id=1,
                        quantity=new_qty - original_qty,
                        positive=False,
                    )
                elif new_qty < original_qty:
                    self._update_stock(
                        item_id=item_data["item_id"],
                        warehouse_id=1,
                        quantity=original_qty - new_qty,
                        positive=True,
                    )
            
            if old_journal_lines:
                self.accounting_service.post_journal_entry(
                    voucher_type=VoucherType.JOURNAL,
                    entry_date=invoice_date,
                    lines=old_journal_lines,
                    source_table="sales_invoices",
                    source_id=invoice_id,
                    narration=f"Reverse sales invoice {invoice_number}"
                )
            
            self.accounting_service.post_journal_entry(
                voucher_type=VoucherType.SALES,
                entry_date=invoice_date,
                lines=new_journal_lines,
                source_table="sales_invoices",
                source_id=invoice_id,
                narration=f"Sales invoice {invoice_number} to {customer.name}"
            )
            
            if payment_type in ["BANK", "CHEQUE"] and bank_account_id:
                existing_txn = self.db.fetch_one("""
                    SELECT id FROM bank_transactions 
                    WHERE reference_no = ? AND transaction_type = 'DEPOSIT'
                """, (invoice_number,))
                
                if existing_txn:
                    self.db.execute("""
                        UPDATE bank_transactions 
                        SET amount = ?,
                            bank_account_id = ?,
                            notes = ?
                        WHERE reference_no = ?
                    """, (
                        float(total_amount),
                        bank_account_id,
                        f"Sales invoice {invoice_number} - {payment_type} payment (updated)",
                        invoice_number
                    ))
                    logger.info(f"✅ Updated bank deposit for invoice {invoice_number}")
                else:
                    self.db.execute("""
                        INSERT INTO bank_transactions (
                            bank_account_id,
                            transaction_type,
                            amount,
                            transaction_date,
                            reference_no,
                            notes,
                            created_at
                        ) VALUES (?, 'DEPOSIT', ?, ?, ?, ?, datetime('now'))
                    """, (
                        bank_account_id,
                        float(total_amount),
                        invoice_date,
                        invoice_number,
                        f"Sales invoice {invoice_number} - {payment_type} payment"
                    ))
                    logger.info(f"✅ Recorded bank deposit for invoice {invoice_number}")
            
            elif payment_type == "CASH" and existing_invoice.payment_type in ["BANK", "CHEQUE"]:
                self.db.execute("""
                    DELETE FROM bank_transactions 
                    WHERE reference_no = ? AND transaction_type = 'DEPOSIT'
                """, (invoice_number,))
                logger.info(f"✅ Removed bank deposit for invoice {invoice_number} (changed to CASH)")
        
        logger.info("Updated sales invoice %s (id=%s) - Payment: %s", 
                   invoice_number, invoice_id, payment_type)

    def delete_sales_invoice(self, invoice_id: int) -> None:
        """Deletes sales invoice with journal reversal and stock restoration."""
        invoice = self.get_sales_invoice(invoice_id)
        if not invoice:
            raise ValidationError("Invoice not found.")
        
        if invoice.status == "CANCELLED":
            raise ValidationError("Invoice is already cancelled.")
        
        ar_account_dict = self.account_repo.find_by_code("1100")
        if not ar_account_dict:
            raise ValidationError("Accounts Receivable account (1100) not found.")
        ar_account_id = ar_account_dict["id"]
        
        revenue_account_dict = self.account_repo.find_by_code("4000")
        if not revenue_account_dict:
            raise ValidationError("Sales Revenue account (4000) not found.")
        revenue_account_id = revenue_account_dict["id"]
        
        tax_account_dict = self.account_repo.find_by_code("2100")
        tax_account_id = tax_account_dict["id"] if tax_account_dict else None
        
        reversal_lines = [
            JournalLine(
                account_id=ar_account_id,
                debit=0.0,
                credit=float(invoice.total_amount),
                party_id=invoice.customer_id,
                description="Reverse sales to customer"
            ),
            JournalLine(
                account_id=revenue_account_id,
                debit=float(invoice.subtotal - invoice.discount_amount),
                credit=0.0,
                description="Reverse sales revenue"
            )
        ]
        
        if invoice.tax_amount > 0 and tax_account_id:
            reversal_lines.append(
                JournalLine(
                    account_id=tax_account_id,
                    debit=float(invoice.tax_amount),
                    credit=0.0,
                    description="Reverse sales tax"
                )
            )
        
        with self.db.transaction():
            self.invoice_repo.update(
                invoice_id,
                {
                    "status": "CANCELLED",
                    "updated_at": datetime.now().isoformat()
                }
            )
            
            for item in invoice.items:
                self._update_stock(
                    item_id=item.item_id,
                    warehouse_id=1,
                    quantity=item.quantity,
                    positive=True,
                )
            
            self.accounting_service.post_journal_entry(
                voucher_type=VoucherType.JOURNAL,
                entry_date=invoice.invoice_date,
                lines=reversal_lines,
                source_table="sales_invoices",
                source_id=invoice_id,
                narration=f"Cancel sales invoice {invoice.invoice_number}"
            )
            
            if invoice.payment_type in ["BANK", "CHEQUE"]:
                self.db.execute("""
                    DELETE FROM bank_transactions 
                    WHERE reference_no = ? AND transaction_type = 'DEPOSIT'
                """, (invoice.invoice_number,))
                logger.info(f"✅ Removed bank deposit for cancelled invoice {invoice.invoice_number}")
        
        logger.info("Cancelled sales invoice %s (id=%s)", invoice.invoice_number, invoice_id)