/**
 * Application settings: the keyboard-shortcut catalogue (the desktop app's
 * Shortcuts tab) and the read-only database information card (its Database tab).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "../src/domain/errors.js";
import { DEFAULT_SHORTCUTS, SHORTCUTS_GROUP, shortcutSettingKey } from "../src/domain/shortcuts.js";
import { SettingsRepository } from "../src/repositories/settingsRepository.js";
import { SettingsService } from "../src/services/settingsService.js";
import { freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let settings: SettingsService;

beforeEach(async () => {
  ctx = await freshDb();
  settings = new SettingsService(ctx.db, 1);
});
afterEach(async () => {
  await ctx.db.close();
});

describe("SettingsService shortcuts", () => {
  it("lists every default action with its default key", async () => {
    const list = await settings.listShortcuts(1);
    expect(list).toHaveLength(DEFAULT_SHORTCUTS.length);
    expect(list.map((entry) => entry.actionId)).toEqual(
      DEFAULT_SHORTCUTS.map((entry) => entry.actionId),
    );
    for (const entry of list) {
      expect(entry.currentSequence).toBe(entry.defaultSequence);
      expect(entry.description).toBeTruthy();
      expect(["Navigation", "General", "Window", "Edit", "View"]).toContain(entry.category);
    }
    const search = list.find((entry) => entry.actionId === "search")!;
    expect(search.currentSequence).toBe("Ctrl+F");
  });

  it("stores a rebind in the SHORTCUTS group the desktop app reads", async () => {
    const updated = await settings.updateShortcut(1, "search", "Ctrl+Shift+F");
    expect(updated.currentSequence).toBe("Ctrl+Shift+F");

    // Byte-identical to what services/settings_service.set_shortcut writes: a raw
    // JSON string with no `json:` tag, so the desktop app can json.loads() it.
    const stored = await ctx.db.get<{ setting_value: string }>(
      "SELECT setting_value FROM settings WHERE company_id = 1 AND setting_key = ?",
      [shortcutSettingKey("search")],
    );
    expect(stored!.setting_value).toBe(
      '{"action_id":"search","current_sequence":"Ctrl+Shift+F"}',
    );

    const list = await settings.listShortcuts(1);
    expect(list.find((entry) => entry.actionId === "search")!.currentSequence).toBe("Ctrl+Shift+F");
    // Other actions keep their defaults.
    expect(list.find((entry) => entry.actionId === "refresh")!.currentSequence).toBe("Ctrl+R");
  });

  it("accepts a plain-string override written by an older build", async () => {
    const repo = new SettingsRepository(ctx.db);
    await repo.setSetting(1, shortcutSettingKey("new_record"), "Ctrl+Alt+N", SHORTCUTS_GROUP);
    const list = await settings.listShortcuts(1);
    expect(list.find((entry) => entry.actionId === "new_record")!.currentSequence).toBe(
      "Ctrl+Alt+N",
    );
  });

  it("resets one action and then all of them", async () => {
    await settings.updateShortcut(1, "search", "Ctrl+Shift+F");
    await settings.updateShortcut(1, "refresh", "Ctrl+Shift+R");

    const reset = await settings.resetShortcut(1, "search");
    expect(reset.currentSequence).toBe("Ctrl+F");
    let list = await settings.listShortcuts(1);
    expect(list.find((entry) => entry.actionId === "search")!.currentSequence).toBe("Ctrl+F");
    expect(list.find((entry) => entry.actionId === "refresh")!.currentSequence).toBe("Ctrl+Shift+R");

    const removed = await settings.resetAllShortcuts(1);
    expect(removed).toBe(1);
    list = await settings.listShortcuts(1);
    expect(list.every((entry) => entry.currentSequence === entry.defaultSequence)).toBe(true);
  });

  it("rejects unknown actions and blank keys", async () => {
    await expect(settings.updateShortcut(1, "not_an_action", "Ctrl+Q")).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(settings.updateShortcut(1, "search", "   ")).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(settings.resetShortcut(1, "not_an_action")).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe("SettingsService database info", () => {
  it("reports the live connection without exposing credentials", async () => {
    const info = await settings.databaseInfo();
    expect(info.engine).toContain("local");
    expect(info.location).toContain("dev.sqlite");
    expect(info.source).toContain("ERP_LOCAL_DB");
    expect(info.sqliteVersion).toMatch(/^\d+\.\d+/);
    expect(info.restartRequired).toBe(true);
    expect(info.companyId).toBe(1);
    expect(JSON.stringify(info)).not.toContain("password");
  });
});
