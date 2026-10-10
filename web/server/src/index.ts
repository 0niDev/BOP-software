import { closeDb, getDb } from "./db/index.js";
import { bootstrapDatabase } from "./db/bootstrap.js";
import { env } from "./env.js";
import { createApp } from "./http/app.js";
import { BackupService } from "./services/backupService.js";

async function main(): Promise<void> {
  const db = getDb();

  // The hosted SQLite Cloud database is the live production schema and must
  // never be re-created or re-seeded from the new app; only the local
  // development database is bootstrapped automatically.
  if (env.dbEngine === "local") {
    await bootstrapDatabase(db);
    console.log(`[bootstrap] local database ready at ${env.localDbPath}`);
  } else {
    console.log("[bootstrap] using hosted SQLite Cloud database (no schema changes)");
  }

  const app = createApp(db, env.companyId);
  const server = app.listen(env.port, () => {
    console.log(`[server] API listening on http://localhost:${env.port} (engine=${env.dbEngine})`);
  });

  // Auto-backup scheduler (services/auto_backup.py ran every 24h by default).
  // Opt-in here: set ERP_AUTO_BACKUP_HOURS to enable.
  let backupTimer: NodeJS.Timeout | null = null;
  if (env.autoBackupHours > 0 && env.dbEngine === "local") {
    const backups = new BackupService(db, env.dbEngine, env.backupDir);
    const intervalMs = env.autoBackupHours * 60 * 60 * 1000;
    backupTimer = setInterval(() => {
      void backups
        .run()
        .then((result) => console.log(`[backup] wrote ${result.file} (${result.bytes} bytes)`))
        .catch((err: unknown) => console.error("[backup] failed:", err));
    }, intervalMs);
    console.log(
      `[backup] auto-backup every ${env.autoBackupHours}h into ${env.backupDir}`,
    );
  }

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[server] ${signal} received, shutting down...`);
    if (backupTimer) clearInterval(backupTimer);
    server.close();
    await closeDb();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
