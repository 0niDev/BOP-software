import { defineConfig, devices } from "@playwright/test";

/**
 * Browser UI audit configuration (`npm run test:e2e`).
 *
 * Boots the real stack — Express API + Vite dev server — against a throwaway
 * database seeded with the rich demo dataset, so the audit sees the same data a
 * user would. One browser is enough: `npx playwright install chromium` once.
 *
 * The API runs on its own DB file (`data/e2e.sqlite`, git-ignored) so an audit
 * run never disturbs `data/dev.sqlite`, and the stack listens on non-default
 * ports so it never collides with a `npm run dev` you already have open.
 */
const API_PORT = 4100;
const CLIENT_PORT = 5273;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${CLIENT_PORT}`,
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run seed:rich && npm -w @bop-erp/server run dev",
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ERP_DB_ENGINE: "local",
        ERP_LOCAL_DB: "./data/e2e.sqlite",
        PORT: String(API_PORT),
      },
    },
    {
      command: `npm -w @bop-erp/client run dev -- --port ${CLIENT_PORT} --strictPort`,
      url: `http://127.0.0.1:${CLIENT_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      // Vite proxies /api to this URL (see client/vite.config.ts).
      env: { API_URL: `http://127.0.0.1:${API_PORT}` },
    },
  ],
});
