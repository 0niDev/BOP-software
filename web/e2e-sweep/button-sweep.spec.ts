/**
 * Button sweep: drive every page in a real browser, click every distinct button
 * with a real Playwright click (mousedown -> mouseup -> click), and report what
 * each one does.
 *
 * SAFETY: every non-GET request to /api is intercepted at the BROWSER and
 * fulfilled locally, so no button click can write to the database the app is
 * pointed at. Signing in is the single exception (it stamps last_login_at).
 * Blocked writes are recorded and reported — a "Save"/"Post" button is
 * exercised right up to the point where it would mutate data.
 *
 * Every measurement waits for the page's own /api fetches to finish first, so a
 * verdict is never taken against a half-rendered table.
 *
 * Run against an already-running stack:
 *   npx playwright test --config=e2e-sweep/playwright.sweep.config.ts
 */
import { test, type Locator, type Page } from "@playwright/test";

const NAV = [
  "Dashboard",
  "Sales Invoices",
  "Purchase Invoices",
  "Payments & Receipts",
  "Manufacturing",
  "Expenses",
  "Banking",
  "Returns",
  "Customers & Suppliers",
  "Items",
  "Fixed Assets",
  "Chart of Accounts",
  "Reports",
  "Users",
  "Settings",
];

/** Distinct labels clicked per page — bounds the run on tables with 1000s of rows. */
const MAX_CLICKS_PER_PAGE = 45;

interface Row {
  page: string;
  button: string;
  instances: number;
  disabled: boolean;
  covered: string;
  submit: boolean;
  clickable: string;
  outcome: string;
  http: string[];
  writes: string[];
  errors: string[];
}

const ROWS: Row[] = [];

const short = (url: string): string => url.replace(/^https?:\/\/[^/]+/, "").split("?")[0] ?? url;

/** Console/page errors, API traffic and in-flight GETs. Reset per click. */
class Recorder {
  http: string[] = [];
  writes: string[] = [];
  errors: string[] = [];
  pending = 0;

  constructor(page: Page) {
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      if (/React DevTools|Download the React/i.test(message.text())) return;
      this.errors.push(`console: ${message.text().slice(0, 130)}`);
    });
    page.on("pageerror", (error) => {
      this.errors.push(`pageerror: ${String(error).slice(0, 130)}`);
    });
    page.on("request", (request) => {
      if (request.url().includes("/api/") && request.method() === "GET") this.pending += 1;
    });
    page.on("requestfinished", (request) => {
      if (request.url().includes("/api/") && request.method() === "GET") this.pending -= 1;
    });
    page.on("requestfailed", (request) => {
      if (request.url().includes("/api/") && request.method() === "GET") this.pending -= 1;
    });
    page.on("response", (response) => {
      if (!response.url().includes("/api/")) return;
      const method = response.request().method();
      if (method !== "GET" && method !== "HEAD") return;
      this.http.push(`${method} ${short(response.url())} ${response.status()}`);
    });
  }

  reset(): void {
    this.http = [];
    this.writes = [];
    this.errors = [];
  }
}

/**
 * Fulfil every write locally instead of sending it. The response body matches
 * the app's error shape so the UI surfaces an ordinary failure rather than
 * hanging.
 */
async function blockWrites(page: Page, recorder: Recorder): Promise<void> {
  await page.route("**/api/**", async (route) => {
    const method = route.request().method();
    // Signing in must reach the server or there is nothing to sweep. It is the
    // one write that is inherent to using the app at all (users.last_login_at).
    const isLogin = route.request().url().includes("/api/auth/login");
    if (method === "GET" || method === "HEAD" || method === "OPTIONS" || isLogin) {
      await route.continue();
      return;
    }
    recorder.writes.push(`${method} ${short(route.request().url())}`);
    await route.fulfill({
      status: 599,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "BLOCKED_BY_SWEEP", message: "write blocked by the read-only sweep" },
      }),
    });
  });
}

