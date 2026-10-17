import { defineConfig, devices } from "@playwright/test";

/**
 * Config for the button sweep (`web/e2e-sweep`).
 *
 * Deliberately separate from `web/playwright.config.ts` so the normal
 * `npm run test:e2e` audit never picks this up.
 *
 * It does NOT boot a stack: it drives whatever is already listening — the Vite
 * dev server on 5173, which proxies /api to the API on 4000. Point it elsewhere
 * with SWEEP_BASE_URL.
 */
export default defineConfig({
  testDir: ".",
  // A page with thousands of rows is slow to scroll, but a hang must not eat the
  // whole run. Each click already has its own 4s ceiling.
  timeout: 240_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.SWEEP_BASE_URL ?? "http://localhost:5173",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    trace: "off",
  },
});
