/** TEMPORARY read-only probe of the hosted SQLite Cloud database. Deleted after use. */
import { SqliteCloudDatabase } from "./server/src/db/sqliteCloud.js";
import { env } from "./server/src/env.js";

const db = new SqliteCloudDatabase(env.sqliteCloudUrl);

async function count(table: string): Promise<string> {
  try {
    const row = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
    return `${table}=${row?.n ?? 0}`;
  } catch (err) {
    return `${table}=ERR(${err instanceof Error ? err.message.slice(0, 40) : "?"})`;
  }
}

async function span(table: string, column: string): Promise<string> {
  try {
    const row = await db.get<Record<string, unknown>>(
      `SELECT MIN(${column}) AS lo, MAX(${column}) AS hi FROM ${table}`,
    );
    return `${table}.${column}: ${row?.lo ?? "-"} … ${row?.hi ?? "-"}`;
  } catch (err) {
    return `${table}.${column}=ERR(${err instanceof Error ? err.message.slice(0, 40) : "?"})`;
  }
}

const version = await db.get<{ v: string }>("SELECT sqlite_version() AS v");
console.log("sqlite_version:", version?.v);

const tables = await db.all<{ name: string }>(
  "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
);
console.log("tables:", tables.length);

const counts = await Promise.all(
  [
    "companies",
    "warehouses",
    "users",
    "accounts",
    "parties",
    "items",
    "stock_batches",
    "sales_invoices",
    "purchase_invoices",
    "payments",
    "receipts",
    "journal_entries",
    "journal_entry_lines",
    "expenses",
    "settings",
    "numbering_sequences",
  ].map(count),
);
console.log(counts.join("\n"));

console.log(await span("sales_invoices", "invoice_date"));
console.log(await span("purchase_invoices", "invoice_date"));
console.log(await span("journal_entries", "entry_date"));

const seq = await db.all<{ document_type: string; prefix: string; next_number: number }>(
  "SELECT document_type, prefix, next_number FROM numbering_sequences ORDER BY document_type",
);
console.log("sequences:", seq.map((s) => `${s.document_type}:${s.prefix}${s.next_number}`).join(" "));

const companies = await db.all<{ id: number; name: string }>("SELECT id, name FROM companies");
console.log("companies:", companies.map((c) => `${c.id}:${c.name}`).join(", "));

await db.close();
