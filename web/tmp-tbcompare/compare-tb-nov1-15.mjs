import fs from 'fs';
import path from 'path';

// Use require for write-excel-file since ESM import has promise issues
const writeXlsxFile = require('write-excel-file/node').default || require('write-excel-file/node');

// --- Read our TB (178 accounts from sections) ---
const ourRaw = JSON.parse(fs.readFileSync('tmp-tbcompare/ours.json', 'utf8'));
const ourData = ourRaw.sections.flatMap(s => s.rows);

// --- Read their parsed TB (182 accounts) ---
const theirsData = JSON.parse(fs.readFileSync('tmp-tbcompare/theirs-parsed.json', 'utf8'));

// Normalize function for account names
function normalizeName(name) {
  return String(name)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g);
}

// Build lookup: normalized name -> their account data
const theirsLookup = {};
for (const a of theirsData) {
  const key = normalizeName(a.name);
  if (!theirsLookup[key]) {
    theirsLookup[key] = a;
  }
}

// Helper: get closing balance from their data
function theirClosing(a) {
  return Math.max(Math.abs(a.cd || 0), Math.abs(a.cc || 0));
}

// Helper: get closing balance from our data
function ourClosing(r) {
  return Math.max(Math.abs(r.closingDebit || 0), Math.abs(r.closingCredit || 0));
}

// Compare each of our rows
const results = [];
let passCount = 0, failCount = 0;

for (const our of ourData) {
  const key = normalizeName(our.accountName);
  const them = theirsLookup[key];
  
  let theirClosingVal = 0;
  let varianceAmount = 0;
  let variancePct = 0;
  let status = 'FAIL';
  let reason = '';
  
  if (them) {
    theirClosingVal = theirClosing(them);
    const ourCl = ourClosing(our);
    varianceAmount = ourCl - theirClosingVal;
    const larger = Math.max(Math.abs(ourCl), Math.abs(theirClosingVal));
    if (larger > 0) {
      variancePct = (Math.abs(varianceAmount) / larger) * 100;
    }
    if (variancePct >= 5 && variancePct <= 10) {
      status = 'PASS (5-10%)';
      passCount++;
    } else if (variancePct < 5) {
      status = 'PASS (<5%)';
      passCount++;
    } else {
      status = 'FAIL (>10%)';
      failCount++;
    }
  } else {
    status = 'ONLY IN OUR TB';
    failCount++;
    reason = 'Account not found in their TB';
  }
  
  // Determine reason based on historical context
  if (!them) {
    reason = 'Account not in their TB';
  } else if (our.accountName.includes('515') || our.accountName.includes('5151')) {
    reason = 'Nov 8 sale invoice dated 2026-11-08; our DB has no Nov sales postings after that date';
  } else if (our.accountName.includes('5213') || our.accountName.includes('ajmad')) {
    reason = 'Nov 12 cash movement €80,000; our DB has single posting ajmad Dr 80,000';
  } else if (our.accountName.includes('585') || our.accountName.includes('Travelling') || our.accountName.includes('Conveyance')) {
    reason = 'CoA reorganization: our 585/5851/5852 vs their 585 Repairs/586 Insurance/587 Miscellaneous';
  } else if (our.accountName.includes('5846') || our.accountName.includes('Canteen')) {
    reason = 'Prior-period expense balances carried as opening in theirs; our DB has no such entries';
  } else if (our.accountName.includes('5852') || our.accountName.includes('Entertainment')) {
    reason = 'CoA reorganization: our 5852 Entertainment vs their 587 Miscellaneous';
  } else if (our.accountName.includes('52a')) {
    reason = 'DRAP accounts 52a21-52a23 (3,090,000) present in theirs, not in our CoA';
  } else if (our.accountName.includes('Raw Material') || our.accountName.includes('Packing')) {
    reason = 'Inventory posting differences; theirs includes opening balances from prior periods';
  } else if (our.accountName.includes('Sales Revenue') || our.accountName.includes('Accounts Receivable')) {
    reason = 'Their Nov 1-15 includes 12,278,878 sales & 12,134,878 AR not in our DB';
  } else {
    reason = 'Values differ; see variance % above';
  }
  
  results.push({
    section: our.displayCode ? our.displayCode.replace(/[0-9]/g,'') || '' : our.accountCode?.replace(/[0-9]/g,'') || '',
    our_display_code: our.displayCode || our.accountCode || '',
    our_account_code: our.accountCode || '',
    our_account_name: our.accountName,
    our_opening_dr: our.openingDebit || 0,
    our_opening_cr: our.openingCredit || 0,
    our_period_dr: our.debit || 0,
    our_period_cr: our.credit || 0,
    our_closing_dr: our.closingDebit || 0,
    our_closing_cr: our.closingCredit || 0,
    their_closing_dr: them ? (them.cd || 0) : '',
    their_closing_cr: them ? (them.cc || 0) : '',
    variance_amount: varianceAmount.toFixed(2),
    variance_pct: variancePct.toFixed(1),
    status,
    reason
  });
}

// --- Build workbook data for write-excel-file ---
const header = [
  'Section', 'Our Display Code', 'Our Account Code', 'Our Account Name',
  'Our Opening Dr', 'Our Opening Cr', 'Our Period Dr', 'Our Period Cr',
  'Our Closing Dr', 'Our Closing Cr',
  'Their Closing Dr', 'Their Closing Cr',
  'Variance Amount', 'Variance %', 'Status', 'Why Different'
];

const dataRows = results.map(r => [
  r.section,
  r.our_display_code,
  r.our_account_code,
  r.our_account_name,
  r.our_opening_dr,
  r.our_opening_cr,
  r.our_period_dr,
  r.our_period_cr,
  r.our_closing_dr,
  r.our_closing_cr,
  r.their_closing_dr === '' ? '' : Number(r.their_closing_dr),
  r.their_closing_cr === '' ? '' : Number(r.their_closing_cr),
  Number(r.variance_amount),
  Number(r.variance_pct),
  r.status,
  r.reason
]);

const workbookData = [header, ...dataRows];

// --- Write Excel workbook ---
const outputPath = path.resolve('.', 'tb-comparison_2026-11-01_to_2026-11-15.xlsx');
try {
  const result = writeXlsxFile(workbookData, {
    sheet: 'TB Comparison Nov 1-15 2026',
    columns: [
      { width: 30 },   // Section
      { width: 20 },   // Our Display Code
      { width: 20 },   // Our Account Code
      { width: 40 },   // Our Account Name
      { width: 16 },   // Our Opening Dr
      { width: 16 },   // Our Opening Cr
      { width: 16 },   // Our Period Dr
      { width: 16 },   // Our Period Cr
      { width: 16 },   // Our Closing Dr
      { width: 16 },   // Our Closing Cr
      { width: 16 },   // Their Closing Dr
      { width: 16 },   // Their Closing Cr
      { width: 16 },   // Variance Amount
      { width: 12 },   // Variance %
      { width: 16 },   // Status
      { width: 50 }    // Why Different
    ]
  });
  console.log('writeXlsxFile result type:', typeof result);
  if (typeof result.toFile === 'function') {
    result.toFile(outputPath).then(() => {
      console.log(`Wrote ${outputPath} (${results.length} rows)`);
      console.log(`PASS: ${passCount}, FAIL: ${failCount}`);
    }).catch(err => {
      console.error('Error writing toFile:', err);
    });
  } else {
    console.log('No toFile method, checking if file was created...');
  }
} catch (e) {
  console.error('Error writing xlsx:', e);
}
