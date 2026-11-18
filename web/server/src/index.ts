import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import type { Express } from "express";
import { closeDb, createDatabase, getDb, getLocalDbOverride, setLocalDbOverride } from "./db/index.js";
import type { SqlDatabase } from "./db/types.js";
import { ObservedDatabase } from "./db/observed.js";
import { bootstrapDatabase } from "./db/bootstrap.js";
import { ConfigurationError, ConflictError } from "./domain/errors.js";
import { env } from "./env.js";
import { createApp, type DatabaseSwapper } from "./http/app.js";
import { BackupService } from "./services/backupService.js";
import { discardUploadedDatabase, validateUploadedDatabase } from "./services/dbSwapService.js";
import { MirrorService } from "./services/mirrorService.js";
import { ReplicaService } from "./services/replicaService.js";

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

/** Everything a database hot-swap has to discard and rebuild. */
interface Stack {
  rawDb: SqlDatabase;
  mirrorDb: SqlDatabase;
  mirror: MirrorService;
  replica: ReplicaService;
  db: SqlDatabase;
  app: Express;
}

/**
 * Build the database adapters, services and HTTP app as one unit. The whole
 * stack is rebuilt on a hot-swap, so nothing here may hold a module-level
 * connection of its own.
 */
async function buildStack(clientDir: string | null, swapper: DatabaseSwapper): Promise<Stack> {
  const rawDb = getDb();
  // The hosted driver serializes every statement on one connection, so a
  // multi-second snapshot would otherwise pause the whole API. The mirror gets
  // its own read connection; SQLite allows concurrent readers.
  const mirrorDb = env.dbEngine === "sqlitecloud" && env.liveMirror ? createDatabase() : rawDb;
  // While an uploaded database is loaded, the live copy must not overwrite the
  // real one, so the mirror stays off for the duration.
  const mirror = new MirrorService(
    mirrorDb,
    env.dbEngine,
    env.mirrorDir,
    env.pcMirrorDir,
    env.mirrorDebounceMs,
    env.liveMirror && getLocalDbOverride() === null,
  );
  // The cloud replica only exists in local-primary mode: the local database is
  // the source of truth and SQLite Cloud becomes a read-only copy of it.
  const replica = new ReplicaService(
    rawDb,
    env.dbEngine === "local" ? env.sqliteCloudUrl : "",
    env.replicaDir,
    env.replicaMinutes,
    env.replicaDryRun,
  );
  const db = new ObservedDatabase(rawDb, () => {
    mirror.notify();
    replica.markDirty();
  });

  // The hosted SQLite Cloud database is the live production schema and must
  // never be re-created or re-seeded from the new app; only the local
  // development database is bootstrapped automatically.
  if (env.dbEngine === "local") {
    await bootstrapDatabase(db);
    console.log(
      `[bootstrap] local database ready at ${getLocalDbOverride()?.file ?? env.localDbPath}`,
    );
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
    clientDir,
    mirror,
    replica,
    swapper,
  });

  return { rawDb, mirrorDb, mirror, replica, db, app };
}

