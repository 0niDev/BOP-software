"""
Manufacturing Service - Production order management and BOM processing
Handles production planning, material consumption, and finished goods creation.
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
import uuid

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from models.manufacturing import ProductionOrder, BomItem, ProductionStatus
from models.document_status import DocumentStatus
from repositories.manufacturing_repository import ProductionOrderRepository, BomRepository
from services.accounting_service import AccountingService
from services.inventory_service import InventoryService
from database.connection_manager import get_connection


class ManufacturingServiceError(Exception):
    """Custom exception for manufacturing service errors."""
    pass


class ManufacturingService:
    """
    Handles complete production lifecycle including:
    - Bill of Materials (BOM) management
    - Production order creation
    - Raw material consumption
    - Finished goods receipt
    - Cost calculation and accounting
    """
    
    def __init__(self, company_id: str):
        self.company_id = company_id
        self.production_repo = ProductionOrderRepository()
        self.bom_repo = BomRepository()
        self.accounting_service = AccountingService(company_id)
        self.inventory_service = InventoryService(company_id)
    
    def create_bom(self, finished_item_code: str, items: List[Dict[str, Any]]) -> None:
        """
        Create or update a Bill of Materials for a finished item.
        
        Args:
            finished_item_code: Code of the finished item
            items: List of dicts with item_code, quantity, uom
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            # Delete existing BOM for this item
            self.bom_repo.delete_for_item(conn, finished_item_code, self.company_id)
            
            # Create new BOM items
            for idx, item_data in enumerate(items):
                bom_item = BomItem(
                    id=str(uuid.uuid4()),
                    company_id=self.company_id,
                    finished_item_code=finished_item_code,
                    raw_item_code=item_data['item_code'],
                    quantity=Decimal(str(item_data['quantity'])),
                    uom=item_data.get('uom', 'PCS'),
                    line_no=idx + 1,
                    is_active=True,
                    created_at=datetime.now()
                )
                self.bom_repo.create(conn, bom_item)
            
            conn.commit()
            self.bom_repo.invalidate_cache()
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise ManufacturingServiceError(f"Failed to create BOM: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def get_bom(self, finished_item_code: str) -> List[BomItem]:
        """
        Get BOM for a finished item.
        """
        conn = None
        try:
            conn = get_connection()
            return self.bom_repo.get_for_item(conn, finished_item_code, self.company_id)
        finally:
            if conn:
                conn.close()
    
    def create_production_order(
        self,
        finished_item_code: str,
        quantity: Decimal,
        warehouse_id: str,
        planned_start_date: date,
        planned_end_date: date,
        remarks: str = ""
    ) -> ProductionOrder:
        """
        Create a new production order.
        
        Args:
            finished_item_code: Item to produce
            quantity: Quantity to produce
            warehouse_id: Warehouse for raw materials and finished goods
            planned_start_date: Planned production start
            planned_end_date: Planned completion date
            remarks: Order remarks
            
        Returns:
            Created ProductionOrder
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            # Get BOM for the item
            bom_items = self.bom_repo.get_for_item(conn, finished_item_code, self.company_id)
            if not bom_items:
                raise ManufacturingServiceError(f"No BOM found for item {finished_item_code}")
            
            # Calculate required raw materials
            required_materials: List[Dict[str, Any]] = []
            for bom_item in bom_items:
                required_qty = bom_item.quantity * quantity
                
                # Check stock availability
                available_stock = self.inventory_service.get_available_stock(
                    bom_item.raw_item_code,
                    warehouse_id
                )
                
                required_materials.append({
                    'item_code': bom_item.raw_item_code,
                    'required_qty': required_qty,
                    'available_qty': available_stock,
                    'is_available': available_stock >= required_qty
                })
            
            # Generate production order number
            last_order = self.production_repo.get_last_order(conn, self.company_id, planned_start_date.year)
            sequence = (int(last_order.split('-')[-1]) + 1) if last_order else 1
            order_no = f"PO-{planned_start_date.year}-{sequence:05d}"
            
            # Create production order
            order_id = str(uuid.uuid4())
            order = ProductionOrder(
                id=order_id,
                company_id=self.company_id,
                order_no=order_no,
                finished_item_code=finished_item_code,
                quantity_to_produce=quantity,
                quantity_produced=Decimal('0'),
                warehouse_id=warehouse_id,
                status=ProductionStatus.PLANNED,
                planned_start_date=planned_start_date,
                planned_end_date=planned_end_date,
                actual_start_date=None,
                actual_end_date=None,
                remarks=remarks,
                created_at=datetime.now()
            )
            
            self.production_repo.create(conn, order)
            
            # Store required materials (would be in a separate table in full implementation)
            # For now, they're calculated from BOM when needed
            
            conn.commit()
            return order
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise ManufacturingServiceError(f"Failed to create production order: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def start_production(self, order_id: str) -> ProductionOrder:
        """
        Start a production order and reserve raw materials.
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            order = self.production_repo.get_by_id(conn, order_id)
            if not order:
                raise ManufacturingServiceError(f"Production order {order_id} not found")
            
            if order.status != ProductionStatus.PLANNED:
                raise ManufacturingServiceError(f"Order {order_id} is not in PLANNED status")
            
            # Get BOM items
            bom_items = self.bom_repo.get_for_item(conn, order.finished_item_code, self.company_id)
            
            # Reserve raw materials
            for bom_item in bom_items:
                required_qty = bom_item.quantity * order.quantity_to_produce
                
                self.inventory_service.reserve_stock(
                    item_code=bom_item.raw_item_code,
                    quantity=required_qty,
                    warehouse_id=order.warehouse_id,
                    reference_type='PRODUCTION_ORDER',
                    reference_id=order_id
                )
            
            # Update order status
            order.status = ProductionStatus.IN_PROGRESS
            order.actual_start_date = date.today()
            self.production_repo.update(conn, order)
            
            conn.commit()
            return order
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise ManufacturingServiceError(f"Failed to start production: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def complete_production(
        self,
        order_id: str,
        actual_quantity: Decimal,
        batch_no: str,
        manufacturing_date: date,
        expiry_date: Optional[date] = None
    ) -> ProductionOrder:
        """
        Complete a production order.
        Consumes raw materials and creates finished goods.
        
        Args:
            order_id: Production order ID
            actual_quantity: Actual quantity produced
            batch_no: Batch number for finished goods
            manufacturing_date: Manufacturing date
            expiry_date: Expiry date (optional)
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            order = self.production_repo.get_by_id(conn, order_id)
            if not order:
                raise ManufacturingServiceError(f"Production order {order_id} not found")
            
            if order.status != ProductionStatus.IN_PROGRESS:
                raise ManufacturingServiceError(f"Order {order_id} is not IN PROGRESS")
            
            # Get BOM items
            bom_items = self.bom_repo.get_for_item(conn, order.finished_item_code, self.company_id)
            
            # Consume raw materials (proportional to actual production)
            production_ratio = actual_quantity / order.quantity_to_produce
            
            for bom_item in bom_items:
                consumed_qty = (bom_item.quantity * order.quantity_to_produce * production_ratio).quantize(
                    Decimal('0.01'),
                    rounding=ROUND_HALF_UP
                )
                
                # Deduct raw materials (releases reservation and deducts)
                self.inventory_service.deduct_stock(
                    item_code=bom_item.raw_item_code,
                    quantity=consumed_qty,
                    warehouse_id=order.warehouse_id,
                    reference_type='PRODUCTION_CONSUMPTION',
                    reference_id=order_id
                )
            
            # Calculate production cost
            total_material_cost = Decimal('0')
            for bom_item in bom_items:
                consumed_qty = (bom_item.quantity * order.quantity_to_produce * production_ratio).quantize(
                    Decimal('0.01'),
                    rounding=ROUND_HALF_UP
                )
                # Get average rate for the material
                stock_summary = self.inventory_service.get_stock_summary()
                material_rate = Decimal('0')
                for item in stock_summary:
                    if item['item_code'] == bom_item.raw_item_code:
                        material_rate = item['average_rate']
                        break
                
                total_material_cost += consumed_qty * material_rate
            
            # Add finished goods to stock
            fg_rate = (total_material_cost / actual_quantity).quantize(
                Decimal('0.01'),
                rounding=ROUND_HALF_UP
            ) if actual_quantity > 0 else Decimal('0')
            
            self.inventory_service.add_stock(
                item_code=order.finished_item_code,
                quantity=actual_quantity,
                warehouse_id=order.warehouse_id,
                batch_no=batch_no,
                manufacturing_date=manufacturing_date,
                expiry_date=expiry_date,
                rate=fg_rate,
                reference_type='PRODUCTION_COMPLETION',
                reference_id=order_id
            )
            
            # Create journal entry for production
            # Debit: Finished Goods Inventory
            # Credit: Work in Progress (WIP)
            je_lines = [
                {
                    'account_code': '1250-FG',  # Finished Goods account
                    'debit': float(total_material_cost),
                    'credit': 0,
                    'party_id': None,
                    'narration': f'Finished goods for {order.order_no}'
                },
                {
                    'account_code': '1230-WIP',  # Work in Progress account
                    'debit': 0,
                    'credit': float(total_material_cost),
                    'party_id': None,
                    'narration': f'WIP clearing for {order.order_no}'
                }
            ]
            
            self.accounting_service.create_journal_entry(
                voucher_type='JOURNAL',
                voucher_no=order.order_no,
                voucher_date=manufacturing_date,
                lines=je_lines,
                description=f"Production completion {order.order_no} - {actual_quantity} units",
                reference=order_id,
                posted=True
            )
            
            # Update order status
            order.status = ProductionStatus.COMPLETED
            order.quantity_produced = actual_quantity
            order.actual_end_date = date.today()
            self.production_repo.update(conn, order)
            
            conn.commit()
            return order
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise ManufacturingServiceError(f"Failed to complete production: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def cancel_production_order(self, order_id: str, reason: str) -> ProductionOrder:
        """
        Cancel a production order and release reserved materials.
        """
        conn = None
        try:
            conn = get_connection()
            conn.begin_transaction()
            
            order = self.production_repo.get_by_id(conn, order_id)
            if not order:
                raise ManufacturingServiceError(f"Production order {order_id} not found")
            
            if order.status == ProductionStatus.COMPLETED:
                raise ManufacturingServiceError(f"Cannot cancel completed order {order_id}")
            
            if order.status == ProductionStatus.IN_PROGRESS:
                # Release reserved materials
                bom_items = self.bom_repo.get_for_item(conn, order.finished_item_code, self.company_id)
                
                for bom_item in bom_items:
                    required_qty = bom_item.quantity * order.quantity_to_produce
                    
                    self.inventory_service.release_reservation(
                        item_code=bom_item.raw_item_code,
                        quantity=required_qty,
                        warehouse_id=order.warehouse_id,
                        reference_type='PRODUCTION_ORDER',
                        reference_id=order_id
                    )
            
            # Update order status
            order.status = ProductionStatus.CANCELLED
            order.cancellation_remarks = reason
            self.production_repo.update(conn, order)
            
            conn.commit()
            return order
            
        except Exception as e:
            if conn:
                conn.rollback()
            raise ManufacturingServiceError(f"Failed to cancel production order: {str(e)}")
        finally:
            if conn:
                conn.close()
    
    def get_production_orders(
        self,
        status: Optional[ProductionStatus] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None
    ) -> List[ProductionOrder]:
        """
        Get production orders with optional filters.
        """
        conn = None
        try:
            conn = get_connection()
            return self.production_repo.get_orders(conn, self.company_id, status, from_date, to_date)
        finally:
            if conn:
                conn.close()
    
    def get_wip_report(self) -> List[Dict[str, Any]]:
        """
        Get Work in Progress report.
        """
        conn = None
        try:
            conn = get_connection()
            
            # Get all in-progress orders
            orders = self.production_repo.get_orders(
                conn,
                self.company_id,
                ProductionStatus.IN_PROGRESS,
                None,
                None
            )
            
            wip_report = []
            total_wip_value = Decimal('0')
            
            for order in orders:
                bom_items = self.bom_repo.get_for_item(conn, order.finished_item_code, self.company_id)
                
                # Calculate WIP value (materials reserved/consumed)
                wip_value = Decimal('0')
                for bom_item in bom_items:
                    required_qty = bom_item.quantity * order.quantity_to_produce
                    # Get material rate
                    stock_summary = self.inventory_service.get_stock_summary()
                    material_rate = Decimal('0')
                    for item in stock_summary:
                        if item['item_code'] == bom_item.raw_item_code:
                            material_rate = item['average_rate']
                            break
                    wip_value += required_qty * material_rate
                
                wip_report.append({
                    'order_no': order.order_no,
                    'finished_item': order.finished_item_code,
                    'quantity_to_produce': order.quantity_to_produce,
                    'start_date': order.actual_start_date,
                    'wip_value': wip_value
                })
                
                total_wip_value += wip_value
            
            wip_report.append({
                'order_no': 'TOTAL',
                'finished_item': '',
                'quantity_to_produce': Decimal('0'),
                'start_date': None,
                'wip_value': total_wip_value
            })
            
            return wip_report
            
        finally:
            if conn:
                conn.close()
