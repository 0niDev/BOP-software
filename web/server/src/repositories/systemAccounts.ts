import type { SqlDatabase } from "../db/types.js";
import { ConfigurationError } from "../domain/errors.js";

/**
 * Resolves system account codes (1000, 1100, 4000, ...) to their database id,
 * caching the result. Mirrors accounting/system_accounts.py: services must
 * never hardcode numeric ids, since they differ between environments.
 */
export class SystemAccountResolver {
  private readonly cache = new Map<string, number>();

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {}

  async idFor(code: string): Promise<number> {
    const cached = this.cache.get(code);
    if (cached !== undefined) return cached;
    const row = await this.db.get<{ id: number }>(
      "SELECT id FROM accounts WHERE account_code = ? AND company_id = ?",
      [code, this.companyId],
    );
    if (!row) {
      throw new ConfigurationError(
        `Required system account '${code}' is missing. Run the database seed/migrations.`,
      );
    }
    this.cache.set(code, row.id);
    return row.id;
  }
}