/** Wait until the page has no /api GETs in flight and React has re-rendered. */
async function settle(page: Page, recorder: Recorder, timeoutMs = 20_000): Promise<void> {
  const start = Date.now();
  await page.waitForTimeout(200);
  while (recorder.pending > 0 && Date.now() - start < timeoutMs) {
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(250);
}

async function signInSafely(page: Page): Promise<void> {
  if (await page.locator("nav").isVisible().catch(() => false)) return;
  await page.goto("/");
  await page.fill("#username", "admin");
  await page.fill("#password", "admin123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.locator("nav").waitFor({ state: "visible", timeout: 30_000 });
}

async function openPage(page: Page, nav: string, recorder: Recorder): Promise<void> {
  await page.locator("nav").getByRole("button", { name: nav, exact: true }).click();
  await settle(page, recorder);
}

/** What the button looks like and whether anything sits on top of it. */
/** The label a button is currently showing, bounded so a stale index cannot stall. */
async function buttonLabel(button: Locator): Promise<string> {
  return button.evaluate(
    (el) =>
      (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40) ||
      "«no text»",
    undefined,
    { timeout: 3_000 },
  );
}

/** What the button looks like and whether anything sits on top of it. */
async function describe(button: Locator): Promise<{
  covered: string;
  visible: boolean;
  size: string;
  inViewport: boolean;
}> {
  return button.evaluate(
    (el) => {
    const rect = el.getBoundingClientRect();
    const cx = Math.min(Math.max(rect.left + rect.width / 2, 1), window.innerWidth - 1);
    const cy = Math.min(Math.max(rect.top + rect.height / 2, 1), window.innerHeight - 1);
    const top = document.elementFromPoint(cx, cy);
    const style = getComputedStyle(el);
    return {
      covered:
        top && top !== el && !el.contains(top)
          ? `${top.tagName.toLowerCase()}${
              typeof top.className === "string" && top.className.trim()
                ? `.${top.className.trim().split(/\s+/)[0]}`
                : ""
            } "${(top.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30)}"`
          : "",
      visible:
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) > 0 &&
        rect.width > 0 &&
        rect.height > 0,
      size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
      inViewport: rect.top >= -1 && rect.bottom <= window.innerHeight + 1,
    };
    },
    undefined,
    { timeout: 5_000 },
  );
}

interface Fingerprint {
  url: string;
  rows: number;
  textLen: number;
  dialogs: number;
  active: string;
}

async function fingerprint(page: Page): Promise<Fingerprint> {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    const active = document.activeElement as HTMLElement | null;
    return {
      url: location.href,
      rows: main ? main.querySelectorAll("tbody tr").length : 0,
      textLen: main ? (main.innerText ?? "").length : 0,
      dialogs: document.querySelectorAll('[role="dialog"], dialog, .modal').length,
      active: active ? `${active.tagName.toLowerCase()}${active.id ? `#${active.id}` : ""}` : "none",
    };
  });
}

function describeChange(before: Fingerprint, after: Fingerprint): string {
  if (after.url !== before.url) return `navigated -> ${short(after.url)}`;
  if (after.dialogs > before.dialogs) return `modal opened (${before.dialogs}->${after.dialogs})`;
  if (after.rows !== before.rows) return `table rows ${before.rows}->${after.rows}`;
  const delta = after.textLen - before.textLen;
  if (Math.abs(delta) > 20) return `content changed (${delta > 0 ? "+" : ""}${delta} chars)`;
  if (after.active !== before.active) return `focus moved to ${after.active}`;
  return "no visible change";
}

async function resetTo(page: Page, nav: string, recorder: Recorder): Promise<void> {
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.reload();
  await signInSafely(page);
  await openPage(page, nav, recorder);
}

function printRows(rows: Row[], title: string): void {
  console.log(`\n===== SWEEP RESULTS: ${title} =====`);
  console.log(
    "| Button | # | Disabled | Covered | Clickable | Result | HTTP | Blocked writes | Console errors |",
  );
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of rows) {
    console.log(
      `| ${r.button || "«no text»"} | ${r.instances} | ${r.disabled ? "yes" : "no"} | ${
        r.covered || "-"
      } | ${r.clickable} | ${r.outcome} | ${r.http.join("; ") || "-"} | ${
        r.writes.join("; ") || "-"
      } | ${r.errors.join("; ") || "-"} |`,
    );
  }
}

