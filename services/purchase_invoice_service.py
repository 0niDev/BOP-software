"""Service for Purchase Invoices - Business logic layer."""
from __future__ import annotations

import datetime
from decimal import Decimal
from typing import List, Optional

from database.connection import DatabaseConnection, get_db
from models.enums import VoucherType
from models.purchase_invoice import PurchaseInvoice
from models.purchase_invoice_item import PurchaseInvoiceItem
from models.item import Item
from models.party import Party
from repositories.purchase_invoice_repository import PurchaseInvoiceRepository
from repositories.purchase_invoice_item_repository import PurchaseInvoiceItemRepository
from repositories.item_repository import ItemRepository
from repositories.party_repository import PartyRepository
from repositories.account_repository import AccountRepository
from repositories.stock_batch_repository import StockBatchRepository
from services.accounting_service import AccountingService
from services.account_service import AccountService
from utils.exceptions import ValidationError
from utils.logger import get_logger
from utils.activity_logger import log_purchase_invoice_created, log_purchase_invoice_updated, log_purchase_invoice_deleted

logger = get_logger(__name__)


class JournalLine:
    """Simple journal line object for accounting entries."""
    
    def __init__(
        self, 
        account_id: int, 
        debit: float, 
        credit: float,
        party_id: Optional[int] = None, 
        description: Optional[str] = None
    ):
        self.account_id = account_id
        self.debit = debit
        self.credit = credit
        self.party_id = party_id
        self.description = description


