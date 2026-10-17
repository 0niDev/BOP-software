import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import { closeDb, getDb } from "./db/index.js";
import { bootstrapDatabase } from "./db/bootstrap.js";
import { env } from "./env.js";
import { createApp } from "./http/app.js";
import { BackupService } from "./services/backupService.js";

/**
 * TLS is optional and self-contained: when both ERP_TLS_CERT and ERP_TLS_KEY are
 * configured the process terminates HTTPS itself, so the whole application can
 * run as ONE service on ONE port (see web/DEPLOYMENT.md). Without them it
 * listens over plain HTTP — put it behind IIS/nginx, or keep it on a private
 * network, before exposing it.
 */
function readTls(): { cert: Buffer; key: Buffer } | null {
  const { tlsCertFile, tlsKeyFile } = env;
  if (!tlsCertFile && !tlsKeyFile) return null;
  if (!tlsCertFile || !tlsKeyFile) {
    throw new Error(
      "Set BOTH ERP_TLS_CERT and ERP_TLS_KEY (or neither). " +
        `Got cert=${tlsCertFile ?? "unset"}, key=${tlsKeyFile ?? "unset"}.`,
    );
  }
  for (const file of [tlsCertFile, tlsKeyFile]) {
    if (!fs.existsSync(file)) {
      throw new Error(`TLS file not found: ${file}`);
    }
  }
  return { cert: fs.readFileSync(tlsCertFile), key: fs.readFileSync(tlsKeyFile) };
}

function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Global process error boundaries. Node will otherwise swallow async failures
 * into an unhandled state and/or exit with no clean message. We log them
 * explicitly and keep the process alive for async rejections (the HTTP server
 * itself is already fault-tolerant for per-request failures), but any
 * synchronous exception during startup or from the event loop is fatal.
 */
function installGlobalErrorBoundaries(): void {
  const logRejection = (err: unknown) => {
    console.error(`[${timestamp()}] unhandledRejection:`);
    console.error(err instanceof Error ? err.stack ?? err.message : err);
  };

  const logUncaught = (err: unknown) => {
    console.error(`[${timestamp()}] uncaughtException:`);
    console.error(err instanceof Error ? err.stack ?? err.message : err);
  };

  process.on("unhandledRejection", logRejection);
  process.on("uncaughtException", (err) => {
    logUncaught(err);
    // A truly uncaught synchronous exception means the process state is
    // unreliable. Exit cleanly rather than continuing in a corrupted state.
    process.exit(1);
  });
}

async function main(): Promise<void> {
  installGlobalErrorBoundaries();

  const db = getDb();

  // The hosted SQLite Cloud database is the live production schema and must
  // never be re-created or re-seeded from the new app; only the local
  // development database is bootstrapped automatically.
  if (env.dbEngine === "local") {
    await bootstrapDatabase(db);
    console.log(`[bootstrap] local database ready at ${env.localDbPath}`);
  } else {
    console.log("[bootstrap] using hosted SQLite Cloud database (no schema changes)");
    // Fail fast on bad cloud credentials / unreachable host rather than waiting
    // for the first request to time out.
    if (typeof (db as { ping?: () => Promise<boolean> }).ping === "function") {
      const ok = await (db as { ping: () => Promise<boolean> }).ping();
      if (!ok) {
        console.error(
          `[bootstrap] SQLite Cloud ping failed at ${timestamp()}. ` +
            "Check SQLITE_CLOUD_URL and network reachability before restarting.",
        );
        process.exit(1);
      }
      console.log("[bootstrap] SQLite Cloud connectivity check passed");
    }
  }

  const app = createApp(db, env.companyId, {
    engine: env.dbEngine,
    // One process, one port: the API and the built client when asked for.
    clientDir: env.serveClient ? env.clientDist : null,
  });

  const tls = readTls();
  const scheme = tls ? "https" : "http";
  const server = tls ? https.createServer(tls, app) : http.createServer(app);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(env.port, env.host, () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  console.log(
    `[server] API listening on ${scheme}://${env.host}:${env.port} ` +
      `(engine=${env.dbEngine}, client=${env.serveClient ? "built client" : "api only"}, ` +
      `tls=${tls ? "on" : "off"})`,
  );

  // Auto-backup scheduler (services/auto_backup.py ran every 24h by default).
  // Opt-in here: set ERP_AUTO_BACKUP_HOURS to enable.
  let backupTimer: NodeJS.Timeout | null = null;
  if (env.autoBackupHours > 0 && env.dbEngine === "local") {
    const backups = new BackupService(db, env.dbEngine, env.backupDir);
    const intervalMs = env.autoBackupHours * 60 * 60 * 1000;
    backupTimer = setInterval(() => {
      void backups
        .run()
        .then((result) =>
          console.log(
            `[${timestamp()}] [backup] wrote ${result.file} (${result.bytes} bytes)`,
          ),
        )
        .catch((err: unknown) =>
          console.error(`[${timestamp()}] [backup] failed:`, err),
        );
    }, intervalMs);
    console.log(
      `[backup] auto-backup every ${env.autoBackupHours}h into ${env.backupDir}`,
    );
  }

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[${timestamp()}] [server] ${signal} received, shutting down...`);
    if (backupTimer) clearInterval(backupTimer);

    try {
      // Best-effort cancellation of any in-flight statement before closing.
      await (db as { interrupt?: () => Promise<void> }).interrupt?.();
    } catch {
      // interrupt is best-effort; continue shutting down anyway
    }

    server.close();
    await closeDb();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(`[${timestamp()}] fatal startup error:`, err);
  process.exit(1);
});
