"""Business rules for Purchase Invoices (creation, validation, accounting)."""
from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from typing import List

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
    """Simple journal line object for accounting service"""
    def __init__(self, account_id: int, debit: float, credit: float, 
                 party_id: int | None = None, description: str | None = None):
        self.account_id = account_id
        self.debit = debit
        self.credit = credit
        self.party_id = party_id
        self.description = description


class PurchaseInvoiceService:
    def __init__(self, db: DatabaseConnection | None = None):
        self.db = db or get_db()
        self.invoice_repo = PurchaseInvoiceRepository(self.db)
        self.item_repo = PurchaseInvoiceItemRepository(self.db)
        self.item_master_repo = ItemRepository(self.db)
        self.party_repo = PartyRepository(self.db)
        self.account_repo = AccountRepository(self.db)
        self.stock_repo = StockBatchRepository(self.db)
        self.accounting_service = AccountingService(self.db)
        self.account_service = AccountService(self.db)

    def _update_stock(
        self,
        item_id: int,
        warehouse_id: int,
        quantity: float,
        unit_cost: float,
        batch_number: str | None = None,
        manufacturing_date: str | None = None,
        expiry_date: str | None = None,
        batch_cache: dict | None = None,
        item_cache: dict | None = None,
    ) -> None:
        """Update stock when purchasing items."""
        import datetime
        
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
        
        logger.info(f"Updating stock for {item['item_code']}: +{quantity}")
        
        if not batch_number:
            batch_number = f"PURCHASE-{item_id}-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        if not manufacturing_date:
            manufacturing_date = datetime.date.today().isoformat()
        if not expiry_date:
            expiry_date = (datetime.date.today() + datetime.timedelta(days=730)).isoformat()
        
        # Use cached batch if available
        cache_key = f"{item_id}_{warehouse_id}"
        if batch_cache is not None and cache_key in batch_cache:
            existing = batch_cache[cache_key]
        else:
            existing = self.db.fetch_one("""
                SELECT id, quantity_in_stock 
                FROM stock_batches 
                WHERE item_id = ? AND warehouse_id = ? AND is_active = 1
                ORDER BY id DESC LIMIT 1
            """, (item_id, warehouse_id))
            if batch_cache is not None:
                batch_cache[cache_key] = existing
        
        if existing:
            new_quantity = existing["quantity_in_stock"] + quantity
            self.db.execute("""
                UPDATE stock_batches 
                SET quantity_in_stock = ? 
                WHERE id = ?
            """, (new_quantity, existing["id"]))
            logger.info(f"Updated stock for {item['item_code']}: {new_quantity}")
            # Update cache
            if batch_cache is not None:
                batch_cache[cache_key] = {"id": existing["id"], "quantity_in_stock": new_quantity}
        else:
            self.db.execute("""
                INSERT INTO stock_batches (
                    item_id, warehouse_id, batch_number, 
                    manufacturing_date, expiry_date, 
                    purchase_price, quantity_in_stock, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            """, (item_id, warehouse_id, batch_number, manufacturing_date, 
                  expiry_date, unit_cost, quantity))
            logger.info(f"Created new batch for {item['item_code']}: {quantity}")

    def create_purchase_invoice(
        self,
        invoice_number: str,
        supplier_id: int,
        invoice_date: str,
        payment_type: str,
        items: List[dict],
        notes: str | None = None,
        company_id: int = 1,
        warehouse_id: int = 1,
        created_by: int | None = None,
        bank_account_id: int | None = None,
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
            item = Item.from_row(item_dict)
            
            if not item.is_active:
                raise ValidationError(f"Item {item.item_name} is not active.")
            
            line_total = (quantity * unit_cost) - discount + tax
            if line_total < 0:
                raise ValidationError(f"Line total cannot be negative for item {item.item_name}")
            
            validated_items.append({
                "item_id": item_id,
                "quantity": float(quantity),
                "unit_cost": float(unit_cost),
                "discount_amount": float(discount),
                "tax_amount": float(tax),
                "line_total": float(line_total),
                "batch_id": None,  # Don't set batch_id for new purchases - it will be created by _update_stock
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

        # Get accounts - cache them to avoid repeated lookups
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

        # ============================================================
        # 🔴 FIX: Determine credit account AND party_id
        # ============================================================
        credit_party_id = None  # Default: no party_id
        
        if payment_type == "CREDIT":
            credit_account_id = ap_account_id
            credit_description = f"Supplier credit - {supplier.name}"
            credit_party_id = supplier_id  # ✅ SET party_id for credit purchases
            logger.info(f"🔧 CREDIT purchase - party_id={supplier_id}")
            
        elif payment_type in ["BANK", "CHEQUE"] and bank_account_id:
            bank_account = self.db.fetch_one("""
                SELECT id, bank_name, account_id FROM bank_accounts WHERE id = ?
            """, (bank_account_id,))
            if bank_account:
                credit_account_id = bank_account["account_id"]
                credit_description = f"{payment_type} payment - {bank_account['bank_name']}"
                # Don't set party_id for bank payments - only for credit purchases
                logger.info(f"✅ Using specific bank account: {bank_account['bank_name']}")
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

        # ============================================================
        # ✅ FIX: Build journal lines with party_id ONLY when appropriate
        # ============================================================
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

        # ============================================================
        # Save everything in one transaction
        # ============================================================
        with self.db.transaction():
            invoice.id = self.invoice_repo.insert_unique(invoice.to_dict())
            
            # Create caches to avoid redundant database lookups
            batch_cache = {}
            item_cache = {}
            
            for item_data in validated_items:
                item_data["invoice_id"] = invoice.id
                item = PurchaseInvoiceItem(**item_data)
                self.item_repo.insert(item.to_dict())
                
                self._update_stock(
                    item_id=item_data["item_id"],
                    warehouse_id=warehouse_id,
                    quantity=item_data["quantity"],
                    unit_cost=item_data["unit_cost"],
                    batch_number=item_data.get("batch_number"),
                    manufacturing_date=item_data.get("manufacturing_date"),
                    expiry_date=item_data.get("expiry_date"),
                    batch_cache=batch_cache,
                    item_cache=item_cache,
                )
            
            # ✅ Post journal entry with party_id
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
                logger.info(f"✅ Recorded bank withdrawal for invoice {invoice_number} from bank account {bank_account_id}")

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


    def get_purchase_invoice(self, invoice_id: int) -> PurchaseInvoice | None:
        row = self.invoice_repo.get_by_id(invoice_id)
        if not row:
            return None
        invoice = PurchaseInvoice.from_row(row)
        invoice.items = self.item_repo.find_by_invoice_id(invoice_id)
        return invoice

    def list_purchase_invoices(
        self, 
        company_id: int = 1, 
        status: str | None = None
    ) -> list[PurchaseInvoice]:
        """List purchase invoices with items loaded in a single batch query (eliminates N+1)."""
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
        notes: str | None,
        status: str,
        bank_account_id: int | None = None,
    ) -> None:
        """Updates purchase invoice with complete journal reversal."""
        existing_invoice = self.get_purchase_invoice(invoice_id)
        if not existing_invoice:
            raise ValidationError("Invoice not found.")
        
        # Get paid amount from database
        paid_row = self.db.fetch_one("""
            SELECT paid_amount FROM purchase_invoices WHERE id = ?
        """, (invoice_id,))
        
        actual_paid = paid_row["paid_amount"] if paid_row else 0
        
        # Prevent changing payment type on paid invoices
        if actual_paid > 0 and existing_invoice.payment_type != payment_type:
            raise ValidationError(
                f"Cannot change payment type from {existing_invoice.payment_type} to {payment_type}. "
                f"Invoice is already paid (Rs. {actual_paid:,.2f}). "
                "Please cancel the invoice and create a new one with the correct payment type."
            )
        
        # Validate inputs
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
        
        # Validate and process items
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
            item = Item.from_row(item_dict)
            
            if not item.is_active:
                raise ValidationError(f"Item {item.item_name} is not active.")
            
            line_total = (quantity * unit_cost) - discount + tax
            if line_total < 0:
                raise ValidationError(f"Line total cannot be negative for item {item.item_name}")
            
            validated_items.append({
                "item_id": item_id,
                "quantity": float(quantity),
                "unit_cost": float(unit_cost),
                "discount_amount": float(discount),
                "tax_amount": float(tax),
                "line_total": float(line_total),
                "batch_id": None,  # Don't set batch_id for updates either - let _update_stock handle it
                "batch_number": item_data.get("batch_number"),
                "manufacturing_date": item_data.get("manufacturing_date"),
                "expiry_date": item_data.get("expiry_date")
            })
            
            subtotal += quantity * unit_cost
            discount_amount += discount
            tax_amount += tax

        total_amount = subtotal - discount_amount + tax_amount
        
        # Keep existing paid amount
        paid_amount = existing_invoice.paid_amount
        
        # Get all accounts
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

        # ============================================================
        # STEP 1: Find the old journal entry to reverse
        # ============================================================
        old_je = self.db.fetch_one("""
            SELECT id, voucher_number 
            FROM journal_entries 
            WHERE source_table = 'purchase_invoices' 
            AND source_id = ?
            AND voucher_type != 'JOURNAL'
        """, (invoice_id,))
        
        old_journal_lines = []
        if old_je:
            old_lines = self.db.fetch_all("""
                SELECT account_id, debit, credit, party_id, description
                FROM journal_entry_lines
                WHERE journal_entry_id = ?
            """, (old_je["id"],))
            
            if old_lines:
                for line in old_lines:
                    old_journal_lines.append(
                        JournalLine(
                            account_id=line["account_id"],
                            debit=line["credit"] or 0,
                            credit=line["debit"] or 0,
                            party_id=line.get("party_id"),
                            description=f"REVERSAL: {line.get('description', '')}"
                        )
                    )
                print(f"✅ Found {len(old_lines)} lines to reverse")

        # ============================================================
        # STEP 2: Determine credit account for new entry
        # ============================================================
        if payment_type == "CREDIT":
            credit_account_id = ap_account_id
            credit_description = f"Supplier credit - {supplier.name}"
            print(f"🔧 NEW ENTRY: CREDIT - Crediting AP")
        elif payment_type == "CASH":
            credit_account_id = cash_account_id
            credit_description = "Cash payment"
            print(f"🔧 NEW ENTRY: CASH - Crediting Cash")
        elif payment_type in ["BANK", "CHEQUE"] and bank_account_id:
            bank_account = self.db.fetch_one("""
                SELECT id, bank_name, account_id FROM bank_accounts WHERE id = ?
            """, (bank_account_id,))
            if bank_account:
                credit_account_id = bank_account["account_id"]
                credit_description = f"{payment_type} payment - {bank_account['bank_name']}"
                print(f"🔧 NEW ENTRY: {payment_type} - Crediting Bank ({bank_account['bank_name']})")
            else:
                raise ValidationError("Selected bank account not found.")
        else:
            # Default to master bank
            bank_account_dict = self.account_repo.find_by_code("1010")
            if not bank_account_dict:
                raise ValidationError("Bank account (1010) not found.")
            credit_account_id = bank_account_dict["id"]
            credit_description = f"{payment_type} payment"
            print(f"🔧 NEW ENTRY: {payment_type} - Crediting Bank (Default)")

        # ============================================================
        # STEP 3: Create new journal entry
        # ============================================================
        new_journal_lines = [
            JournalLine(
                account_id=inventory_account_id,
                debit=float(total_amount),
                credit=0.0,
                description=f"Purchase - {supplier.name}"
            ),
            JournalLine(
                account_id=credit_account_id,
                debit=0.0,
                credit=float(total_amount),
                description=credit_description
            )
        ]
        
        if tax_amount > 0 and tax_account_id:
            new_journal_lines.append(
                JournalLine(
                    account_id=tax_account_id,
                    debit=0.0,
                    credit=float(tax_amount),
                    description="Purchase tax"
                )
            )

        # ============================================================
        # STEP 4: Save everything in one transaction
        # ============================================================
        with self.db.transaction():
            self.invoice_repo.update(
                invoice_id,
                {
                    "invoice_number": invoice_number,
                    "supplier_id": supplier_id,
                    "invoice_date": invoice_date,
                    "payment_type": payment_type,
                    # NO bank_account_id here!
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
            
            # Initialize batch cache for optimization
            batch_cache = {}
            
            for item_data in validated_items:
                item_data["invoice_id"] = invoice_id
                item = PurchaseInvoiceItem(**item_data)
                self.item_repo.insert(item.to_dict())
                
                self._update_stock(
                    item_id=item_data["item_id"],
                    warehouse_id=1,
                    quantity=item_data["quantity"],
                    unit_cost=item_data["unit_cost"],
                    batch_number=item_data.get("batch_number"),
                    manufacturing_date=item_data.get("manufacturing_date"),
                    expiry_date=item_data.get("expiry_date"),
                    batch_cache=batch_cache,
                )
            
            if old_journal_lines:
                self.accounting_service.post_journal_entry(
                    voucher_type=VoucherType.JOURNAL,
                    entry_date=invoice_date,
                    lines=old_journal_lines,
                    source_table="purchase_invoices",
                    source_id=invoice_id,
                    narration=f"Reverse old purchase invoice {existing_invoice.invoice_number}"
                )
                print(f"✅ Reversed {len(old_journal_lines)} lines")
            
            self.accounting_service.post_journal_entry(
                voucher_type=VoucherType.PURCHASE,
                entry_date=invoice_date,
                lines=new_journal_lines,
                source_table="purchase_invoices",
                source_id=invoice_id,
                narration=f"Purchase invoice {invoice_number} updated"
            )
            print(f"✅ Created new entry with {len(new_journal_lines)} lines")
            
            # ✅ Handle bank transaction on payment type change
            if payment_type in ["BANK", "CHEQUE"] and bank_account_id:
                existing_txn = self.db.fetch_one("""
                    SELECT id FROM bank_transactions 
                    WHERE reference_no = ? AND transaction_type = 'WITHDRAWAL'
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
                        f"Purchase invoice {invoice_number} - {payment_type} payment (updated)",
                        invoice_number
                    ))
                    logger.info(f"✅ Updated bank withdrawal for invoice {invoice_number}")
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
                        ) VALUES (?, 'WITHDRAWAL', ?, ?, ?, ?, datetime('now'))
                    """, (
                        bank_account_id,
                        float(total_amount),
                        invoice_date,
                        invoice_number,
                        f"Purchase invoice {invoice_number} - {payment_type} payment"
                    ))
                    logger.info(f"✅ Recorded bank withdrawal for invoice {invoice_number}")
            
            elif payment_type == "CASH" and existing_invoice.payment_type in ["BANK", "CHEQUE"]:
                self.db.execute("""
                    DELETE FROM bank_transactions 
                    WHERE reference_no = ? AND transaction_type = 'WITHDRAWAL'
                """, (invoice_number,))
                logger.info(f"✅ Removed bank withdrawal for invoice {invoice_number} (changed to CASH)")
        
        logger.info("Updated purchase invoice %s (id=%s) - Payment Type: %s", 
                    invoice_number, invoice_id, payment_type)

    def delete_purchase_invoice(self, invoice_id: int) -> None:
        """Deletes purchase invoice (reverse journal entry)"""
        invoice = self.get_purchase_invoice(invoice_id)
        if not invoice:
            raise ValidationError("Invoice not found.")
        
        if invoice.status == "CANCELLED":
            raise ValidationError("Invoice is already cancelled.")
        
        inventory_account_dict = self.account_repo.find_by_code("1200")
        if not inventory_account_dict:
            raise ValidationError("Inventory account (1200) not found.")
        inventory_account_id = inventory_account_dict["id"]
        
        ap_account_dict = self.account_repo.find_by_code("2000")
        if not ap_account_dict:
            raise ValidationError("Accounts Payable account (2000) not found.")
        ap_account_id = ap_account_dict["id"]
        
        tax_account_dict = self.account_repo.find_by_code("2100")
        tax_account_id = tax_account_dict["id"] if tax_account_dict else None
        
        old_je = self.db.fetch_one("""
            SELECT id, voucher_number 
            FROM journal_entries 
            WHERE source_table = 'purchase_invoices' 
            AND source_id = ?
            AND voucher_type != 'JOURNAL'
        """, (invoice_id,))
        
        reversal_lines = []
        if old_je:
            old_lines = self.db.fetch_all("""
                SELECT account_id, debit, credit, party_id, description
                FROM journal_entry_lines
                WHERE journal_entry_id = ?
            """, (old_je["id"],))
            
            if old_lines:
                for line in old_lines:
                    reversal_lines.append(
                        JournalLine(
                            account_id=line["account_id"],
                            debit=line["credit"] or 0,
                            credit=line["debit"] or 0,
                            party_id=line.get("party_id"),
                            description=f"REVERSAL: {line.get('description', '')}"
                        )
                    )
        
        if not reversal_lines:
            reversal_lines = [
                JournalLine(
                    account_id=ap_account_id,
                    debit=float(invoice.total_amount),
                    credit=0.0,
                    description="Reverse AP"
                ),
                JournalLine(
                    account_id=inventory_account_id,
                    debit=0.0,
                    credit=float(invoice.total_amount),
                    description="Reverse inventory"
                )
            ]
            if invoice.tax_amount > 0 and tax_account_id:
                reversal_lines.append(
                    JournalLine(
                        account_id=tax_account_id,
                        debit=float(invoice.tax_amount),
                        credit=0.0,
                        description="Reverse tax"
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
                self.db.execute("""
                    UPDATE stock_batches 
                    SET quantity_in_stock = quantity_in_stock - ?
                    WHERE id = ?
                """, (item["quantity"], item["batch_id"]))
                logger.info(f"✅ Restored stock for item {item['item_id']}: -{item['quantity']}")
            
            if reversal_lines:
                self.accounting_service.post_journal_entry(
                    voucher_type=VoucherType.JOURNAL,
                    entry_date=invoice.invoice_date,
                    lines=reversal_lines,
                    source_table="purchase_invoices",
                    source_id=invoice_id,
                    narration=f"Reverse purchase invoice {invoice.invoice_number}"
                )
            
            if invoice.payment_type in ["BANK", "CHEQUE"]:
                self.db.execute("""
                    DELETE FROM bank_transactions 
                    WHERE reference_no = ? AND transaction_type = 'WITHDRAWAL'
                """, (invoice.invoice_number,))
                logger.info(f"✅ Removed bank withdrawal for cancelled invoice {invoice.invoice_number}")
        
        logger.info("Cancelled purchase invoice %s (id=%s)", invoice.invoice_number, invoice_id)