/**
 * Manufacturing service, two independent stages:
 *
 *  Production (formulation): raw materials -> a batch of the "(Unpacked) <BOM>"
 *  finished-good item. Journals Dr Inventory - Finished Goods / Cr the raw
 *  material inventory accounts.
 *
 *  Packing: unpacked bulk + packing materials -> saleable finished goods, on its
 *  own packing order. Journals Dr Inventory - Finished Goods / Cr the inventory
 *  accounts of everything consumed (the unpacked bulk is itself finished goods).
 *
 * Both stages create Draft orders; stock and journals only move when the user
 * explicitly produces or packs.
 */
import type { SqlDatabase } from "../db/types.js";
import { SystemAccountCodes, type ItemType } from "../domain/enums.js";
import { InsufficientStockError, NotFoundError, ValidationError } from "../domain/errors.js";
import { Decimal, dec, round2, toQuantity, toStorage } from "../domain/money.js";
import { insertRow } from "../repositories/base.js";
import { ItemRepository, type ItemRow } from "../repositories/itemRepository.js";
import { JournalRepository } from "../repositories/journalRepository.js";
import {
  ManufacturingRepository,
  type BomComponentRow,
  type BomRow,
  type PackingOrderRow,
  type ProductionOrderRow,
} from "../repositories/manufacturingRepository.js";
import { StockBatchRepository } from "../repositories/stockBatchRepository.js";
import { SystemAccountResolver } from "../repositories/systemAccounts.js";
import { AccountingService, type JournalLineInput } from "./accountingService.js";
import { INVENTORY_ACCOUNT_BY_TYPE, ItemService } from "./itemService.js";

/** Prefix of the intermediate inventory item a formulation BOM produces. */
export const UNPACKED_ITEM_PREFIX = "(Unpacked) ";

export interface BomComponentInput {
  componentItemId: number;
  quantityRequired: number | string;
  wastagePercent?: number | string;
}

export interface CreateBomInput {
  /**
   * Formulation BOMs may omit it: the "(Unpacked) <BOM name>" output item is
   * created (or reused) automatically. Packing BOMs require the finished good.
   */
  finishedItemId?: number | null;
  outputQuantity: number | string;
  components: readonly BomComponentInput[];
  bomName?: string | null;
  notes?: string | null;
  companyId?: number;
}