async function sweepPage(page: Page, nav: string, recorder: Recorder): Promise<void> {
  const pageRows: Row[] = [];

  const metas = await page.evaluate(() =>
    Array.from(document.querySelectorAll("main button")).map((el) => ({
      label:
        (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40) ||
        "«no text»",
      disabled: (el as HTMLButtonElement).disabled === true,
      submit: (el as HTMLButtonElement).type === "submit",
    })),
  );

  // One click per distinct label: a table with 1737 rows has thousands of
  // identical Edit buttons, and the question is whether the handler works, not
  // whether row 900 differs from row 3.
  const groups: Array<{
    label: string;
    index: number;
    count: number;
    disabled: boolean;
    submit: boolean;
  }> = [];
  const seen = new Map<string, number>();
  metas.forEach((meta, index) => {
    const existing = seen.get(meta.label);
    if (existing === undefined) {
      seen.set(meta.label, groups.length);
      groups.push({
        label: meta.label,
        index,
        count: 1,
        disabled: meta.disabled,
        submit: meta.submit,
      });
    } else {
      groups[existing]!.count += 1;
    }
  });

  const limited = groups.slice(0, MAX_CLICKS_PER_PAGE);
  console.log(
    `\n[${nav}] ${metas.length} <button> elements, ${groups.length} distinct labels` +
      (limited.length < groups.length ? ` (clicking the first ${limited.length})` : ""),
  );

  for (const group of limited) {
    const button = page.locator("main button").nth(group.index);
    await button.scrollIntoViewIfNeeded({ timeout: 3_000 }).catch(() => undefined);
    const look = await describe(button).catch(() => null);

    recorder.reset();
    const before = await fingerprint(page);
    let clickable = "yes";
    let outcome: string;

    try {
      // Real click: Playwright dispatches mousedown/mouseup/click and enforces
      // that the element is visible, stable, enabled and receives events.
      await button.click({ timeout: 4_000 });
      await settle(page, recorder, 6_000);
      const after = await fingerprint(page);
      outcome = describeChange(before, after);
      // Always return to a clean page between clicks. A conditional reset is not
      // enough: a click that only moves focus ("Edit" on the shortcuts table)
      // still mutates the DOM (Save/Cancel appear), which shifts every later
      // index in the button list and makes the next click target the wrong node.
      await resetTo(page, nav, recorder);
    } catch (error) {
      if (group.disabled) {
        // A disabled control is *meant* to refuse clicks. That is not a defect.
        clickable = "n/a";
        outcome = "disabled by design";
      } else {
        clickable = "NO";
        outcome = `CLICK FAILED: ${String(error).split("\n")[0]!.slice(0, 120)}`;
      }
      await resetTo(page, nav, recorder);
    }

    const row: Row = {
      page: nav,
      button: group.label,
      instances: group.count,
      disabled: group.disabled,
      covered: look?.covered ?? "unknown",
      submit: group.submit,
      clickable,
      outcome,
      http: recorder.http.slice(0, 4),
      writes: recorder.writes.slice(0, 4),
      errors: recorder.errors.slice(0, 3),
    };
    pageRows.push(row);
    ROWS.push(row);
    const extra = [
      group.disabled ? "disabled" : "",
      row.covered ? `covered by ${row.covered}` : "",
      row.submit ? "submit" : "",
    ]
      .filter(Boolean)
      .join(", ");
    console.log(
      `  ${row.clickable === "yes" ? "OK  " : row.clickable === "n/a" ? "n/a " : "FAIL"} ${group.label} (${group.count}x${
        extra ? `, ${extra}` : ""
      }) -> ${row.outcome}` +
        (row.http.length ? ` | ${row.http.join(", ")}` : "") +
        (row.writes.length ? ` | BLOCKED ${row.writes.join(", ")}` : "") +
        (row.errors.length ? ` | ERRORS ${row.errors.join(" | ")}` : ""),
    );
    await signInSafely(page);
  }

  // --- second pass: controls that only exist after a form/tab is opened -----
  // Most pages show just 2-5 controls until a "New…"/tab button is clicked, so
  // Save / Cancel / Post live behind that toggle. Open each reveal control and
  // sweep what appears, so the buttons that actually submit get exercised too
  // (still with every write blocked).
  const initialLabels = new Set(groups.map((g) => g.label));
  const reveals = groups
    .filter((g) => /^(new|add|create|edit|record|manage|deposit|withdraw|issue|receive)/i.test(g.label))
    .slice(0, 8);

  for (const reveal of reveals) {
    await openPage(page, nav, recorder);
    try {
      await page.locator("main button").nth(reveal.index).click({ timeout: 4_000 });
    } catch {
      continue;
    }
    await settle(page, recorder, 6_000);

    const revealedMetas = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main button")).map((el) => ({
        label:
          (el.getAttribute("aria-label") ?? el.textContent ?? "")
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 40) || "«no text»",
        disabled: (el as HTMLButtonElement).disabled === true,
        submit: (el as HTMLButtonElement).type === "submit",
      })),
    );

    const fresh: Array<{ label: string; index: number; disabled: boolean; submit: boolean }> = [];
    const seenFresh = new Set<string>();
    revealedMetas.forEach((meta, index) => {
      if (initialLabels.has(meta.label) || seenFresh.has(meta.label)) return;
      seenFresh.add(meta.label);
      fresh.push({ label: meta.label, index, disabled: meta.disabled, submit: meta.submit });
    });
    console.log(
      `  -- after "${reveal.label}": ${fresh.length} new control(s) -> ${fresh.map((f) => f.label).join(", ")}`,
    );

    for (const target of fresh.slice(0, 12)) {
      // Re-open the reveal for every target. The previous click usually closes
      // the form/tab it opened, which shifts every index: `target.index` would
      // then point at a node with no element behind it, and the action on it
      // waits until the whole test times out instead of failing. Re-deriving the
      // node each time keeps each click honest (it is verified against the label
      // this list was built from) and keeps the run bounded.
      await resetTo(page, nav, recorder);
      try {
        await page.locator("main button").nth(reveal.index).click({ timeout: 4_000 });
      } catch {
        continue;
      }
      await settle(page, recorder, 6_000);

      const button = page.locator("main button").nth(target.index);
      const present = await buttonLabel(button)
        .then((label) => label === target.label)
        .catch(() => false);
      const look = present ? await describe(button).catch(() => null) : null;
      recorder.reset();
      const before = await fingerprint(page);
      let clickable = "yes";
      let outcome: string;
      if (!present) {
        clickable = "n/a";
        outcome = "gone once the form was re-opened with the same control";
      } else if (target.disabled) {
        clickable = "n/a";
        outcome = "disabled by design";
      } else {
        try {
          await button.click({ timeout: 4_000 });
          await settle(page, recorder, 6_000);
          outcome = describeChange(before, await fingerprint(page));
        } catch (error) {
          clickable = "NO";
          outcome = `CLICK FAILED: ${String(error).split("\n")[0]!.slice(0, 120)}`;
        }
      }
      const row: Row = {
        page: nav,
        button: `${target.label}  [after ${reveal.label}]`,
        instances: 1,
        disabled: target.disabled,
        covered: look?.covered ?? "unknown",
        submit: target.submit,
        clickable,
        outcome,
        http: recorder.http.slice(0, 4),
        writes: recorder.writes.slice(0, 4),
        errors: recorder.errors.slice(0, 3),
      };
      pageRows.push(row);
      ROWS.push(row);
      console.log(
        `  ${clickable === "yes" ? "OK  " : clickable === "n/a" ? "n/a " : "FAIL"} ${row.button} -> ${outcome}` +
          (row.http.length ? ` | ${row.http.join(", ")}` : "") +
          (row.writes.length ? ` | BLOCKED ${row.writes.join(", ")}` : "") +
          (row.errors.length ? ` | ERRORS ${row.errors.join(" | ")}` : ""),
      );
      await signInSafely(page);
    }
  }

  printRows(pageRows, nav);
}

