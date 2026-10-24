// Runs the dev stack against the throwaway `testdb` database on SQLite Cloud.
// The URL lives in web/.env as SQLITE_CLOUD_TESTDB_URL (git-ignored); an
// exported process env var wins over the file.
import { spawn } from "node:child_process";
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

const child = spawn(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "dev"], {
  cwd: webRoot,
  stdio: "inherit",
  env: { ...process.env, ERP_DB_ENGINE: "sqlitecloud", SQLITE_CLOUD_URL: url },
});
child.on("exit", (code) => process.exit(code ?? 0));
