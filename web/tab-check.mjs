import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const failures = [];
page.on("response", (r) => {
  if (r.url().includes("/api/") && !r.ok()) failures.push(`${r.status()} ${r.url()}`);
});
page.on("pageerror", (e) => failures.push(`pageerror ${e.message}`));

await page.goto("http://localhost:5173/");
await page.fill("#username", "admin");
await page.fill("#password", "admin123");
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForTimeout(4000);
console.log("after login:", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 200));
if (await page.locator("nav").count()) {
  await page.locator("nav").getByRole("button", { name: "Manufacturing", exact: true }).click();
  await page.waitForTimeout(2500);
  for (const tab of ["Formulations", "Production", "Packing"]) {
    await page.getByRole("tab", { name: tab }).click();
    await page.waitForTimeout(1200);
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 200);
    console.log(`[${tab}] ${text}`);
  }
}
console.log("api failures:", failures.length ? failures : "none");
await browser.close();
