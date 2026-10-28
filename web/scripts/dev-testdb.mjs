// Runs the dev stack against a separate local file for the throwaway `testdb`
// database, so changes made here never touch the real local database
// (data/erp.sqlite) or the production cloud database (main). The local file is
// the source of truth for this run; the push replica sends it to cloud testdb.
//
// The URL lives in web/.env as SQLITE_CLOUD_TESTDB_URL (git-ignored); an
// exported process env var wins over the file.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
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

const url = process.env.SQLITE_CLOUD_TESTDB_URL || fromDotEnv("SQLITE_CLOUD_TESTDB_URL");
if (!url) {
  console.error("SQLITE_CLOUD_TESTDB_URL is not set (add it to web/.env).");
  process.exit(1);
}

// Separate local file: the real one (data/erp.sqlite) is never opened here.
const localDb = path.join(webRoot, "data", "testdb.sqlite");
if (!fs.existsSync(localDb)) {
  console.log(`[dev:testdb] ${localDb} does not exist yet — pulling cloud testdb (read-only)...`);
  const pulled = spawnSync(
    process.execPath,
    [path.join(webRoot, "scripts", "pull-cloud.mjs"), "--url", url, "--out", localDb],
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
    // Replica target: cloud testdb. Never main — that only happens in production.
    SQLITE_CLOUD_URL: url,
    ERP_LIVE_MIRROR: "0",
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
