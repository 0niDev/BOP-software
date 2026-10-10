import type { SqlDatabase } from "../db/types.js";
import { NotFoundError } from "../domain/errors.js";
import type { PartyType } from "../domain/enums.js";
import { insertRow, type InsertData } from "./base.js";

export interface PartyRow {
  id: number;
  company_id: number;
  code: string;
  name: string;
  party_type: PartyType;
  customer_category: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  opening_balance: number;
  credit_limit: number;
  account_id: number | null;
  is_active: number;
  created_at: string;
}

export class PartyRepository {
  constructor(private readonly db: SqlDatabase) {}

  async findById(id: number): Promise<PartyRow | undefined> {
    return this.db.get<PartyRow>("SELECT * FROM parties WHERE id = ?", [id]);
  }

  async requireById(id: number): Promise<PartyRow> {
    const party = await this.findById(id);
    if (!party) throw new NotFoundError(`Party ${id} not found.`);
    return party;
  }

  async findByCode(code: string, companyId = 1): Promise<PartyRow | undefined> {
    return this.db.get<PartyRow>(
      "SELECT * FROM parties WHERE code = ? AND company_id = ?",
      [code, companyId],
    );
  }

  async list(
    companyId = 1,
    opts: { type?: PartyType; activeOnly?: boolean; search?: string } = {},
  ): Promise<PartyRow[]> {
    let sql = "SELECT * FROM parties WHERE company_id = ?";
    const params: Array<string | number> = [companyId];
    if (opts.type) {
      // A customer lookup should also return BOTH (customer + supplier).
      sql += " AND (party_type = ? OR party_type = 'BOTH')";
      params.push(opts.type);
    }
    if (opts.activeOnly !== false) sql += " AND is_active = 1";
    if (opts.search) {
      sql += " AND (name LIKE ? OR code LIKE ? OR COALESCE(phone,'') LIKE ?)";
      const like = `%${opts.search}%`;
      params.push(like, like, like);
    }
    sql += " ORDER BY name";
    return this.db.all<PartyRow>(sql, params);
  }

  async update(id: number, data: InsertData): Promise<void> {
    const cols = Object.keys(data);
    if (cols.length === 0) return;
    await this.db.run(
      `UPDATE parties SET ${cols.map((col) => `${col} = ?`).join(", ")} WHERE id = ?`,
      [...cols.map((col) => data[col] ?? null), id],
    );
  }

  async deactivate(id: number): Promise<void> {
    await this.db.run("UPDATE parties SET is_active = 0 WHERE id = ?", [id]);
  }

  async insert(data: InsertData): Promise<number> {
    return insertRow(this.db, "parties", data);
  }
}
