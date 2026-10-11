import { closeDb, getDb } from "./db/index.js";
import { env } from "./env.js";
import { seedDemoData, seedRichDemoData } from "./seedData.js";

async function main(): Promise<void> {
  if (env.dbEngine !== "local") {
    throw new Error("Refusing to seed a non-local database. Set ERP_DB_ENGINE=local.");
  }
  const db = getDb();
  const ids = await seedDemoData(db);
  console.log("Seeded basic demo data:");
  console.log(`  customer id = ${ids.customerId} (DEMO-CUST)`);
  console.log(`  item id     = ${ids.itemId} (DEMO-FG)`);
  console.log(`  batch id    = ${ids.batchId} (DEMO-BATCH, 1000 units @ 100.00 cost)`);

  if (process.argv.includes("--rich")) {
    const seeded = await seedRichDemoData(db, ids);
    console.log(
      seeded > 0
        ? `Seeded rich demo data (full transaction set, ${seeded} journal entries).`
        : "Rich demo data already present — nothing to do.",
    );
  }

  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
