/**
 * Manufacturing service. Port of create_bom / create_production_order /
 * start_production / complete_production from services/manufacturing_service.py.
 *
 * completeProduction consumes raw/packing stock and posts:
 *   Dr Inventory - Finished Goods      total cost
 *     Cr Inventory - Raw Materials            raw cost
 *     Cr Inventory - Packing Materials        packing cost
 *
 * createProductionOrder also supports the Python app's "temporary one-use BOM"
 * path: pass `tempFinishedItemId` + `tempComponents` instead of a saved BOM and
 * a hidden BOM flagged `is_temp = 1`, named `TEMP-<order number>`, is created and
 * linked to the order. Those BOMs never appear in the BOM list.
 */
import type { SqlDatabase } from "../db/types.js";
import { SystemAccountCodes, type ItemType } from "../domain/enums.js";
import { InsufficientStockError, NotFoundError, ValidationError } from "../domain/errors.js";
import { Decimal, dec, round2, toQuantity, toStorage } from "../domain/money.js";
import { insertRow } from "../repositories/base.js";
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

export interface UpdateBomInput {
  finishedItemId: number;
  outputQuantity: number | string;
  components: readonly BomComponentInput[];
  bomName?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface CreateProductionOrderInput {
  /** Saved BOM to produce from — omit for a temporary one-use production. */
  bomId?: number | null;
  plannedQuantity: number | string;
  manufacturingDate: string;
  orderNumber?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  warehouseId?: number;
  createdBy?: number | null;
  companyId?: number;
  /** Temporary (one-use) production: the finished item to make … */
  tempFinishedItemId?: number | null;
  /** … and the raw/packing materials consumed, as for a BOM. */
  tempComponents?: readonly BomComponentInput[] | null;
}

export interface CompleteProductionInput {
  actualQuantity: number | string;
  wastageQuantity?: number | string;
  outputBatchNumber?: string | null;
  /** Skip the component stock check and deduction (e.g. stock not entered yet). */
  ignoreStock?: boolean;
}

export interface UpdateProductionOrderInput {
  bomId: number;
  plannedQuantity: number | string;
  manufacturingDate: string;
  expiryDate?: string | null;
  notes?: string | null;
}

export interface PackProductionInput {
  outputBatchNumber?: string | null;
  ignoreStock?: boolean;
  /** How much of the unpacked stock to pack now. Omit to pack all of it. */
  quantity?: number | string;
  /** Packing materials chosen by the user. Omit to fall back to the BOM. */
  materials?: readonly { itemId: number; quantity: number | string }[];
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

  async updateBom(id: number, input: UpdateBomInput): Promise<{ id: number; bomName: string }> {
    const existing = await this.manufacturing.findBomById(id);
    if (!existing) throw new NotFoundError(`BOM ${id} not found.`);
    if (existing.is_temp) {
      throw new ValidationError("A temporary one-use BOM cannot be edited.");
    }

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
    const bomName = input.bomName?.trim() || existing.bom_name;
    if (bomName !== existing.bom_name) {
      if (await this.manufacturing.findBomByName(bomName, this.companyId)) {
        throw new ValidationError(`BOM name '${bomName}' already exists.`);
      }
    }
    const components = await this.validateComponents(input.components);

    await this.db.transaction(async () => {
      await this.manufacturing.updateBom(id, {
        finished_item_id: finished.id,
        bom_name: bomName,
        output_quantity: toStorage(outputQuantity),
        notes: input.notes ?? existing.notes,
        is_active: input.isActive === false ? 0 : existing.is_active,
      });
      await this.manufacturing.deleteBomComponents(id);
      for (const component of components) {
        await this.manufacturing.insertBomComponent({
          bom_id: id,
          component_item_id: component.componentItemId,
          quantity_required: toStorage(component.quantityRequired),
          wastage_percent: toStorage(component.wastagePercent),
        });
      }
    });
    return { id, bomName };
  }

