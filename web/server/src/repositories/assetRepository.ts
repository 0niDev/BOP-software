import type { SqlDatabase } from "../db/types.js";
import { insertRow, type InsertData } from "./base.js";

export interface AssetRow {
  /** accounts.id -- an asset IS a fixed-asset account with optional details. */
  account_id: number;
  account_code: string;
  account_name: string;
  account_subtype: string | null;
  opening_balance: number;
  created_at: string;
  asset_type: string | null;
  purchase_amount: number | null;
  purchase_date: string | null;
  supplier_id: number | null;
  due_date: string | null;
  notes: string | null;
  current_balance: number;
}

/**
 * Fixed assets are the ASSET accounts under code `15%` (1500-1505 seeded, plus
 * 1506 "Other Fixed Assets" created on demand), optionally described by an
 * `asset_details` row. Mirrors AssetView._load_assets in
 * views/widgets/asset_view.py.
 */
export class AssetRepository {
  constructor(private readonly db: SqlDatabase) {}

  async list(companyId = 1): Promise<AssetRow[]> {
    return this.db.all<AssetRow>(
      `SELECT a.id AS account_id, a.account_code, a.account_name, a.account_subtype,
              a.opening_balance, a.created_at,
              ad.asset_type, ad.purchase_amount, ad.purchase_date, ad.supplier_id,
              ad.due_date, ad.notes,
              COALESCE(SUM(CASE WHEN je.is_posted = 1 THEN jel.debit - jel.credit ELSE 0 END), 0)
                AS current_balance
       FROM accounts a
       LEFT JOIN asset_details ad ON ad.account_id = a.id
       LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
       LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
       WHERE a.account_type = 'ASSET' AND a.account_code LIKE '15%'
         AND a.company_id = ? AND a.is_active = 1
       GROUP BY a.id, a.account_code, a.account_name, a.account_subtype, a.opening_balance,
                a.created_at, ad.asset_type, ad.purchase_amount, ad.purchase_date,
                ad.supplier_id, ad.due_date, ad.notes
       ORDER BY a.account_code`,
      [companyId],
    );
  }

  async findDetailsByAccount(accountId: number): Promise<Record<string, unknown> | undefined> {
    return this.db.get("SELECT * FROM asset_details WHERE account_id = ?", [accountId]);
  }

  /** `asset_details` is UNIQUE(account_id) in the schema, so this upserts. */
  async upsertDetails(data: InsertData & { account_id: number }): Promise<void> {
    const cols = Object.keys(data);
    const assignments = cols
      .filter((col) => col !== "account_id")
      .map((col) => `${col} = excluded.${col}`)
      .join(", ");
    await this.db.run(
      `INSERT INTO asset_details (${cols.join(", ")})
       VALUES (${cols.map(() => "?").join(", ")})
       ON CONFLICT(account_id) DO UPDATE SET ${assignments}`,
      cols.map((col) => data[col] ?? null),
    );
  }

  async insertReturningId(data: InsertData): Promise<number> {
    return insertRow(this.db, "asset_details", data);
  }
}
