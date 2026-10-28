/**
 * Central configuration, mirroring the Python project's config/app_config.py.
 *
 * Values come from web/.env only. The web app is self-contained: it never
 * reads the Python app's python/.env, so each application can be configured
 * and deployed independently. Nothing else in the codebase reads
 * process.env directly.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url)); // web/server/src
const serverRoot = path.resolve(here, ".."); // web/server
const webRoot = path.resolve(here, "..", ".."); // web (repo root of this app)

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

// web/.env is the only environment file for this application.
loadDotEnv(path.join(webRoot, ".env"));

export type DbEngine = "local" | "sqlitecloud";

function readEngine(): DbEngine {
  const raw = (process.env.ERP_DB_ENGINE ?? "local").toLowerCase();
  return raw === "sqlitecloud" ? "sqlitecloud" : "local";
}

/** Backup directory (mirrors the Python app's `backups/` folder). */
const backupDir = path.resolve(webRoot, process.env.ERP_BACKUP_DIR ?? "backups");

/**
 * Auto-backup interval in hours. 0 (the default) disables the scheduler; the
 * Python app defaulted to every 24 hours, so set ERP_AUTO_BACKUP_HOURS=24 to
 * match it. Kept opt-in so a dev machine does not start writing snapshots.
 */
function readAutoBackupHours(): number {
  const raw = Number(process.env.ERP_AUTO_BACKUP_HOURS ?? 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

/** `1/true/yes/on` (case-insensitive) mean true; anything else means false. */
function readFlag(raw: string | undefined, fallback = false): boolean {
  if (raw === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

/** An optional path resolved against `web/`; unset or blank means "not configured". */
function optionalPath(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  return value ? path.resolve(webRoot, value) : null;
}

/**
 * Like `optionalPath`, but keeps a UNC share (`\\\\pc\\share`) untouched.
 * Resolving that against `web/` would produce a path no Windows machine can open.
 */
function optionalDir(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  return /^[\\/]{2}/.test(value) ? value : path.resolve(webRoot, value);
}

/** Named snapshots to keep; 0 disables pruning. */
function readBackupKeep(): number {
  const raw = Number(process.env.ERP_BACKUP_KEEP ?? 7);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 7;
}

/**
 * Second copy of every backup, saved to a folder on this machine's desktop
 * (`<home>/Desktop/desktop`). `ERP_DESKTOP_DIR` overrides it.
 */
function readDesktopDir(): string {
  const value = (process.env.ERP_DESKTOP_DIR ?? "").trim();
  return value ? path.resolve(webRoot, value) : path.join(os.homedir(), "Desktop", "desktop");
}

/** Idle gap before the live copy is rewritten; 0 means immediately. */
function readMirrorDebounceSeconds(): number {
  const raw = Number(process.env.ERP_MIRROR_DEBOUNCE_SECONDS ?? 15);
  return Number.isFinite(raw) && raw >= 0 ? raw : 15;
}

/**
 * How often the local database is pushed to SQLite Cloud (`ERP_REPLICA_MINUTES`,
 * default 15). Also pushed at startup, on shutdown and on demand, so this only
 * sets the worst-case recovery window.
 */
function readReplicaMinutes(): number {
  const raw = Number(process.env.ERP_REPLICA_MINUTES ?? 15);
  return Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 1440) : 15;
}

export const env = {
  dbEngine: readEngine(),
  localDbPath: path.resolve(webRoot, process.env.ERP_LOCAL_DB ?? "data/dev.sqlite"),
  sqliteCloudUrl: process.env.SQLITE_CLOUD_URL ?? "",
  /** Bind address. 0.0.0.0 exposes the API on the LAN; 127.0.0.1 is for a
   *  reverse proxy in front of it. */
  host: process.env.ERP_HOST ?? "0.0.0.0",
  port: Number(process.env.PORT ?? 4000),
  companyId: Number(process.env.ERP_COMPANY_ID ?? 1),
  warehouseId: Number(process.env.ERP_WAREHOUSE_ID ?? 1),
  currency: process.env.ERP_CURRENCY ?? "PKR",
  backupDir,
  autoBackupHours: readAutoBackupHours(),
  /** Named snapshots to keep (`ERP_BACKUP_KEEP`); 0 disables pruning. */
  backupKeep: readBackupKeep(),
  /** Extra copy of every backup on the local desktop (`<home>/Desktop/desktop`). */
  desktopDir: readDesktopDir(),
  /** Live local copy: on by default, refreshed after an idle gap. */
  liveMirror: readFlag(process.env.ERP_LIVE_MIRROR, true),
  mirrorDir: optionalDir(process.env.ERP_MIRROR_DIR) ?? path.join(backupDir, "live"),
  mirrorDebounceMs: readMirrorDebounceSeconds() * 1000,
  /** Folder the replica push stages its snapshot in. */
  replicaDir: optionalDir(process.env.ERP_REPLICA_DIR) ?? path.join(backupDir, "replica"),
  replicaMinutes: readReplicaMinutes(),
  /** `ERP_REPLICA_DRY_RUN=1` builds the push script but sends nothing. */
  replicaDryRun: readFlag(process.env.ERP_REPLICA_DRY_RUN),
  /** Bounded shutdown flush: never block exit longer than this. */
  replicaFlushTimeoutMs: 20_000,
  /** Folder on the operator's computer; pushed to on every refresh. */
  pcMirrorDir: optionalDir(process.env.ERP_PC_MIRROR_DIR),
  apiKey: process.env.ERP_API_KEY ?? "",
  /**
   * Serve the built React client from this same process (one port, one
   * service). Off by default: in development Vite serves the client, and
   * turning it on there would shadow the dev server. The production deploy
   * sets ERP_SERVE_CLIENT=1.
   */
  serveClient: readFlag(process.env.ERP_SERVE_CLIENT),
  clientDist: path.resolve(webRoot, process.env.ERP_CLIENT_DIST ?? "client/dist"),
  /** Optional TLS: when both are set the server speaks HTTPS itself. */
  tlsCertFile: optionalPath(process.env.ERP_TLS_CERT),
  tlsKeyFile: optionalPath(process.env.ERP_TLS_KEY),
} as const;

export { serverRoot, webRoot };
