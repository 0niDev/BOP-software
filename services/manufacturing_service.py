"""Business rules for Manufacturing - BOM, Production Orders, Accounting."""
from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

from database.connection import DatabaseConnection, get_db
from models.enums import VoucherType
from models.bill_of_materials import BillOfMaterials, BOMComponent
from models.production_order import ProductionOrder, ProductionConsumption
from models.item import Item
from repositories.bom_repository import BOMRepository, BOMComponentRepository
from repositories.production_order_repository import (
    ProductionOrderRepository,
    ProductionConsumptionRepository
)
from repositories.item_repository import ItemRepository
from repositories.account_repository import AccountRepository
from repositories.stock_batch_repository import StockBatchRepository
from services.accounting_service import AccountingService, JournalLine
from utils.exceptions import ValidationError, InsufficientStockError
from utils.logger import get_logger
from utils.activity_logger import log_manufacturing_order_created

logger = get_logger(__name__)

# services/manufacturing_service.py
# services/manufacturing_service.py

from repositories.journal_repository import JournalRepository

class ManufacturingService:
    def __init__(self, db: DatabaseConnection | None = None):
        self.db = db or get_db()
        self.bom_repo = BOMRepository(self.db)
        self.bom_component_repo = BOMComponentRepository(self.db)
        self.order_repo = ProductionOrderRepository(self.db)
        self.consumption_repo = ProductionConsumptionRepository(self.db)
        self.item_repo = ItemRepository(self.db)
        self.account_repo = AccountRepository(self.db)
        self.stock_repo = StockBatchRepository(self.db)
        self.accounting_service = AccountingService(self.db)
        self.journal_repo = JournalRepository(self.db)  # ← For auto-generation

    # ======================================================================
    # Bill of Materials (BOM) Operations
    # ======================================================================

    def create_bom(
        self,
        finished_item_id: int,           # ← Required
        output_quantity: float,          # ← Required
        components: list[dict],          # ← Required
        bom_name: str | None = None,     # ← Optional (auto-generate)
        notes: str | None = None,
        company_id: int = 1,
    ) -> BillOfMaterials:
        """
        Create a new Bill of Materials with AUTO-GENERATED name if not provided.
        """
        # 1. Validate finished item
        finished_item = self.item_repo.get_by_id(finished_item_id)
        if not finished_item:
            raise ValidationError("Finished item does not exist.")
        if finished_item["item_type"] != "FINISHED_GOOD":
            raise ValidationError("Finished item must be of type FINISHED_GOOD.")

        # 2. ✅ Handle BOM name (manual or auto-generate)
        if bom_name is not None:
            bom_name = bom_name.strip()
            if not bom_name:
                raise ValidationError("BOM name cannot be empty.")
            # Check if BOM name already exists
            existing = self.bom_repo.find_by_name(bom_name, company_id)
            if existing:
                raise ValidationError(f"BOM name '{bom_name}' already exists.")
        else:
            # Auto-generate BOM name
            bom_name = self.journal_repo.next_voucher_number(company_id, "BOM")
            logger.info(f"Auto-generated BOM name: {bom_name}")

        if output_quantity <= 0:
            raise ValidationError("Output quantity must be greater than 0.")
        if not components:
            raise ValidationError("At least one component is required.")

        # 3. Validate components
        validated_components = []
        for comp in components:
            component_item_id = comp.get("component_item_id")
            quantity_required = comp.get("quantity_required", 0)
            wastage_percent = comp.get("wastage_percent", 0)

            if not component_item_id or quantity_required <= 0:
                raise ValidationError("Each component requires an item and quantity.")

            component_item = self.item_repo.get_by_id(component_item_id)
            if not component_item:
                raise ValidationError(f"Component item {component_item_id} does not exist.")
            if component_item["item_type"] not in ["RAW_MATERIAL", "PACKING_MATERIAL"]:
                raise ValidationError(f"Component {component_item['item_name']} must be RAW_MATERIAL or PACKING_MATERIAL.")

            if wastage_percent < 0 or wastage_percent > 100:
                raise ValidationError("Wastage percentage must be between 0 and 100.")

            validated_components.append({
                "component_item_id": component_item_id,
                "quantity_required": quantity_required,
                "wastage_percent": wastage_percent,
            })

        # 4. Create BOM
        bom = BillOfMaterials(
            finished_item_id=finished_item_id,
            bom_name=bom_name,
            output_quantity=output_quantity,
            notes=notes,
            company_id=company_id,
        )

        with self.db.transaction():
            bom.id = self.bom_repo.insert(bom.to_dict())
            for comp in validated_components:
                comp["bom_id"] = bom.id
                bom_component = BOMComponent(**comp)
                self.bom_component_repo.insert(bom_component.to_dict())

        logger.info("Created BOM '%s' for item %s (id=%s)", bom_name, finished_item["item_code"], bom.id)
        return bom

    def get_bom(self, bom_id: int) -> BillOfMaterials | None:
        """Get BOM by ID with components."""
        row = self.bom_repo.get_by_id(bom_id)
        if not row:
            return None
        bom = BillOfMaterials.from_row(row)
        bom.components = [
            BOMComponent.from_row(row) 
            for row in self.bom_component_repo.find_by_bom_id(bom_id)
        ]
        return bom

    def list_boms(self, company_id: int = 1, active_only: bool = True) -> list[BillOfMaterials]:
        """List all BOMs with components loaded in a single batch query (eliminates N+1)."""
        rows = self.bom_repo.find_all_for_company(company_id, active_only)
        
        if not rows:
            return []
        
        # Batch load all components for all BOMs in ONE query
        bom_ids = [row['id'] for row in rows]
        components_by_bom = self.bom_component_repo.find_by_bom_ids(bom_ids)
        
        # Build BOM objects with their components
        boms = []
        for row in rows:
            bom = BillOfMaterials.from_row(row)
            bom.components = [
                BOMComponent.from_row(comp_row)
                for comp_row in components_by_bom.get(bom.id, [])
            ]
            boms.append(bom)
        
        return boms

    def update_bom(
        self,
        bom_id: int,
        bom_name: str,
        output_quantity: float,
        components: list[dict],
        notes: str | None,
        is_active: bool
    ) -> None:
        """Update BOM."""
        existing = self.bom_repo.get_by_id(bom_id)
        if not existing:
            raise ValidationError("BOM not found.")

        if not bom_name or not bom_name.strip():
            raise ValidationError("BOM name is required.")
        if output_quantity <= 0:
            raise ValidationError("Output quantity must be greater than 0.")
        if not components:
            raise ValidationError("At least one component is required.")

        with self.db.transaction():
            self.bom_repo.update(
                bom_id,
                {
                    "bom_name": bom_name.strip(),
                    "output_quantity": output_quantity,
                    "notes": notes,
                    "is_active": int(is_active),
                }
            )
            self.bom_component_repo.delete_by_bom_id(bom_id)
            for comp in components:
                comp["bom_id"] = bom_id
                bom_component = BOMComponent(**comp)
                self.bom_component_repo.insert(bom_component.to_dict())

        logger.info("Updated BOM id=%s", bom_id)

    def deactivate_bom(self, bom_id: int) -> None:
        """Deactivate BOM."""
        orders = self.order_repo.find_all_for_company()
        for order in orders:
            if order["bom_id"] == bom_id and order["status"] not in ["CANCELLED"]:
                raise ValidationError("Cannot deactivate BOM that is used in active production orders.")
        
        self.bom_repo.deactivate(bom_id)
        logger.info("Deactivated BOM id=%s", bom_id)

    # ======================================================================
    # Production Order Operations
    # ======================================================================

    def create_production_order(
        self,
        order_number: str,
        bom_id: int,
        planned_quantity: float,
        manufacturing_date: str,
        expiry_date: str | None = None,
        notes: str | None = None,
        company_id: int = 1,
        warehouse_id: int = 1,
        created_by: int | None = None,
    ) -> ProductionOrder:
        """Create a new production order."""
        order_number = order_number.strip()
        if not order_number:
            raise ValidationError("Order number is required.")
        if planned_quantity <= 0:
            raise ValidationError("Planned quantity must be greater than 0.")

        bom = self.get_bom(bom_id)
        if not bom:
            raise ValidationError("BOM does not exist.")
        if not bom.is_active:
            raise ValidationError("BOM is not active.")

        finished_item = self.item_repo.get_by_id(bom.finished_item_id)
        if not finished_item:
            raise ValidationError("Finished item does not exist.")

        order = ProductionOrder(
            order_number=order_number,
            bom_id=bom_id,
            planned_quantity=planned_quantity,
            manufacturing_date=manufacturing_date,
            expiry_date=expiry_date,
            notes=notes,
            company_id=company_id,
            warehouse_id=warehouse_id,
            created_by=created_by,
            status="DRAFT",
        )

        with self.db.transaction():
            order.id = self.order_repo.insert_unique(order.to_dict())

        logger.info("Created production order %s (id=%s)", order_number, order.id)
        
        # Log activity
        log_manufacturing_order_created(
            order_id=order.id,
            order_number=order_number,
            product_name=finished_item["item_name"],
            quantity=planned_quantity,
        )
        
        return order

    def get_production_order(self, order_id: int) -> ProductionOrder | None:
        """Get production order by ID with consumptions."""
        row = self.order_repo.get_by_id(order_id)
        if not row:
            return None
        order = ProductionOrder.from_row(row)
        order.components = [
            ProductionConsumption.from_row(row)
            for row in self.consumption_repo.find_by_production_order(order_id)
        ]
        return order

    def list_production_orders(
        self,
        company_id: int = 1,
        status: str | None = None
    ) -> list[ProductionOrder]:
        """List production orders with components loaded in a single batch query (eliminates N+1)."""
        rows = self.order_repo.find_all_for_company(company_id, status)
        
        if not rows:
            return []
        
        # Batch load all consumption records for all orders in ONE query
        order_ids = [row['id'] for row in rows]
        components_by_order = self.consumption_repo.find_by_production_orders(order_ids)
        
        # Build order objects with their components
        orders = []
        for row in rows:
            order = ProductionOrder.from_row(row)
            order.components = [
                ProductionConsumption.from_row(comp_row)
                for comp_row in components_by_order.get(order.id, [])
            ]
            orders.append(order)
        
        return orders

    def start_production(self, order_id: int) -> None:
        """Start a production order (change status to IN_PROGRESS)."""
        order = self.get_production_order(order_id)
        if not order:
            raise ValidationError("Production order not found.")
        if order.status != "DRAFT":
            raise ValidationError(f"Cannot start order with status '{order.status}'.")

        self.order_repo.update_status(order_id, "IN_PROGRESS")
        logger.info("Started production order id=%s", order_id)
    def cancel_production_order(self, order_id: int) -> None:
        """Cancel a production order."""
        order = self.get_production_order(order_id)
        if not order:
            raise ValidationError("Production order not found.")
        if order.status == "COMPLETED":
            raise ValidationError("Cannot cancel a completed production order.")

        self.order_repo.update_status(order_id, "CANCELLED")
        logger.info("Cancelled production order id=%s", order_id)

    def delete_production_order(self, order_id: int) -> None:
        """Delete a production order (only if DRAFT)."""
        order = self.get_production_order(order_id)
        if not order:
            raise ValidationError("Production order not found.")
        if order.status != "DRAFT":
            raise ValidationError(f"Cannot delete order with status '{order.status}'.")

        self.order_repo.delete(order_id)
        logger.info("Deleted production order id=%s", order_id)

    def complete_production(
        self,
        order_id: int,
        actual_quantity: float,
        wastage_quantity: float = 0,
        output_batch_number: str | None = None,
    ) -> None:
        """
        Complete a production order.
        This creates accounting entries and updates stock.
        """
        order = self.get_production_order(order_id)
        if not order:
            raise ValidationError("Production order not found.")
        if order.status != "IN_PROGRESS":
            raise ValidationError(f"Cannot complete order with status '{order.status}'.")

        if actual_quantity <= 0:
            raise ValidationError("Actual quantity must be greater than 0.")
        if wastage_quantity < 0:
            raise ValidationError("Wastage quantity cannot be negative.")

        # Get BOM and components
        bom = self.get_bom(order.bom_id)
        if not bom:
            raise ValidationError("BOM not found.")

        # Calculate required raw materials
        ratio = actual_quantity / bom.output_quantity
        required_materials = []
        total_raw_cost = Decimal('0')

        for component in bom.components:
            required_qty = component.quantity_required * ratio
            wastage_qty = required_qty * (component.wastage_percent / 100)
            total_required = required_qty + wastage_qty

            # Get current stock
            stock_batch = self.stock_repo.find_by_item_and_warehouse(
                component.component_item_id,
                order.warehouse_id
            )

            if not stock_batch:
                item = self.item_repo.get_by_id(component.component_item_id)
                raise InsufficientStockError(
                    f"No stock batch found for {item['item_name']}. "
                    f"Required: {total_required:.2f}"
                )

            if stock_batch["quantity_in_stock"] < total_required:
                item = self.item_repo.get_by_id(component.component_item_id)
                raise InsufficientStockError(
                    f"Insufficient stock for {item['item_name']}. "
                    f"Required: {total_required:.2f}, Available: {stock_batch['quantity_in_stock']:.2f}"
                )

            unit_cost = stock_batch["purchase_price"] if stock_batch else 0

            required_materials.append({
                "component_item_id": component.component_item_id,
                "batch_id": stock_batch["id"] if stock_batch else None,
                "quantity_consumed": float(total_required),
                "unit_cost": unit_cost,
                "total_cost": float(total_required) * unit_cost,
            })

            total_raw_cost += Decimal(str(float(total_required) * unit_cost))

        # Get accounts for journal entry
        inventory_raw_account = self.account_repo.find_by_code("1200")
        if not inventory_raw_account:
            raise ValidationError("Inventory Raw Materials account (1200) not found.")
        
        inventory_finished_account = self.account_repo.find_by_code("1220")
        if not inventory_finished_account:
            raise ValidationError("Inventory Finished Goods account (1220) not found.")
        
        wastage_account = self.account_repo.find_by_code("5200")
        if not wastage_account:
            raise ValidationError("Manufacturing Wastage account (5200) not found.")

        # Prepare journal entry lines
        journal_lines = [
            JournalLine(
                account_id=inventory_finished_account["id"],
                debit=float(total_raw_cost),
                credit=0.0,
                description=f"Production output - {order.order_number}"
            ),
            JournalLine(
                account_id=inventory_raw_account["id"],
                debit=0.0,
                credit=float(total_raw_cost),
                description=f"Raw materials consumed - {order.order_number}"
            )
        ]

        # Save everything in a single transaction
        with self.db.transaction():
            # Update production order
            self.order_repo.update_with_timestamp(
                order_id,
                {
                    "actual_quantity": actual_quantity,
                    "wastage_quantity": wastage_quantity,
                    "output_batch_number": output_batch_number,
                    "production_cost": float(total_raw_cost),
                    "status": "COMPLETED",
                    "completed_at": datetime.now().isoformat(),
                }
            )

            # Create consumption records
            for material in required_materials:
                consumption = ProductionConsumption(
                    production_order_id=order_id,
                    component_item_id=material["component_item_id"],
                    batch_id=material["batch_id"],
                    quantity_consumed=material["quantity_consumed"],
                    unit_cost=material["unit_cost"],
                )
                self.consumption_repo.insert(consumption.to_dict())

                # Update stock quantity
                self.stock_repo.update_quantity(
                    material["batch_id"],
                    -material["quantity_consumed"]
                )

            # Create or update finished goods stock
            if output_batch_number:
                existing_batch = self.stock_repo.find_by_item_and_warehouse(
                    bom.finished_item_id,
                    order.warehouse_id
                )
                
                if existing_batch:
                    new_qty = existing_batch["quantity_in_stock"] + actual_quantity
                    self.stock_repo.update_quantity(existing_batch["id"], actual_quantity)
                    logger.info(f"Updated existing batch for finished item: +{actual_quantity} (now {new_qty})")
                else:
                    self.stock_repo.create_batch(
                        item_id=bom.finished_item_id,
                        warehouse_id=order.warehouse_id,
                        batch_number=output_batch_number,
                        manufacturing_date=order.manufacturing_date,
                        expiry_date=order.expiry_date,
                        purchase_price=float(total_raw_cost) / actual_quantity,
                        quantity_in_stock=actual_quantity,
                    )
                    logger.info(f"Created new batch for finished item: {actual_quantity}")

            # Post journal entry
            self.accounting_service.post_journal_entry(
                voucher_type=VoucherType.MANUFACTURING,
                entry_date=datetime.now().isoformat(),
                lines=journal_lines,
                source_table="production_orders",
                source_id=order_id,
                narration=f"Production order {order.order_number} completed"
            )

        logger.info("Completed production order %s (id=%s), cost=%.2f", 
                   order.order_number, order_id, total_raw_cost)