  async deleteBom(id: number): Promise<void> {
    const existing = await this.manufacturing.findBomById(id);
    if (!existing) throw new NotFoundError(`BOM ${id} not found.`);
    if (existing.is_temp) {
      throw new ValidationError("A temporary one-use BOM cannot be deleted on its own.");
    }
    if ((await this.manufacturing.countOrdersUsingBom(id)) > 0) {
      throw new ValidationError("Cannot delete a BOM that is used by production orders.");
    }
    await this.db.transaction(async () => {
      await this.manufacturing.deleteBomComponents(id);
      await this.manufacturing.deleteBom(id);
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
  ): Promise<{ id: number; orderNumber: string; bomId: number }> {
    const companyId = input.companyId ?? this.companyId;
    const warehouseId = input.warehouseId ?? 1;
    const plannedQuantity = dec(input.plannedQuantity);
    if (plannedQuantity.lessThanOrEqualTo(0)) {
      throw new ValidationError("Planned quantity must be greater than 0.");
    }

    // Temporary one-use production: a hidden BOM is created for the order.
    if (input.tempFinishedItemId != null && input.tempComponents != null) {
      const finished = await this.items.requireById(input.tempFinishedItemId);
      if (finished.item_type !== "FINISHED_GOOD") {
        throw new ValidationError("Finished item must be of type FINISHED_GOOD.");
      }
      if (input.tempComponents.length === 0) {
        throw new ValidationError("At least one component is required.");
      }
      const components = await this.validateComponents(input.tempComponents);

      return this.db.transaction(async () => {
        // The order number is allocated inside the transaction so a failure
        // rolls the sequence back with the rows (no gaps), exactly like the
        // Python app's temporary-BOM path.
        const orderNumber = await this.resolveOrderNumber(input.orderNumber, companyId);
        const bomId = await this.manufacturing.insertBom({
          company_id: companyId,
          finished_item_id: finished.id,
          bom_name: `TEMP-${orderNumber}`,
          output_quantity: 1,
          notes: "Temporary one-use BOM",
          is_active: 1,
          is_temp: 1,
        });
        for (const component of components) {
          await this.manufacturing.insertBomComponent({
            bom_id: bomId,
            component_item_id: component.componentItemId,
            quantity_required: toStorage(component.quantityRequired),
            wastage_percent: toStorage(component.wastagePercent),
          });
        }
        const id = await this.manufacturing.insertOrder({
          company_id: companyId,
          warehouse_id: warehouseId,
          order_number: orderNumber,
          bom_id: bomId,
          planned_quantity: toStorage(plannedQuantity),
          manufacturing_date: input.manufacturingDate,
          expiry_date: input.expiryDate ?? null,
          notes: input.notes ?? null,
          created_by: input.createdBy ?? null,
          status: "DRAFT",
        });
        return { id, orderNumber, bomId };
      });
    }

    const orderNumber = await this.resolveOrderNumber(input.orderNumber, companyId);
    if (input.bomId == null) {
      throw new ValidationError("A BOM is required for a saved production order.");
    }
    const bom = await this.manufacturing.findBomById(input.bomId);
    if (!bom) throw new ValidationError("BOM does not exist.");
    if (!bom.is_active) throw new ValidationError("BOM is not active.");

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
    return { id, orderNumber, bomId: bom.id };
  }

  async updateProductionOrder(id: number, input: UpdateProductionOrderInput): Promise<void> {
    const order = await this.manufacturing.findOrderById(id);
    if (!order) throw new NotFoundError(`Production order ${id} not found.`);
    if (order.status !== "DRAFT") {
      throw new ValidationError(`Cannot edit an order with status '${order.status}'.`);
    }
    const plannedQuantity = dec(input.plannedQuantity);
    if (plannedQuantity.lessThanOrEqualTo(0)) {
      throw new ValidationError("Planned quantity must be greater than 0.");
    }
    const bom = await this.manufacturing.findBomById(input.bomId);
    if (!bom) throw new ValidationError("BOM does not exist.");
    if (!bom.is_active) throw new ValidationError("BOM is not active.");

    await this.manufacturing.updateOrder(id, {
      bom_id: bom.id,
      planned_quantity: toStorage(plannedQuantity),
      manufacturing_date: input.manufacturingDate,
      expiry_date: input.expiryDate ?? null,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    });
  }

  async deleteProductionOrder(id: number): Promise<void> {
    const order = await this.manufacturing.findOrderById(id);
    if (!order) throw new NotFoundError(`Production order ${id} not found.`);
    if (order.status !== "DRAFT") {
      throw new ValidationError(`Cannot delete an order with status '${order.status}'.`);
    }
    await this.manufacturing.deleteOrder(id);
  }

  /** Explicit order number (rejected if taken) or the next PRODUCTION_ORDER one. */
  private async resolveOrderNumber(
    requested: string | null | undefined,
    companyId: number,
  ): Promise<string> {
    const orderNumber = requested?.trim() || "";
    if (!orderNumber) {
      return this.journal.nextVoucherNumber(companyId, "PRODUCTION_ORDER");
    }
    if (await this.manufacturing.orderNumberExists(orderNumber, companyId)) {
      throw new ValidationError(`Order number '${orderNumber}' already exists.`);
    }
    return orderNumber;
  }

  async startProduction(orderId: number): Promise<void> {
    const order = await this.manufacturing.findOrderById(orderId);
    if (!order) throw new NotFoundError(`Production order ${orderId} not found.`);
    if (order.status !== "DRAFT") {
      throw new ValidationError(`Cannot start an order with status '${order.status}'.`);
    }
    await this.manufacturing.updateOrder(orderId, { status: "IN_PROGRESS" });
  }

  /** Stage 1: consume raw materials and put an unpacked batch of the finished good into stock. */
  async produceProduction(
    orderId: number,
    input: CompleteProductionInput,
  ): Promise<{ id: number; productionCost: number; journalEntryId: number }> {
    const order = await this.manufacturing.findOrderById(orderId);
    if (!order) throw new NotFoundError(`Production order ${orderId} not found.`);
    if (order.status !== "IN_PROGRESS") {
      throw new ValidationError(`Cannot produce an order with status '${order.status}'.`);
    }
    if (dec(order.actual_quantity).greaterThan(0)) {
      throw new ValidationError("This order has already been produced; use Pack.");
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
    const materials: Array<{
      componentItemId: number;
      batchId: number | null;
      quantity: Decimal;
      unitCost: Decimal;
    }> = [];

    for (const component of bomComponents) {
      const item = await this.items.requireById(component.component_item_id);
      // Packing materials are consumed in the second stage, after the good exists.
      if (item.item_type === "PACKING_MATERIAL") continue;

      const requiredQty = dec(component.quantity_required).times(ratio);
      const wastageQty = requiredQty.times(dec(component.wastage_percent).dividedBy(100));
      const totalRequired = requiredQty.plus(wastageQty);

      const batch = await this.batches.findByItemAndWarehouse(
        component.component_item_id,
        order.warehouse_id,
      );
      if (!input.ignoreStock) {
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
      }
      const unitCost = dec(batch?.purchase_price ?? item.purchase_price);
      rawCost = rawCost.plus(round2(totalRequired.times(unitCost)));
      materials.push({
        componentItemId: component.component_item_id,
        batchId: batch?.id ?? null,
        quantity: totalRequired,
        unitCost,
      });
    }

    const resolver = new SystemAccountResolver(this.db, this.companyId);
    const journalLines: JournalLineInput[] = [];
    if (rawCost.greaterThan(0)) {
      journalLines.push({
        accountId: await resolver.idFor(SystemAccountCodes.INVENTORY_FINISHED_GOODS),
        debit: rawCost,
        description: `Unpacked production output - ${order.order_number}`,
      });
      journalLines.push({
        accountId: await resolver.idFor(SystemAccountCodes.INVENTORY_RAW_MATERIALS),
        credit: rawCost,
        description: `Raw materials consumed - ${order.order_number}`,
      });
    }

    const unpackedName = await this.unpackedBatchName(order, input.outputBatchNumber, bom.finished_item_id);

    return this.db.transaction(async () => {
      await this.manufacturing.updateOrder(orderId, {
        actual_quantity: toQuantity(actualQuantity),
        wastage_quantity: toQuantity(wastageQuantity),
        output_batch_number: unpackedName,
        production_cost: toStorage(rawCost),
        raw_material_cost: toStorage(rawCost),
        packing_material_cost: 0,
      });

      for (const material of materials) {
        if (input.ignoreStock || material.batchId === null) continue;
        await this.manufacturing.insertConsumption({
          production_order_id: orderId,
          component_item_id: material.componentItemId,
          batch_id: material.batchId,
          quantity_consumed: toQuantity(material.quantity),
          unit_cost: toStorage(material.unitCost),
        });
        await this.batches.adjustQuantity(material.batchId, -toQuantity(material.quantity));
        await insertRow(this.db, "stock_movements", {
          item_id: material.componentItemId,
          batch_id: material.batchId,
          warehouse_id: order.warehouse_id,
          movement_type: "PRODUCTION_CONSUME",
          quantity: -toQuantity(material.quantity),
          unit_cost: toStorage(material.unitCost),
          reference_table: "production_orders",
          reference_id: orderId,
          movement_date: order.manufacturing_date,
          notes: `Production order ${order.order_number} (unpacked stage)`,
        });
      }

      // The intermediate batch is explicitly marked UNPACKED- and is hidden
      // from FIFO/sales until the packing stage renames it.
      const rawUnit = rawCost.dividedBy(actualQuantity);
      const outputBatchId = await this.batches.insert({
        item_id: bom.finished_item_id,
        warehouse_id: order.warehouse_id,
        batch_number: unpackedName,
        manufacturing_date: order.manufacturing_date,
        expiry_date: order.expiry_date,
        purchase_price: toStorage(rawUnit),
        raw_unit_cost: toStorage(rawUnit),
        packing_unit_cost: 0,
        quantity_in_stock: toQuantity(actualQuantity),
        is_active: 1,
      });
      await insertRow(this.db, "stock_movements", {
        item_id: bom.finished_item_id,
        batch_id: outputBatchId,
        warehouse_id: order.warehouse_id,
        movement_type: "PRODUCTION_IN",
        quantity: toQuantity(actualQuantity),
        unit_cost: toStorage(rawUnit),
        reference_table: "production_orders",
        reference_id: orderId,
        movement_date: order.manufacturing_date,
        notes: `Production order ${order.order_number} (unpacked)`,
      });

      const journalEntryId = journalLines.length
        ? await this.accounting.postJournalEntry({
            voucherType: "MANUFACTURING",
            entryDate: new Date().toISOString().slice(0, 10),
            lines: journalLines,
            sourceTable: "production_orders",
            sourceId: orderId,
            narration: `Production order ${order.order_number} produced (unpacked)`,
            companyId: this.companyId,
          })
        : 0;

      return { id: orderId, productionCost: toStorage(rawCost), journalEntryId };
    });
  }

  /** Stage 2: consume packing materials and turn the unpacked batch into saleable finished goods. */
  async packProduction(
    orderId: number,
    input: PackProductionInput = {},
  ): Promise<{ id: number; productionCost: number; journalEntryId: number }> {
    const order = await this.manufacturing.findOrderById(orderId);
    if (!order) throw new NotFoundError(`Production order ${orderId} not found.`);
    if (order.status !== "IN_PROGRESS") {
      throw new ValidationError(`Cannot pack an order with status '${order.status}'.`);
    }
    if (dec(order.actual_quantity).lessThanOrEqualTo(0)) {
      throw new ValidationError("Produce this order before packing.");
    }
    const unpackedName = order.output_batch_number;
    if (!unpackedName || !unpackedName.startsWith("UNPACKED-")) {
      throw new ValidationError("This order has no unpacked batch to pack.");
    }

    const bom = await this.manufacturing.findBomById(order.bom_id);
    if (!bom) throw new ValidationError("BOM not found.");
    const bomComponents = await this.manufacturing.findBomComponents(bom.id);

    const unpackedBatch = await this.batches.findByNumber(
      bom.finished_item_id,
      order.warehouse_id,
      unpackedName,
    );
    if (!unpackedBatch) {
      throw new ValidationError("The unpacked output batch is missing from stock.");
    }
    const available = dec(unpackedBatch.quantity_in_stock);
    const packQuantity =
      input.quantity == null ? available : dec(input.quantity);
    if (packQuantity.lessThanOrEqualTo(0)) {
      throw new ValidationError("Packing quantity must be greater than 0.");
    }
    if (packQuantity.greaterThan(available)) {
      throw new ValidationError(
        `Cannot pack ${packQuantity.toFixed(2)} — only ${available.toFixed(2)} unpacked.`,
      );
    }
    // Packing the lot renames the batch; a partial pack splits a new one off.
    const packsEverything = packQuantity.equals(available);
    const ratio = packQuantity.dividedBy(dec(bom.output_quantity));

    // Packing materials can be chosen at pack time; the BOM list is only the
    // fallback for the one-click Complete API.
    const requested: Array<{ itemId: number; quantity: Decimal }> = [];
    if (input.materials !== undefined) {
      for (const raw of input.materials) {
        const item = await this.items.requireById(raw.itemId);
        if (item.item_type !== "PACKING_MATERIAL") {
          throw new ValidationError(`'${item.item_name}' is not a packing material.`);
        }
        const quantity = dec(raw.quantity);
        if (quantity.lessThanOrEqualTo(0)) {
          throw new ValidationError(`Quantity for '${item.item_name}' must be greater than 0.`);
        }
        requested.push({ itemId: raw.itemId, quantity });
      }
    } else {
      for (const component of bomComponents) {
        const item = await this.items.requireById(component.component_item_id);
        if (item.item_type !== "PACKING_MATERIAL") continue;
        const requiredQty = dec(component.quantity_required).times(ratio);
        const wastageQty = requiredQty.times(dec(component.wastage_percent).dividedBy(100));
        requested.push({
          itemId: component.component_item_id,
          quantity: requiredQty.plus(wastageQty),
        });
      }
    }

    let packingCost = new Decimal(0);
    const materials: Array<{
      componentItemId: number;
      batchId: number | null;
      quantity: Decimal;
      unitCost: Decimal;
    }> = [];

    for (const request of requested) {
      const item = await this.items.requireById(request.itemId);
      const totalRequired = request.quantity;
      const batch = await this.batches.findByItemAndWarehouse(
        request.itemId,
        order.warehouse_id,
      );
      if (!input.ignoreStock) {
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
      }
      const unitCost = dec(batch?.purchase_price ?? item.purchase_price);
      packingCost = packingCost.plus(round2(totalRequired.times(unitCost)));
      materials.push({
        componentItemId: request.itemId,
        batchId: batch?.id ?? null,
        quantity: totalRequired,
        unitCost,
      });
    }

    const rawUnit = dec(order.raw_material_cost).dividedBy(dec(order.actual_quantity));
    const packedRawCost = round2(rawUnit.times(packQuantity));
    const packedUnitCost = packedRawCost.plus(packingCost).dividedBy(packQuantity);
    const packingUnitCost = packingCost.dividedBy(packQuantity);

    // Packing the lot reuses the unpacked batch (renamed); a partial pack needs
    // its own batch number, so find one that is still free.
    const baseName =
      input.outputBatchNumber?.trim() || unpackedName.slice("UNPACKED-".length);
    let finalName = baseName;
    let suffix = 1;
    while (await this.batches.findByNumber(bom.finished_item_id, order.warehouse_id, finalName)) {
      finalName = `${baseName}-${suffix}`;
      suffix += 1;
    }

    const resolver = new SystemAccountResolver(this.db, this.companyId);
    const journalLines: JournalLineInput[] = [];
    if (packingCost.greaterThan(0)) {
      journalLines.push({
        accountId: await resolver.idFor(SystemAccountCodes.INVENTORY_FINISHED_GOODS),
        debit: packingCost,
        description: `Packing cost - ${order.order_number}`,
      });
      journalLines.push({
        accountId: await resolver.idFor(SystemAccountCodes.INVENTORY_PACKING_MATERIALS),
        credit: packingCost,
        description: `Packing materials consumed - ${order.order_number}`,
      });
    }

    return this.db.transaction(async () => {
      for (const material of materials) {
        if (input.ignoreStock || material.batchId === null) continue;
        await this.manufacturing.insertConsumption({
          production_order_id: orderId,
          component_item_id: material.componentItemId,
          batch_id: material.batchId,
          quantity_consumed: toQuantity(material.quantity),
          unit_cost: toStorage(material.unitCost),
        });
        await this.batches.adjustQuantity(material.batchId, -toQuantity(material.quantity));
        await insertRow(this.db, "stock_movements", {
          item_id: material.componentItemId,
          batch_id: material.batchId,
          warehouse_id: order.warehouse_id,
          movement_type: "PRODUCTION_CONSUME",
          quantity: -toQuantity(material.quantity),
          unit_cost: toStorage(material.unitCost),
          reference_table: "production_orders",
          reference_id: orderId,
          movement_date: order.manufacturing_date,
          notes: `Production order ${order.order_number} (packing stage)`,
        });
      }

      if (packsEverything) {
        // Rename the unpacked batch into the saleable finished-goods batch.
        await this.db.run(
          `UPDATE stock_batches
              SET batch_number = ?, purchase_price = ?, packing_unit_cost = ?, raw_unit_cost = ?
            WHERE id = ?`,
          [
            finalName,
            toStorage(packedUnitCost),
            toStorage(packingUnitCost),
            toStorage(rawUnit),
            unpackedBatch.id,
          ],
        );
      } else {
        // Leave the rest unpacked and split the packed quantity into a new batch.
        await this.batches.adjustQuantity(unpackedBatch.id, -toQuantity(packQuantity));
        const packedBatchId = await this.batches.insert({
          item_id: bom.finished_item_id,
          warehouse_id: order.warehouse_id,
          batch_number: finalName,
          manufacturing_date: order.manufacturing_date,
          expiry_date: order.expiry_date,
          purchase_price: toStorage(packedUnitCost),
          raw_unit_cost: toStorage(rawUnit),
          packing_unit_cost: toStorage(packingUnitCost),
          quantity_in_stock: toQuantity(packQuantity),
          is_active: 1,
        });
        await insertRow(this.db, "stock_movements", {
          item_id: bom.finished_item_id,
          batch_id: packedBatchId,
          warehouse_id: order.warehouse_id,
          movement_type: "PRODUCTION_IN",
          quantity: toQuantity(packQuantity),
          unit_cost: toStorage(packedUnitCost),
          reference_table: "production_orders",
          reference_id: orderId,
          movement_date: order.manufacturing_date,
          notes: `Production order ${order.order_number} (packed)`,
        });
      }

      const cumulativePacking = dec(order.packing_material_cost).plus(packingCost);
      await this.manufacturing.updateOrder(orderId, {
        // Partial packs keep the unpacked batch active for the next pack.
        output_batch_number: packsEverything ? finalName : unpackedName,
        production_cost: toStorage(dec(order.raw_material_cost).plus(cumulativePacking)),
        packing_material_cost: toStorage(cumulativePacking),
        ...(packsEverything
          ? { status: "COMPLETED", completed_at: new Date().toISOString() }
          : {}),
      });

      const journalEntryId = journalLines.length
        ? await this.accounting.postJournalEntry({
            voucherType: "MANUFACTURING",
            entryDate: new Date().toISOString().slice(0, 10),
            lines: journalLines,
            sourceTable: "production_orders",
            sourceId: orderId,
            narration: `Production order ${order.order_number} packed`,
            companyId: this.companyId,
          })
        : 0;

      return {
        id: orderId,
        productionCost: toStorage(packedRawCost.plus(packingCost)),
        journalEntryId,
      };
    });
  }

  /** Produce then pack in one call (kept for the one-click Complete action/API). */
  async completeProduction(
    orderId: number,
    input: CompleteProductionInput,
  ): Promise<{ id: number; productionCost: number; journalEntryId: number }> {
    const order = await this.manufacturing.findOrderById(orderId);
    if (!order) throw new NotFoundError(`Production order ${orderId} not found.`);
    if (order.status === "IN_PROGRESS" && dec(order.actual_quantity).isZero()) {
      await this.produceProduction(orderId, input);
    }
    return this.packProduction(orderId, {
      outputBatchNumber: input.outputBatchNumber,
      ignoreStock: input.ignoreStock,
    });
  }

  /** A unique stock-batch name for the intermediate unpacked output. */
  private async unpackedBatchName(
    order: { order_number: string; warehouse_id: number },
    requested: string | null | undefined,
    itemId: number,
  ): Promise<string> {
    const base = requested?.trim() || order.order_number;
    const preferred = `UNPACKED-${base}`;
    const clash = await this.batches.findByNumber(itemId, order.warehouse_id, preferred);
    return clash ? `${preferred}-${order.order_number}` : preferred;
  }
}
