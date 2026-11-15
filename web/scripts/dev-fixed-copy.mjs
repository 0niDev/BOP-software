// Dev stack against a local copy of the production `fixed` database, so the real
// data is never opened and cannot be written by a dev run.
//
//   npm run dev:fixed              # clone once if missing, then start dev
//   npm run dev:fixed -- --refresh # re-pull the copy from cloud first
//
// The copy is pulled read-only (scripts/pull-cloud.mjs) into data/fixed-copy.sqlite
// and then used as a local file. The push replica is disabled for the run (empty
// SQLITE_CLOUD_URL), so nothing this session does can reach any cloud database.
//
// Source URL: SQLITE_CLOUD_PROD_URL from web/.env if set, otherwise the existing
// SQLITE_CLOUD_URL with its database name swapped for `fixed`.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const webRoot = path.resolve(import.meta.dirname, "..");

function fromDotEnv(key) {
  const file = path.join(webRoot, ".env");
  if (!fs.existsSync(file)) return "";
  const line = fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .find((raw) => raw.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "") : "";
}

const configured = process.env.SQLITE_CLOUD_PROD_URL || fromDotEnv("SQLITE_CLOUD_PROD_URL");
const source = configured || fromDotEnv("SQLITE_CLOUD_URL").replace(/(:\d+\/)[^?]*/, "$1fixed");
if (!source) {
  console.error("No SQLITE_CLOUD_PROD_URL or SQLITE_CLOUD_URL in web/.env — nothing to clone.");
  process.exit(1);
}
const database = /:\d+\/([^?]*)/.exec(source)?.[1] ?? "?";
if (!/fixed/i.test(database)) {
  console.error(`Refusing: the source database is '${database}', not 'fixed'.`);
  process.exit(1);
}

const localDb = path.join(webRoot, "data", "fixed-copy.sqlite");
if (!fs.existsSync(localDb) || process.argv.includes("--refresh")) {
  console.log(`[dev:fixed] pulling ${database} into ${localDb} (read-only against the cloud)...`);
  fs.rmSync(localDb, { force: true });
  const pulled = spawnSync(
    process.execPath,
    [path.join(webRoot, "scripts", "pull-cloud.mjs"), "--url", source, "--out", localDb],
    { cwd: webRoot, stdio: "inherit" },
  );
  if (pulled.status !== 0) process.exit(pulled.status ?? 1);
}

const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
  cwd: webRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    ERP_DB_ENGINE: "local",
    ERP_LOCAL_DB: localDb,
    // No cloud target: the replica stays off, so a dev run cannot write anywhere
    // but this file.
    SQLITE_CLOUD_URL: "",
    ERP_LIVE_MIRROR: "0",
    ERP_BACKUP_DIR: path.join(webRoot, "backups", "fixed-copy"),
    ERP_DESKTOP_DIR: path.join(os.homedir(), "Desktop", "desktop-fixed-copy"),
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
