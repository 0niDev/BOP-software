/**
 * Maintenance CLI: bring every auto-code numbering sequence back in sync with
 * the records already in the database (see reconcileNumberingSequences).
 * Idempotent, and safe against the hosted database because it only ever moves
 * a sequence forward.
 *
 *   npm -w @bop-erp/server run reconcile
 */
import { closeDb, getDb } from "./db/index.js";
import { reconcileNumberingSequences } from "./db/bootstrap.js";
import { env } from "./env.js";

async function main(): Promise<void> {
  const db = getDb();
  console.log(`[reconcile] engine=${env.dbEngine} company=${env.companyId}`);
  await reconcileNumberingSequences(db, env.companyId);
  const rows = await db.all<{ document_type: string; next_number: number }>(
    "SELECT document_type, next_number FROM numbering_sequences WHERE company_id = ? ORDER BY document_type",
    [env.companyId],
  );
  for (const row of rows) {
    console.log(`  ${row.document_type} -> ${row.next_number}`);
  }
  await closeDb();
}

main().catch((err: unknown) => {
  console.error("[reconcile] failed:", err);
  process.exit(1);
});
