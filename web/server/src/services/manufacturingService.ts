/**
 * Manufacturing service. Port of create_bom / create_production_order /
 * start_production / complete_production from services/manufacturing_service.py.
 *
 * completeProduction consumes raw/packing stock and posts:
 *   Dr Inventory - Finished Goods      total cost
 *     Cr Inventory - Raw Materials            raw cost
 *     Cr Inventory - Packing Materials        packing cost
 *
 * Note: the Python app's "temporary one-use BOM" path is not ported yet.
 */
import type { SqlDatabase } from "../db/types.js";
import { SystemAccountCodes, type ItemType } from "../domain/enums.js";
import { InsufficientStockError, NotFoundError, ValidationError } from "../domain/errors.js";
import { Decimal, dec, round2, toStorage } from "../domain/money.js";
import { ItemRepository } from "../repositories/itemRepository.js";
import { JournalRepository } from "../repositories/journalRepository.js";
import {
  ManufacturingRepository,
  type BomComponentRow,
  type BomRow,
  type ProductionOrderRow,
} from "../repositories/manufacturingRepository.js";
import { StockBatchRepository } from "../repositories/stockBatchRepository.js";
import { SystemAccountResolver } from "../repositories/systemAccounts.js";
import { AccountingService, type JournalLineInput } from "./accountingService.js";

export interface BomComponentInput {
  componentItemId: number;
  quantityRequired: number | string;
  wastagePercent?: number | string;
}

export interface CreateBomInput {
  finishedItemId: number;
  outputQuantity: number | string;
  components: readonly BomComponentInput[];
  bomName?: string | null;
  notes?: string | null;
  companyId?: number;
}

export interface CreateProductionOrderInput {
  bomId: number;
  plannedQuantity: number | string;
  manufacturingDate: string;
  orderNumber?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  warehouseId?: number;
  createdBy?: number | null;
  companyId?: number;
}

export interface CompleteProductionInput {
  actualQuantity: number | string;
  wastageQuantity?: number | string;
  outputBatchNumber?: string | null;
}

interface ValidatedComponent {
  componentItemId: number;
  quantityRequired: Decimal;
  wastagePercent: Decimal;
}