export interface UpdateBomInput {
  finishedItemId?: number | null;
  outputQuantity: number | string;
  components: readonly BomComponentInput[];
  bomName?: string | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface CreateProductionOrderInput {
  /** Saved formulation BOM to produce from — omit for a manual run. */
  bomId?: number | null;
  plannedQuantity: number | string;
  manufacturingDate: string;
  orderNumber?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  warehouseId?: number;
  createdBy?: number | null;
  companyId?: number;
  /** Manual run: name for the per-unit BOM saved from this run … */
  bomName?: string | null;
  /** … and the raw-material totals consumed by the whole run. */
  components?: readonly BomComponentInput[] | null;
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

export interface CreatePackingOrderInput {
  /** Saved packing BOM — omit for a manual run (which saves one). */
  bomId?: number | null;
  plannedQuantity: number | string;
  manufacturingDate: string;
  orderNumber?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  warehouseId?: number;
  createdBy?: number | null;
  companyId?: number;
  /** Manual run: name for the per-unit packing BOM … */
  packingBomName?: string | null;
  /** … the finished good produced … */
  outputItemId?: number | null;
  /** … the unpacked bulk consumed … */
  unpackedItemId?: number | null;
  /** … its total quantity for the run … */
  unpackedQuantity?: number | string | null;
  /** … and the packing-material totals for the run. */
  materials?: readonly BomComponentInput[] | null;
}

export interface UpdatePackingOrderInput {
  bomId: number;
  plannedQuantity: number | string;
  manufacturingDate: string;
  expiryDate?: string | null;
  notes?: string | null;
}

export interface PackPackingOrderInput {
  /** Items/packages to make now. Defaults to the order's planned quantity. */
  units?: number | string | null;
  /** Unpacked bulk consumed now. Defaults to the BOM ratio. */
  unpackedQuantity?: number | string | null;
  /** Packing materials used now. Defaults to the BOM ratio. */
  materials?: readonly { itemId: number; quantity: number | string }[] | null;
  outputBatchNumber?: string | null;
  ignoreStock?: boolean;
}

interface ValidatedComponent {
  componentItemId: number;
  quantityRequired: Decimal;
  wastagePercent: Decimal;
  itemType: ItemType;
}

interface ConsumedMaterial {
  itemId: number;
  itemType: ItemType;
  batchId: number | null;
  quantity: Decimal;
  unitCost: Decimal;
  cost: Decimal;
}

export class ManufacturingService {
  private readonly items: ItemRepository;
  private readonly batches: StockBatchRepository;
  private readonly manufacturing: ManufacturingRepository;
  private readonly journal: JournalRepository;
  private readonly accounting: AccountingService;
  private readonly itemService: ItemService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.items = new ItemRepository(db);
    this.batches = new StockBatchRepository(db);
    this.manufacturing = new ManufacturingRepository(db);
    this.journal = new JournalRepository(db);
    this.accounting = new AccountingService(db, companyId);
    this.itemService = new ItemService(db, companyId);
  }

  // --- BOM ---------------------------------------------------------------
  async listBoms(activeOnly = true): Promise<BomRow[]> {
    return this.manufacturing.listBoms(this.companyId, activeOnly);
  }

  async getBom(id: number): Promise<{ bom: BomRow; components: BomComponentRow[] }> {
    const bom = await this.manufacturing.findBomById(id);
    if (!bom) throw new NotFoundError(`BOM ${id} not found.`);
    const components = await this.manufacturing.findBomComponents(id);
    return { bom, components };
  }

  async createBom(
    input: CreateBomInput,
  ): Promise<{ id: number; bomName: string; finishedItemId: number }> {
    const companyId = input.companyId ?? this.companyId;
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
    if (components.phase === "PACKING" && input.finishedItemId == null) {
      throw new ValidationError("A packing BOM needs the finished output item.");
    }
    if (input.finishedItemId != null) {
      await this.requireFinishedItem(input.finishedItemId);
    }

    return this.db.transaction(async () => {
      const bomName = name ?? (await this.journal.nextVoucherNumber(companyId, "BOM"));
      const finished =
        input.finishedItemId != null
          ? await this.items.requireById(input.finishedItemId)
          : await this.ensureUnpackedItem(bomName, components.components);
      const bomId = await this.manufacturing.insertBom({
        company_id: companyId,
        finished_item_id: finished.id,
        bom_name: bomName,
        output_quantity: toStorage(outputQuantity),
        notes: input.notes ?? null,
        phase: components.phase,
        is_active: 1,
      });
      for (const component of components.components) {
        await this.manufacturing.insertBomComponent({
          bom_id: bomId,
          component_item_id: component.componentItemId,
          quantity_required: toStorage(component.quantityRequired),
          wastage_percent: toStorage(component.wastagePercent),
        });
      }
      return { id: bomId, bomName, finishedItemId: finished.id };
    });
  }

  async updateBom(id: number, input: UpdateBomInput): Promise<{ id: number; bomName: string }> {
    const existing = await this.manufacturing.findBomById(id);
    if (!existing) throw new NotFoundError(`BOM ${id} not found.`);

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
    // Renaming a formulation BOM must not touch its "(Unpacked)" item (Q3).
    const finishedItemId = input.finishedItemId ?? existing.finished_item_id;
    await this.requireFinishedItem(finishedItemId);

    await this.db.transaction(async () => {
      await this.manufacturing.updateBom(id, {
        finished_item_id: finishedItemId,
        bom_name: bomName,
        output_quantity: toStorage(outputQuantity),
        notes: input.notes ?? existing.notes,
        phase: components.phase,
        is_active: input.isActive === false ? 0 : existing.is_active,
      });
      await this.manufacturing.deleteBomComponents(id);
      for (const component of components.components) {
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
    if ((await this.manufacturing.countOrdersUsingBom(id)) > 0) {
      throw new ValidationError("Cannot delete a BOM that is used by production or packing orders.");
    }
    await this.db.transaction(async () => {
      await this.manufacturing.deleteBomComponents(id);
      await this.manufacturing.deleteBom(id);
    });
  }

  private async requireFinishedItem(id: number): Promise<ItemRow> {
    const item = await this.items.requireById(id);
    if (item.item_type !== "FINISHED_GOOD") {
      throw new ValidationError("Finished item must be of type FINISHED_GOOD.");
    }
    return item;
  }

  /** The "(Unpacked) <BOM name>" output item of a formulation BOM. */
  private async ensureUnpackedItem(
    bomName: string,
    components: readonly ValidatedComponent[],
  ): Promise<ItemRow> {
    const itemName = `${UNPACKED_ITEM_PREFIX}${bomName}`;
    const existing = await this.items.findByName(itemName, this.companyId);
    if (existing) return existing;
    // Bulk is measured in the first component's unit (e.g. KG or L).
    const first = await this.items.requireById(components[0]!.componentItemId);
    return this.itemService.create({
      itemName,
      itemType: "FINISHED_GOOD",
      unit: first.unit,
    });
  }

  private async validateComponents(
    components: readonly BomComponentInput[],
  ): Promise<{ components: ValidatedComponent[]; phase: "FORMULATION" | "PACKING" }> {
    const validated: ValidatedComponent[] = [];
    let rawName = "";
    let otherName = "";
    let finishedCount = 0;

    for (const raw of components) {
      const quantityRequired = dec(raw.quantityRequired);
      if (!raw.componentItemId || quantityRequired.lessThanOrEqualTo(0)) {
        throw new ValidationError("Each component requires an item and quantity.");
      }
      const item = await this.items.requireById(raw.componentItemId);
      if (
        item.item_type !== "RAW_MATERIAL" &&
        item.item_type !== "PACKING_MATERIAL" &&
        item.item_type !== "FINISHED_GOOD"
      ) {
        throw new ValidationError(
          `Component '${item.item_name}' must be a raw, packing or finished-good item.`,
        );
      }
      if (item.item_type === "RAW_MATERIAL") {
        rawName ||= item.item_name;
      } else {
        otherName ||= item.item_name;
        if (item.item_type === "FINISHED_GOOD") finishedCount += 1;
      }
      const wastagePercent = dec(raw.wastagePercent ?? 0);
      if (wastagePercent.lessThan(0) || wastagePercent.greaterThan(100)) {
        throw new ValidationError("Wastage percentage must be between 0 and 100.");
      }
      validated.push({
        componentItemId: item.id,
        quantityRequired,
        wastagePercent,
        itemType: item.item_type,
      });
    }

    // The formulation stage (raw materials) and the packing stage (unpacked
    // bulk + packaging) are separate recipes and never mix.
    if (rawName && otherName) {
      throw new ValidationError(
        `A BOM cannot mix raw materials and packing/finished materials ('${rawName}' + '${otherName}'). ` +
          "Keep the formulation BOM (raw materials) and the packing BOM separate.",
      );
    }
    if (finishedCount > 1) {
      throw new ValidationError("A packing BOM can consume only one unpacked material.");
    }
    return { components: validated, phase: rawName ? "FORMULATION" : "PACKING" };
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
  ): Promise<{ id: number; orderNumber: string; bomId: number; finishedItemId: number }> {
    const companyId = input.companyId ?? this.companyId;
    const warehouseId = input.warehouseId ?? 1;
    const plannedQuantity = dec(input.plannedQuantity);
    if (plannedQuantity.lessThanOrEqualTo(0)) {
      throw new ValidationError("Planned quantity must be greater than 0.");
    }

    // Manual run: no saved BOM, so save a per-unit one from the run's totals.
    if (input.bomId == null) {
      if (!input.bomName?.trim() || !input.components || input.components.length === 0) {
        throw new ValidationError(
          "A saved BOM, or a BOM name with the run's component totals, is required.",
        );
      }
      return this.db.transaction(async () => {
        const bom = await this.createBom({
          bomName: input.bomName,
          outputQuantity: 1,
          components: input.components!.map((component) => ({
            componentItemId: component.componentItemId,
            quantityRequired: toStorage(dec(component.quantityRequired).dividedBy(plannedQuantity)),
          })),
          notes: "Saved from a production run",
          companyId,
        });
        const orderNumber = await this.resolveOrderNumber(input.orderNumber, companyId);
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
        return { id, orderNumber, bomId: bom.id, finishedItemId: bom.finishedItemId };
      });
    }

    const orderNumber = await this.resolveOrderNumber(input.orderNumber, companyId);
    const bom = await this.manufacturing.findBomById(input.bomId);
    if (!bom) throw new ValidationError("BOM does not exist.");
    if (bom.phase === "PACKING") {
      throw new ValidationError("This is a packing BOM — create a packing order instead.");
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
    return { id, orderNumber, bomId: bom.id, finishedItemId: bom.finished_item_id };
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

  /** Consume raw materials and put a batch of the unpacked item into stock. */
  async produceProduction(
    orderId: number,
    input: CompleteProductionInput,
  ): Promise<{ id: number; productionCost: number; journalEntryId: number; outputBatchNumber: string }> {
    const order = await this.manufacturing.findOrderById(orderId);
    if (!order) throw new NotFoundError(`Production order ${orderId} not found.`);
    if (order.status !== "IN_PROGRESS") {
      throw new ValidationError(`Cannot produce an order with status '${order.status}'.`);
    }
    if (dec(order.actual_quantity).greaterThan(0)) {
      throw new ValidationError("This order has already been produced.");
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

    const materials: ConsumedMaterial[] = [];
    let rawCost = new Decimal(0);

    for (const component of bomComponents) {
      const item = await this.items.requireById(component.component_item_id);
      // Packing and unpacked materials belong to the packing stage.
      if (item.item_type !== "RAW_MATERIAL") continue;

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
      const cost = round2(totalRequired.times(unitCost));
      rawCost = rawCost.plus(cost);
      materials.push({
        itemId: component.component_item_id,
        itemType: item.item_type,
        batchId: batch?.id ?? null,
        quantity: totalRequired,
        unitCost,
        cost,
      });
    }
    if (materials.length === 0) {
      throw new ValidationError("This BOM has no raw materials to produce.");
    }

    const outputBatchNumber = await this.uniqueBatchNumber(
      bom.finished_item_id,
      order.warehouse_id,
      input.outputBatchNumber,
      order.order_number,
    );
    const journalLines = await this.consumptionJournal(
      materials,
      SystemAccountCodes.INVENTORY_FINISHED_GOODS,
      `Unpacked production output - ${order.order_number}`,
      `Raw materials consumed - ${order.order_number}`,
    );

    return this.db.transaction(async () => {
      await this.manufacturing.updateOrder(orderId, {
        actual_quantity: toQuantity(actualQuantity),
        wastage_quantity: toQuantity(wastageQuantity),
        output_batch_number: outputBatchNumber,
        production_cost: toStorage(rawCost),
        raw_material_cost: toStorage(rawCost),
        packing_material_cost: 0,
        status: "COMPLETED",
        completed_at: new Date().toISOString(),
      });

      for (const material of materials) {
        if (input.ignoreStock || material.batchId === null) continue;
        await this.manufacturing.insertConsumption({
          production_order_id: orderId,
          component_item_id: material.itemId,
          batch_id: material.batchId,
          quantity_consumed: toQuantity(material.quantity),
          unit_cost: toStorage(material.unitCost),
        });
        await this.batches.adjustQuantity(material.batchId, -toQuantity(material.quantity));
        await insertRow(this.db, "stock_movements", {
          item_id: material.itemId,
          batch_id: material.batchId,
          warehouse_id: order.warehouse_id,
          movement_type: "PRODUCTION_CONSUME",
          quantity: -toQuantity(material.quantity),
          unit_cost: toStorage(material.unitCost),
          reference_table: "production_orders",
          reference_id: orderId,
          movement_date: order.manufacturing_date,
          notes: `Production order ${order.order_number}`,
        });
      }

      const unitCost = rawCost.dividedBy(actualQuantity);
      const outputBatchId = await this.batches.insert({
        item_id: bom.finished_item_id,
        warehouse_id: order.warehouse_id,
        batch_number: outputBatchNumber,
        manufacturing_date: order.manufacturing_date,
        expiry_date: order.expiry_date,
        purchase_price: toStorage(unitCost),
        raw_unit_cost: toStorage(unitCost),
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
        unit_cost: toStorage(unitCost),
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
            narration: `Production order ${order.order_number} produced`,
            companyId: this.companyId,
          })
        : 0;

      return {
        id: orderId,
        productionCost: toStorage(rawCost),
        journalEntryId,
        outputBatchNumber,
      };
    });
  }

  // --- Packing orders ----------------------------------------------------
  async listPackingOrders(): Promise<PackingOrderRow[]> {
    return this.manufacturing.listPackingOrders(this.companyId);
  }

  async getPackingOrder(
    id: number,
  ): Promise<{ order: PackingOrderRow; consumptions: Record<string, unknown>[] }> {
    const order = await this.manufacturing.findPackingOrderById(id);
    if (!order) throw new NotFoundError(`Packing order ${id} not found.`);
    const consumptions = await this.manufacturing.findPackingConsumptions(id);
    return { order, consumptions };
  }

  async createPackingOrder(
    input: CreatePackingOrderInput,
  ): Promise<{ id: number; orderNumber: string; bomId: number; outputItemId: number }> {
    const companyId = input.companyId ?? this.companyId;
    const warehouseId = input.warehouseId ?? 1;
    const plannedQuantity = dec(input.plannedQuantity);
    if (plannedQuantity.lessThanOrEqualTo(0)) {
      throw new ValidationError("Items generated must be greater than 0.");
    }

    // Manual run: save a per-unit packing BOM from the run's totals.
    if (input.bomId == null) {
      if (input.outputItemId == null || input.unpackedItemId == null) {
        throw new ValidationError("A packing order needs an output item and an unpacked material.");
      }
      const unpackedQuantity = dec(input.unpackedQuantity);
      if (unpackedQuantity.lessThanOrEqualTo(0)) {
        throw new ValidationError("Unpacked quantity must be greater than 0.");
      }
      const output = await this.requireFinishedItem(input.outputItemId);
      if (output.id === input.unpackedItemId) {
        throw new ValidationError("The output item must differ from the unpacked material.");
      }
      await this.requireFinishedItem(input.unpackedItemId);
      const materials = input.materials ?? [];
      for (const material of materials) {
        const item = await this.items.requireById(material.componentItemId);
        if (item.item_type !== "PACKING_MATERIAL") {
          throw new ValidationError(`'${item.item_name}' is not a packing material.`);
        }
      }

      return this.db.transaction(async () => {
        const bom = await this.createBom({
          finishedItemId: output.id,
          outputQuantity: 1,
          bomName: input.packingBomName?.trim() || null,
          components: [
            {
              componentItemId: input.unpackedItemId!,
              quantityRequired: toStorage(unpackedQuantity.dividedBy(plannedQuantity)),
            },
            ...materials.map((material) => ({
              componentItemId: material.componentItemId,
              quantityRequired: toStorage(
                dec(material.quantityRequired).dividedBy(plannedQuantity),
              ),
            })),
          ],
          notes: "Saved from a packing run",
          companyId,
        });
        const orderNumber = await this.resolvePackingOrderNumber(input.orderNumber, companyId);
        const id = await this.manufacturing.insertPackingOrder({
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
        return { id, orderNumber, bomId: bom.id, outputItemId: output.id };
      });
    }

    const bom = await this.manufacturing.findBomById(input.bomId);
    if (!bom) throw new ValidationError("BOM does not exist.");
    if (bom.phase !== "PACKING") {
      throw new ValidationError("Packing needs a packing BOM.");
    }
    const orderNumber = await this.resolvePackingOrderNumber(input.orderNumber, companyId);
    const id = await this.manufacturing.insertPackingOrder({
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
    return { id, orderNumber, bomId: bom.id, outputItemId: bom.finished_item_id };
  }

  async updatePackingOrder(id: number, input: UpdatePackingOrderInput): Promise<void> {
    const order = await this.manufacturing.findPackingOrderById(id);
    if (!order) throw new NotFoundError(`Packing order ${id} not found.`);
    if (order.status !== "DRAFT") {
      throw new ValidationError(`Cannot edit an order with status '${order.status}'.`);
    }
    const plannedQuantity = dec(input.plannedQuantity);
    if (plannedQuantity.lessThanOrEqualTo(0)) {
      throw new ValidationError("Items generated must be greater than 0.");
    }
    const bom = await this.manufacturing.findBomById(input.bomId);
    if (!bom) throw new ValidationError("BOM does not exist.");
    if (bom.phase !== "PACKING") throw new ValidationError("Packing needs a packing BOM.");

    await this.manufacturing.updatePackingOrder(id, {
      bom_id: bom.id,
      planned_quantity: toStorage(plannedQuantity),
      manufacturing_date: input.manufacturingDate,
      expiry_date: input.expiryDate ?? null,
      notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    });
  }

  async deletePackingOrder(id: number): Promise<void> {
    const order = await this.manufacturing.findPackingOrderById(id);
    if (!order) throw new NotFoundError(`Packing order ${id} not found.`);
    if (order.status !== "DRAFT") {
      throw new ValidationError(`Cannot delete an order with status '${order.status}'.`);
    }
    await this.manufacturing.deletePackingOrder(id);
  }

  private async resolvePackingOrderNumber(
    requested: string | null | undefined,
    companyId: number,
  ): Promise<string> {
    const orderNumber = requested?.trim() || "";
    if (!orderNumber) {
      return this.journal.nextVoucherNumber(companyId, "PACKING_ORDER");
    }
    if (await this.manufacturing.packingOrderNumberExists(orderNumber, companyId)) {
      throw new ValidationError(`Order number '${orderNumber}' already exists.`);
    }
    return orderNumber;
  }

  async startPacking(orderId: number): Promise<void> {
    const order = await this.manufacturing.findPackingOrderById(orderId);
    if (!order) throw new NotFoundError(`Packing order ${orderId} not found.`);
    if (order.status !== "DRAFT") {
      throw new ValidationError(`Cannot start an order with status '${order.status}'.`);
    }
    await this.manufacturing.updatePackingOrder(orderId, { status: "IN_PROGRESS" });
  }

  /** Consume unpacked bulk + packing materials and put finished goods into stock. */
  async packPackingOrder(
    orderId: number,
    input: PackPackingOrderInput = {},
  ): Promise<{ id: number; productionCost: number; journalEntryId: number; outputBatchNumber: string }> {
    const order = await this.manufacturing.findPackingOrderById(orderId);
    if (!order) throw new NotFoundError(`Packing order ${orderId} not found.`);
    if (order.status !== "IN_PROGRESS") {
      throw new ValidationError(`Cannot pack an order with status '${order.status}'.`);
    }
    const bom = await this.manufacturing.findBomById(order.bom_id);
    if (!bom) throw new ValidationError("BOM not found.");
    const bomComponents = await this.manufacturing.findBomComponents(bom.id);
    const ratio = dec(input.units ?? order.planned_quantity).dividedBy(dec(bom.output_quantity));
    const units = dec(input.units ?? order.planned_quantity);
    if (units.lessThanOrEqualTo(0)) {
      throw new ValidationError("Items generated must be greater than 0.");
    }

    let unpacked: { itemId: number; quantity: Decimal } | null = null;
    const bomMaterials: Array<{ itemId: number; quantity: Decimal }> = [];
    for (const component of bomComponents) {
      const item = await this.items.requireById(component.component_item_id);
      const required = dec(component.quantity_required)
        .times(ratio)
        .times(dec(component.wastage_percent).dividedBy(100).plus(1));
      if (item.item_type === "FINISHED_GOOD") {
        unpacked = { itemId: item.id, quantity: required };
      } else if (item.item_type === "PACKING_MATERIAL") {
        bomMaterials.push({ itemId: item.id, quantity: required });
      }
    }

    const unpackedQuantity =
      input.unpackedQuantity != null ? dec(input.unpackedQuantity) : (unpacked?.quantity ?? new Decimal(0));
    if (!unpacked || unpackedQuantity.lessThanOrEqualTo(0)) {
      throw new ValidationError("This packing BOM has no unpacked material to consume.");
    }

    const requested: Array<{ itemId: number; quantity: Decimal }> = [];
    if (input.materials != null) {
      for (const raw of input.materials) {
        const item = await this.items.requireById(raw.itemId);
        if (item.item_type !== "PACKING_MATERIAL") {
          throw new ValidationError(`'${item.item_name}' is not a packing material.`);
        }
        const quantity = dec(raw.quantity);
        if (quantity.lessThanOrEqualTo(0)) {
          throw new ValidationError(`Quantity for '${item.item_name}' must be greater than 0.`);
        }
        requested.push({ itemId: item.id, quantity });
      }
    } else {
      requested.push(...bomMaterials);
    }

    const consumed: ConsumedMaterial[] = [];
    let totalCost = new Decimal(0);
    const toConsume = [
      { itemId: unpacked.itemId, quantity: unpackedQuantity },
      ...requested,
    ];
    for (const entry of toConsume) {
      const item = await this.items.requireById(entry.itemId);
      const batch = await this.batches.findByItemAndWarehouse(entry.itemId, order.warehouse_id);
      if (!input.ignoreStock) {
        if (!batch) {
          throw new InsufficientStockError(
            `No stock batch found for ${item.item_name}. Required: ${entry.quantity.toFixed(2)}`,
          );
        }
        if (dec(batch.quantity_in_stock).lessThan(entry.quantity)) {
          throw new InsufficientStockError(
            `Insufficient stock for ${item.item_name}. Required: ${entry.quantity.toFixed(2)}, available: ${dec(batch.quantity_in_stock).toFixed(2)}`,
          );
        }
      }
      const unitCost = dec(batch?.purchase_price ?? item.purchase_price);
      const cost = round2(entry.quantity.times(unitCost));
      totalCost = totalCost.plus(cost);
      consumed.push({
        itemId: entry.itemId,
        itemType: item.item_type,
        batchId: batch?.id ?? null,
        quantity: entry.quantity,
        unitCost,
        cost,
      });
    }

    const outputBatchNumber = await this.uniqueBatchNumber(
      bom.finished_item_id,
      order.warehouse_id,
      input.outputBatchNumber,
      order.order_number,
    );
    const journalLines = await this.consumptionJournal(
      consumed,
      SystemAccountCodes.INVENTORY_FINISHED_GOODS,
      `Packed finished goods - ${order.order_number}`,
      `Packing materials consumed - ${order.order_number}`,
    );

    return this.db.transaction(async () => {
      for (const material of consumed) {
        if (input.ignoreStock || material.batchId === null) continue;
        await this.manufacturing.insertPackingConsumption({
          packing_order_id: orderId,
          component_item_id: material.itemId,
          batch_id: material.batchId,
          quantity_consumed: toQuantity(material.quantity),
          unit_cost: toStorage(material.unitCost),
        });
        await this.batches.adjustQuantity(material.batchId, -toQuantity(material.quantity));
        await insertRow(this.db, "stock_movements", {
          item_id: material.itemId,
          batch_id: material.batchId,
          warehouse_id: order.warehouse_id,
          movement_type: "PRODUCTION_CONSUME",
          quantity: -toQuantity(material.quantity),
          unit_cost: toStorage(material.unitCost),
          reference_table: "packing_orders",
          reference_id: orderId,
          movement_date: order.manufacturing_date,
          notes: `Packing order ${order.order_number}`,
        });
      }

      const unpackedCost = consumed
        .filter((material) => material.itemType === "FINISHED_GOOD")
        .reduce((sum, material) => sum.plus(material.cost), new Decimal(0));
      const packingCost = totalCost.minus(unpackedCost);
      const outputUnitCost = totalCost.dividedBy(units);

      const outputBatchId = await this.batches.insert({
        item_id: bom.finished_item_id,
        warehouse_id: order.warehouse_id,
        batch_number: outputBatchNumber,
        manufacturing_date: order.manufacturing_date,
        expiry_date: order.expiry_date,
        purchase_price: toStorage(outputUnitCost),
        raw_unit_cost: toStorage(unpackedCost.dividedBy(units)),
        packing_unit_cost: toStorage(packingCost.dividedBy(units)),
        quantity_in_stock: toQuantity(units),
        is_active: 1,
      });
      await insertRow(this.db, "stock_movements", {
        item_id: bom.finished_item_id,
        batch_id: outputBatchId,
        warehouse_id: order.warehouse_id,
        movement_type: "PRODUCTION_IN",
        quantity: toQuantity(units),
        unit_cost: toStorage(outputUnitCost),
        reference_table: "packing_orders",
        reference_id: orderId,
        movement_date: order.manufacturing_date,
        notes: `Packing order ${order.order_number}`,
      });

      const cumulative = dec(order.actual_quantity).plus(units);
      await this.manufacturing.updatePackingOrder(orderId, {
        actual_quantity: toQuantity(cumulative),
        output_batch_number: outputBatchNumber,
        production_cost: toStorage(dec(order.production_cost).plus(totalCost)),
        ...(cumulative.greaterThanOrEqualTo(dec(order.planned_quantity))
          ? { status: "COMPLETED", completed_at: new Date().toISOString() }
          : {}),
      });

      const journalEntryId = journalLines.length
        ? await this.accounting.postJournalEntry({
            voucherType: "MANUFACTURING",
            entryDate: new Date().toISOString().slice(0, 10),
            lines: journalLines,
            sourceTable: "packing_orders",
            sourceId: orderId,
            narration: `Packing order ${order.order_number} packed`,
            companyId: this.companyId,
          })
        : 0;

      return {
        id: orderId,
        productionCost: toStorage(totalCost),
        journalEntryId,
        outputBatchNumber,
      };
    });
  }

  /** Dr the output inventory account, Cr each consumed item's inventory account. */
  private async consumptionJournal(
    consumed: readonly ConsumedMaterial[],
    debitAccountCode: string,
    debitDescription: string,
    creditDescription: string,
  ): Promise<JournalLineInput[]> {
    const total = consumed.reduce((sum, material) => sum.plus(material.cost), new Decimal(0));
    if (total.lessThanOrEqualTo(0)) return [];
    const resolver = new SystemAccountResolver(this.db, this.companyId);
    const credits = new Map<string, Decimal>();
    for (const material of consumed) {
      if (material.cost.lessThanOrEqualTo(0)) continue;
      const code =
        INVENTORY_ACCOUNT_BY_TYPE[material.itemType] ??
        SystemAccountCodes.INVENTORY_RAW_MATERIALS;
      credits.set(code, (credits.get(code) ?? new Decimal(0)).plus(material.cost));
    }
    const lines: JournalLineInput[] = [
      {
        accountId: await resolver.idFor(debitAccountCode),
        debit: total,
        description: debitDescription,
      },
    ];
    for (const [code, amount] of credits) {
      lines.push({
        accountId: await resolver.idFor(code),
        credit: amount,
        description: creditDescription,
      });
    }
    return lines;
  }

  /** A free stock-batch number: the requested one, or the order number, with a suffix on clash. */
  private async uniqueBatchNumber(
    itemId: number,
    warehouseId: number,
    requested: string | null | undefined,
    fallback: string,
  ): Promise<string> {
    const base = requested?.trim() || fallback;
    let name = base;
    let suffix = 1;
    while (await this.batches.findByNumber(itemId, warehouseId, name)) {
      name = `${base}-${suffix}`;
      suffix += 1;
    }
    return name;
  }
}
