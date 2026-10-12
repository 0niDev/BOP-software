import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
    // Runs before each test file's imports: pins ERP_DB_ENGINE=local so the
    // suite never follows web/.env onto the hosted database.
    setupFiles: ["tests/setup-env.ts"],
    // The default 5s per-test timeout is kept so a real hang still fails fast.
    // The one slow suite — user.test.ts, which hashes passwords with
    // PBKDF2-HMAC-SHA256 at 200,000 iterations — raises its own timeout, because
    // the files run in parallel and a loaded machine can starve it.
  },
});
