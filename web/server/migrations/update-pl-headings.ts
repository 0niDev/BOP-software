/**
 * Update custom P&L report saved template to new section names.
 *
 * Usage:
 *   node --experimental-strip-types server/migrations/update-pl-headings.ts
 *
 * This script:
 * - Renames: "Cost of Sales" → "Cost of Revenue", "Financial Charges" → "Finance Cost",
 *   "Taxation (Current)" → "Income Tax", "Profit/(Loss) Before Taxation" → "Profit Before Taxation",
 *   "Profit/(Loss) After Taxation" → "Net Profit After Tax"
 * - Adds new "Selling & Distribution Expenses" subtotal
 * - Updates operating-expenses and operating-profit to reference it
 *
 * Works on any SQLite DB passed as argument, or defaults to web/data/erp.sqlite.
 */

import Database from "better-sqlite3";
import { resolve } from "path";

const dbPath = process.argv[2] ? resolve(process.argv[2]) : resolve("web/data/erp.sqlite");

const db = new Database(dbPath);

const row = db.prepare("SELECT setting_value FROM settings WHERE setting_key = ?").get("custom_pl_report") as
  | { setting_value: string }
  | undefined;

if (!row) {
  console.log("No saved template. Code default will apply automatically.");
  db.close();
  process.exit(0);
}

const raw = row.setting_value;
const template = JSON.parse(raw.startsWith("json:") ? raw.slice(5) : raw);
const headings = template.headings as Array<{
  id: string;
  name: string;
  note?: string;
  bold?: boolean;
  kind: string;
  accountIds: number[];
  parts: Array<{ headingId: string; sign: 1 | -1 }>;
}>;

// Rename section totals
const renames: Record<string, { name: string; note?: string }> = {
  "cost-of-sales": { name: "Cost of Revenue", note: "21" },
  "financial-charges": { name: "Finance Cost", note: "25" },
  "taxation-current": { name: "Income Tax", note: "27" },
  "profit-before-tax": { name: "Profit Before Taxation" },
  "profit-after-tax": { name: "Net Profit After Tax" },
};

for (const h of headings) {
  const r = renames[h.id];
  if (r) {
    h.name = r.name;
    if (r.note) h.note = r.note;
  }
}

// Insert "Selling & Distribution Expenses" subtotal after promotional-public-relations
const promoIdx = headings.findIndex((h) => h.id === "promotional-public-relations");
if (promoIdx === -1) {
  console.error("Cannot find promotional-public-relations heading");
  db.close();
  process.exit(1);
}

headings.splice(promoIdx + 1, 0, {
  id: "selling-distribution-expenses",
  name: "Selling & Distribution Expenses",
  note: "23",
  bold: true,
  kind: "subtotal",
  accountIds: [],
  parts: [
    { headingId: "selling-distribution", sign: 1 },
    { headingId: "promotional-public-relations", sign: 1 },
  ],
});

// Update operating-expenses to reference the new subtotal
const opExp = headings.find((h) => h.id === "operating-expenses");
if (opExp) {
  opExp.parts = [
    { headingId: "administrative-expenses", sign: 1 },
    { headingId: "selling-distribution-expenses", sign: 1 },
  ];
}

// Update operating-profit
const opProfit = headings.find((h) => h.id === "operating-profit");
if (opProfit) {
  opProfit.parts = [
    { headingId: "sales-net", sign: 1 },
    { headingId: "cost-of-sales", sign: -1 },
    { headingId: "administrative-expenses", sign: -1 },
    { headingId: "selling-distribution-expenses", sign: -1 },
  ];
}

db.prepare("UPDATE settings SET setting_value = ? WHERE setting_key = ?").run(
  JSON.stringify({ headings }),
  "custom_pl_report",
);

console.log(`Updated saved template: ${headings.length} headings`);
db.close();
