/**
 * Application settings, ported from services/settings_service.py.
 * Thin business-logic wrapper over SettingsRepository.
 */
import type { SqlDatabase } from "../db/types.js";
import { ValidationError } from "../domain/errors.js";
import { SettingsRepository } from "../repositories/settingsRepository.js";

const THEMES = ["dark", "light", "system", "custom"] as const;

export class SettingsService {
  private readonly repo: SettingsRepository;

  constructor(db: SqlDatabase) {
    this.repo = new SettingsRepository(db);
  }

  async getAll(companyId: number): Promise<Record<string, Record<string, unknown>>> {
    return this.repo.getAllGrouped(companyId);
  }

  async getGroup(companyId: number, group: string): Promise<Record<string, unknown>> {
    return this.repo.getGroup(companyId, group);
  }

  async setGroup(
    companyId: number,
    group: string,
    settings: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const upper = group.trim().toUpperCase();
    if (!upper) throw new ValidationError("Setting group is required.");

    const patch: Record<string, unknown> = { ...settings };
    if (upper === "APPEARANCE" && typeof patch.theme_name === "string") {
      if (!(THEMES as readonly string[]).includes(patch.theme_name)) {
        throw new ValidationError(`Invalid theme: ${patch.theme_name}`);
      }
    }
    await this.repo.setGroup(companyId, upper, patch);
    return this.repo.getGroup(companyId, upper);
  }

  async deleteGroup(companyId: number, group: string): Promise<number> {
    return this.repo.deleteGroup(companyId, group.trim().toUpperCase());
  }
}
