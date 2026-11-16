#!/usr/bin/env node

import { Database } from '@sqlitecloud/drivers';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read the env file to get the cloud URL
const envContent = readFileSync(resolve('.env'), 'utf8');
if (!envContent) {
  console.error('.env not found');
  process.exit(1);
}
const urlMatch = envContent.match(/SQLITE_CLOUD_URL=(.+)/);
if (!urlMatch) {
  console.error('SQLITE_CLOUD_URL not found in web/.env');
  process.exit(1);
}

const dbUrl = urlMatch[1].trim();
const db = new Database(dbUrl);

// Get the current template
const result = await db.sql`SELECT setting_value FROM settings WHERE setting_key = 'custom_pl_report'`;
if (!result || result.length === 0) {
  console.log('No saved template found. Code default will apply.');
  db.close();
  process.exit(0);
}

const json = result[0].setting_value;
const template = JSON.parse(json);
const headings = template.headings;

console.log(`Found ${headings.length} headings`);

// Check if already updated
if (headings.find(h => h.id === 'selling-distribution-expenses')) {
  console.log('Template already updated');
  db.close();
  process.exit(0);
}

// Insert new subtotal after promotional-public-relations
const promoIdx = headings.findIndex(h => h.id === 'promotional-public-relations');
if (promoIdx === -1) {
  console.error('Cannot find promotional-public-relations heading');
  db.close();
  process.exit(1);
}

headings.splice(promoIdx + 1, 0, {
  id: 'selling-distribution-expenses',
  name: 'Selling & Distribution Expenses',
  note: '23',
  bold: true,
  kind: 'subtotal',
  accountIds: [],
  parts: [
    { headingId: 'selling-distribution', sign: 1 },
    { headingId: 'promotional-public-relations', sign: 1 }
  ]
});

// Update operating-expenses
const opExp = headings.find(h => h.id === 'operating-expenses');
if (opExp) {
  opExp.parts = [
    { headingId: 'administrative-expenses', sign: 1 },
    { headingId: 'selling-distribution-expenses', sign: 1 }
  ];
}

// Update operating-profit
const opProfit = headings.find(h => h.id === 'operating-profit');
if (opProfit) {
  opProfit.parts = [
    { headingId: 'sales-net', sign: 1 },
    { headingId: 'cost-of-sales', sign: -1 },
    { headingId: 'administrative-expenses', sign: -1 },
    { headingId: 'selling-distribution-expenses', sign: -1 }
  ];
}

const newJson = JSON.stringify({ headings });

// Update the database
await db.sql`UPDATE settings SET setting_value = ${newJson} WHERE setting_key = 'custom_pl_report'`;

console.log(`✓ Updated to ${headings.length} headings`);
db.close();
