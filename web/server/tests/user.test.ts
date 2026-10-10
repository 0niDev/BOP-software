import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConflictError, NotFoundError, ValidationError } from "../src/domain/errors.js";
import { SettingsRepository } from "../src/repositories/settingsRepository.js";
import { AuthService } from "../src/services/authService.js";
import { SettingsService } from "../src/services/settingsService.js";
import { UserService } from "../src/services/userService.js";
import { closeDb, freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let users: UserService;
let auth: AuthService;
let settings: SettingsService;

beforeEach(async () => {
  ctx = await freshDb();
  users = new UserService(ctx.db);
  auth = new AuthService(ctx.db);
  settings = new SettingsService(ctx.db);
});
afterEach(async () => {
  await closeDb(ctx.db);
});

describe("UserService", () => {
  it("lists users with role names and never exposes password material", async () => {
    const list = await users.list();
    expect(list.length).toBeGreaterThan(0);
    const admin = list.find((u) => u.username === "admin");
    expect(admin).toBeDefined();
    expect(admin!.role_name).toBe("Admin");
    for (const row of list) {
      expect(row).not.toHaveProperty("password_hash");
      expect(row).not.toHaveProperty("password_salt");
    }
  });

  it("creates a user who can then log in", async () => {
    const created = await users.create({
      username: "  accountant1  ",
      fullName: "Asha Khan",
      password: "secret123",
      roleName: "Accountant",
      email: "asha@example.com",
    });
    expect(created.username).toBe("accountant1");
    expect(created.role_name).toBe("Accountant");
    expect(created.email).toBe("asha@example.com");
    expect(created.is_active).toBe(1);

    const session = await auth.login("accountant1", "secret123");
    expect(session.fullName).toBe("Asha Khan");
    expect(session.roleName).toBe("Accountant");
  });

  it("rejects a duplicate username, a short password and an unknown role", async () => {
    const input = {
      username: "dup",
      fullName: "Dup",
      password: "secret123",
      roleName: "Admin",
    };
    await users.create(input);
    await expect(users.create(input)).rejects.toBeInstanceOf(ConflictError);
    await expect(
      users.create({ ...input, username: "other", password: "abc" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(users.create({ ...input, username: "other", roleName: "Nobody" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(users.create({ ...input, username: "   ", roleName: "Admin" })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("updates profile, role and status", async () => {
    const created = await users.create({
      username: "clerk1",
      fullName: "Old Name",
      password: "secret123",
      roleName: "Storekeeper",
    });
    const updated = await users.update(created.id, {
      fullName: "New Name",
      roleName: "Manager",
      isActive: false,
    });
    expect(updated.full_name).toBe("New Name");
    expect(updated.role_name).toBe("Manager");
    expect(updated.is_active).toBe(0);

    await expect(auth.login("clerk1", "secret123")).rejects.toThrow(/Invalid username or password/);
    await expect(users.update(999_999, { fullName: "x", roleName: "Admin", isActive: true })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("resets a password without knowing the old one", async () => {
    const created = await users.create({
      username: "resetme",
      fullName: "Reset Me",
      password: "secret123",
      roleName: "Manager",
    });
    await users.resetPassword(created.id, "brandnew1");
    const session = await auth.login("resetme", "brandnew1");
    expect(session.username).toBe("resetme");
    await expect(users.resetPassword(created.id, "abc")).rejects.toBeInstanceOf(ValidationError);
    await expect(users.resetPassword(999_999, "brandnew1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("changes own password only when the current one is right", async () => {
    const created = await users.create({
      username: "selfserve",
      fullName: "Self",
      password: "secret123",
      roleName: "Manager",
    });
    await expect(auth.changePassword(created.id, "wrongpass", "brandnew1")).rejects.toThrow(
      /Current password is incorrect/,
    );
    await auth.changePassword(created.id, "secret123", "brandnew1");
    const session = await auth.login("selfserve", "brandnew1");
    expect(session.username).toBe("selfserve");
  });

  it("exposes the seeded role catalogue", async () => {
    const roles = await users.roles();
    const names = roles.map((r) => r.name);
    expect(names).toContain("Admin");
    expect(names).toContain("Accountant");
    expect(names).toContain("Production Manager");
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("SettingsService", () => {
  it("returns all settings grouped, with the seeded theme", async () => {
    const all = await settings.getAll(1);
    expect(all.APPEARANCE).toBeDefined();
    expect(all.APPEARANCE!.theme_name).toBe("dark");
  });

  it("upserts a group and round-trips values", async () => {
    const before = await settings.getGroup(1, "SHORTCUTS");
    expect(before).toEqual({});

    await settings.setGroup(1, "shortcuts", { "shortcut:new_invoice": "Ctrl+N" });
    expect(await settings.getGroup(1, "SHORTCUTS")).toEqual({ "shortcut:new_invoice": "Ctrl+N" });

    await settings.setGroup(1, "SHORTCUTS", { "shortcut:new_invoice": "Ctrl+Shift+N" });
    expect(await settings.getGroup(1, "SHORTCUTS")).toEqual({ "shortcut:new_invoice": "Ctrl+Shift+N" });

    const removed = await settings.deleteGroup(1, "SHORTCUTS");
    expect(removed).toBe(1);
    expect(await settings.getGroup(1, "SHORTCUTS")).toEqual({});
  });

  it("stores objects with the same json: tag the Python app writes", async () => {
    const raw = new SettingsRepository(ctx.db);
    await raw.setSetting(1, "custom_theme", { accent: "#8b1a2b" }, "APPEARANCE");
    const stored = await ctx.db.get<{ setting_value: string }>(
      `SELECT setting_value FROM settings WHERE company_id = 1 AND setting_key = 'custom_theme'`,
    );
    expect(stored?.setting_value).toBe('json:{"accent":"#8b1a2b"}');
    expect(await settings.getGroup(1, "APPEARANCE")).toMatchObject({ custom_theme: { accent: "#8b1a2b" } });
  });

  it("rejects an invalid theme and an empty group", async () => {
    await expect(settings.setGroup(1, "APPEARANCE", { theme_name: "neon" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(settings.setGroup(1, "   ", { a: "b" })).rejects.toBeInstanceOf(ValidationError);
    expect(await settings.getGroup(1, "APPEARANCE")).toMatchObject({ theme_name: "dark" });
  });
});
