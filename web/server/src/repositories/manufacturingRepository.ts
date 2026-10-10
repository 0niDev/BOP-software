import type { Row, SqlDatabase } from "../db/types.js";
import { insertRow, type InsertData } from "./base.js";

export interface BomRow {
  id: number;
  company_id: number;
  finished_item_id: number;
  bom_name: string;
  output_quantity: number;
  notes: string | null;
  is_active: number;
  is_temp: number;
  is_ghost: number;
  created_at: string;
}

export interface BomComponentRow {
  id: number;
  bom_id: number;
  component_item_id: number;
  quantity_required: number;
  wastage_percent: number;
}

export interface ProductionOrderRow {
  id: number;
  company_id: number;
  warehouse_id: number;
  order_number: string;
  bom_id: number;
  planned_quantity: number;
  actual_quantity: number;
  wastage_quantity: number;
  output_batch_number: string | null;
  manufacturing_date: string;
  expiry_date: string | null;
  production_cost: number;
  raw_material_cost: number;
  packing_material_cost: number;
  status: string;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
}

export class ManufacturingRepository {
  constructor(private readonly db: SqlDatabase) {}

  // --- BOM ---------------------------------------------------------------
  async findBomByName(name: string, companyId = 1): Promise<BomRow | undefined> {
    return this.db.get<BomRow>(
      "SELECT * FROM bill_of_materials WHERE bom_name = ? AND company_id = ?",
      [name, companyId],
    );
  }

  async insertBom(data: InsertData): Promise<number> {
    return insertRow(this.db, "bill_of_materials", data);
  }

  async insertBomComponent(data: InsertData): Promise<number> {
    return insertRow(this.db, "bom_components", data);
  }

  async findBomById(id: number): Promise<BomRow | undefined> {
    return this.db.get<BomRow>("SELECT * FROM bill_of_materials WHERE id = ?", [id]);
  }

  async findBomComponents(bomId: number): Promise<BomComponentRow[]> {
    return this.db.all<BomComponentRow>(
      "SELECT * FROM bom_components WHERE bom_id = ? ORDER BY id",
      [bomId],
    );
  }

  async listBoms(companyId = 1, activeOnly = true): Promise<BomRow[]> {
    return this.db.all<BomRow>(
      "SELECT * FROM bill_of_materials WHERE company_id = ?" +
        (activeOnly ? " AND is_active = 1 AND is_temp = 0" : "") +
        " ORDER BY bom_name",
      [companyId],
    );
  }

  // --- Production orders -------------------------------------------------
  async orderNumberExists(orderNumber: string, companyId = 1): Promise<boolean> {
    const row = await this.db.get<{ id: number }>(
      "SELECT id FROM production_orders WHERE company_id = ? AND order_number = ?",
      [companyId, orderNumber],
    );
    return row !== undefined;
  }

  async insertOrder(data: InsertData): Promise<number> {
    return insertRow(this.db, "production_orders", data);
  }

  async findOrderById(id: number): Promise<ProductionOrderRow | undefined> {
    return this.db.get<ProductionOrderRow>("SELECT * FROM production_orders WHERE id = ?", [id]);
  }

  async listOrders(companyId = 1): Promise<ProductionOrderRow[]> {
    return this.db.all<ProductionOrderRow>(
      "SELECT * FROM production_orders WHERE company_id = ? ORDER BY id DESC LIMIT 200",
      [companyId],
    );
  }

  async updateOrder(id: number, data: InsertData): Promise<void> {
    const cols = Object.keys(data);
    if (cols.length === 0) return;
    const assignments = cols.map((c) => `${c} = ?`).join(", ");
    await this.db.run(`UPDATE production_orders SET ${assignments} WHERE id = ?`, [
      ...cols.map((c) => data[c] ?? null),
      id,
    ]);
  }

  async insertConsumption(data: InsertData): Promise<number> {
    return insertRow(this.db, "production_consumption", data);
  }

  async findConsumptions(orderId: number): Promise<Row[]> {
    return this.db.all<Row>(
      "SELECT * FROM production_consumption WHERE production_order_id = ? ORDER BY id",
      [orderId],
    );
  }
}