// ---------------------------------------------------------------------------
// PRIORITY: the two bugs reported on the Inventory ("Items") page.
// ---------------------------------------------------------------------------
test("PRIORITY - Items: Stock column renders and Edit actually takes you to the form", async ({
  page,
}) => {
  const recorder = new Recorder(page);
  await blockWrites(page, recorder);
  await signInSafely(page);
  await openPage(page, "Items", recorder);
  // The table is long; make sure it has actually rendered before measuring.
  await page
    .waitForFunction(() => document.querySelectorAll("main tbody tr").length > 5, undefined, {
      timeout: 30_000,
    })
    .catch(() => undefined);
  await settle(page, recorder);

  const stock = await page.evaluate(() => {
    const heads = Array.from(document.querySelectorAll("main thead th")).map((h) =>
      (h.textContent ?? "").trim(),
    );
    const index = heads.indexOf("Stock");
    const rows = Array.from(document.querySelectorAll("main tbody tr"));
    let nonEmpty = 0;
    let nonZero = 0;
    let sample = "";
    if (index >= 0) {
      for (const row of rows) {
        const text = (row.children[index]?.textContent ?? "").trim();
        if (text) nonEmpty += 1;
        if (!sample && text) sample = text;
        const value = Number.parseFloat(text);
        if (Number.isFinite(value) && value !== 0) nonZero += 1;
      }
    }
    return { heads, stockIndex: index, rowCount: rows.length, nonEmpty, nonZero, sample };
  });

  console.log("\n===== PRIORITY: INVENTORY (Items) =====");
  console.log(`headers:            ${stock.heads.join(" | ")}`);
  console.log(
    `Stock column:       ${stock.stockIndex >= 0 ? `present at index ${stock.stockIndex}` : "MISSING"}`,
  );
  console.log(`rows rendered:      ${stock.rowCount}`);
  console.log(`Stock cells filled: ${stock.nonEmpty} / ${stock.rowCount} (first non-empty: "${stock.sample}")`);
  console.log(`Stock cells non-0:  ${stock.nonZero} / ${stock.rowCount}`);

  const before = await page.evaluate(() => {
    const forms = Array.from(document.querySelectorAll("main form")).map((form) => {
      const rect = form.getBoundingClientRect();
      return { inViewport: rect.top >= -1 && rect.bottom <= window.innerHeight + 1 };
    });
    return { formsInViewport: forms.filter((f) => f.inViewport).length, forms: forms.length, scrollY: Math.round(window.scrollY) };
  });
  console.log(
    `before Edit: forms in viewport = ${before.formsInViewport}/${before.forms}, scrollY = ${before.scrollY}`,
  );

  const editButton = page.locator("main tbody tr").first().getByRole("button", { name: "Edit" });
  const editCount = await editButton.count();
  let clickable = "yes";
  let outcome = "";
  recorder.reset();
  try {
    await editButton.first().click({ timeout: 4_000 });
  } catch (error) {
    clickable = "NO";
    outcome = `CLICK FAILED: ${String(error).split("\n")[0]!.slice(0, 120)}`;
  }
  await page.waitForTimeout(1_000);

  const after = await page.evaluate(() => {
    const forms = Array.from(document.querySelectorAll("main form")).map((form) => {
      const rect = form.getBoundingClientRect();
      return { inViewport: rect.top >= -1 && rect.bottom <= window.innerHeight + 1 };
    });
    const active = document.activeElement as HTMLElement | null;
    const rect = active?.getBoundingClientRect();
    const inForm = active ? !!active.closest("form") : false;
    return {
      formsInViewport: forms.filter((f) => f.inViewport).length,
      forms: forms.length,
      scrollY: Math.round(window.scrollY),
      tag: active?.tagName.toLowerCase() ?? "none",
      type: active ? String((active as HTMLInputElement).type ?? "") : "",
      placeholder: active ? String((active as HTMLInputElement).placeholder ?? "") : "",
      valueLength: active ? String((active as HTMLInputElement).value ?? "").length : 0,
      inViewport: !!rect && rect.top >= -1 && rect.bottom <= window.innerHeight + 1,
      inForm,
    };
  });

  if (clickable === "yes") {
    outcome =
      `focus -> <${after.tag} type=${after.type || "-"} placeholder="${after.placeholder}"> ` +
      `valueLen=${after.valueLength} inViewport=${after.inViewport} insideForm=${after.inForm}`;
  }
  console.log(`Edit buttons in first row: ${editCount}`);
  console.log(
    `after Edit:  forms in viewport = ${after.formsInViewport}/${after.forms}, scrollY = ${after.scrollY}`,
  );
  console.log(`after Edit:  ${outcome}`);
  console.log(
    `Edit HTTP: ${recorder.http.join("; ") || "-"} | blocked writes: ${recorder.writes.join("; ") || "-"} | errors: ${recorder.errors.join("; ") || "-"}`,
  );
  console.log(
    `VERDICT Stock column: ${stock.stockIndex >= 0 && stock.nonEmpty > 0 ? "WORKS" : "BROKEN"}`,
  );
  console.log(
    `VERDICT Edit button:  ${
      clickable === "yes" && after.inForm && after.inViewport
        ? "WORKS (form scrolled into view, field focused)"
        : "BROKEN"
    }`,
  );
  console.log("======================================\n");
});

for (const nav of NAV) {
  test(`${nav}: every button`, async ({ page }) => {
    const recorder = new Recorder(page);
    await blockWrites(page, recorder);
    await signInSafely(page);
    await openPage(page, nav, recorder);
    await sweepPage(page, nav, recorder);
  });
}

test.afterAll(() => {
  const failed = ROWS.filter((r) => r.clickable === "NO");
  const withErrors = ROWS.filter((r) => r.errors.length > 0);
  const writes = ROWS.filter((r) => r.writes.length > 0);
  console.log("\n########## SWEEP SUMMARY ##########");
  console.log(`buttons clicked (distinct labels): ${ROWS.length}`);
  console.log(`clicks that FAILED: ${failed.length}`);
  for (const r of failed) console.log(`  FAIL ${r.page} / ${r.button}: ${r.outcome}`);
  console.log(`buttons with console/page errors: ${withErrors.length}`);
  for (const r of withErrors) console.log(`  ERR ${r.page} / ${r.button}: ${r.errors.join(" | ")}`);
  console.log(`buttons that attempted a write (blocked, not sent): ${writes.length}`);
  for (const r of writes) console.log(`  WRITE ${r.page} / ${r.button}: ${r.writes.join(", ")}`);
  console.log("###################################");
});