export class ManufacturingService {
  private readonly items: ItemRepository;
  private readonly batches: StockBatchRepository;
  private readonly manufacturing: ManufacturingRepository;
  private readonly journal: JournalRepository;
  private readonly accounting: AccountingService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.items = new ItemRepository(db);
    this.batches = new StockBatchRepository(db);
    this.manufacturing = new ManufacturingRepository(db);
    this.journal = new JournalRepository(db);
    this.accounting = new AccountingService(db, companyId);
  }

  // --- BOM ---------------------------------------------------------------
  async listBoms(): Promise<BomRow[]> {
    return this.manufacturing.listBoms(this.companyId);
  }

  async getBom(id: number): Promise<{ bom: BomRow; components: BomComponentRow[] }> {
    const bom = await this.manufacturing.findBomById(id);
    if (!bom) throw new NotFoundError(`BOM ${id} not found.`);
    const components = await this.manufacturing.findBomComponents(id);
    return { bom, components };
  }

  async createBom(input: CreateBomInput): Promise<{ id: number; bomName: string }> {
    const companyId = input.companyId ?? this.companyId;
    const finished = await this.items.requireById(input.finishedItemId);
    if (finished.item_type !== "FINISHED_GOOD") {
      throw new ValidationError("Finished item must be of type FINISHED_GOOD.");
    }
    const outputQuantity = dec(input.outputQuantity);
    if (outputQuantity.lessThanOrEqualTo(0)) {
      throw new ValidationError("Output quantity must be greater than 0.");
    }
    if (!input.components || input.components.length === 0) {
      throw new ValidationError("At least one component is required.");
    }

    const name = input.bomName?.trim() || null;
    if (name && (await this.manufacturing.findBomByName(name, companyId))) {
      throw new ValidationError(`BOM name '${name}' already exists.`);
    }

    const components = await this.validateComponents(input.components);

    return this.db.transaction(async () => {
      const bomName = name ?? (await this.journal.nextVoucherNumber(companyId, "BOM"));
      const bomId = await this.manufacturing.insertBom({
        company_id: companyId,
        finished_item_id: finished.id,
        bom_name: bomName,
        output_quantity: toStorage(outputQuantity),
        notes: input.notes ?? null,
        is_active: 1,
      });
      for (const component of components) {
        await this.manufacturing.insertBomComponent({
          bom_id: bomId,
          component_item_id: component.componentItemId,
          quantity_required: toStorage(component.quantityRequired),
          wastage_percent: toStorage(component.wastagePercent),
        });
      }
      return { id: bomId, bomName };
    });
  }

  private async validateComponents(
    components: readonly BomComponentInput[],
  ): Promise<ValidatedComponent[]> {
    const validated: ValidatedComponent[] = [];
    for (const raw of components) {
      const quantityRequired = dec(raw.quantityRequired);
      if (!raw.componentItemId || quantityRequired.lessThanOrEqualTo(0)) {
        throw new ValidationError("Each component requires an item and quantity.");
      }
      const item = await this.items.requireById(raw.componentItemId);
      if (item.item_type !== "RAW_MATERIAL" && item.item_type !== "PACKING_MATERIAL") {
        throw new ValidationError(
          `Component '${item.item_name}' must be RAW_MATERIAL or PACKING_MATERIAL.`,
        );
      }
      const wastagePercent = dec(raw.wastagePercent ?? 0);
      if (wastagePercent.lessThan(0) || wastagePercent.greaterThan(100)) {
        throw new ValidationError("Wastage percentage must be between 0 and 100.");
      }
      validated.push({ componentItemId: item.id, quantityRequired, wastagePercent });
    }
    return validated;
  }

  // --- Production orders -------------------------------------------------
  async listProductionOrders(): Promise<ProductionOrderRow[]> {
    return this.manufacturing.listOrders(this.companyId);
  }

  async getProductionOrder(
    id: number,
  ): Promise<{ order: ProductionOrderRow; consumptions: Record<string, unknown>[] }> {
    const order = await this.manufacturing.findOrderById(id);
    if (!order) throw new NotFoundError(`Production order ${id} not found.`);
    const consumptions = await this.manufacturing.findConsumptions(id);
    return { order, consumptions };
  }

  async createProductionOrder(
    input: CreateProductionOrderInput,
  ): Promise<{ id: number; orderNumber: string }> {
    const companyId = input.companyId ?? this.companyId;
    const warehouseId = input.warehouseId ?? 1;
    const plannedQuantity = dec(input.plannedQuantity);
    if (plannedQuantity.lessThanOrEqualTo(0)) {
      throw new ValidationError("Planned quantity must be greater than 0.");
    }

    const bom = await this.manufacturing.findBomById(input.bomId);
    if (!bom) throw new ValidationError("BOM does not exist.");
    if (!bom.is_active) throw new ValidationError("BOM is not active.");

    let orderNumber = input.orderNumber?.trim() || "";
    if (orderNumber) {
      if (await this.manufacturing.orderNumberExists(orderNumber, companyId)) {
        throw new ValidationError(`Order number '${orderNumber}' already exists.`);
      }
    } else {
      orderNumber = await this.journal.nextVoucherNumber(companyId, "PRODUCTION_ORDER");
    }

    const id = await this.manufacturing.insertOrder({
      company_id: companyId,
      warehouse_id: warehouseId,
      order_number: orderNumber,
      bom_id: bom.id,
      planned_quantity: toStorage(plannedQuantity),
      manufacturing_date: input.manufacturingDate,
      expiry_date: input.expiryDate ?? null,
      notes: input.notes ?? null,
      created_by: input.createdBy ?? null,
      status: "DRAFT",
    });
    return { id, orderNumber };
  }

  async startProduction(orderId: number): Promise<void> {
    const order = await this.manufacturing.findOrderById(orderId);
    if (!order) throw new NotFoundError(`Production order ${orderId} not found.`);
    if (order.status !== "DRAFT") {
      throw new ValidationError(`Cannot start an order with status '${order.status}'.`);
    }
    await this.manufacturing.updateOrder(orderId, { status: "IN_PROGRESS" });
  }

  async completeProduction(
    orderId: number,
    input: CompleteProductionInput,
  ): Promise<{ id: number; productionCost: number; journalEntryId: number }> {
    const order = await this.manufacturing.findOrderById(orderId);
    if (!order) throw new NotFoundError(`Production order ${orderId} not found.`);
    if (order.status !== "IN_PROGRESS") {
      throw new ValidationError(`Cannot complete order with status '${order.status}'.`);
    }
    const actualQuantity = dec(input.actualQuantity);
    if (actualQuantity.lessThanOrEqualTo(0)) {
      throw new ValidationError("Actual quantity must be greater than 0.");
    }
    const wastageQuantity = dec(input.wastageQuantity ?? 0);
    if (wastageQuantity.lessThan(0)) {
      throw new ValidationError("Wastage quantity cannot be negative.");
    }

    const bom = await this.manufacturing.findBomById(order.bom_id);
    if (!bom) throw new ValidationError("BOM not found.");
    const bomComponents = await this.manufacturing.findBomComponents(bom.id);
    const ratio = actualQuantity.dividedBy(dec(bom.output_quantity));

    let rawCost = new Decimal(0);
    let packingCost = new Decimal(0);
    const materials: Array<{
      componentItemId: number;
      batchId: number;
      quantity: Decimal;
      unitCost: Decimal;
      isPacking: boolean;
    }> = [];

    for (const component of bomComponents) {
      const requiredQty = dec(component.quantity_required).times(ratio);
      const wastageQty = requiredQty.times(dec(component.wastage_percent).dividedBy(100));
      const totalRequired = requiredQty.plus(wastageQty);

      const batch = await this.batches.findByItemAndWarehouse(
        component.component_item_id,
        order.warehouse_id,
      );
      const item = await this.items.requireById(component.component_item_id);
      if (!batch) {
        throw new InsufficientStockError(
          `No stock batch found for ${item.item_name}. Required: ${totalRequired.toFixed(2)}`,
        );
      }
      if (dec(batch.quantity_in_stock).lessThan(totalRequired)) {
        throw new InsufficientStockError(
          `Insufficient stock for ${item.item_name}. Required: ${totalRequired.toFixed(2)}, available: ${dec(batch.quantity_in_stock).toFixed(2)}`,
        );
      }
      const unitCost = dec(batch.purchase_price);
      const materialCost = round2(totalRequired.times(unitCost));
      const isPacking = item.item_type === "PACKING_MATERIAL";
      if (isPacking) packingCost = packingCost.plus(materialCost);
      else rawCost = rawCost.plus(materialCost);

      materials.push({
        componentItemId: component.component_item_id,
        batchId: batch.id,
        quantity: totalRequired,
        unitCost,
        isPacking,
      });
    }

    const totalCost = rawCost.plus(packingCost);
    const resolver = new SystemAccountResolver(this.db, this.companyId);
    const finishedId = await resolver.idFor(SystemAccountCodes.INVENTORY_FINISHED_GOODS);

    const journalLines: JournalLineInput[] = [
      {
        accountId: finishedId,
        debit: totalCost,
        description: `Production output - ${order.order_number}`,
      },
    ];
    if (rawCost.greaterThan(0)) {
      journalLines.push({
        accountId: await resolver.idFor(SystemAccountCodes.INVENTORY_RAW_MATERIALS),
        credit: rawCost,
        description: `Raw materials consumed - ${order.order_number}`,
      });
    }
    if (packingCost.greaterThan(0)) {
      journalLines.push({
        accountId: await resolver.idFor(SystemAccountCodes.INVENTORY_PACKING_MATERIALS),
        credit: packingCost,
        description: `Packing materials consumed - ${order.order_number}`,
      });
    }

    return this.db.transaction(async () => {
      await this.manufacturing.updateOrder(orderId, {
        actual_quantity: toStorage(actualQuantity),
        wastage_quantity: toStorage(wastageQuantity),
        output_batch_number: input.outputBatchNumber ?? null,
        production_cost: toStorage(totalCost),
        raw_material_cost: toStorage(rawCost),
        packing_material_cost: toStorage(packingCost),
        status: "COMPLETED",
        completed_at: new Date().toISOString(),
      });

      for (const material of materials) {
        await this.manufacturing.insertConsumption({
          production_order_id: orderId,
          component_item_id: material.componentItemId,
          batch_id: material.batchId,
          quantity_consumed: toStorage(material.quantity),
          unit_cost: toStorage(material.unitCost),
        });
        await this.batches.adjustQuantity(material.batchId, material.quantity.negated().toNumber());
      }

      if (input.outputBatchNumber) {
        const unitCost = totalCost.dividedBy(actualQuantity);
        const rawUnit = rawCost.dividedBy(actualQuantity);
        const packingUnit = packingCost.dividedBy(actualQuantity);
        const existing = await this.batches.findByItemAndWarehouse(
          bom.finished_item_id,
          order.warehouse_id,
        );
        if (existing) {
          await this.batches.addToBatch(existing.id, toStorage(actualQuantity), {
            purchasePrice: toStorage(unitCost),
            rawUnitCost: toStorage(rawUnit),
            packingUnitCost: toStorage(packingUnit),
          });
        } else {
          await this.batches.insert({
            item_id: bom.finished_item_id,
            warehouse_id: order.warehouse_id,
            batch_number: input.outputBatchNumber,
            manufacturing_date: order.manufacturing_date,
            expiry_date: order.expiry_date,
            purchase_price: toStorage(unitCost),
            raw_unit_cost: toStorage(rawUnit),
            packing_unit_cost: toStorage(packingUnit),
            quantity_in_stock: toStorage(actualQuantity),
            is_active: 1,
          });
        }
      }

      const journalEntryId = await this.accounting.postJournalEntry({
        voucherType: "MANUFACTURING",
        entryDate: new Date().toISOString().slice(0, 10),
        lines: journalLines,
        sourceTable: "production_orders",
        sourceId: orderId,
        narration: `Production order ${order.order_number} completed`,
        companyId: this.companyId,
      });

      return {
        id: orderId,
        productionCost: toStorage(totalCost),
        journalEntryId,
      };
    });
  }
}
