import type { SqlDatabase } from "../db/types.js";

export interface TaxRateRow {
  id: number;
  company_id: number;
  name: string;
  tax_type: "SALES_TAX" | "WITHHOLDING_TAX";
  rate_percent: number;
  is_active: number;
}

/**
 * Read-only view of `tax_rates`, used to validate an item's tax_rate_id and to
 * populate the tax-rate dropdown (mirrors repositories/tax_rate_repository.py
 * as used by items).
 */
export class TaxRateRepository {
  constructor(private readonly db: SqlDatabase) {}

  async findById(id: number): Promise<TaxRateRow | undefined> {
    return this.db.get<TaxRateRow>("SELECT * FROM tax_rates WHERE id = ?", [id]);
  }

  async list(companyId = 1, activeOnly = true): Promise<TaxRateRow[]> {
    return this.db.all<TaxRateRow>(
      "SELECT * FROM tax_rates WHERE company_id = ?" +
        (activeOnly ? " AND is_active = 1" : "") +
        " ORDER BY name",
      [companyId],
    );
  }
}
