/**
 * Central configuration, mirroring the Python project's config/app_config.py.
 *
 * Values come from web/.env or, as a fallback, the repository-root .env
 * (so the existing SQLITE_CLOUD_URL is picked up without duplication).
 * Nothing else in the codebase reads process.env directly.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)); // web/server/src
const serverRoot = path.resolve(here, ".."); // web/server
const webRoot = path.resolve(here, "..", ".."); // web

function loadDotEnv(file: string): void {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// web/.env wins, then the repository root .env fills in anything missing.
loadDotEnv(path.join(webRoot, ".env"));
loadDotEnv(path.resolve(webRoot, "..", ".env"));

export type DbEngine = "local" | "sqlitecloud";

function readEngine(): DbEngine {
  const raw = (process.env.ERP_DB_ENGINE ?? "local").toLowerCase();
  return raw === "sqlitecloud" ? "sqlitecloud" : "local";
}

export const env = {
  dbEngine: readEngine(),
  localDbPath: path.resolve(webRoot, process.env.ERP_LOCAL_DB ?? "data/dev.sqlite"),
  sqliteCloudUrl: process.env.SQLITE_CLOUD_URL ?? "",
  port: Number(process.env.PORT ?? 4000),
  companyId: Number(process.env.ERP_COMPANY_ID ?? 1),
  warehouseId: Number(process.env.ERP_WAREHOUSE_ID ?? 1),
  currency: process.env.ERP_CURRENCY ?? "PKR",
} as const;

export { serverRoot, webRoot };
