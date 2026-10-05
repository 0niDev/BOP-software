"""Service for Sales Invoices - Business logic layer."""
from __future__ import annotations

import datetime
from decimal import Decimal
from typing import List, Optional

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
from utils.exceptions import ValidationError, InsufficientStockError, DuplicateRecordError
from utils.dates import parse_date
from utils.logger import get_logger
from utils.activity_logger import log_sales_invoice_created, log_sales_invoice_updated, log_sales_invoice_deleted

logger = get_logger(__name__)


class SalesInvoiceService:
    """Service for managing sales invoices with automatic accounting and stock updates."""

    def __init__(self, db: Optional[DatabaseConnection] = None):
        self.db = db or get_db()
        self.invoice_repo = SalesInvoiceRepository(self.db)
        self.item_repo = SalesInvoiceItemRepository(self.db)
        self.item_master_repo = ItemRepository(self.db)
        self.party_repo = PartyRepository(self.db)
        self.account_repo = AccountRepository(self.db)
        self.accounting_service = AccountingService(self.db)
        self.stock_repo = StockBatchRepository(self.db)

    def _resolve_unit_cost(self, batch: dict) -> tuple[Decimal, Decimal]:
        raw = Decimal(str(batch.get('raw_unit_cost') or 0))
        pack = Decimal(str(batch.get('packing_unit_cost') or 0))
        if raw == 0 and pack == 0:
            raw = Decimal(str(batch.get('purchase_price') or 0))
        if raw == 0 and pack == 0:
            raise ValidationError(
                f"Stock batch {batch['id']} has no cost (raw_unit_cost / packing_unit_cost / purchase_price all zero). Cannot compute COGS."
            )
        return raw, pack

    def _compute_item_cogs(self, item_data: dict, batch: dict) -> tuple[Decimal, Decimal, Decimal, dict[int, Decimal]]:
        item_type = item_data.get("item_type", "FINISHED_GOOD")
        qty = Decimal(str(item_data["quantity"]))
        credits_by_account: dict[int, Decimal] = {}

        if item_type == "FINISHED_GOOD":
            raw_unit, packing_unit = self._resolve_unit_cost(batch)
            cogs_finished = (raw_unit + packing_unit) * qty
            cogs_packing = Decimal('0')
            cogs_raw_mat = Decimal('0')
            inv_account = self.account_repo.find_by_code("1220")
            if inv_account:
                credits_by_account[inv_account["id"]] = cogs_finished
        elif item_type == "PACKING_MATERIAL":
            unit = Decimal(str(batch.get('purchase_price') or 0))
            if unit == 0:
                raise ValidationError(
                    f"Stock batch {batch['id']} has no cost (purchase_price is zero). Cannot compute COGS."
                )
            cogs_finished = Decimal('0')
            cogs_packing = unit * qty
            cogs_raw_mat = Decimal('0')
            inv_account = self.account_repo.find_by_code("1210")
            if inv_account:
                credits_by_account[inv_account["id"]] = cogs_packing
        else:
            unit = Decimal(str(batch.get('purchase_price') or 0))
            if unit == 0:
                raise ValidationError(
                    f"Stock batch {batch['id']} has no cost (purchase_price is zero). Cannot compute COGS."
                )
            cogs_finished = Decimal('0')
            cogs_packing = Decimal('0')
            cogs_raw_mat = unit * qty
            inv_account = self.account_repo.find_by_code("1200")
            if inv_account:
                credits_by_account[inv_account["id"]] = cogs_raw_mat

        return cogs_finished, cogs_packing, cogs_raw_mat, credits_by_account

    def _append_cogs_lines(
        self,
        journal_lines: list,
        account_cache: dict,
        cogs_finished: Decimal,
        cogs_packing: Decimal,
        cogs_raw_mat: Decimal,
        credits_by_account: dict[int, Decimal],
        invoice_number: str,
    ) -> None:
        cogs_total = cogs_finished + cogs_packing + cogs_raw_mat
        if cogs_total <= 0:
            raise ValidationError(
                f"Sales invoice {invoice_number} produced zero COGS. Check that stock batches have valid costs."
            )

        cogs_account_dict = account_cache.get("5000")
        packing_cogs_account_dict = account_cache.get("5001")
        raw_cogs_account_dict = account_cache.get("5002")

        if cogs_finished > 0 and cogs_account_dict:
            journal_lines.append(JournalLine(
                account_id=cogs_account_dict["id"],
                debit=float(cogs_finished),
                credit=0.0,
                description=f"COGS (finished goods) - {invoice_number}",
            ))
        if cogs_packing > 0 and packing_cogs_account_dict:
            journal_lines.append(JournalLine(
                account_id=packing_cogs_account_dict["id"],
                debit=float(cogs_packing),
                credit=0.0,
                description=f"COGS (packing materials) - {invoice_number}",
            ))
        if cogs_raw_mat > 0 and raw_cogs_account_dict:
            journal_lines.append(JournalLine(
                account_id=raw_cogs_account_dict["id"],
                debit=float(cogs_raw_mat),
                credit=0.0,
                description=f"COGS (raw materials) - {invoice_number}",
            ))
        for inv_id, amount in credits_by_account.items():
            journal_lines.append(JournalLine(
                account_id=inv_id,
                debit=0.0,
                credit=float(amount),
                description=f"Reduce inventory - {invoice_number}",
            ))

        logger.info("Posted COGS for %s: finished=%.2f packing=%.2f raw=%.2f", invoice_number, float(cogs_finished), float(cogs_packing), float(cogs_raw_mat))

    def _update_stock(
        self,
        item_id: int,
        warehouse_id: int,
        quantity: float,
        positive: bool = False,
        batch_cache: Optional[dict] = None,
    ) -> None:
        """Update stock when selling items - optimized with batch caching."""
        item = self.item_master_repo.get_by_id(item_id)
        if not item:
            logger.debug(f"Item {item_id} not found for stock update")
            return

        change = quantity if positive else -quantity
        logger.debug(f"Updating stock for {item['item_code']}: {change}")

        # Use cached batch if available, otherwise fetch
        cache_key = f"{item_id}_{warehouse_id}"
        if batch_cache is not None and cache_key in batch_cache:
            existing_batch = batch_cache[cache_key]
        else:
            existing_batch = self.stock_repo.find_by_item_and_warehouse(item_id, warehouse_id)
            if batch_cache is not None:
                batch_cache[cache_key] = existing_batch

        if existing_batch:
            current_qty = existing_batch["quantity_in_stock"]
            logger.debug(f"Current stock for {item['item_code']}: {current_qty}")

            if not positive and current_qty < quantity:
                logger.warning(f"Insufficient stock for {item['item_code']}: "
                            f"Available: {current_qty}, Required: {quantity}")
                raise ValidationError(f"Insufficient stock for {item['item_name']}. "
                                    f"Available: {current_qty}, Required: {quantity}")

            if positive:
                new_quantity = current_qty + quantity
                self.stock_repo.update_quantity(existing_batch["id"], quantity, use_cache=True)
            else:
                new_quantity = current_qty - quantity
                self.stock_repo.update_quantity(existing_batch["id"], -quantity, use_cache=True)

            logger.debug(f"Updated stock for {item['item_code']}: {current_qty} -> {new_quantity}")
        else:
            action = "restore" if positive else "deduct"
            raise ValidationError(
                f"No stock batch found for item {item['item_name']} in warehouse {warehouse_id}. Cannot {action} stock."
            )

    def _bulk_update_stock(
        self,
        items_data: List[dict],
        warehouse_id: int,
        batch_cache: Optional[dict] = None,
    ) -> None:
        """Bulk update stock for multiple items - reduces DB queries."""
        if batch_cache is None:
            batch_cache = {}

        for item_data in items_data:
            self._update_stock(
                item_id=item_data["item_id"],
                warehouse_id=warehouse_id,
                quantity=item_data["quantity"],
                positive=False,
                batch_cache=batch_cache,
            )

    def create_sales_invoice(
        self,
        invoice_number: str,
        customer_id: int,
        invoice_date: str,
        payment_type: str,
        items: List[dict],
        notes: Optional[str] = None,
        company_id: int = 1,
        warehouse_id: int = 1,
        created_by: Optional[int] = None,
        bank_account_id: Optional[int] = None,
    ) -> SalesInvoice:
        """Creates a sales invoice with automatic journal entry and stock update."""
        invoice_number = invoice_number.strip()
        if not invoice_number:
            raise ValidationError("Invoice number is required.")
        if not customer_id:
            raise ValidationError("Customer is required.")
        if not invoice_date:
            raise ValidationError("Invoice date is required.")
        invoice_date = parse_date(invoice_date, "invoice_date")
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

        # Cache for items to avoid redundant DB lookups
        item_cache = {}
        stock_cache = {}  # Cache stock batches to avoid redundant queries

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

            # Use cached item if available
            if item_id in item_cache:
                item_dict = item_cache[item_id]
            else:
                item_dict = self.item_master_repo.get_by_id(item_id)
                item_cache[item_id] = item_dict

            if not item_dict:
                raise ValidationError(f"Item {item_id} does not exist.")
            
            # Access dictionary keys directly since get_by_id returns a dict
            item_name = item_dict['item_name']
            item_code = item_dict['item_code']
            is_active = item_dict['is_active']

            if not is_active:
                raise ValidationError(f"Item {item_name} is not active.")

            # Use cached stock check
            stock_key = f"{item_id}_{warehouse_id}"
            if stock_key in stock_cache:
                stock_batch = stock_cache[stock_key]
            else:
                stock_batch = self.stock_repo.find_by_item_and_warehouse(item_id, warehouse_id)
                stock_cache[stock_key] = stock_batch

            if not stock_batch:
                raise ValidationError(
                    f"No stock batch found for {item_name} in warehouse {warehouse_id}. Cannot sell an item with no stock record."
                )

            available_stock = stock_batch["quantity_in_stock"]

            logger.debug(f"Stock check for {item_code}: Available: {available_stock}, Required: {quantity}")

            if available_stock < quantity:
                raise InsufficientStockError(
                    f"Insufficient stock for {item_name}. "
                    f"Available: {available_stock}, Required: {quantity}"
                )

            line_total = (quantity * unit_price) - discount + tax
            if line_total < 0:
                raise ValidationError(f"Line total cannot be negative for item {item_name}")

            validated_items.append({
                "item_id": item_id,
                "batch_id": stock_batch["id"],
                "quantity": float(quantity),
                "unit_price": float(unit_price),
                "discount_amount": float(discount),
                "tax_amount": float(tax),
                "line_total": float(line_total),
                "item_name": item_name,
                "item_code": item_code,
                "item_type": item_dict.get('item_type', 'FINISHED_GOOD'),
            })

            subtotal += quantity * unit_price
            discount_amount += discount
            tax_amount += tax

        total_amount = subtotal - discount_amount + tax_amount

        # Create invoice WITH bank_account_id
        invoice = SalesInvoice(
            invoice_number=invoice_number,
            customer_id=customer_id,
            invoice_date=invoice_date,
            payment_type=payment_type,
            bank_account_id=bank_account_id,
            subtotal=float(subtotal),
            discount_amount=float(discount_amount),
            tax_amount=float(tax_amount),
            total_amount=float(total_amount),
            paid_amount=float(total_amount) if payment_type != "CREDIT" else 0.0,
            notes=notes,
            company_id=company_id,
            warehouse_id=warehouse_id,
            created_by=created_by
        )

        # Use cached account lookups to improve performance
        account_codes_needed = ["4000", "2100"]  # Sales Revenue, Sales Tax Payable
        if payment_type == "CREDIT":
            account_codes_needed.append("1100")  # Accounts Receivable
        elif payment_type == "CASH":
            account_codes_needed.append("1000")  # Cash
        elif payment_type in ["BANK", "CHEQUE"]:
            account_codes_needed.append("1010")  # Bank

        # Cache for COGS entries
        account_codes_needed.extend(["5000", "5001", "5002", "1220", "1200", "1210"])

        # Batch fetch all needed accounts
        account_cache = {}
        for code in set(account_codes_needed):
            account_dict = self.account_repo.find_by_code(code)
            if account_dict:
                account_cache[code] = account_dict

        revenue_account_dict = account_cache.get("4000")
        if not revenue_account_dict:
            raise ValidationError("Sales Revenue account (4000) not found.")
        revenue_account_id = revenue_account_dict["id"]

        tax_account_dict = account_cache.get("2100")
        tax_account_id = tax_account_dict["id"] if tax_account_dict else None

        # Determine debit account based on payment type
        debit_account_id = None
        debit_description = ""

        if payment_type == "CREDIT":
            debit_account_dict = account_cache.get("1100")
            if not debit_account_dict:
                raise ValidationError("Accounts Receivable account (1100) not found.")
            debit_account_id = debit_account_dict["id"]
            debit_description = f"Credit sale to {customer.name}"
        elif payment_type == "CASH":
            debit_account_dict = account_cache.get("1000")
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
                    logger.info(f"Using specific bank account: {bank_name}")
                else:
                    raise ValidationError("Selected bank account not found.")
            else:
                debit_account_dict = account_cache.get("1010")
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

            # Prepare all invoice items data for batch insert
            items_data = []
            cogs_finished = Decimal('0')
            cogs_packing = Decimal('0')
            cogs_raw_mat = Decimal('0')
            credits_by_account: dict[int, Decimal] = {}

            for item_data in validated_items:
                batch = self.stock_repo.find_by_item_and_warehouse(
                    item_data['item_id'], warehouse_id
                )
                if not batch:
                    raise ValidationError(
                        f"No stock batch found for item {item_data['item_name']} in warehouse {warehouse_id}. Cannot sell an item with no stock record."
                    )

                item_cogs_finished, item_cogs_packing, item_cogs_raw_mat, item_credits = self._compute_item_cogs(item_data, batch)
                cogs_finished += item_cogs_finished
                cogs_packing += item_cogs_packing
                cogs_raw_mat += item_cogs_raw_mat
                for k, v in item_credits.items():
                    credits_by_account[k] = credits_by_account.get(k, Decimal('0')) + v

                clean_item_data = {
                    "invoice_id": invoice.id,
                    "item_id": item_data["item_id"],
                    "batch_id": batch["id"],
                    "quantity": item_data["quantity"],
                    "unit_price": item_data["unit_price"],
                    "discount_amount": item_data["discount_amount"],
                    "tax_amount": item_data["tax_amount"],
                    "line_total": item_data["line_total"],
                }
                items_data.append(clean_item_data)

            # Batch insert all invoice items
            for item_data in items_data:
                item = SalesInvoiceItem(**item_data)
                self.item_repo.insert(item.to_dict())

            # Bulk update stock with shared cache
            self._bulk_update_stock(items_data, warehouse_id, batch_cache={})

            # Post COGS journal lines
            self._append_cogs_lines(
                journal_lines, account_cache, cogs_finished, cogs_packing, cogs_raw_mat,
                credits_by_account, invoice_number,
            )

            self.accounting_service.post_journal_entry(
                voucher_type=VoucherType.SALES,
                entry_date=invoice_date,
                lines=journal_lines,
                source_table="sales_invoices",
                source_id=invoice.id,
                narration=f"Sales invoice {invoice_number} to {customer.name}"
            )

            # Record bank transaction if payment is BANK or CHEQUE
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
                logger.info(f"Recorded bank deposit for invoice {invoice_number}")

        logger.info("Created sales invoice %s for customer %s (id=%s)", 
                invoice_number, customer_id, invoice.id)

        # Log activity
        log_sales_invoice_created(
            invoice_id=invoice.id,
            invoice_number=invoice_number,
            customer_name=customer.name,
            total_amount=float(total_amount),
            items_count=len(validated_items),
            payment_type=payment_type,
        )
        return invoice

    def get_sales_invoice(self, invoice_id: int) -> Optional[SalesInvoice]:
        """Get sales invoice by ID with items."""
        row = self.invoice_repo.get_by_id(invoice_id)
        if not row:
            return None
        invoice = SalesInvoice.from_row(row)
        invoice.items = self.item_repo.find_by_invoice_id(invoice_id)
        return invoice

    def list_sales_invoices(
        self, 
        company_id: int = 1, 
        status: Optional[str] = None
    ) -> List[SalesInvoice]:
        """List sales invoices with items loaded in a single batch query."""
        rows = self.invoice_repo.find_all_for_company(company_id, status)

        if not rows:
            return []

        # Batch load all items for all invoices in ONE query
        invoice_ids = [row['id'] for row in rows]
        items_by_invoice = self.item_repo.find_by_invoice_ids(invoice_ids)

        # Build invoice objects with their items
        invoices = []
        for row in rows:
            invoice = SalesInvoice.from_row(row)
            invoice.items = items_by_invoice.get(invoice.id, [])
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
        notes: Optional[str] = None,
        status: str = "PENDING",
        company_id: int = 1,
        warehouse_id: int = 1,
        bank_account_id: Optional[int] = None,
    ) -> SalesInvoice:
        """Update an existing sales invoice.

        The whole operation (journal reversal, stock restore, header update,
        line replacement, stock deduction and new journal entry) runs inside
        ONE transaction so a failure can never leave the invoice/journal/stock
        in a partial state.
        """
        # Get existing invoice
        existing_invoice = self.get_sales_invoice(invoice_id)
        if not existing_invoice:
            raise ValidationError(f"Sales invoice {invoice_id} not found.")
        invoice_date = parse_date(invoice_date, "invoice_date")
        
        # Get customer for narration
        customer_dict = self.party_repo.get_by_id(customer_id)
        if not customer_dict:
            raise ValidationError(f"Customer {customer_id} not found.")
        
        # Convert to Party object for consistent access
        from models.party import Party
        customer = Party.from_row(customer_dict)
        
        # Check if invoice number is being changed and validate uniqueness
        if existing_invoice.invoice_number != invoice_number:
            if self.invoice_repo.number_exists(invoice_number, company_id, exclude_id=invoice_id):
                raise DuplicateRecordError(
                    f"Invoice number '{invoice_number}' already exists."
                )
        
        # Validate all items first (fail fast, no mutation on invalid input)
        validated_items = []
        subtotal = Decimal(0)
        discount_amount = Decimal(0)
        tax_amount = Decimal(0)
        
        for item_data in items:
            item_id = item_data.get("item_id")
            quantity = Decimal(str(item_data.get("quantity", 0)))
            unit_price = Decimal(str(item_data.get("unit_price", 0)))
            discount = Decimal(str(item_data.get("discount_amount", 0)))
            tax = Decimal(str(item_data.get("tax_amount", 0)))
            
            if quantity <= 0:
                continue
            
            item = self.item_master_repo.get_by_id(item_id)
            if not item:
                raise ValidationError(f"Item {item_id} not found.")
            
            line_total = (quantity * unit_price) - discount + tax
            if line_total < 0:
                raise ValidationError(f"Line total cannot be negative for item {item['item_name']}")
            
            validated_items.append({
                "item_id": item_id,
                "batch_id": None,
                "quantity": float(quantity),
                "unit_price": float(unit_price),
                "discount_amount": float(discount),
                "tax_amount": float(tax),
                "line_total": float(line_total),
                "item_name": item['item_name'],
                "item_code": item['item_code'],
                "item_type": item.get('item_type', 'FINISHED_GOOD'),
            })
            
            subtotal += quantity * unit_price
            discount_amount += discount
            tax_amount += tax
        
        total_amount = subtotal - discount_amount + tax_amount
        
        # Resolve accounts and build the new journal lines BEFORE mutating.
        account_codes_needed = ["4000", "2100"]
        if payment_type == "CREDIT":
            account_codes_needed.append("1100")
        elif payment_type == "CASH":
            account_codes_needed.append("1000")
        elif payment_type in ["BANK", "CHEQUE"]:
            account_codes_needed.append("1010")
        account_codes_needed += ["5000", "5001", "5002", "1220", "1200", "1210"]
        account_cache = {}
        for code in set(account_codes_needed):
            account_dict = self.account_repo.find_by_code(code)
            if account_dict:
                account_cache[code] = account_dict
        
        revenue_account_dict = account_cache.get("4000")
        if not revenue_account_dict:
            raise ValidationError("Sales Revenue account (4000) not found.")
        revenue_account_id = revenue_account_dict["id"]
        
        debit_account_id = None
        debit_description = ""
        
        if payment_type == "CREDIT":
            debit_account_dict = account_cache.get("1100")
            if not debit_account_dict:
                raise ValidationError("Accounts Receivable account (1100) not found.")
            debit_account_id = debit_account_dict["id"]
            debit_description = f"Credit sale to {customer.name}"
        elif payment_type == "CASH":
            debit_account_dict = account_cache.get("1000")
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
                debit_account_dict = account_cache.get("1010")
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
        
        tax_account_dict = account_cache.get("2100")
        tax_account_id = tax_account_dict["id"] if tax_account_dict else None
        
        if tax_amount > 0 and tax_account_id:
            journal_lines.append(
                JournalLine(
                    account_id=tax_account_id,
                    debit=0.0,
                    credit=float(tax_amount),
                    description="Sales tax"
                )
            )
        
        # ---- Atomic mutation block ------------------------------------------
        with self.db.transaction():
            # Reverse ALL existing journal entries for this invoice
            journal_entries = self.db.fetch_all("""
                SELECT id, voucher_number, is_posted FROM journal_entries 
                WHERE source_table = 'sales_invoices' AND source_id = ?
            """, (invoice_id,))
            
            # Batch-load ALL lines for posted entries in ONE query instead of
            # one query per entry (N+1 elimination for hosted/remote DBs).
            posted_ids = [e['id'] for e in journal_entries if e['is_posted']]
            lines_by_entry: dict[int, list] = {}
            if posted_ids:
                placeholders = ", ".join("?" * len(posted_ids))
                for line in self.db.fetch_all(f"""
                    SELECT journal_entry_id, account_id, debit, credit, description, party_id 
                    FROM journal_entry_lines WHERE journal_entry_id IN ({placeholders})
                """, tuple(posted_ids)):
                    lines_by_entry.setdefault(line['journal_entry_id'], []).append(line)
            
            for journal_entry in journal_entries:
                if journal_entry['is_posted']:
                    journal_lines_existing = lines_by_entry.get(journal_entry['id'], [])
                    
                    reverse_lines = []
                    for line in journal_lines_existing:
                        reverse_lines.append(JournalLine(
                            account_id=line['account_id'],
                            debit=line['credit'],
                            credit=line['debit'],
                            party_id=line.get('party_id'),
                            description=f"Reversal of {line['description']}"
                        ))
                    
                    self.accounting_service.post_journal_entry(
                        voucher_type=VoucherType.SALES,
                        entry_date=invoice_date,
                        lines=reverse_lines,
                        source_table="sales_invoices",
                        source_id=invoice_id,
                        narration=f"Reversal of sales invoice {existing_invoice.invoice_number} for update"
                    )
                    logger.info(f"Reversed journal entry {journal_entry['voucher_number']} for invoice {existing_invoice.invoice_number}")
            
            # Restore stock for existing invoice items
            existing_items = self.item_repo.find_by_invoice_id(invoice_id)
            batch_cache = {}
            for item in existing_items:
                # Add stock back (positive update)
                self._update_stock(
                    item_id=item['item_id'],
                    warehouse_id=warehouse_id,
                    quantity=item['quantity'],
                    positive=True,
                    batch_cache=batch_cache
                )
            logger.info(f"Restored stock for existing invoice {existing_invoice.invoice_number}")
            
            # Delete existing invoice items
            self.db.execute("DELETE FROM sales_invoice_items WHERE invoice_id = ?", (invoice_id,))
            
            # Update invoice header
            invoice_data = {
                "invoice_number": invoice_number,
                "customer_id": customer_id,
                "invoice_date": invoice_date,
                "payment_type": payment_type,
                "bank_account_id": bank_account_id,
                "subtotal": float(subtotal),
                "discount_amount": float(discount_amount),
                "tax_amount": float(tax_amount),
                "total_amount": float(total_amount),
                "notes": notes,
                "status": status,
                "company_id": company_id,
                "warehouse_id": warehouse_id,
            }
            
            self.invoice_repo.update(invoice_id, invoice_data)
            logger.info(f"Updated invoice header for {invoice_number}")
            
            # Insert new invoice items
            items_data = []
            cogs_finished = Decimal('0')
            cogs_packing = Decimal('0')
            cogs_raw_mat = Decimal('0')
            credits_by_account: dict[int, Decimal] = {}
            for item_data in validated_items:
                cache_key = f"{item_data['item_id']}_{warehouse_id}"
                if cache_key not in batch_cache:
                    batch_cache[cache_key] = self.stock_repo.find_by_item_and_warehouse(
                        item_data['item_id'], warehouse_id
                    )

                batch = batch_cache[cache_key]
                if not batch:
                    raise ValidationError(
                        f"No stock batch found for item {item_data['item_name']} in warehouse {warehouse_id}. Cannot sell an item with no stock record."
                    )

                item_cogs_finished, item_cogs_packing, item_cogs_raw_mat, item_credits = self._compute_item_cogs(item_data, batch)
                cogs_finished += item_cogs_finished
                cogs_packing += item_cogs_packing
                cogs_raw_mat += item_cogs_raw_mat
                for k, v in item_credits.items():
                    credits_by_account[k] = credits_by_account.get(k, Decimal('0')) + v

                clean_item_data = {
                    "invoice_id": invoice_id,
                    "item_id": item_data["item_id"],
                    "batch_id": batch["id"],
                    "quantity": item_data["quantity"],
                    "unit_price": item_data["unit_price"],
                    "discount_amount": item_data["discount_amount"],
                    "tax_amount": item_data["tax_amount"],
                    "line_total": item_data["line_total"],
                }
                items_data.append(clean_item_data)
            
            for item_data in items_data:
                item = SalesInvoiceItem(**item_data)
                self.item_repo.insert(item.to_dict())
            
            # Deduct stock for new items
            self._bulk_update_stock(items_data, warehouse_id, batch_cache={})
            
            # Post COGS journal lines
            self._append_cogs_lines(
                journal_lines, account_cache, cogs_finished, cogs_packing, cogs_raw_mat,
                credits_by_account, invoice_number,
            )

            self.accounting_service.post_journal_entry(
                voucher_type=VoucherType.SALES,
                entry_date=invoice_date,
                lines=journal_lines,
                source_table="sales_invoices",
                source_id=invoice_id,
                narration=f"Updated sales invoice {invoice_number} to {customer.name}"
            )
            
            # Delete any existing bank transactions for this invoice first
            self.db.execute(
                "DELETE FROM bank_transactions WHERE reference_no = ?",
                (existing_invoice.invoice_number,)
            )
            
            # Record bank transaction if payment is BANK or CHEQUE
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
                    f"Updated sales invoice {invoice_number} - {payment_type} payment"
                ))
                logger.info(f"Recorded bank deposit for updated invoice {invoice_number}")
        
        logger.info("Updated sales invoice %s for customer %s (id=%s)", 
                invoice_number, customer_id, invoice_id)
        
        # Log activity
        log_sales_invoice_updated(
            invoice_id=invoice_id,
            invoice_number=invoice_number,
            customer_name=customer.name if hasattr(customer, 'name') else customer.get('name', 'Unknown'),
            total_amount=float(total_amount),
            user_id=None,
            company_id=company_id,
        )
        
        # Return updated invoice
        return self.get_sales_invoice(invoice_id)

    def delete_sales_invoice(self, invoice_id: int) -> bool:
        """Delete a sales invoice with proper reversal of accounting entries and stock."""
        # Get existing invoice
        existing_invoice = self.get_sales_invoice(invoice_id)
        if not existing_invoice:
            raise ValidationError(f"Sales invoice {invoice_id} not found.")
        
        with self.db.transaction():
            # Reverse ALL existing journal entries for this invoice
            journal_entries = self.db.fetch_all("""
                SELECT id, voucher_number, is_posted FROM journal_entries 
                WHERE source_table = 'sales_invoices' AND source_id = ?
            """, (invoice_id,))
            
            # Batch-load ALL lines for posted entries in ONE query instead of
            # one query per entry (N+1 elimination for hosted/remote DBs).
            posted_ids = [e['id'] for e in journal_entries if e['is_posted']]
            lines_by_entry: dict[int, list] = {}
            if posted_ids:
                placeholders = ", ".join("?" * len(posted_ids))
                for line in self.db.fetch_all(f"""
                    SELECT journal_entry_id, account_id, debit, credit, description, party_id 
                    FROM journal_entry_lines WHERE journal_entry_id IN ({placeholders})
                """, tuple(posted_ids)):
                    lines_by_entry.setdefault(line['journal_entry_id'], []).append(line)
            
            for journal_entry in journal_entries:
                if journal_entry['is_posted']:
                    journal_lines_existing = lines_by_entry.get(journal_entry['id'], [])
                    
                    reverse_lines = []
                    for line in journal_lines_existing:
                        reverse_lines.append(JournalLine(
                            account_id=line['account_id'],
                            debit=line['credit'],
                            credit=line['debit'],
                            party_id=line.get('party_id'),
                            description=f"Reversal of {line['description']}"
                        ))
                    
                    self.accounting_service.post_journal_entry(
                        voucher_type=VoucherType.SALES,
                        entry_date=existing_invoice.invoice_date,
                        lines=reverse_lines,
                        source_table="sales_invoices",
                        source_id=invoice_id,
                        narration=f"Reversal of sales invoice {existing_invoice.invoice_number} on deletion"
                    )
                    logger.info(f"Reversed journal entry {journal_entry['voucher_number']} for invoice {existing_invoice.invoice_number}")
            
            # Restore stock for existing invoice items
            existing_items = self.item_repo.find_by_invoice_id(invoice_id)
            batch_cache = {}
            for item in existing_items:
                # Add stock back (positive update)
                self._update_stock(
                    item_id=item['item_id'],
                    warehouse_id=existing_invoice.warehouse_id,
                    quantity=item['quantity'],
                    positive=True,
                    batch_cache=batch_cache
                )
            logger.info(f"Restored stock for deleted invoice {existing_invoice.invoice_number}")
            
            # Delete bank transactions for this invoice
            self.db.execute(
                "DELETE FROM bank_transactions WHERE reference_no = ?", 
                (existing_invoice.invoice_number,)
            )
            
            # Delete invoice items
            self.db.execute("DELETE FROM sales_invoice_items WHERE invoice_id = ?", (invoice_id,))
            
            # Mark invoice as CANCELLED (preserve record for audit trail)
            self.invoice_repo.update(invoice_id, {"status": "CANCELLED"})
            logger.info(f"Cancelled sales invoice {existing_invoice.invoice_number}")
        
        # Log activity
        log_sales_invoice_deleted(
            invoice_id=invoice_id,
            invoice_number=existing_invoice.invoice_number,
            customer_name="",
            total_amount=float(existing_invoice.total_amount),
        )
        
        return True


