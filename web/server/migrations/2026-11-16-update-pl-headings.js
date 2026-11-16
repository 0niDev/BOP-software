/**
 * Migration script to update the custom P&L report saved template
 * to match the new section names and structure.
 *
 * Changes:
 * - "Cost of Sales" → "Cost of Revenue"
 * - "Financial Charges" → "Finance Cost"
 * - "Taxation (Current)" → "Income Tax"
 * - "Profit/(Loss) Before Taxation" → "Profit Before Taxation"
 * - "Profit/(Loss) After Taxation" → "Net Profit After Tax"
 * - Adds new "Selling & Distribution Expenses" subtotal
 *
 * Usage: node server/migrations/2026-11-16-update-pl-headings.js
 */

import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../../data/fixed-copy.sqlite");

const db = new Database(dbPath);

try {
  const row = db.prepare("SELECT setting_value FROM settings WHERE setting_key = 'custom_pl_report'").get();
  
  if (!row) {
    console.log("No saved template found. The code default will be used automatically.");
    process.exit(0);
  }

  const template = JSON.parse(row.setting_value);
  const headings = template.headings;

  // Rename existing headings
  const renames = {
    "cost-of-sales": { name: "Cost of Revenue", note: "21" },
    "financial-charges": { name: "Finance Cost", note: "25" },
    "taxation-current": { name: "Income Tax", note: "27" },
    "profit-before-tax": { name: "Profit Before Taxation" },
    "profit-after-tax": { name: "Net Profit After Tax" },
  };

  for (const heading of headings) {
    if (renames[heading.id]) {
      heading.name = renames[heading.id].name;
      if (renames[heading.id].note) {
        heading.note = renames[heading.id].note;
      }
    }
  }

  // Add new "Selling & Distribution Expenses" subtotal after "Promotional & Public Relations"
  const promoIndex = headings.findIndex(h => h.id === "promotional-public-relations");
  if (promoIndex === -1) {
    console.error("Could not find 'promotional-public-relations' heading");
    process.exit(1);
  }

  const sellingDistributionSubtotal = {
    id: "selling-distribution-expenses",
    name: "Selling & Distribution Expenses",
    bold: true,
    kind: "subtotal",
    accountIds: [],
    parts: [
      { headingId: "selling-distribution", sign: 1 },
      { headingId: "promotional-public-relations", sign: 1 }
    ]
  };

  // Insert after promotional-public-relations
  headings.splice(promoIndex + 1, 0, sellingDistributionSubtotal);

  // Update operating-expenses to use the new subtotal
  const operatingExpenses = headings.find(h => h.id === "operating-expenses");
  if (operatingExpenses) {
    operatingExpenses.parts = [
      { headingId: "administrative-expenses", sign: 1 },
      { headingId: "selling-distribution-expenses", sign: 1 }
    ];
  }

  // Update operating-profit to use the new subtotal
  const operatingProfit = headings.find(h => h.id === "operating-profit");
  if (operatingProfit) {
    operatingProfit.parts = [
      { headingId: "sales-net", sign: 1 },
      { headingId: "cost-of-sales", sign: -1 },
      { headingId: "administrative-expenses", sign: -1 },
      { headingId: "selling-distribution-expenses", sign: -1 }
    ];
  }

  // Save back
  db.prepare("UPDATE settings SET setting_value = ? WHERE setting_key = 'custom_pl_report'")
    .run(JSON.stringify(template));

  console.log("✓ Updated saved template with new heading names and structure");
  console.log(`  Total headings: ${headings.length}`);

} finally {
  db.close();
}
