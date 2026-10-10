/**
 * Business rules for Items, ported from services/item_service.py:
 * validation, auto-generated item codes (ITEM-00001) allocated inside the same
 * transaction as the insert so a failure leaves no gap in the sequence.
 */
import type { SqlDatabase } from "../db/types.js";
import { NotFoundError, ValidationError } from "../domain/errors.js";
import type { ItemType } from "../domain/enums.js";
import { ItemRepository, type ItemRow } from "../repositories/itemRepository.js";
import { JournalRepository } from "../repositories/journalRepository.js";
import { TaxRateRepository, type TaxRateRow } from "../repositories/taxRateRepository.js";

export const ITEM_UNITS = [
  "TABLET",
  "CAPSULE",
  "ML",
  "GRAM",
  "KG",
  "UNIT",
  "VIAL",
  "AMPOULE",
] as const;

export const ITEM_TYPES: readonly ItemType[] = [
  "RAW_MATERIAL",
  "PACKING_MATERIAL",
  "FINISHED_GOOD",
];

export interface CreateItemInput {
  itemName: string;
  unit?: string;
  itemCode?: string | null;
  notes?: string | null;
  purchasePrice?: number;
  sellingPrice?: number;
  minimumStock?: number;
  maximumStock?: number;
  taxRateId?: number | null;
  itemType?: ItemType;
  categoryId?: number | null;
}

export interface UpdateItemInput {
  itemName: string;
  notes?: string | null;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  minimumStock: number;
  maximumStock: number;
  taxRateId?: number | null;
  itemType: ItemType;
  categoryId?: number | null;
  isActive?: boolean;
}

interface ItemFields {
  itemName: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  minimumStock: number;
  maximumStock: number;
  itemType: string;
}

function validateCommon(fields: ItemFields): void {
  if (!fields.itemName.trim()) throw new ValidationError("Item name is required.");
  if (fields.purchasePrice < 0) throw new ValidationError("Purchase price cannot be negative.");
  if (fields.sellingPrice < 0) throw new ValidationError("Selling price cannot be negative.");
  if (fields.minimumStock < 0) throw new ValidationError("Minimum stock cannot be negative.");
  if (fields.maximumStock < 0) throw new ValidationError("Maximum stock cannot be negative.");
  if (fields.maximumStock < fields.minimumStock) {
    throw new ValidationError("Maximum stock must be >= minimum stock.");
  }
  if (!(ITEM_UNITS as readonly string[]).includes(fields.unit)) {
    throw new ValidationError(
      `Invalid unit: ${fields.unit}. Use TABLET, CAPSULE, ML, GRAM, KG, UNIT, VIAL or AMPOULE.`,
    );
  }
  if (!(ITEM_TYPES as readonly string[]).includes(fields.itemType)) {
    throw new ValidationError(`Invalid item type: ${fields.itemType}`);
  }
}

export class ItemService {
  private readonly items: ItemRepository;
  private readonly taxes: TaxRateRepository;
  private readonly journal: JournalRepository;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.items = new ItemRepository(db);
    this.taxes = new TaxRateRepository(db);
    this.journal = new JournalRepository(db);
  }

  async list(
    opts: { activeOnly?: boolean; search?: string; itemType?: ItemType } = {},
  ): Promise<ItemRow[]> {
    return this.items.list(this.companyId, opts);
  }

  async get(id: number): Promise<ItemRow> {
    return this.items.requireById(id);
  }

  async taxRates(): Promise<TaxRateRow[]> {
    return this.taxes.list(this.companyId);
  }

  async create(input: CreateItemInput): Promise<ItemRow> {
    const unit = input.unit ?? "UNIT";
    const itemType = input.itemType ?? "FINISHED_GOOD";
    const purchasePrice = input.purchasePrice ?? 0;
    const sellingPrice = input.sellingPrice ?? 0;
    const minimumStock = input.minimumStock ?? 0;
    const maximumStock = input.maximumStock ?? 0;

    validateCommon({
      itemName: input.itemName,
      unit,
      purchasePrice,
      sellingPrice,
      minimumStock,
      maximumStock,
      itemType,
    });

    let itemCode = input.itemCode?.trim() || null;
    if (itemCode !== null) {
      if (!itemCode) throw new ValidationError("Item code cannot be empty.");
      if (await this.items.findByCode(itemCode, this.companyId)) {
        throw new ValidationError(`Item code '${itemCode}' already exists.`);
      }
    }

    await this.validateTaxRate(input.taxRateId ?? null);

    const id = await this.db.transaction(async () => {
      // Code generation joins the transaction so the sequence rolls back with
      // the insert on failure -- no gaps (mirrors the Python service).
      if (itemCode === null) {
        itemCode = await this.journal.nextVoucherNumber(this.companyId, "ITEM");
      }
      return this.items.insert({
        company_id: this.companyId,
        item_code: itemCode as string,
        item_name: input.itemName.trim(),
        unit,
        item_type: itemType,
        purchase_price: purchasePrice,
        selling_price: sellingPrice,
        minimum_stock: minimumStock,
        maximum_stock: maximumStock,
        tax_rate_id: input.taxRateId ?? null,
        category_id: input.categoryId ?? null,
        notes: input.notes ?? null,
        is_active: 1,
      });
    });

    return this.items.requireById(id);
  }

  async update(id: number, input: UpdateItemInput): Promise<ItemRow> {
    await this.items.requireById(id);

    validateCommon({
      itemName: input.itemName,
      unit: input.unit,
      purchasePrice: input.purchasePrice,
      sellingPrice: input.sellingPrice,
      minimumStock: input.minimumStock,
      maximumStock: input.maximumStock,
      itemType: input.itemType,
    });

    await this.validateTaxRate(input.taxRateId ?? null);

    await this.items.update(id, {
      item_name: input.itemName.trim(),
      notes: input.notes ?? null,
      unit: input.unit,
      purchase_price: input.purchasePrice,
      selling_price: input.sellingPrice,
      minimum_stock: input.minimumStock,
      maximum_stock: input.maximumStock,
      tax_rate_id: input.taxRateId ?? null,
      item_type: input.itemType,
      category_id: input.categoryId ?? null,
      is_active: input.isActive === false ? 0 : 1,
    });
    return this.items.requireById(id);
  }

  async deactivate(id: number): Promise<void> {
    const item = await this.items.findById(id);
    if (!item) throw new NotFoundError("Item not found.");
    await this.items.deactivate(id);
  }

  private async validateTaxRate(taxRateId: number | null): Promise<void> {
    if (taxRateId == null) return;
    const taxRate = await this.taxes.findById(taxRateId);
    if (!taxRate) throw new ValidationError("Tax rate does not exist.");
    if (taxRate.company_id !== this.companyId) {
      throw new ValidationError("Tax rate belongs to different company.");
    }
    if (taxRate.tax_type !== "SALES_TAX") {
      throw new ValidationError("Tax rate must be sales tax type.");
    }
  }
}
