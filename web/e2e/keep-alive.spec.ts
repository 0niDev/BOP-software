import { expect, test, type Page } from "@playwright/test";

/**
 * Visited pages stay mounted (hidden) so an unfinished form survives a module
 * switch. Guard the behaviour the users asked for: a half-filled invoice must
 * still be there after adding a missing item in Inventory.
 */
async function signIn(page: Page): Promise<void> {
  await page.goto("/");
  await page.fill("#username", "admin");
  await page.fill("#password", "admin123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("nav")).toBeVisible();
}

test("a half-filled invoice survives switching modules", async ({ page }) => {
  await signIn(page);
  const active = page.locator("main [data-page-active]");

  await page
    .locator("nav")
    .getByRole("button", { name: "Sales Invoices", exact: true })
    .click();
  await active.getByRole("button", { name: "New invoice" }).click();

  const note = active.getByPlaceholder(
    "e.g. Order 123, delivered to warehouse",
  );
  await note.fill("draft kept across tabs");
  const qty = active.locator("tbody tr").first().locator("input").nth(1);
  await qty.fill("12");

  // Leave for another module and come back.
  await page
    .locator("nav")
    .getByRole("button", { name: "Inventory", exact: true })
    .click();
  await expect(
    active.getByRole("heading", { name: /inventory/i }).first(),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("button", { name: "Sales Invoices", exact: true })
    .click();

  await expect(note).toHaveValue("draft kept across tabs");
  await expect(qty).toHaveValue("12");
});
