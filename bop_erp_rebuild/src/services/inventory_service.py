"""
Inventory Service - Stock management and valuation
Handles stock movements, batch tracking, and inventory valuation.
"""

from typing import Optional, List, Dict, Any, Tuple
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
import uuid

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from models.item import Item, StockBatch, StockMovement, Warehouse
from models.document_status import DocumentStatus
from repositories.item_repository import ItemRepository, StockBatchRepository, StockMovementRepository, WarehouseRepository
from database.connection_manager import get_connection


class InventoryServiceError(Exception):
    """Custom exception for inventory service errors."""
    pass


class InventoryService:
    """
    Handles all inventory operations including stock tracking,
    batch management, and warehouse transfers.
    """
    
    def __init__(self, company_id: str):
        self.company_id = company_id
        self.item_repo = ItemRepository()
        self.batch_repo = StockBatchRepository()
        self.movement_repo = StockMovementRepository()
        self.warehouse_repo = WarehouseRepository()
    
    def get_available_stock(self, item_code: str, warehouse_id: Optional[str] = None) -> Decimal:
        """
        Get available stock quantity for an item.
        
        Args:
            item_code: Item code to check
            warehouse_id: Specific warehouse (None for all warehouses)
            
        Returns:
            Available quantity as Decimal
        """
        conn = None
        try:
            conn = get_connection()
            
            batches = self.batch_repo.get_available_batches(
                conn,
                item_code,
                self.company_id,
                warehouse_id
            )
            
            total_qty = sum(batch.quantity for batch in batches)
            return Decimal(str(total_qty))
            
        finally:
            if conn:
                conn.close()
    
    def get_stock_by_warehouse(self, item_code: str) -> List[Dict[str, Any]]:
        """
        Get stock breakdown by warehouse for an item.
        
        Args:
            item_code: Item code to check
            
        Returns:
            List of dicts with warehouse_id, warehouse_name, quantity
        """
        conn = None
        try:
            conn = get_connection()
            
            batches = self.batch_repo.get_all_batches_for_item(
                conn,
                item_code,
                self.company_id
            )
            
            # Group by warehouse
            warehouse_stock: Dict[str, Dict[str, Any]] = {}
            
            for batch in batches:
                wh_id = batch.warehouse_id
                
                if wh_id not in warehouse_stock:
                    warehouse = self.warehouse_repo.get_by_id(conn, wh_id)
                    warehouse_stock[wh_id] = {
                        'warehouse_id': wh_id,
                        'warehouse_name': warehouse.name if warehouse else 'Unknown',
                        'quantity': Decimal('0')
                    }
                
                warehouse_stock[wh_id]['quantity'] += batch.quantity
            
            return list(warehouse_stock.values())
            
        finally:
            if conn:
                conn.close()
    
    def reserve_stock(
        self,
        item_code: str,
        quantity: Decimal,
        warehouse_id: str,
        reference_type: str,
        reference_id: str
    ) -> List[StockBatch]:
        """
        Reserve stock for a sales order or production order.
        Uses FIFO method to select batches.
        
        Args:
            item_code: Item to reserve
            quantity: Quantity to reserve
            warehouse_id: Warehouse to reserve from
            reference_type: Type of reference (SALES_ORDER, PRODUCTION_ORDER)
            reference_id: ID of the referencing document
            
        Returns:
            List of reserved batches
            
        Raises:
            InventoryServiceError: If insufficient stock available
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            # Get available batches sorted by expiry (FEFO) or creation (FIFO)
            available_batches = self.batch_repo.get_available_batches(
                conn,
                item_code,
                self.company_id,
                warehouse_id
            )
            
            if not available_batches:
                raise InventoryServiceError(f"No stock available for item {item_code}")
            
            total_available = sum(b.quantity for b in available_batches)
            if total_available < quantity:
                raise InventoryServiceError(
                    f"Insufficient stock for {item_code}. Available: {total_available}, Required: {quantity}"
                )
            
            # Reserve from batches (FEFO - First Expiry First Out)
            reserved_batches: List[StockBatch] = []
            remaining_qty = quantity
            
            for batch in available_batches:
                if remaining_qty <= 0:
                    break
                
                qty_to_reserve = min(batch.quantity, remaining_qty)
                
                # Update batch reservation
                batch.reserved_quantity = (batch.reserved_quantity or Decimal('0')) + qty_to_reserve
                self.batch_repo.update(conn, batch)
                
                # Create reservation movement
                movement = StockMovement(
                    id=str(uuid.uuid4()),
                    company_id=self.company_id,
                    item_code=item_code,
                    batch_id=batch.id,
                    warehouse_id=warehouse_id,
                    movement_type='RESERVATION',
                    quantity=-qty_to_reserve,  # Negative for reservation
                    reference_type=reference_type,
                    reference_id=reference_id,
                    movement_date=date.today(),
                    created_at=datetime.now()
                )
                self.movement_repo.create(conn, movement)
                
                reserved_batches.append(batch)
                remaining_qty -= qty_to_reserve
            
            conn.commit()
            return reserved_batches
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise InventoryServiceError(f"Failed to reserve stock: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def release_reservation(
        self,
        item_code: str,
        quantity: Decimal,
        warehouse_id: str,
        reference_type: str,
        reference_id: str
    ) -> None:
        """
        Release previously reserved stock.
        
        Args:
            item_code: Item code
            quantity: Quantity to release
            warehouse_id: Warehouse ID
            reference_type: Original reference type
            reference_id: Original reference ID
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            # Find reserved batches for this reference
            batches = self.batch_repo.get_reserved_batches_for_reference(
                conn,
                item_code,
                self.company_id,
                warehouse_id,
                reference_type,
                reference_id
            )
            
            remaining_qty = quantity
            
            for batch in batches:
                if remaining_qty <= 0:
                    break
                
                qty_to_release = min(batch.reserved_quantity or Decimal('0'), remaining_qty)
                
                # Update batch
                batch.reserved_quantity = (batch.reserved_quantity or Decimal('0')) - qty_to_release
                self.batch_repo.update(conn, batch)
                
                # Create release movement
                movement = StockMovement(
                    id=str(uuid.uuid4()),
                    company_id=self.company_id,
                    item_code=item_code,
                    batch_id=batch.id,
                    warehouse_id=warehouse_id,
                    movement_type='RELEASE',
                    quantity=qty_to_release,
                    reference_type=reference_type,
                    reference_id=reference_id,
                    movement_date=date.today(),
                    created_at=datetime.now()
                )
                self.movement_repo.create(conn, movement)
                
                remaining_qty -= qty_to_release
            
            conn.commit()
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise InventoryServiceError(f"Failed to release reservation: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def deduct_stock(
        self,
        item_code: str,
        quantity: Decimal,
        warehouse_id: str,
        reference_type: str,
        reference_id: str,
        batch_ids: Optional[List[str]] = None
    ) -> List[StockBatch]:
        """
        Permanently deduct stock (for sales invoice completion).
        Uses FEFO (First Expiry First Out) if batch_ids not specified.
        
        Args:
            item_code: Item to deduct
            quantity: Quantity to deduct
            warehouse_id: Warehouse to deduct from
            reference_type: Reference document type
            reference_id: Reference document ID
            batch_ids: Specific batches to deduct from (optional)
            
        Returns:
            List of batches deducted from
            
        Raises:
            InventoryServiceError: If insufficient stock
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            if batch_ids:
                # Use specific batches
                batches = [self.batch_repo.get_by_id(conn, bid) for bid in batch_ids]
                batches = [b for b in batches if b and b.warehouse_id == warehouse_id]
            else:
                # Get available batches (FEFO)
                batches = self.batch_repo.get_available_batches(
                    conn,
                    item_code,
                    self.company_id,
                    warehouse_id
                )
            
            total_available = sum(b.quantity - (b.reserved_quantity or Decimal('0')) for b in batches)
            if total_available < quantity:
                raise InventoryServiceError(
                    f"Insufficient stock for {item_code}. Available: {total_available}, Required: {quantity}"
                )
            
            # Deduct from batches
            deducted_batches: List[StockBatch] = []
            remaining_qty = quantity
            
            for batch in batches:
                if remaining_qty <= 0:
                    break
                
                available_in_batch = batch.quantity - (batch.reserved_quantity or Decimal('0'))
                if available_in_batch <= 0:
                    continue
                
                qty_to_deduct = min(available_in_batch, remaining_qty)
                
                # Update batch quantity
                batch.quantity -= qty_to_deduct
                # Reduce reservation if any
                if batch.reserved_quantity and batch.reserved_quantity > 0:
                    batch.reserved_quantity -= min(batch.reserved_quantity, qty_to_deduct)
                
                self.batch_repo.update(conn, batch)
                
                # Create deduction movement
                movement = StockMovement(
                    id=str(uuid.uuid4()),
                    company_id=self.company_id,
                    item_code=item_code,
                    batch_id=batch.id,
                    warehouse_id=warehouse_id,
                    movement_type='OUTWARD',
                    quantity=-qty_to_deduct,
                    reference_type=reference_type,
                    reference_id=reference_id,
                    movement_date=date.today(),
                    created_at=datetime.now()
                )
                self.movement_repo.create(conn, movement)
                
                deducted_batches.append(batch)
                remaining_qty -= qty_to_deduct
            
            conn.commit()
            return deducted_batches
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise InventoryServiceError(f"Failed to deduct stock: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def add_stock(
        self,
        item_code: str,
        quantity: Decimal,
        warehouse_id: str,
        batch_no: str,
        manufacturing_date: Optional[date],
        expiry_date: Optional[date],
        rate: Decimal,
        reference_type: str,
        reference_id: str
    ) -> StockBatch:
        """
        Add stock to inventory (for purchase invoice completion).
        Creates a new batch.
        
        Args:
            item_code: Item code
            quantity: Quantity to add
            warehouse_id: Warehouse to add to
            batch_no: Batch number
            manufacturing_date: Manufacturing date
            expiry_date: Expiry date
            rate: Cost rate per unit
            reference_type: Reference document type
            reference_id: Reference document ID
            
        Returns:
            Created StockBatch
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            # Check if batch already exists
            existing_batch = self.batch_repo.get_by_batch_no(
                conn,
                item_code,
                batch_no,
                self.company_id,
                warehouse_id
            )
            
            if existing_batch:
                # Update existing batch
                existing_batch.quantity += quantity
                # Weighted average rate update
                total_value = (existing_batch.quantity - quantity) * (existing_batch.rate or Decimal('0')) + (quantity * rate)
                existing_batch.rate = total_value / existing_batch.quantity if existing_batch.quantity > 0 else rate
                self.batch_repo.update(conn, existing_batch)
                batch = existing_batch
            else:
                # Create new batch
                batch_id = str(uuid.uuid4())
                batch = StockBatch(
                    id=batch_id,
                    company_id=self.company_id,
                    item_code=item_code,
                    batch_no=batch_no,
                    warehouse_id=warehouse_id,
                    quantity=quantity,
                    rate=rate.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
                    manufacturing_date=manufacturing_date,
                    expiry_date=expiry_date,
                    is_active=True,
                    created_at=datetime.now()
                )
                self.batch_repo.create(conn, batch)
            
            # Create inward movement
            movement = StockMovement(
                id=str(uuid.uuid4()),
                company_id=self.company_id,
                item_code=item_code,
                batch_id=batch.id,
                warehouse_id=warehouse_id,
                movement_type='INWARD',
                quantity=quantity,
                reference_type=reference_type,
                reference_id=reference_id,
                movement_date=date.today(),
                created_at=datetime.now()
            )
            self.movement_repo.create(conn, movement)
            
            conn.commit()
            return batch
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise InventoryServiceError(f"Failed to add stock: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def transfer_stock(
        self,
        item_code: str,
        quantity: Decimal,
        from_warehouse_id: str,
        to_warehouse_id: str,
        batch_no: Optional[str] = None,
        reference_no: str = ""
    ) -> Tuple[StockMovement, StockMovement]:
        """
        Transfer stock between warehouses.
        
        Args:
            item_code: Item to transfer
            quantity: Quantity to transfer
            from_warehouse_id: Source warehouse
            to_warehouse_id: Destination warehouse
            batch_no: Specific batch to transfer (optional, uses FEFO if not specified)
            reference_no: Reference number for the transfer
            
        Returns:
            Tuple of (outward_movement, inward_movement)
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            # Get batch to transfer
            if batch_no:
                batch = self.batch_repo.get_by_batch_no(
                    conn,
                    item_code,
                    batch_no,
                    self.company_id,
                    from_warehouse_id
                )
                if not batch:
                    raise InventoryServiceError(f"Batch {batch_no} not found in source warehouse")
            else:
                batches = self.batch_repo.get_available_batches(
                    conn,
                    item_code,
                    self.company_id,
                    from_warehouse_id
                )
                if not batches:
                    raise InventoryServiceError(f"No stock available for {item_code} in source warehouse")
                batch = batches[0]  # Take first available batch
            
            if batch.quantity < quantity:
                raise InventoryServiceError(
                    f"Insufficient stock in batch {batch.batch_no}. Available: {batch.quantity}, Required: {quantity}"
                )
            
            reference_id = str(uuid.uuid4())
            
            # Create outward movement
            outward = StockMovement(
                id=str(uuid.uuid4()),
                company_id=self.company_id,
                item_code=item_code,
                batch_id=batch.id,
                warehouse_id=from_warehouse_id,
                movement_type='TRANSFER_OUT',
                quantity=-quantity,
                reference_type='STOCK_TRANSFER',
                reference_id=reference_id,
                movement_date=date.today(),
                created_at=datetime.now()
            )
            self.movement_repo.create(conn, outward)
            
            # Create or update batch at destination
            dest_batch = self.batch_repo.get_by_batch_no(
                conn,
                item_code,
                batch.batch_no,
                self.company_id,
                to_warehouse_id
            )
            
            if dest_batch:
                dest_batch.quantity += quantity
                self.batch_repo.update(conn, dest_batch)
            else:
                # Create new batch at destination
                dest_batch = StockBatch(
                    id=str(uuid.uuid4()),
                    company_id=self.company_id,
                    item_code=item_code,
                    batch_no=batch.batch_no,
                    warehouse_id=to_warehouse_id,
                    quantity=quantity,
                    rate=batch.rate,
                    manufacturing_date=batch.manufacturing_date,
                    expiry_date=batch.expiry_date,
                    is_active=True,
                    created_at=datetime.now()
                )
                self.batch_repo.create(conn, dest_batch)
            
            # Create inward movement
            inward = StockMovement(
                id=str(uuid.uuid4()),
                company_id=self.company_id,
                item_code=item_code,
                batch_id=dest_batch.id,
                warehouse_id=to_warehouse_id,
                movement_type='TRANSFER_IN',
                quantity=quantity,
                reference_type='STOCK_TRANSFER',
                reference_id=reference_id,
                movement_date=date.today(),
                created_at=datetime.now()
            )
            self.movement_repo.create(conn, inward)
            
            # Update source batch
            batch.quantity -= quantity
            self.batch_repo.update(conn, batch)
            
            conn.commit()
            return (outward, inward)
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise InventoryServiceError(f"Failed to transfer stock: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def get_stock_summary(self, as_of_date: Optional[date] = None) -> List[Dict[str, Any]]:
        """
        Get stock summary report.
        
        Args:
            as_of_date: Date for stock snapshot (None for current)
            
        Returns:
            List of items with quantities and values
        """
        conn = None
        try:
            conn = get_connection()
            
            items = self.item_repo.get_all_active(conn, self.company_id)
            summary = []
            
            for item in items:
                batches = self.batch_repo.get_all_batches_for_item(
                    conn,
                    item.code,
                    self.company_id
                )
                
                total_qty = sum(b.quantity for b in batches)
                total_value = sum(b.quantity * (b.rate or Decimal('0')) for b in batches)
                
                if total_qty > 0:
                    summary.append({
                        'item_code': item.code,
                        'item_name': item.name,
                        'category': item.category,
                        'uom': item.uom,
                        'total_quantity': total_qty,
                        'total_value': total_value,
                        'average_rate': total_value / total_qty if total_qty > 0 else Decimal('0')
                    })
            
            return summary
            
        finally:
            if conn:
                conn.close()
