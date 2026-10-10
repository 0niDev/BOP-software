import { closeDb, getDb } from "./db/index.js";
import { bootstrapDatabase } from "./db/bootstrap.js";
import { env } from "./env.js";
import { createApp } from "./http/app.js";

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

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[server] ${signal} received, shutting down...`);
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