class PurchaseInvoiceService:
    """Service for managing purchase invoices with automatic accounting and stock updates."""
    
    def __init__(self, db: Optional[DatabaseConnection] = None):
        self.db = db or get_db()
        self.invoice_repo = PurchaseInvoiceRepository(self.db)
        self.item_repo = PurchaseInvoiceItemRepository(self.db)
        self.item_master_repo = ItemRepository(self.db)
        self.party_repo = PartyRepository(self.db)
        self.account_repo = AccountRepository(self.db)
        self.stock_repo = StockBatchRepository(self.db)
        self.accounting_service = AccountingService(self.db)
        self.account_service = AccountService(self.db)

    def _get_or_create_batch(
        self,
        item_id: int,
        warehouse_id: int,
        batch_number: Optional[str],
        manufacturing_date: Optional[str],
        expiry_date: Optional[str],
        purchase_price: float,
        quantity: float,
        conn=None,
    ) -> int:
        """Get existing batch or create new one, returns batch_id."""
        
        if not batch_number:
            batch_number = f"PURCHASE-{item_id}-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        if not manufacturing_date:
            manufacturing_date = datetime.date.today().isoformat()
        if not expiry_date:
            expiry_date = (datetime.date.today() + datetime.timedelta(days=730)).isoformat()
        
        # Use provided connection or get from pool
        db_conn = conn if conn else self.db
        
        # Check for existing batch with same batch_number
        existing = db_conn.fetch_one("""
            SELECT id, quantity_in_stock 
            FROM stock_batches 
            WHERE item_id = ? AND warehouse_id = ? AND batch_number = ? AND is_active = 1
        """, (item_id, warehouse_id, batch_number))
        
        if existing:
            # Update existing batch quantity
            new_quantity = existing["quantity_in_stock"] + quantity
            db_conn.execute("""
                UPDATE stock_batches 
                SET quantity_in_stock = ?, purchase_price = ?
                WHERE id = ?
            """, (new_quantity, purchase_price, existing["id"]))
            logger.info(f"Updated existing batch {batch_number}: {new_quantity}")
            return existing["id"]
        else:
            # Create new batch
            db_conn.execute("""
                INSERT INTO stock_batches (
                    item_id, warehouse_id, batch_number, 
                    manufacturing_date, expiry_date, 
                    purchase_price, quantity_in_stock, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            """, (item_id, warehouse_id, batch_number, manufacturing_date, 
                  expiry_date, purchase_price, quantity))
            
            # Get last insert ID using the same connection
            if hasattr(db_conn, 'last_insert_id'):
                batch_id = db_conn.last_insert_id()
            else:
                cursor = db_conn.execute("SELECT last_insert_rowid()")
                batch_id = cursor.fetchone()[0]
            logger.info(f"Created new batch {batch_number} with id={batch_id}: {quantity}")
            return batch_id

    def _update_stock(
        self,
        item_id: int,
        warehouse_id: int,
        quantity: float,
        unit_cost: float,
        batch_id: int,
        batch_cache: Optional[dict] = None,
        item_cache: Optional[dict] = None,
    ) -> None:
        """Log stock update - actual update already done in _get_or_create_batch."""
        # Use cached item if available
        if item_cache is not None and item_id in item_cache:
            item = item_cache[item_id]
        else:
            item = self.item_master_repo.get_by_id(item_id)
            if item_cache is not None:
                item_cache[item_id] = item
        
        if not item:
            logger.warning(f"Item {item_id} not found for stock update")
            return
        
        logger.info(f"Stock updated for {item['item_code']}: +{quantity} (batch_id={batch_id})")

    def create_purchase_invoice(
        self,
        invoice_number: str,
        supplier_id: int,
        invoice_date: str,
        payment_type: str,
        items: List[dict],
        notes: Optional[str] = None,
        company_id: int = 1,
        warehouse_id: int = 1,
        created_by: Optional[int] = None,
        bank_account_id: Optional[int] = None,
    ) -> PurchaseInvoice:
        """Creates a purchase invoice with automatic journal entry and stock update."""
        invoice_number = invoice_number.strip()
        if not invoice_number:
            raise ValidationError("Invoice number is required.")
        if not supplier_id:
            raise ValidationError("Supplier is required.")
        if not invoice_date:
            raise ValidationError("Invoice date is required.")
        if payment_type not in ["CASH", "BANK", "CHEQUE", "CREDIT"]:
            raise ValidationError("Invalid payment type.")
        if not items:
            raise ValidationError("At least one item is required.")

        supplier_dict = self.party_repo.get_by_id(supplier_id)
        if not supplier_dict:
            raise ValidationError("Supplier does not exist.")
        if not supplier_dict.get("is_active", 0):
            raise ValidationError("Supplier is not active.")
        if supplier_dict.get("party_type") not in ["SUPPLIER", "BOTH"]:
            raise ValidationError("Selected party is not a supplier.")
        
        supplier = Party.from_row(supplier_dict)

        validated_items = []
        subtotal = Decimal('0')
        discount_amount = Decimal('0')
        tax_amount = Decimal('0')
        
        for item_data in items:
            item_id = item_data.get("item_id")
            quantity = Decimal(str(item_data.get("quantity", 0)))
            unit_cost = Decimal(str(item_data.get("unit_cost", 0)))
            discount = Decimal(str(item_data.get("discount_amount", 0)))
            tax = Decimal(str(item_data.get("tax_amount", 0)))
            
            if not item_id or quantity <= 0:
                raise ValidationError(f"Invalid quantity for item {item_id}")
            if unit_cost < 0:
                raise ValidationError(f"Unit cost cannot be negative for item {item_id}")
            
            item_dict = self.item_master_repo.get_by_id(item_id)
            if not item_dict:
                raise ValidationError(f"Item {item_id} does not exist.")
            
            # Access dictionary keys directly since get_by_id returns a dict
            item_name = item_dict['item_name']
            is_active = item_dict['is_active']
            
            if not is_active:
                raise ValidationError(f"Item {item_name} is not active.")
            
            line_total = (quantity * unit_cost) - discount + tax
            if line_total < 0:
                raise ValidationError(f"Line total cannot be negative for item {item_name}")
            
            validated_items.append({
                "item_id": item_id,
                "quantity": float(quantity),
                "unit_cost": float(unit_cost),
                "discount_amount": float(discount),
                "tax_amount": float(tax),
                "line_total": float(line_total),
                "batch_number": item_data.get("batch_number"),
                "manufacturing_date": item_data.get("manufacturing_date"),
                "expiry_date": item_data.get("expiry_date")
            })
            
            subtotal += quantity * unit_cost
            discount_amount += discount
            tax_amount += tax

        total_amount = subtotal - discount_amount + tax_amount
        
        invoice = PurchaseInvoice(
            invoice_number=invoice_number,
            supplier_id=supplier_id,
            invoice_date=invoice_date,
            payment_type=payment_type,
            subtotal=float(subtotal),
            discount_amount=float(discount_amount),
            tax_amount=float(tax_amount),
            total_amount=float(total_amount),
            notes=notes,
            company_id=company_id,
            warehouse_id=warehouse_id,
            created_by=created_by
        )

        # Get accounts
        inventory_account_dict = self.account_repo.find_by_code("1200")
        if not inventory_account_dict:
            raise ValidationError("Inventory account (1200) not found.")
        inventory_account_id = inventory_account_dict["id"]

        ap_account_dict = self.account_repo.find_by_code("2000")
        if not ap_account_dict:
            raise ValidationError("Accounts Payable account (2000) not found.")
        ap_account_id = ap_account_dict["id"]

        cash_account_dict = self.account_repo.find_by_code("1000")
        if not cash_account_dict:
            raise ValidationError("Cash account (1000) not found.")
        cash_account_id = cash_account_dict["id"]

        tax_account_dict = self.account_repo.find_by_code("2100")
        tax_account_id = tax_account_dict["id"] if tax_account_dict else None
        bank_account_dict = self.account_repo.find_by_code("1010")

        # Determine credit account AND party_id
        credit_party_id = None  # Default: no party_id
        
        if payment_type == "CREDIT":
            credit_account_id = ap_account_id
            credit_description = f"Supplier credit - {supplier.name}"
            credit_party_id = supplier_id  # SET party_id for credit purchases
            logger.info(f"CREDIT purchase - party_id={supplier_id}")
            
        elif payment_type in ["BANK", "CHEQUE"] and bank_account_id:
            bank_account = self.db.fetch_one("""
                SELECT id, bank_name, account_id FROM bank_accounts WHERE id = ?
            """, (bank_account_id,))
            if bank_account:
                credit_account_id = bank_account["account_id"]
                credit_description = f"{payment_type} payment - {bank_account['bank_name']}"
                # Don't set party_id for bank payments - only for credit purchases
                logger.info(f"Using specific bank account: {bank_account['bank_name']}")
            else:
                raise ValidationError("Selected bank account not found.")
                
        elif payment_type == "CASH":
            credit_account_id = cash_account_id
            credit_description = "Cash payment"
            # Don't set party_id for cash payments
            
        else:
            # Default to master bank account
            if not bank_account_dict:
                raise ValidationError("Bank account (1010) not found.")
            credit_account_id = bank_account_dict["id"]
            credit_description = f"{payment_type} payment"
            # Don't set party_id for default bank payments

        # Build journal lines with party_id ONLY when appropriate
        journal_lines = [
            JournalLine(
                account_id=inventory_account_id,
                debit=float(total_amount),
                credit=0.0,
                description="Inventory purchase"
            ),
        ]
        
        # Only add party_id for CREDIT purchases
        if credit_party_id is not None:
            journal_lines.append(
                JournalLine(
                    account_id=credit_account_id,
                    debit=0.0,
                    credit=float(total_amount),
                    party_id=credit_party_id,
                    description=credit_description
                )
            )
        else:
            journal_lines.append(
                JournalLine(
                    account_id=credit_account_id,
                    debit=0.0,
                    credit=float(total_amount),
                    description=credit_description
                )
            )
        
        if tax_amount > 0 and tax_account_id:
            journal_lines.append(
                JournalLine(
                    account_id=tax_account_id,
                    debit=0.0,
                    credit=float(tax_amount),
                    description="Purchase tax"
                )
            )

        # Save everything in one transaction
        with self.db.transaction() as conn:
            invoice.id = self.invoice_repo.insert_unique(invoice.to_dict())
            
            # Create caches to avoid redundant database lookups
            batch_cache = {}
            item_cache = {}
            
            for item_data in validated_items:
                # First create/get the batch and get its ID
                batch_id = self._get_or_create_batch(
                    item_id=item_data["item_id"],
                    warehouse_id=warehouse_id,
                    batch_number=item_data.get("batch_number"),
                    manufacturing_date=item_data.get("manufacturing_date"),
                    expiry_date=item_data.get("expiry_date"),
                    purchase_price=item_data["unit_cost"],
                    quantity=item_data["quantity"],
                    conn=conn,
                )
                
                # Now set batch_id for the invoice item
                item_data["batch_id"] = batch_id
                item_data["invoice_id"] = invoice.id
                item = PurchaseInvoiceItem(**item_data)
                self.item_repo.insert(item.to_dict())
                
                # Update stock quantity for the created batch
                self._update_stock(
                    item_id=item_data["item_id"],
                    warehouse_id=warehouse_id,
                    quantity=item_data["quantity"],
                    unit_cost=item_data["unit_cost"],
                    batch_id=batch_id,
                    batch_cache=batch_cache,
                    item_cache=item_cache,
                )
            
            # Post journal entry with party_id
            self.accounting_service.post_journal_entry(
                voucher_type=VoucherType.PURCHASE,
                entry_date=invoice_date,
                lines=journal_lines,
                source_table="purchase_invoices",
                source_id=invoice.id,
                narration=f"Purchase invoice {invoice_number}"
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
                    ) VALUES (?, 'WITHDRAWAL', ?, ?, ?, ?, datetime('now'))
                """, (
                    bank_account_id,
                    float(total_amount),
                    invoice_date,
                    invoice_number,
                    f"Purchase invoice {invoice_number} - {payment_type} payment"
                ))
                logger.info(f"Recorded bank withdrawal for invoice {invoice_number} from bank account {bank_account_id}")

        logger.info("Created purchase invoice %s for supplier %s (id=%s)", 
                invoice_number, supplier_id, invoice.id)
        
        # Log activity
        log_purchase_invoice_created(
            invoice_id=invoice.id,
            invoice_number=invoice_number,
            supplier_name=supplier.name,
            total_amount=float(total_amount),
            items_count=len(validated_items),
            payment_type=payment_type,
        )
        return invoice

    def get_purchase_invoice(self, invoice_id: int) -> Optional[PurchaseInvoice]:
        """Get purchase invoice by ID with items."""
        row = self.invoice_repo.get_by_id(invoice_id)
        if not row:
            return None
        invoice = PurchaseInvoice.from_row(row)
        invoice.items = self.item_repo.find_by_invoice_id(invoice_id)
        return invoice

    def list_purchase_invoices(
        self, 
        company_id: int = 1, 
        status: Optional[str] = None
    ) -> List[PurchaseInvoice]:
        """List purchase invoices with items loaded in a single batch query."""
        rows = self.invoice_repo.find_all_for_company(company_id, status)
        
        if not rows:
            return []
        
        # Batch load all items for all invoices in ONE query
        invoice_ids = [row['id'] for row in rows]
        items_by_invoice = self.item_repo.find_by_invoice_ids(invoice_ids)
        
        # Build invoice objects with their items
        invoices = []
        for row in rows:
            invoice = PurchaseInvoice.from_row(row)
            invoice.items = items_by_invoice.get(invoice.id, [])
            invoices.append(invoice)
        
        return invoices

    def update_purchase_invoice(
        self,
        invoice_id: int,
        invoice_number: str,
        supplier_id: int,
        invoice_date: str,
        payment_type: str,
        items: List[dict],
        notes: Optional[str] = None,
        status: str = "CONFIRMED",
        company_id: int = 1,
        warehouse_id: int = 1,
        bank_account_id: Optional[int] = None,
    ) -> PurchaseInvoice:
        """Update an existing purchase invoice."""
        from decimal import Decimal
        
        # Get existing invoice
        existing_invoice = self.invoice_repo.get_by_id(invoice_id)
        if not existing_invoice:
            raise ValidationError(f"Purchase invoice {invoice_id} not found.")
        
        # Convert dict to PurchaseInvoice object if needed
        if isinstance(existing_invoice, dict):
            existing_invoice = PurchaseInvoice(**existing_invoice)
        
        # Get supplier for logging
        supplier_dict = self.party_repo.get_by_id(supplier_id)
        if not supplier_dict:
            raise ValidationError(f"Supplier {supplier_id} not found.")
        supplier = Party(**supplier_dict) if isinstance(supplier_dict, dict) else supplier_dict
        
        # Reverse existing journal entry
        existing_journal = self.accounting_service.get_journal_entry(
            source_table="purchase_invoices",
            source_id=invoice_id
        )
        
        if existing_journal:
            journal_lines = existing_journal.get('lines', [])
            
            # Create reversing lines (swap debit/credit)
            reverse_lines = []
            for line in journal_lines:
                reverse_lines.append(JournalLine(
                    account_id=line['account_id'],
                    debit=line['credit'],  # Swap
                    credit=line['debit'],  # Swap
                    party_id=line.get('party_id'),
                    description=f"Reversal of {line['description']}"
                ))
            
            self.accounting_service.post_journal_entry(
                voucher_type=VoucherType.PURCHASE,
                entry_date=invoice_date,
                lines=reverse_lines,
                source_table="purchase_invoices",
                source_id=invoice_id,
                narration=f"Reversal of purchase invoice {existing_invoice.invoice_number} for update"
            )
            logger.info(f"Reversed journal entry for invoice {existing_invoice.invoice_number}")
        
        # Restore stock for existing invoice items
        existing_items = self.item_repo.find_by_invoice_id(invoice_id)
        batch_cache = {}
        item_cache = {}
        for item in existing_items:
            # Get or create batch for restoration (using negative quantity to reverse)
            batch_id = self._get_or_create_batch(
                item_id=item['item_id'],
                warehouse_id=warehouse_id,
                batch_number=item.get('batch_number'),
                manufacturing_date=item.get('manufacturing_date'),
                expiry_date=item.get('expiry_date'),
                purchase_price=item['unit_cost'],
                quantity=-item['quantity'],  # Negative to reverse the stock
            )
            item_data = self.item_master_repo.get_by_id(item['item_id'])
            if item_data:
                self._update_stock(
                    item_id=item['item_id'],
                    warehouse_id=warehouse_id,
                    quantity=-item['quantity'],  # Negative to reverse
                    unit_cost=item['unit_cost'],
                    batch_id=batch_id,
                    batch_cache=batch_cache,
                    item_cache=item_cache,
                )
        logger.info(f"Restored stock for existing invoice {existing_invoice.invoice_number}")
        
        # Delete existing invoice items
        self.db.execute("DELETE FROM purchase_invoice_items WHERE invoice_id = ?", (invoice_id,))
        
        # Now create new entries with updated data (similar to create logic)
        validated_items = []
        subtotal = Decimal(0)
        discount_amount = Decimal(0)
        tax_amount = Decimal(0)
        
        for item_data in items:
            item_id = item_data.get("item_id")
            quantity = Decimal(str(item_data.get("quantity", 0)))
            unit_cost = Decimal(str(item_data.get("unit_cost", 0)))
            discount = Decimal(str(item_data.get("discount_amount", 0)))
            tax = Decimal(str(item_data.get("tax_amount", 0)))
            
            if quantity <= 0:
                continue
            
            item = self.item_master_repo.get_by_id(item_id)
            if not item:
                raise ValidationError(f"Item {item_id} not found.")
            
            line_total = (quantity * unit_cost) - discount + tax
            if line_total < 0:
                raise ValidationError(f"Line total cannot be negative for item {item['item_name']}")
            
            validated_items.append({
                "item_id": item_id,
                "batch_id": None,
                "quantity": float(quantity),
                "unit_cost": float(unit_cost),
                "discount_amount": float(discount),
                "tax_amount": float(tax),
                "line_total": float(line_total),
                "batch_number": item_data.get("batch_number"),
                "manufacturing_date": item_data.get("manufacturing_date"),
                "expiry_date": item_data.get("expiry_date"),
            })
            
            subtotal += quantity * unit_cost
            discount_amount += discount
            tax_amount += tax
        
        total_amount = subtotal - discount_amount + tax_amount
        
        # Update invoice header
        invoice_data = {
            "invoice_number": invoice_number,
            "supplier_id": supplier_id,
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
        
        # Insert new invoice items AND add stock for new items
        items_data = []
        batch_cache = {}
        item_cache = {}
        
        with self.db.transaction() as conn:
            for item_data in validated_items:
                # First create/get the batch and get its ID
                batch_id = self._get_or_create_batch(
                    item_id=item_data["item_id"],
                    warehouse_id=warehouse_id,
                    batch_number=item_data.get("batch_number"),
                    manufacturing_date=item_data.get("manufacturing_date"),
                    expiry_date=item_data.get("expiry_date"),
                    purchase_price=item_data["unit_cost"],
                    quantity=item_data["quantity"],
                    conn=conn,
                )
                
                # Set batch_id for the invoice item
                item_data["batch_id"] = batch_id
                
                clean_item_data = {
                    "invoice_id": invoice_id,
                    "item_id": item_data["item_id"],
                    "batch_id": batch_id,
                    "quantity": item_data["quantity"],
                    "unit_cost": item_data["unit_cost"],
                    "discount_amount": item_data["discount_amount"],
                    "tax_amount": item_data["tax_amount"],
                    "line_total": item_data["line_total"],
                    "batch_number": item_data.get("batch_number"),
                    "manufacturing_date": item_data.get("manufacturing_date"),
                    "expiry_date": item_data.get("expiry_date"),
                }
                items_data.append(clean_item_data)
                
                # Insert the invoice item
                item = PurchaseInvoiceItem(**clean_item_data)
                self.item_repo.insert(item.to_dict())
                
                # Update stock quantity for the created batch
                self._update_stock(
                    item_id=item_data["item_id"],
                    warehouse_id=warehouse_id,
                    quantity=item_data["quantity"],
                    unit_cost=item_data["unit_cost"],
                    batch_id=batch_id,
                    batch_cache=batch_cache,
                    item_cache=item_cache,
                )
        
        logger.info(f"Added stock for new items in invoice {invoice_number}")
        
        # Create new journal entry
        account_codes_needed = ["1200"]  # Inventory
        if payment_type == "CREDIT":
            account_codes_needed.append("2000")  # Accounts Payable
        elif payment_type == "CASH":
            account_codes_needed.append("1000")  # Cash
        elif payment_type in ["BANK", "CHEQUE"]:
            account_codes_needed.append("1010")  # Bank
        
        account_cache = {}
        for code in set(account_codes_needed):
            account_dict = self.account_repo.find_by_code(code)
            if account_dict:
                account_cache[code] = account_dict
        
        inventory_account_dict = account_cache.get("1200")
        if not inventory_account_dict:
            raise ValidationError("Inventory account (1200) not found.")
        inventory_account_id = inventory_account_dict["id"]
        
        credit_account_id = None
        credit_description = ""
        credit_party_id = None
        
        if payment_type == "CREDIT":
            ap_account_dict = account_cache.get("2000")
            if not ap_account_dict:
                raise ValidationError("Accounts Payable account (2000) not found.")
            credit_account_id = ap_account_dict["id"]
            credit_description = f"Supplier credit - {supplier.name}"
            credit_party_id = supplier_id
        elif payment_type == "CASH":
            cash_account_dict = account_cache.get("1000")
            if not cash_account_dict:
                raise ValidationError("Cash account (1000) not found.")
            credit_account_id = cash_account_dict["id"]
            credit_description = "Cash payment"
        elif payment_type in ["BANK", "CHEQUE"]:
            if bank_account_id:
                bank_account = self.db.fetch_one("""
                    SELECT id, bank_name, account_id FROM bank_accounts WHERE id = ?
                """, (bank_account_id,))
                if bank_account:
                    credit_account_id = bank_account["account_id"]
                    bank_name = bank_account.get("bank_name", "Selected Bank")
                    credit_description = f"{payment_type} payment - {bank_name}"
                else:
                    raise ValidationError("Selected bank account not found.")
            else:
                bank_account_dict = account_cache.get("1010")
                if not bank_account_dict:
                    raise ValidationError("Bank account (1010) not found.")
                credit_account_id = bank_account_dict["id"]
                credit_description = f"{payment_type} payment"
        
        if credit_account_id is None:
            raise ValidationError(f"Could not determine credit account for payment type: {payment_type}")
        
        journal_lines = [
            JournalLine(
                account_id=inventory_account_id,
                debit=float(total_amount),
                credit=0.0,
                description="Inventory purchase"
            ),
        ]
        
        # Only add party_id for CREDIT purchases
        if credit_party_id is not None:
            journal_lines.append(
                JournalLine(
                    account_id=credit_account_id,
                    debit=0.0,
                    credit=float(total_amount),
                    party_id=credit_party_id,
                    description=credit_description
                )
            )
        else:
            journal_lines.append(
                JournalLine(
                    account_id=credit_account_id,
                    debit=0.0,
                    credit=float(total_amount),
                    description=credit_description
                )
            )
        
        tax_account_dict = account_cache.get("2100")
        tax_account_id = tax_account_dict["id"] if tax_account_dict else None
        
        if tax_amount > 0 and tax_account_id:
            journal_lines.append(
                JournalLine(
                    account_id=tax_account_id,
                    debit=0.0,
                    credit=float(tax_amount),
                    description="Purchase tax"
                )
            )
        
        self.accounting_service.post_journal_entry(
            voucher_type=VoucherType.PURCHASE,
            entry_date=invoice_date,
            lines=journal_lines,
            source_table="purchase_invoices",
            source_id=invoice_id,
            narration=f"Updated purchase invoice {invoice_number} from {supplier.name}"
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
                ) VALUES (?, 'WITHDRAWAL', ?, ?, ?, ?, datetime('now'))
            """, (
                bank_account_id,
                float(total_amount),
                invoice_date,
                invoice_number,
                f"Updated purchase invoice {invoice_number} - {payment_type} payment"
            ))
            logger.info(f"Recorded bank withdrawal for updated invoice {invoice_number}")
        
        logger.info("Updated purchase invoice %s for supplier %s (id=%s)", 
                invoice_number, supplier_id, invoice_id)
        
        # Log activity
        log_purchase_invoice_updated(
            invoice_id=invoice_id,
            invoice_number=invoice_number,
            supplier_name=supplier.name if hasattr(supplier, 'name') else supplier.get('name', 'Unknown'),
            total_amount=float(total_amount),
            user_id=None,
            company_id=company_id,
        )
        
        # Return updated invoice
        return self.get_purchase_invoice(invoice_id)

    def delete_purchase_invoice(self, invoice_id: int) -> bool:
        """Delete a purchase invoice."""
        # TODO: Implement delete logic with proper reversal of accounting entries
        raise NotImplementedError("Delete purchase invoice not yet implemented")
