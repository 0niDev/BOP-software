/**
 * Application settings, ported from repositories/settings_repository.py.
 *
 * Values are stored as text in `settings.setting_value`; dicts/lists are
 * serialized with the same `json:` tag the Python app writes, so both apps can
 * read each other's rows.
 */
import type { Row, SqlDatabase } from "../db/types.js";

const JSON_PREFIX = "json:";

export type SettingValue = string | number | boolean | null;

export function encodeSettingValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return JSON_PREFIX + JSON.stringify(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value);
}

export function decodeSettingValue(raw: unknown): unknown {
  if (typeof raw !== "string") return raw ?? null;
  if (raw.startsWith(JSON_PREFIX)) {
    try {
      return JSON.parse(raw.slice(JSON_PREFIX.length));
    } catch {
      return raw;
    }
  }
  return raw;
}

export class SettingsRepository {
  constructor(private readonly db: SqlDatabase) {}

  async getSetting(companyId: number, key: string, group = "GENERAL"): Promise<unknown> {
    const row = await this.db.get<{ setting_value: string | null }>(
      `SELECT setting_value FROM settings
       WHERE company_id = ? AND setting_key = ? AND setting_group = ?`,
      [companyId, key, group],
    );
    return row ? decodeSettingValue(row.setting_value) : null;
  }

  async getGroup(companyId: number, group: string): Promise<Record<string, unknown>> {
    const rows = await this.db.all<Row>(
      `SELECT setting_key, setting_value FROM settings
       WHERE company_id = ? AND setting_group = ?`,
      [companyId, group],
    );
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[String(row.setting_key)] = decodeSettingValue(row.setting_value);
    }
    return result;
  }

  async getAllGrouped(companyId: number): Promise<Record<string, Record<string, unknown>>> {
    const rows = await this.db.all<Row>(
      `SELECT setting_group, setting_key, setting_value FROM settings
       WHERE company_id = ? ORDER BY setting_group, setting_key`,
      [companyId],
    );
    const result: Record<string, Record<string, unknown>> = {};
    for (const row of rows) {
      const group = String(row.setting_group);
      (result[group] ??= {})[String(row.setting_key)] = decodeSettingValue(row.setting_value);
    }
    return result;
  }

  async setSetting(
    companyId: number,
    key: string,
    value: unknown,
    group = "GENERAL",
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO settings (company_id, setting_key, setting_value, setting_group)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(company_id, setting_key) DO UPDATE SET
         setting_value = excluded.setting_value,
         setting_group = excluded.setting_group`,
      [companyId, key, encodeSettingValue(value), group],
    );
  }

  async setGroup(
    companyId: number,
    group: string,
    settings: Record<string, unknown>,
  ): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      await this.setSetting(companyId, key, value, group);
    }
  }

  async deleteGroup(companyId: number, group: string): Promise<number> {
    const result = await this.db.run(
      "DELETE FROM settings WHERE company_id = ? AND setting_group = ?",
      [companyId, group],
    );
    return result.changes;
  }
}
