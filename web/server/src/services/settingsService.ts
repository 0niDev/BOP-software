/**
 * Application settings, ported from services/settings_service.py.
 *
 * Thin business-logic wrapper over SettingsRepository, plus the two tabs that
 * used to be missing from the web port:
 *  - keyboard shortcuts (the desktop app's `SHORTCUTS` group, see
 *    domain/shortcuts.ts) — this is a real editor here, not just stored rows;
 *  - read-only database connection information (the desktop app's `Database`
 *    tab, which only ever displayed the configured connection and warned that a
 *    restart is required).
 */
import fs from "node:fs";
import type { SqlDatabase } from "../db/types.js";
import { ValidationError } from "../domain/errors.js";
import {
  DEFAULT_SHORTCUTS,
  SHORTCUTS_GROUP,
  findShortcutDefinition,
  shortcutSettingKey,
} from "../domain/shortcuts.js";
import { env } from "../env.js";
import { SettingsRepository } from "../repositories/settingsRepository.js";

const THEMES = ["dark", "light", "system", "custom"] as const;

export interface ShortcutEntry {
  actionId: string;
  description: string;
  category: string;
  context: string;
  defaultSequence: string;
  currentSequence: string;
}

export interface DatabaseInfo {
  engine: string;
  /** Resolved file path (local) or credential-masked URL (hosted). */
  location: string;
  /** Where the connection actually comes from. */
  source: string;
  /** SQLite library version reported by the live connection. */
  sqliteVersion: string;
  /** Connection settings are read from the environment at boot. */
  restartRequired: boolean;
  companyId: number;
  currency: string;
}

/** Hide the password in a `sqlitecloud://user:pass@host:port/db` URL. */
function maskConnectionUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const credentials = parsed.username
      ? `${parsed.username}:${parsed.password ? "****" : ""}@`
      : "";
    return `${parsed.protocol}//${credentials}${parsed.host}${parsed.pathname}`;
  } catch {
    return "(unparseable SQLITE_CLOUD_URL)";
  }
}

export class SettingsService {
  private readonly repo: SettingsRepository;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
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

  // --- Shortcuts (desktop app's Shortcuts tab) ---------------------------

  /**
   * One stored value -> the key sequence it holds.
   *
   * The desktop app stores a raw JSON string (`json.dumps(config)` without the
   * repository's `json:` tag), so that is what we write too; a bare key and the
   * tagged-object form are both accepted on read for older rows.
   */
  private static readSequence(value: unknown): string | null {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed) as { current_sequence?: unknown };
          return typeof parsed.current_sequence === "string" && parsed.current_sequence.trim()
            ? parsed.current_sequence.trim()
            : null;
        } catch {
          return null;
        }
      }
      return trimmed;
    }
    if (value && typeof value === "object") {
      const sequence = (value as { current_sequence?: unknown }).current_sequence;
      if (typeof sequence === "string" && sequence.trim()) return sequence.trim();
    }
    return null;
  }

  /** The stored overrides, keyed by action id. */
  private async overrideSequences(companyId: number): Promise<Map<string, string>> {
    const group = await this.repo.getGroup(companyId, SHORTCUTS_GROUP);
    const overrides = new Map<string, string>();
    for (const [key, value] of Object.entries(group)) {
      if (!key.startsWith("shortcut:")) continue;
      const sequence = SettingsService.readSequence(value);
      if (sequence) overrides.set(key.slice("shortcut:".length), sequence);
    }
    return overrides;
  }

  /** Every known action with its default and current key (for the editor). */
  async listShortcuts(companyId: number): Promise<ShortcutEntry[]> {
    const overrides = await this.overrideSequences(companyId);
    return DEFAULT_SHORTCUTS.map((definition) => ({
      actionId: definition.actionId,
      description: definition.description,
      category: definition.category,
      context: definition.context,
      defaultSequence: definition.defaultSequence,
      currentSequence: overrides.get(definition.actionId) ?? definition.defaultSequence,
    }));
  }

  async updateShortcut(
    companyId: number,
    actionId: string,
    sequence: string,
  ): Promise<ShortcutEntry> {
    const definition = findShortcutDefinition(actionId);
    if (!definition) throw new ValidationError(`Unknown shortcut action: ${actionId}`);
    const trimmed = sequence.trim();
    if (!trimmed) throw new ValidationError("A shortcut key is required.");
    // Stored as a plain JSON string (no `json:` tag) exactly like
    // services/settings_service.set_shortcut, so the desktop app's
    // get_all_shortcuts can json.loads() it without blowing up.
    await this.repo.setSetting(
      companyId,
      shortcutSettingKey(actionId),
      JSON.stringify({ action_id: actionId, current_sequence: trimmed }),
      SHORTCUTS_GROUP,
    );
    return {
      actionId,
      description: definition.description,
      category: definition.category,
      context: definition.context,
      defaultSequence: definition.defaultSequence,
      currentSequence: trimmed,
    };
  }

  /** Drop one override so the action falls back to its default key. */
  async resetShortcut(companyId: number, actionId: string): Promise<ShortcutEntry> {
    const definition = findShortcutDefinition(actionId);
    if (!definition) throw new ValidationError(`Unknown shortcut action: ${actionId}`);
    await this.repo.deleteSetting(companyId, shortcutSettingKey(actionId), SHORTCUTS_GROUP);
    return {
      actionId,
      description: definition.description,
      category: definition.category,
      context: definition.context,
      defaultSequence: definition.defaultSequence,
      currentSequence: definition.defaultSequence,
    };
  }

  /** Reset every shortcut (the desktop app's "Reset All to Defaults"). */
  async resetAllShortcuts(companyId: number): Promise<number> {
    return this.repo.deleteGroup(companyId, SHORTCUTS_GROUP);
  }

  // --- Database tab ------------------------------------------------------

  /**
   * Read-only connection summary. The desktop app's Database tab was an inert
   * copy form — it saved db_host/db_user/db_password into `settings` and still
   * needed a restart, because the connection really comes from configuration.
   * Here the connection comes from `web/.env`, so the tab reports it instead of
   * writing a database password into a table every authenticated user can read.
   */
  async databaseInfo(): Promise<DatabaseInfo> {
    const isCloud = env.dbEngine === "sqlitecloud";
    const row = await this.db.get<{ version: string }>("SELECT sqlite_version() AS version");
    return {
      engine: isCloud ? "sqlitecloud (hosted)" : "local (node:sqlite)",
      location: isCloud
        ? maskConnectionUrl(env.sqliteCloudUrl)
        : `${env.localDbPath}${fs.existsSync(env.localDbPath) ? "" : "  (file not created yet)"}`,
      source: isCloud
        ? "SQLITE_CLOUD_URL (web/.env)"
        : "ERP_LOCAL_DB (web/.env)",
      sqliteVersion: String(row?.version ?? "unknown"),
      restartRequired: true,
      companyId: this.companyId,
      currency: env.currency,
    };
  }
}
