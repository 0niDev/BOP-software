/**
 * Single-process production mode: when `clientDir` is configured and the build
 * is present, the API process also serves the built SPAs.
 *
 * These checks are the ones that matter for a deployment:
 *  - `/` and `/assets/<hashed file>` come from disk, with cache headers that
 *    keep the hashed bundle cached but always revalidate index.html;
 *  - a deep client-side path falls back to index.html;
 *  - an unknown `/api/...` path still answers with a JSON 404 (the SPA shell
 *    must never swallow API errors);
 *  - a POST is never answered with the SPA shell;
 *  - with no build configured, or a configured build missing on disk, the
 *    process degrades to API-only rather than serving a half-broken app.
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/http/app.js";
import { closeDb, freshDb, type TestContext } from "./helpers/db.js";

type App = ReturnType<typeof createApp>;

const INDEX_MARKER = "BOP-ERP-BUILT-CLIENT";
const BUNDLE = "assets/index-abc123.js";

let ctx: TestContext;
let tempRoots: string[] = [];

async function makeBuiltClient(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "bop-client-"));
  tempRoots.push(dir);
  await mkdir(path.join(dir, "assets"), { recursive: true });
  await writeFile(path.join(dir, "index.html"), `<!doctype html><title>${INDEX_MARKER}</title>`);
  await writeFile(path.join(dir, BUNDLE), "console.log('built');");
  return dir;
}

/** Boot the app on an ephemeral port, hand out its base URL, then close it. */
async function withServer<T>(app: App, fn: (base: string) => Promise<T>): Promise<T> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

beforeEach(async () => {
  ctx = await freshDb();
});

afterEach(async () => {
  await closeDb(ctx.db);
  for (const dir of tempRoots) await rm(dir, { recursive: true, force: true });
  tempRoots = [];
});

describe("serving the built client from the API process", () => {
  it("serves the SPA at / and caches the hashed bundle forever", async () => {
    const clientDir = await makeBuiltClient();
    const app = createApp(ctx.db, 1, { engine: "local", clientDir });

    await withServer(app, async (base) => {
      const index = await fetch(`${base}/`);
      expect(index.status).toBe(200);
      expect(await index.text()).toContain(INDEX_MARKER);
      expect(index.headers.get("cache-control")).toBe("no-cache");

      const bundle = await fetch(`${base}/${BUNDLE}`);
      expect(bundle.status).toBe(200);
      expect(await bundle.text()).toContain("built");
      expect(bundle.headers.get("cache-control")).toContain("immutable");
    });
  });

  it("falls back to index.html for client routes but never for /api", async () => {
    const clientDir = await makeBuiltClient();
    const app = createApp(ctx.db, 1, { engine: "local", clientDir });

    await withServer(app, async (base) => {
      const deep = await fetch(`${base}/reports/trial-balance`);
      expect(deep.status).toBe(200);
      expect(await deep.text()).toContain(INDEX_MARKER);

      const api = await fetch(`${base}/api/definitely-not-a-route`);
      expect(api.status).toBe(404);
      expect(api.headers.get("content-type")).toContain("application/json");
      const body = (await api.json()) as { error: { code: string } };
      expect(body.error.code).toBe("NOT_FOUND");

      // The real API keeps working alongside the static handler.
      expect((await fetch(`${base}/api/health`)).status).toBe(200);
    });
  });

  it("does not answer a non-GET request with the SPA shell", async () => {
    const clientDir = await makeBuiltClient();
    const app = createApp(ctx.db, 1, { engine: "local", clientDir });

    await withServer(app, async (base) => {
      const posted = await fetch(`${base}/reports/trial-balance`, { method: "POST" });
      expect(posted.status).toBe(404);
      expect(posted.headers.get("content-type")).toContain("application/json");
      expect(await posted.text()).not.toContain(INDEX_MARKER);
    });
  });

  it("stays API-only when no client build is configured (development)", async () => {
    const app = createApp(ctx.db, 1, { engine: "local" });

    await withServer(app, async (base) => {
      const index = await fetch(`${base}/`);
      expect(index.status).toBe(404);
      expect(index.headers.get("content-type")).toContain("application/json");
      expect((await fetch(`${base}/api/health`)).status).toBe(200);
    });
  });

  it("degrades to API-only when the configured build is missing", async () => {
    const missing = path.join(tmpdir(), "bop-client-does-not-exist");
    const app = createApp(ctx.db, 1, { engine: "local", clientDir: missing });

    await withServer(app, async (base) => {
      const index = await fetch(`${base}/`);
      expect(index.status).toBe(404);
      expect((await fetch(`${base}/api/health`)).status).toBe(200);
    });
  });
});
