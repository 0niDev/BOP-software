# services/item_service.py
"""Business rules for Items (creation, validation)."""
from __future__ import annotations

from database.connection import DatabaseConnection, get_db
from models.item import Item
from repositories.item_repository import ItemRepository
from repositories.tax_rate_repository import TaxRateRepository
from repositories.journal_repository import JournalRepository
from utils.exceptions import ValidationError
from utils.logger import get_logger
from utils.activity_logger import log_item_created, log_item_updated, log_item_deleted

logger = get_logger(__name__)


class ItemService:
    def __init__(self, db: DatabaseConnection | None = None):
        self.db = db or get_db()
        self.repo = ItemRepository(self.db)
        self.tax_repo = TaxRateRepository(self.db)
        self.journal_repo = JournalRepository(self.db)

    def create_item(
        self,
        item_name: str,                # ← Required (no default)
        unit: str = "UNIT",            # ← Default
        item_code: str | None = None,  # ← Optional (auto-generate)
        notes: str | None = None,
        purchase_price: float = 0.0,
        selling_price: float = 0.0,
        minimum_stock: float = 0.0,
        maximum_stock: float = 0.0,
        tax_rate_id: int | None = None,
        item_type: str = "FINISHED_GOOD",
        category_id: int | None = None,
        company_id: int = 1,
    ) -> Item:
        """Creates a new item with AUTO-GENERATED code if not provided."""
        
        # 1. Validate inputs
        item_name = item_name.strip()
        if not item_name:
            raise ValidationError("Item name is required.")
        if purchase_price < 0:
            raise ValidationError("Purchase price cannot be negative.")
        if selling_price < 0:
            raise ValidationError("Selling price cannot be negative.")
        if minimum_stock < 0:
            raise ValidationError("Minimum stock cannot be negative.")
        if maximum_stock < 0:
            raise ValidationError("Maximum stock cannot be negative.")
        if maximum_stock < minimum_stock:
            raise ValidationError("Maximum stock must be >= minimum stock.")
        if unit not in ["TABLET", "CAPSULE", "ML", "GRAM", "KG", "UNIT", "VIAL", "AMPOULE"]:
            raise ValidationError(f"Invalid unit: {unit}. Use TABLET, CAPSULE, ML, etc.")
        if item_type not in ["RAW_MATERIAL", "PACKING_MATERIAL", "FINISHED_GOOD"]:
            raise ValidationError(f"Invalid item type: {item_type}")

        # 2. ✅ Handle item_code (manual or auto-generate)
        if item_code is not None:
            # Manual code provided - validate it
            item_code = item_code.strip()
            if not item_code:
                raise ValidationError("Item code cannot be empty.")
            existing = self.repo.find_by_code(item_code, company_id)
            if existing:
                raise ValidationError(f"Item code '{item_code}' already exists.")
        # (auto-generate happens inside the transaction below)

        # 3. Validate tax rate if provided
        if tax_rate_id is not None:
            tax_rate = self.tax_repo.find_by_id(tax_rate_id)
            if tax_rate is None:
                raise ValidationError("Tax rate does not exist.")
            if tax_rate["company_id"] != company_id:
                raise ValidationError("Tax rate belongs to different company.")
            if tax_rate["tax_type"] != "SALES_TAX":
                raise ValidationError("Tax rate must be sales tax type.")

        # 4. Persist within transaction (code generation included so sequence
        #    rolls back together with the insert on failure — no gaps)
        with self.db.transaction():
            if item_code is None:
                item_code = self.journal_repo.next_voucher_number(company_id, "ITEM")
                logger.info(f"Auto-generated item code: {item_code}")

            item = Item(
                item_code=item_code,
                item_name=item_name,
                notes=notes,
                unit=unit,
                purchase_price=purchase_price,
                selling_price=selling_price,
                minimum_stock=minimum_stock,
                maximum_stock=maximum_stock,
                tax_rate_id=tax_rate_id,
                item_type=item_type,
                category_id=category_id,
                company_id=company_id,
            )
            new_id = self.repo.insert_unique(item.to_dict())
            item.id = new_id

        logger.info("Created item %s - %s (id=%s)", item_code, item_name, new_id)
        log_item_created(
            item_id=new_id,
            item_code=item_code,
            item_name=item_name,
            company_id=company_id,
        )
        return item

    def update_item(
        self,
        item_id: int,
        item_name: str,
        notes: str | None,
        unit: str,
        purchase_price: float,
        selling_price: float,
        minimum_stock: float,
        maximum_stock: float,
        tax_rate_id: int | None,
        item_type: str,
        category_id: int | None,
        is_active: bool = True,
    ) -> None:
        """Updates item details"""
        if not item_name.strip():
            raise ValidationError("Item name is required.")
        if purchase_price < 0:
            raise ValidationError("Purchase price cannot be negative.")
        if selling_price < 0:
            raise ValidationError("Selling price cannot be negative.")
        if minimum_stock < 0:
            raise ValidationError("Minimum stock cannot be negative.")
        if maximum_stock < 0:
            raise ValidationError("Maximum stock cannot be negative.")
        if maximum_stock < minimum_stock:
            raise ValidationError("Maximum stock must be >= minimum stock.")
        if unit not in ["TABLET", "CAPSULE", "ML", "GRAM", "KG", "UNIT", "VIAL", "AMPOULE"]:
            raise ValidationError(f"Invalid unit: {unit}")
        if item_type not in ["RAW_MATERIAL", "PACKING_MATERIAL", "FINISHED_GOOD"]:
            raise ValidationError(f"Invalid item type: {item_type}")
        
        if tax_rate_id is not None:
            tax_rate = self.tax_repo.find_by_id(tax_rate_id)
            if tax_rate is None:
                raise ValidationError("Tax rate does not exist.")
            if tax_rate["company_id"] != 1:
                raise ValidationError("Tax rate belongs to different company.")
            if tax_rate["tax_type"] != "SALES_TAX":
                raise ValidationError("Tax rate must be sales tax type.")

        self.repo.update(
            item_id,
            {
                "item_name": item_name.strip(),
                "notes": notes,
                "unit": unit,
                "purchase_price": purchase_price,
                "selling_price": selling_price,
                "minimum_stock": minimum_stock,
                "maximum_stock": maximum_stock,
                "tax_rate_id": tax_rate_id,
                "item_type": item_type,
                "category_id": category_id,
                "is_active": int(is_active),
            },
        )
        logger.info("Updated item id=%s", item_id)
        log_item_updated(
            item_id=item_id,
            item_code="",  # We don't have the code here, could fetch it
            item_name=item_name.strip(),
            changes={
                "name": item_name.strip(),
                "unit": unit,
                "purchase_price": purchase_price,
                "selling_price": selling_price,
                "minimum_stock": minimum_stock,
                "maximum_stock": maximum_stock,
            },
        )

    def deactivate_item(self, item_id: int) -> None:
        """Deactivates item if safe"""
        # Get item details before deactivation for logging
        item = self.repo.get_by_id(item_id)
        if item:
            self.repo.deactivate(item_id)
            logger.info("Deactivated item id=%s", item_id)
            log_item_deleted(
                item_id=item_id,
                item_code=item.get("item_code", ""),
                item_name=item.get("item_name", ""),
            )

    def get_item(self, item_id: int) -> Item | None:
        """Gets item by ID"""
        row = self.repo.get_by_id(item_id)
        if row is None:
            return None
        return Item.from_row(row)

    def list_items(
        self, 
        company_id: int = 1, 
        active_only: bool = True
    ) -> list[Item]:
        """Lists items with optional filtering"""
        rows = self.repo.find_all_for_company(
            company_id, 
            active_only=active_only
        )
        return [Item.from_row(r) for r in rows]

    def get_tax_rates(
        self, 
        company_id: int = 1, 
        active_only: bool = True
    ) -> list[dict]:
        """Get tax rates for dropdowns"""
        return self.tax_repo.find_all_for_company(company_id, active_only)

    def add_opening_stock(
        self,
        item_id: int,
        quantity: float,
        unit_cost: float = 0.0,
        batch_number: str | None = None,
        expiry_date: str | None = None,
        party_id: int | None = None,
        company_id: int = 1,
        warehouse_id: int = 1,
    ) -> None:
        """Add opening stock for an item as a new stock batch.

        Creates the batch plus an OPENING stock movement. If a party
        (supplier) is provided, posts an OPENING journal entry debiting the
        item's inventory account and crediting the party to keep the books
        balanced.
        """
        from datetime import date, datetime

        from repositories.stock_batch_repository import StockBatchRepository
        from repositories.account_repository import AccountRepository
        from services.accounting_service import AccountingService, JournalLine
        from models.enums import VoucherType

        if quantity <= 0:
            raise ValidationError("Quantity must be greater than 0.")
        if unit_cost < 0:
            raise ValidationError("Unit cost cannot be negative.")

        item = self.repo.get_by_id(item_id)
        if not item:
            raise ValidationError("Item does not exist.")

        if batch_number is None:
            batch_number = f"OPEN-{item['item_code']}-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        stock_repo = StockBatchRepository(self.db)
        total_value = quantity * unit_cost

        with self.db.transaction():
            stock_repo.create_batch(
                item_id=item_id,
                warehouse_id=warehouse_id,
                batch_number=batch_number,
                manufacturing_date=date.today().isoformat(),
                expiry_date=expiry_date,
                purchase_price=unit_cost,
                quantity_in_stock=quantity,
                raw_unit_cost=unit_cost,
            )

            # Audit trail
            batch_row = self.db.fetch_one(
                "SELECT id FROM stock_batches "
                "WHERE item_id = ? AND warehouse_id = ? AND batch_number = ?",
                (item_id, warehouse_id, batch_number),
            )
            if batch_row:
                self.db.execute(
                    """
                    INSERT INTO stock_movements
                        (item_id, batch_id, warehouse_id, movement_type, quantity,
                         unit_cost, movement_date, notes)
                    VALUES (?, ?, ?, 'OPENING', ?, ?, datetime('now'), ?)
                    """,
                    (
                        item_id,
                        batch_row["id"],
                        warehouse_id,
                        quantity,
                        unit_cost,
                        f"Opening stock - {item['item_name']}",
                    ),
                )

            # Accounting: debit inventory, credit party to balance
            if party_id:
                type_codes = {
                    "RAW_MATERIAL": "1200",
                    "PACKING_MATERIAL": "1210",
                    "FINISHED_GOOD": "1220",
                }
                inv_code = type_codes.get(item["item_type"], "1200")
                account_repo = AccountRepository(self.db)
                inv_account = account_repo.find_by_code(inv_code, company_id)
                ap_account = account_repo.find_by_code("2000", company_id)
                if not inv_account:
                    raise ValidationError(f"Inventory account ({inv_code}) not found.")
                if not ap_account:
                    raise ValidationError("Accounts Payable account (2000) not found.")
                if total_value > 0:
                    accounting = AccountingService(self.db)
                    accounting.post_journal_entry(
                        voucher_type=VoucherType.OPENING,
                        entry_date=date.today().isoformat(),
                        lines=[
                            JournalLine(
                                account_id=inv_account["id"],
                                debit=total_value,
                                description=f"Opening stock - {item['item_name']}",
                            ),
                            JournalLine(
                                account_id=ap_account["id"],
                                credit=total_value,
                                party_id=party_id,
                                description=f"Opening stock credit - {item['item_name']}",
                            ),
                        ],
                        narration=f"Opening stock for {item['item_name']}",
                    )

        logger.info(
            "Added opening stock for item %s: qty=%s unit_cost=%s",
            item["item_name"], quantity, unit_cost,
        )