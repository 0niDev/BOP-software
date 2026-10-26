/**
 * Browser UI audit.
 *
 * The one acceptance item that needs a browser: every page is driven in Chromium
 * against a database seeded with the rich demo data and checked for
 *
 *  - console errors / page errors / failed or 4xx API calls,
 *  - horizontal page overflow and elements pushed out of the viewport,
 *  - text clipped by a fixed-size container,
 *  - controls too small to hit, or overlapping each other,
 *  - pages that render no data even though the demo dataset guarantees it,
 *
 * plus a full-page screenshot per page in `e2e/.artifacts/` for a human look.
 * Run with `npm run test:e2e` (boots the API + Vite dev server itself).
 */
import { expect, test, type Dialog, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** Playwright runs with web/ as the working directory (where the config lives). */
const ARTIFACTS = path.resolve("e2e", ".artifacts");

interface PageUnderAudit {
  nav: string;
  /** The rich demo data guarantees this page has something to show. */
  expectData?: boolean;
}

const PAGES: PageUnderAudit[] = [
  { nav: "Dashboard", expectData: true },
  { nav: "Sales Invoices", expectData: true },
  { nav: "Purchase Invoices", expectData: true },
  { nav: "Payments & Receipts", expectData: true },
  { nav: "Manufacturing", expectData: true },
  { nav: "Expenses", expectData: true },
  { nav: "Banking", expectData: true },
  { nav: "Returns", expectData: true },
  { nav: "Customers & Suppliers", expectData: true },
  { nav: "Items", expectData: true },
  { nav: "Fixed Assets", expectData: true },
  { nav: "Chart of Accounts", expectData: true },
  { nav: "Reports", expectData: true },
  { nav: "Users", expectData: true },
  { nav: "Settings" },
  { nav: "Deleted Records" },
];

interface Monitor {
  errors: string[];
  apiFailures: string[];
}

/** Watch console/page errors and failed API calls for the whole test. */
function monitor(page: Page): Monitor {
  const errors: string[] = [];
  const apiFailures: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // The Vite/React dev-server tip is not an application error.
    if (/React DevTools/i.test(message.text())) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("response", (response) => {
    if (!response.url().includes("/api/")) return;
    if (response.status() >= 400) {
      apiFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    if (!request.url().includes("/api/")) return;
    apiFailures.push(`request failed: ${request.url()}`);
  });
  return { errors, apiFailures };
}

async function signIn(page: Page): Promise<void> {
  await page.goto("/");
  await page.fill("#username", "admin");
  await page.fill("#password", "admin123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("nav")).toBeVisible();
}

async function openPage(page: Page, nav: string): Promise<void> {
  await page.locator("nav").getByRole("button", { name: nav, exact: true }).click();
  // Let the page's data fetch settle before measuring.
  await page.waitForTimeout(500);
}

/** Layout problems for the page on screen, plus how much data it shows. */
async function auditLayout(
  page: Page,
): Promise<{ problems: string[]; amounts: number; rows: number }> {
  return page.evaluate(() => {
    const problems: string[] = [];
    const label = (el: Element): string => {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : "";
      const cls =
        typeof el.className === "string" && el.className.trim()
          ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
          : "";
      const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      return `<${tag}${id}${cls}>${text ? ` "${text}"` : ""}`;
    };
    const isVisible = (el: Element): boolean => {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const insideScroller = (el: Element): boolean => {
      for (let node = el.parentElement; node; node = node.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(node).overflowX)) return true;
      }
      return false;
    };

    const main = document.querySelector("main");
    if (!main) return { problems: ["the page has no <main>"], amounts: 0, rows: 0 };

    const doc = document.documentElement;
    if (doc.scrollWidth - doc.clientWidth > 1) {
      problems.push(`page scrolls horizontally (${doc.scrollWidth} > ${doc.clientWidth})`);
    }

    const viewport = window.innerWidth;
    for (const el of Array.from(main.querySelectorAll("*"))) {
      if (!isVisible(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.right > viewport + 1 && !insideScroller(el)) {
        problems.push(`${label(el)} runs ${Math.round(rect.right - viewport)}px past the viewport`);
      }
      if (
        /(hidden|clip)/.test(getComputedStyle(el).overflowX) &&
        el.scrollWidth > el.clientWidth + 2 &&
        (el.textContent ?? "").trim()
      ) {
        problems.push(`${label(el)} clips text (${el.scrollWidth}px inside ${el.clientWidth}px)`);
      }
    }

    const controls = Array.from(main.querySelectorAll("button, input, select, a[href]")).filter(
      isVisible,
    );
    for (const el of controls) {
      const rect = el.getBoundingClientRect();
      if (rect.height < 18 || rect.width < 6) {
        problems.push(`${label(el)} is only ${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }
    }
    for (let i = 0; i < controls.length; i += 1) {
      for (let j = i + 1; j < controls.length; j += 1) {
        const a = controls[i]!;
        const b = controls[j]!;
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const overlapX = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const overlapY = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (overlapX > 6 && overlapY > 6) problems.push(`${label(a)} overlaps ${label(b)}`);
      }
    }

    const amounts = Array.from(main.querySelectorAll("*")).filter(
      (el) => el.children.length === 0 && /\d[\d,]*\.\d{2}/.test(el.textContent ?? ""),
    ).length;

    return { problems: problems.slice(0, 10), amounts, rows: main.querySelectorAll("tbody tr").length };
  });
}

function screenshotName(nav: string): string {
  return `${nav.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}.png`;
}

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});

for (const entry of PAGES) {
  test(`renders ${entry.nav} without layout or runtime problems`, async ({ page }) => {
    const watched = monitor(page);
    await signIn(page);
    await openPage(page, entry.nav);

    await expect(page.locator("main").locator("h1, h2").first()).toBeVisible();
    expect(await page.locator("main .error").count(), "page shows an error banner").toBe(0);

    const { problems, amounts, rows } = await auditLayout(page);
    await page.screenshot({ path: path.join(ARTIFACTS, screenshotName(entry.nav)), fullPage: true });

    expect(problems).toEqual([]);
    if (entry.expectData) {
      expect(amounts + rows, "the demo data should show at least one amount or row").toBeGreaterThan(0);
    }
    expect(watched.errors).toEqual([]);
    expect(watched.apiFailures).toEqual([]);
  });
}

test("keyboard shortcuts switch modules and focus search", async ({ page }) => {
  await signIn(page);

  // Ctrl+5 is module 5 (Manufacturing) and Ctrl+2 module 2 (Sales Invoices).
  await page.keyboard.press("Control+5");
  await expect(
    page.locator("nav").getByRole("button", { name: "Manufacturing", exact: true }),
  ).toHaveClass(/active/);

  await page.keyboard.press("Control+2");
  await expect(
    page.locator("nav").getByRole("button", { name: "Sales Invoices", exact: true }),
  ).toHaveClass(/active/);

  // On a page with no filter of its own, the search shortcut falls back to the
  // sidebar module finder...
  await page.keyboard.press("Control+f");
  expect(await focusedPlaceholder(page)).toMatch(/find module/i);

  // ...and on a page that does have one (Items), it focuses that instead.
  await openPage(page, "Items");
  await page.keyboard.press("Control+f");
  expect(await focusedPlaceholder(page)).toMatch(/search/i);
});

async function focusedPlaceholder(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    return el instanceof HTMLInputElement ? (el.placeholder ?? "") : "";
  });
}

test("the dashboard sorts its best sellers and links a row to its module", async ({ page }) => {
  const watched = monitor(page);
  await signIn(page);
  await openPage(page, "Dashboard");

  const table = page.getByRole("table", { name: "Best selling items" });
  await expect(table).toBeVisible();

  const revenues = async (): Promise<number[]> =>
    (await table.locator("tbody tr td:nth-child(4)").allInnerTexts()).map((text) =>
      Number(text.replace(/[^\d.-]/g, "")),
    );

  // Ranked by revenue, highest first…
  const descending = await revenues();
  expect(descending.length, "the demo data should have a best seller").toBeGreaterThan(0);
  expect(descending).toEqual([...descending].sort((a, b) => b - a));

  // …with the avatar tile, revenue share bar and per-column sort state.
  await expect(table.locator("tbody tr .thumb").first()).toBeVisible();
  await expect(table.locator("tbody .meter").first()).toBeVisible();

  const revenueHeader = table.getByRole("columnheader", { name: /revenue/i });
  await expect(revenueHeader).toHaveAttribute("aria-sort", "descending");
  await table.getByRole("button", { name: /revenue/i }).click();
  await expect(revenueHeader).toHaveAttribute("aria-sort", "ascending");
  const ascending = await revenues();
  expect(ascending).toEqual([...ascending].sort((a, b) => a - b));
  await table.getByRole("button", { name: /revenue/i }).click();
  await expect(revenueHeader).toHaveAttribute("aria-sort", "descending");

  // A row's action menu links to the module that owns the transaction.
  await page.getByRole("button", { name: /^Actions for this/ }).first().click();
  const menu = page.getByRole("menu").first();
  await expect(menu).toBeVisible();
  const openIn = menu.getByRole("menuitem", { name: /^Open in / }).first();
  const target = (await openIn.innerText()).replace(/^Open in /, "").trim();
  await openIn.click();
  await expect(
    page.locator("nav").getByRole("button", { name: target, exact: true }),
  ).toHaveClass(/active/);

  expect(watched.errors).toEqual([]);
  expect(watched.apiFailures).toEqual([]);
});

test("the Shortcuts editor and Database card work end to end", async ({ page }) => {
  const watched = monitor(page);
  await signIn(page);
  await openPage(page, "Settings");

  const card = page.locator(".card", { hasText: "Shortcuts" });
  const rows = card.locator("tbody tr");
  await expect(rows).toHaveCount(26);

  // Rebinding through the UI persists and can be reset again.
  const searchRow = rows.filter({ hasText: "Focus search" });
  await searchRow.getByRole("button", { name: "Edit" }).click();
  const capture = searchRow.locator("input[readonly]");
  await capture.press("Control+Shift+f");
  await expect(capture).toHaveValue("Ctrl+Shift+F");
  await searchRow.getByRole("button", { name: "Save" }).click();
  await expect(searchRow.locator("code")).toHaveText("Ctrl+Shift+F");
  await searchRow.getByRole("button", { name: "Reset" }).click();
  await expect(searchRow.locator("code")).toHaveText("Ctrl+F");

  const database = page.locator(".card", { hasText: "Database" });
  await expect(database).toContainText("SQLite version");
  await expect(database).toContainText("local");

  expect(watched.errors).toEqual([]);
  expect(watched.apiFailures).toEqual([]);
});

test("the Manufacturing page creates a formulation BOM and produces an unpacked batch", async ({
  page,
}) => {
  const watched = monitor(page);
  await signIn(page);
  await openPage(page, "Manufacturing");

  // Unique names so a re-run against the same demo database never clashes.
  const bomName = `E2E Formulation ${Date.now().toString(36).slice(-4)}`;

  // Three stages, each its own tab.
  const tabs = page.getByRole("tablist");
  await expect(tabs.getByRole("tab")).toHaveText(["Formulations", "Production", "Packing"]);

  // A formulation BOM asks only for raw materials: its "(Unpacked)" output
  // item is created in inventory automatically.
  const bomForm = page.locator("form", { hasText: "New bill of materials" });
  await expect(bomForm.getByRole("combobox", { name: "Finished output item" })).toHaveCount(0);
  await bomForm.getByPlaceholder("e.g. Syrup 500ml").fill(bomName);
  await pickCombobox(
    page,
    bomForm.getByRole("combobox", { name: "Component item" }),
    "Demo Raw Material",
  );
  await bomForm.locator('input[aria-label="Component quantity"]').fill("5");
  await bomForm.getByRole("button", { name: "Create BOM" }).click();
  await expect(page.locator(".badge", { hasText: `Created BOM ${bomName}` })).toBeVisible();

  const bomRow = page.locator("tbody tr", { hasText: bomName });
  await expect(bomRow).toContainText("Formulation");
  await expect(bomRow).toContainText(`(Unpacked) ${bomName}`);

  // Production: pick the saved formulation BOM, plan 10, start, produce 10.
  await page.getByRole("tab", { name: "Production" }).click();
  const orderForm = page.locator("form", { hasText: "New production order" });
  await pickCombobox(
    page,
    orderForm.getByRole("combobox", { name: "Production BOM" }),
    bomName,
  );
  await expect(orderForm).toContainText("Components from this BOM");
  await orderForm.locator('input[aria-label="Total output quantity"]').fill("5");
  await orderForm.getByRole("button", { name: "Create order" }).click();
  await expect(page.locator(".badge", { hasText: "Created production order" })).toBeVisible();

  const ordersCard = page.locator(".card", { hasText: "Production orders" });
  const newest = ordersCard.locator("tbody tr").first();
  const orderNumber = (await newest.locator("td").first().innerText()).trim();
  const orderRow = ordersCard.locator("tbody tr", { hasText: orderNumber });
  await orderRow.getByRole("button", { name: "Start" }).click();
  await expect(orderRow.getByRole("button", { name: "Produce" })).toBeVisible();

  // Produce asks for the unpacked quantity, then the batch number.
  const answers = ["5", "E2E-UNPACKED"];
  const onDialog = (dialog: Dialog) => void dialog.accept(answers.shift() ?? "");
  page.on("dialog", onDialog);
  await orderRow.getByRole("button", { name: "Produce" }).click();
  await expect(orderRow).toContainText("COMPLETED");
  await expect(orderRow).toContainText("E2E-UNPACKED");
  page.off("dialog", onDialog);

  expect(watched.errors).toEqual([]);
  expect(watched.apiFailures).toEqual([]);
});

test("manual production and packing runs save their BOMs and honour Ignore stock", async ({
  page,
}) => {
  const watched = monitor(page);
  await signIn(page);
  await openPage(page, "Manufacturing");
  await page.getByRole("tab", { name: "Production" }).click();

  // Unique names so a re-run against the same demo database never clashes.
  const stamp = Date.now().toString(36).slice(-4);
  const runName = `E2E Manual Run ${stamp}`;
  const packingName = `E2E Packing ${stamp}`;

  // No saved BOM selected: enter the run's totals and a name to save them as a
  // per-unit BOM.
  const orderForm = page.locator("form", { hasText: "New production order" });
  await expect(orderForm.getByRole("combobox", { name: "Production BOM" })).toHaveValue(
    /Manual run/,
  );
  await orderForm.getByPlaceholder("e.g. Syrup 500ml").fill(runName);
  await pickCombobox(
    page,
    orderForm.getByRole("combobox", { name: "Raw material" }),
    "Demo Raw Material",
  );
  await orderForm.locator('input[aria-label="Total output quantity"]').fill("10");
  await orderForm.locator('input[aria-label="Total consumed"]').fill("20");
  await orderForm.getByRole("button", { name: "Create order" }).click();
  await expect(page.locator(".badge", { hasText: "Created production order" })).toBeVisible();

  const ordersCard = page.locator(".card", { hasText: "Production orders" });
  const newest = ordersCard.locator("tbody tr").first();
  const orderNumber = (await newest.locator("td").first().innerText()).trim();
  const orderRow = ordersCard.locator("tbody tr", { hasText: orderNumber });
  await orderRow.getByRole("button", { name: "Start" }).click();
  await orderRow.getByRole("checkbox").check();

  const answers = ["10", "E2E-MANUAL-UNPACKED"];
  const onDialog = (dialog: Dialog) => void dialog.accept(answers.shift() ?? "");
  page.on("dialog", onDialog);
  await orderRow.getByRole("button", { name: "Produce" }).click();
  await expect(orderRow).toContainText("COMPLETED");
  page.off("dialog", onDialog);

  // Packing: an independent order that turns the unpacked bulk plus packaging
  // into the finished good. Unpacked used = items generated x size per item.
  await page.getByRole("tab", { name: "Packing" }).click();
  const packingForm = page.locator("form", { hasText: "New packing order" });
  await expect(packingForm.getByRole("combobox", { name: "Packing BOM" })).toHaveValue(
    /Manual run/,
  );
  await packingForm.getByPlaceholder("e.g. Syrup 500ml bottle").fill(packingName);
  await pickCombobox(
    page,
    packingForm.getByRole("combobox", { name: "Output item" }),
    "Demo Small Bottle",
  );
  await pickCombobox(
    page,
    packingForm.getByRole("combobox", { name: "Unpacked material" }),
    `(Unpacked) ${runName}`,
  );
  // The unit picker is the two metric pairs: g/ml first, kg/lit second.
  await expect(packingForm.locator("select")).toContainText("g/ml");
  await expect(packingForm.locator("select")).toContainText("kg/lit");
  await expect(packingForm.locator("select")).toHaveValue("KG_LIT");
  await packingForm.locator('input[aria-label="Items generated"]').fill("10");
  await packingForm.locator('input[aria-label="Size per item"]').fill("1");
  await expect(packingForm.locator(".badge", { hasText: "Unpacked used: 10 KG" })).toBeVisible();
  await pickCombobox(
    page,
    packingForm.getByRole("combobox", { name: "Packing material" }),
    "Demo Packing Box",
  );
  await packingForm.locator('input[aria-label="Total used"]').fill("10");
  await packingForm.getByRole("button", { name: "Create packing order" }).click();
  await expect(page.locator(".badge", { hasText: "Created packing order" })).toBeVisible();

  const packingCard = page.locator(".card", { hasText: "Packing orders" });
  const newestPack = packingCard.locator("tbody tr").first();
  const packNumber = (await newestPack.locator("td").first().innerText()).trim();
  const packRow = packingCard.locator("tbody tr", { hasText: packNumber });
  await packRow.getByRole("button", { name: "Start" }).click();
  await packRow.getByRole("button", { name: "Pack" }).click();

  // The pack dialog is prefilled from the saved BOM, scaled to the order.
  const packCard = page.locator(".card", { hasText: "Pack order" });
  await expect(packCard.locator('input[aria-label="Items generated"]')).toHaveValue("10");
  await expect(packCard.locator('input[aria-label="Unpacked used"]')).toHaveValue("10");
  await expect(packCard.locator('input[aria-label="Quantity used"]')).toHaveValue("10");

  // Ignore stock skips the stock check and deduction; the pack still completes.
  await packCard.getByRole("checkbox").check();
  page.once("dialog", (dialog) => void dialog.accept("E2E-PACKED"));
  await packCard.getByRole("button", { name: "Confirm pack" }).click();
  await expect(page.locator(".badge", { hasText: "Packed 10" })).toBeVisible();
  await expect(packRow).toContainText("COMPLETED");

  expect(watched.errors).toEqual([]);
  expect(watched.apiFailures).toEqual([]);
});

/** Open a type-to-filter combobox, narrow it, and click the first match. */
async function pickCombobox(page: Page, combo: Locator, query: string): Promise<void> {
  await combo.click();
  await combo.fill(query);
  await page.getByRole("option", { name: query }).first().click();
}

/** Labels in this app wrap their control, so match the label text directly. */
function getByLabelText(scope: ReturnType<Page["locator"]>, text: string) {
  return scope.locator("label", { hasText: text }).locator("input, select");
}

/** Pages that own a filter box (FilterBox.tsx sets `data-search`). */
const FILTERED_PAGES = [
  "Items",
  "Customers & Suppliers",
  "Payments & Receipts",
  "Expenses",
  "Fixed Assets",
  "Users",
];

test("typography, number alignment and hit targets hold on every page", async ({ page }) => {
  await signIn(page);
  for (const entry of PAGES) {
    await openPage(page, entry.nav);
    const findings = await page.evaluate(() => {
      const problems: string[] = [];
      const main = document.querySelector("main");
      if (!main) return ["the page has no <main>"];
      const isVisible = (el: Element): boolean => {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      for (const el of Array.from(main.querySelectorAll("*"))) {
        if (el.children.length > 0 || !isVisible(el)) continue;
        const text = (el.textContent ?? "").trim();
        if (!text) continue;
        const size = Number.parseFloat(getComputedStyle(el).fontSize);
        if (size < 11) problems.push(`text "${text.slice(0, 30)}" is only ${size}px`);
      }
      for (const cell of Array.from(main.querySelectorAll("td.num, th.num"))) {
        const align = getComputedStyle(cell).textAlign;
        if (align !== "right") problems.push(`a .num cell is ${align}-aligned`);
      }
      for (const table of Array.from(main.querySelectorAll("table"))) {
        const hasHeaders =
          table.querySelectorAll("thead th").length > 0 ||
          // key/value tables (e.g. the Database card) label each row with a <th>.
          table.querySelectorAll("tbody th").length > 0;
        if (table.querySelectorAll("tbody tr").length > 0 && !hasHeaders) {
          problems.push("a populated table has no header cells");
        }
      }
      for (const control of Array.from(main.querySelectorAll("button, select, input:not([type=checkbox])"))) {
        if (!isVisible(control)) continue;
        const height = control.getBoundingClientRect().height;
        if (height < 24) problems.push(`a ${control.tagName.toLowerCase()} is only ${Math.round(height)}px tall`);
      }
      return problems.slice(0, 10);
    });
    expect(findings, `on ${entry.nav}`).toEqual([]);
  }
});

test("filtering a page down to nothing shows an empty state, not an error", async ({ page }) => {
  const watched = monitor(page);
  await signIn(page);
  for (const nav of FILTERED_PAGES) {
    await openPage(page, nav);
    const filter = page.locator("main [data-search]").first();
    await expect(filter, `${nav} should have a filter box`).toBeVisible();
    await filter.fill("zzzzz-no-match");
    await page.waitForTimeout(250);
    const text = await page.locator("main").innerText();
    expect(text, `${nav} shows no empty-state message while filtered`).toMatch(
      /no .*(match|yet)|nothing/i,
    );
    expect(await page.locator("main .error").count(), `${nav} shows an error while filtered`).toBe(0);
    await filter.fill("");
  }
  expect(watched.errors).toEqual([]);
  expect(watched.apiFailures).toEqual([]);
});

test("no page overflows horizontally at 1280 or 1024 px", async ({ page }) => {
  await signIn(page);
  for (const width of [1280, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    for (const entry of PAGES) {
      await openPage(page, entry.nav);
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(overflow, `${entry.nav} overflows at ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});

/**
 * The Excel exports are downloaded by a real click, so this exercises the whole
 * path — React -> Vite proxy -> Express -> workbook bytes -> file on disk —
 * rather than the endpoint alone.
 */
test("reports download as Excel workbooks from the Reports page", async ({ page }) => {
  const watched = monitor(page);
  await signIn(page);
  await openPage(page, "Reports");

  const trialBalanceCard = page
    .locator(".card")
    .filter({ has: page.getByRole("heading", { name: /^Trial Balance/ }) });
  const tbExport = trialBalanceCard.getByRole("button", { name: "Export Excel" });
  await expect(tbExport).toBeEnabled();

  const [single] = await Promise.all([page.waitForEvent("download"), tbExport.click()]);
  expect(single.suggestedFilename()).toMatch(/^trial-balance_.*\.xlsx$/);
  const singlePath = await single.path();
  expect(singlePath, "the workbook should reach disk").toBeTruthy();
  const singleSize = fs.statSync(singlePath as string).size;
  expect(singleSize).toBeGreaterThan(1000);

  const exportAllCard = page
    .locator(".card")
    .filter({ has: page.getByRole("heading", { name: "Export all reports" }) });
  const allExport = exportAllCard.getByRole("button", { name: "Download all reports (Excel)" });
  await expect(allExport).toBeEnabled();

  const [combined] = await Promise.all([page.waitForEvent("download"), allExport.click()]);
  expect(combined.suggestedFilename()).toMatch(/^all-reports_.*\.xlsx$/);
  const combinedPath = await combined.path();
  expect(combinedPath, "the combined workbook should reach disk").toBeTruthy();
  // Four sheets weigh more than one.
  expect(fs.statSync(combinedPath as string).size).toBeGreaterThan(singleSize);

  // The CSV exports now share the same download helper, so keep them covered.
  const [tbCsv] = await Promise.all([
    page.waitForEvent("download"),
    trialBalanceCard.getByRole("button", { name: "Export CSV" }).click(),
  ]);
  expect(tbCsv.suggestedFilename()).toBe("trial-balance.csv");
  const csvPath = await tbCsv.path();
  expect(fs.readFileSync(csvPath as string, "utf8")).toContain(
    "Account Code,Account Name,Type,Opening Debit",
  );

  const [allCsv] = await Promise.all([
    page.waitForEvent("download"),
    exportAllCard.getByRole("button", { name: "Download all reports (CSV)" }).click(),
  ]);
  expect(allCsv.suggestedFilename()).toMatch(/^all-reports_.*\.csv$/);
  const allCsvPath = await allCsv.path();
  expect(fs.readFileSync(allCsvPath as string, "utf8")).toContain("Trial Balance");

  expect(watched.errors).toEqual([]);
  expect(watched.apiFailures).toEqual([]);
});