async function main(): Promise<void> {
  installGlobalErrorBoundaries();

  const clientDir = env.serveClient ? env.clientDist : null;
  let state: Stack;
  let server: http.Server | https.Server | null = null;
  let swapping = false;

  /** Only one swap at a time: two would interleave close/rebuild and break both. */
  async function withSwapLock<T>(fn: () => Promise<T>): Promise<T> {
    if (swapping) throw new ConflictError("A database switch is already in progress.");
    swapping = true;
    try {
      return await fn();
    } finally {
      swapping = false;
    }
  }

  /**
   * Close the live stack, let `apply` point the local engine at a new file,
   * rebuild everything and hand the listening server the new app. If the new
   * database cannot be opened, fall back to the real one so the app survives.
   */
  async function swapStack(apply: () => void): Promise<void> {
    const current = state;
    // An uploaded/test database must never be pushed to SQLite Cloud: stop the
    // replica with the old stack. It only restarts for the real database.
    current.replica.stop();
    await current.mirror.flush().catch(() => undefined);
    current.mirror.stop();
    await closeDb();
    if (current.mirrorDb !== current.rawDb) {
      await current.mirrorDb.close().catch(() => undefined);
    }

    apply();
    let failure: unknown = null;
    try {
      state = await buildStack(clientDir, swapper);
    } catch (err) {
      // The incoming file failed to open or migrate. Discard it and rebuild on
      // the real database so the running app is not left pointing at nothing.
      failure = err;
      await closeDb().catch(() => undefined);
      if (getLocalDbOverride()) setLocalDbOverride(null);
      state = await buildStack(clientDir, swapper);
    }

    if (server) {
      server.removeAllListeners("request");
      server.on("request", state.app);
    }
    void state.mirror.start().catch((err: unknown) =>
      console.error(`[${timestamp()}] [mirror] restart failed:`, err),
    );
    if (!getLocalDbOverride()) void state.replica.start();

    if (failure) throw failure;
  }

  const swapper: DatabaseSwapper = {
    available: env.dbEngine === "local",
    current: () => ({
      engine: env.dbEngine,
      location: getLocalDbOverride()?.file ?? env.localDbPath,
      label: getLocalDbOverride()?.label ?? null,
    }),
    async swap(bytes, filename) {
      return withSwapLock(async () => {
        if (env.dbEngine !== "local") {
          throw new ConfigurationError(
            "Loading an uploaded database is only available when the server runs on a " +
              "local SQLite file (ERP_DB_ENGINE=local).",
          );
        }
        const uploaded = validateUploadedDatabase(bytes);
        try {
          const target = path.join(path.dirname(env.localDbPath), "hotswap.sqlite");
          fs.mkdirSync(path.dirname(target), { recursive: true });
          // SQLite sidecars from a previous load must go, or they would be
          // replayed onto the new file.
          for (const suffix of ["", "-wal", "-shm"]) {
            fs.rmSync(target + suffix, { force: true });
          }
          fs.copyFileSync(uploaded, `${target}.swap`);
          fs.renameSync(`${target}.swap`, target);

          await swapStack(() => setLocalDbOverride({ file: target, label: filename }));
          console.log(`[db] loaded ${filename} (${target}); real database untouched`);
          return { ok: true as const, label: filename };
        } finally {
          discardUploadedDatabase(uploaded);
        }
      });
    },
    async reset() {
      return withSwapLock(async () => {
        if (!getLocalDbOverride()) return { ok: true as const };
        await swapStack(() => setLocalDbOverride(null));
        console.log("[db] switched back to the real database");
        return { ok: true as const };
      });
    },
  };

  state = await buildStack(clientDir, swapper);

  const tls = readTls();
  const scheme = tls ? "https" : "http";
  server = tls ? https.createServer(tls, state.app) : http.createServer(state.app);
  const httpServer = server;

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(env.port, env.host, () => {
      httpServer.removeListener("error", reject);
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
  if (env.autoBackupHours > 0) {
    const intervalMs = env.autoBackupHours * 60 * 60 * 1000;
    backupTimer = setInterval(() => {
      // Never write an uploaded test database into the real snapshot set.
      if (getLocalDbOverride()) return;
      const backups = new BackupService(
        state.rawDb,
        env.dbEngine,
        env.backupDir,
        env.backupKeep,
        env.desktopDir,
        env.dbName,
      );
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

  // Live local copy: refresh once at startup so changes made outside this
  // process (e.g. the SQLite Cloud dashboard) are picked up too.
  if (env.liveMirror) {
    void state.mirror.start().catch((err: unknown) =>
      console.error(`[${timestamp()}] [mirror] startup refresh failed:`, err),
    );
  } else {
    console.log("[mirror] disabled (ERP_LIVE_MIRROR=0)");
  }

  // Cloud replica: push once at startup (catches writes a hard kill left
  // behind), then on the interval. Disabled when no cloud URL is configured.
  void state.replica.start();

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[${timestamp()}] [server] ${signal} received, shutting down...`);
    if (backupTimer) clearInterval(backupTimer);
    state.replica.stop();

    // Stop accepting requests, then flush whatever the replica has not sent.
    httpServer.close();
    try {
      await state.replica.flush(env.replicaFlushTimeoutMs);
    } catch (err) {
      console.error(`[${timestamp()}] [replica] shutdown flush failed:`, err);
    }

    // Save the last few seconds of writes before the connection goes away.
    try {
      await state.mirror.flush();
    } catch (err) {
      console.error(`[${timestamp()}] [mirror] shutdown flush failed:`, err);
    }

    try {
      // Best-effort cancellation of any in-flight statement before closing.
      await (state.db as { interrupt?: () => Promise<void> }).interrupt?.();
    } catch {
      // interrupt is best-effort; continue shutting down anyway
    }

    httpServer.close();
    if (state.mirrorDb !== state.rawDb) {
      try {
        await state.mirrorDb.close();
      } catch {
        // the app connection is the one that must close cleanly
      }
    }
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
