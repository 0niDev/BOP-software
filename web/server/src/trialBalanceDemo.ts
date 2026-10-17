/**
 * Standalone demo: trial balance cross-check.
 *
 * 1. Builds a fresh in-memory SQLite database and runs the bootstrap schema
 *    plus the seeded chart of accounts (seedDemoData is NOT used — only
 *    bootstrapDatabase, so the ledger starts empty).
 * 2. Posts the four prescribed double-entry vouchers through
 *    AccountingService.postJournalEntry().
 * 3. Prints the raw journal entry breakdown (Step 1 output).
 * 4. Prints AccountingService.getTrialBalance() right below it (Step 2 output)
 *    so the manual trial balance can be cross-compared with the system's.
 *
 * Run: npx tsx src/trialBalanceDemo.ts   (from web/server)
 */
import { bootstrapDatabase } from "./db/bootstrap.js";
import { LocalSqliteDatabase } from "./db/localSqlite.js";
import { formatAmount } from "./domain/money.js";
import { AccountingService } from "./services/accountingService.js";

const ENTRY_DATE = "2026-10-17";

interface VoucherSpec {
  label: string;
  narration: string;
  lines: { code: string; debit?: number; credit?: number }[];
}

const VOUCHERS: VoucherSpec[] = [
  {
    label: "Voucher 1 (Capital Injection)",
    narration: "Capital injection by owner",
    lines: [
      { code: "1000", debit: 1000000 }, // Cash
      { code: "3000", credit: 1000000 }, // Capital / Equity (Owner's Equity)
    ],
  },
  {
    label: "Voucher 2 (Inventory Purchase on Credit)",
    narration: "Inventory purchase on credit",
    lines: [
      { code: "1220", debit: 200000 }, // Inventory - Finished Goods
      { code: "2000", credit: 200000 }, // Accounts Payable
    ],
  },
  {
    label: "Voucher 3 (Cash Sale & COGS)",
    narration: "Cash sale and cost of goods sold",
    lines: [
      { code: "1000", debit: 150000 }, // Line A: Cash
      { code: "4000", credit: 150000 }, // Line A: Sales Revenue
      { code: "5000", debit: 80000 }, // Line B: Cost of Goods Sold
      { code: "1220", credit: 80000 }, // Line B: Inventory - Finished Goods
    ],
  },
  {
    label: "Voucher 4 (Vendor Settlement)",
    narration: "Partial settlement of supplier payable",
    lines: [
      { code: "2000", debit: 50000 }, // Accounts Payable
      { code: "1000", credit: 50000 }, // Cash
    ],
  },
];

const pad = (value: string, width: number): string =>
  value.padEnd(width, " ");
const left = (value: string, width: number): string =>
  value.padStart(width, " ");
const money = (value: number): string => left(formatAmount(value), 16);

async function main(): Promise<void> {
  // --- 1. Fresh in-memory database + bootstrap schema & chart of accounts ---
  const db = new LocalSqliteDatabase(":memory:");
  await bootstrapDatabase(db);

  const accounting = new AccountingService(db, 1);

  const accountIdByCode = async (code: string): Promise<number> => {
    const row = await db.get<{ id: number }>(
      "SELECT id FROM accounts WHERE company_id = 1 AND account_code = ?",
      [code],
    );
    if (!row) throw new Error(`Account ${code} missing from chart of accounts`);
    return row.id;
  };

  const accountNameByCode = new Map<string, string>();
  for (const acct of await db.all<{ account_code: string; account_name: string }>(
    "SELECT account_code, account_name FROM accounts WHERE company_id = 1",
  )) {
    accountNameByCode.set(acct.account_code, acct.account_name);
  }

  // --- 2. Post the four journal entries -------------------------------
  const posted: { spec: VoucherSpec; entryId: number; voucherNumber: string }[] = [];
  for (const spec of VOUCHERS) {
    const entryId = await accounting.postJournalEntry({
      voucherType: "JOURNAL",
      entryDate: ENTRY_DATE,
      narration: spec.narration,
      lines: await Promise.all(
        spec.lines.map(async (line) => ({
          accountId: await accountIdByCode(line.code),
          debit: line.debit,
          credit: line.credit,
          description: `${spec.label}: ${line.code} ${accountNameByCode.get(line.code) ?? ""}`.trim(),
        })),
      ),
    });
    const row = await db.get<{ voucher_number: string }>(
      "SELECT voucher_number FROM journal_entries WHERE id = ?",
      [entryId],
    );
    posted.push({ spec, entryId, voucherNumber: row?.voucher_number ?? `#${entryId}` });
  }

  // --- 3. Step 1 output: raw journal entry breakdown -------------------
  const rule = "=".repeat(96);
  console.log(rule);
  console.log("STEP 1 - RAW JOURNAL ENTRY BREAKDOWN (as posted to the database)");
  console.log(rule);
  console.log(`Database: fresh SQLite in-memory | Company: 1 | Entry date: ${ENTRY_DATE}\n`);

  // Per-account net movement accumulated from the raw lines — this is what a
  // manually built trial balance derives (each account netted into its normal
  // column), as opposed to the gross line-word totals below.
  const manualNet = new Map<string, { debit: number; credit: number }>();

  let manualDebit = 0;
  let manualCredit = 0;
  for (const { spec, entryId, voucherNumber } of posted) {
    console.log(`${spec.label}  [id=${entryId}, voucher=${voucherNumber}, type=JOURNAL]`);
    console.log(`  Narration: ${spec.narration}`);
    console.log(`  ${pad("Code", 6)}${pad("Account", 34)}${left("Debit (PKR)", 16)}${left("Credit (PKR)", 16)}`);

    let entryDebit = 0;
    let entryCredit = 0;
    for (const line of spec.lines) {
      const debit = line.debit ?? 0;
      const credit = line.credit ?? 0;
      entryDebit += debit;
      entryCredit += credit;
      manualDebit += debit;
      manualCredit += credit;
      const net = manualNet.get(line.code) ?? { debit: 0, credit: 0 };
      net.debit += debit;
      net.credit += credit;
      manualNet.set(line.code, net);
      console.log(
        `  ${pad(line.code, 6)}${pad(accountNameByCode.get(line.code) ?? "?", 34)}${money(debit)}${money(credit)}`,
      );
    }
    console.log(
      `  ${pad("", 6)}${pad("Entry total", 34)}${money(entryDebit)}${money(entryCredit)}  -> balanced: ${entryDebit === entryCredit}`,
    );
    console.log("");
  }
  console.log(
    `GROSS LINE TOTALS:  Debit ${formatAmount(manualDebit)}  |  Credit ${formatAmount(manualCredit)}  |  Diff ${formatAmount(manualDebit - manualCredit)}`,
  );

  // Manual trial balance: net each account into its normal column (assets and
  // expenses debit-normal; liabilities, equity and revenue credit-normal).
  const DEBIT_NORMAL = new Set(["1", "5"]);
  const manualTb = new Map<string, { debit: number; credit: number }>();
  for (const [code, net] of manualNet) {
    const debitNormal = DEBIT_NORMAL.has(code.charAt(0));
    // Balance in the account's normal sign: assets/expenses count D−C,
    // liabilities/equity/revenue count C−D — then place it in its column.
    const normal = debitNormal ? net.debit - net.credit : net.credit - net.debit;
    manualTb.set(
      code,
      normal >= 0
        ? { debit: debitNormal ? normal : 0, credit: debitNormal ? 0 : normal }
        : { debit: debitNormal ? 0 : -normal, credit: debitNormal ? -normal : 0 },
    );
  }
  let manualTbDebit = 0;
  let manualTbCredit = 0;
  console.log("");
  console.log("MANUAL TRIAL BALANCE (derived from the raw lines above):");
  console.log(`  ${pad("Code", 6)}${pad("Account", 34)}${left("Debit (PKR)", 16)}${left("Credit (PKR)", 16)}`);
  for (const code of [...manualTb.keys()].sort()) {
    const cell = manualTb.get(code)!;
    if (cell.debit === 0 && cell.credit === 0) continue;
    manualTbDebit += cell.debit;
    manualTbCredit += cell.credit;
    console.log(
      `  ${pad(code, 6)}${pad(accountNameByCode.get(code) ?? "?", 34)}${money(cell.debit)}${money(cell.credit)}`,
    );
  }
  console.log(`  ${"-".repeat(72)}`);
  console.log(`  ${pad("", 6)}${pad("TOTAL", 34)}${money(manualTbDebit)}${money(manualTbCredit)}`);

  // --- 4. Step 2 output: the system-generated trial balance ------------
  // Note: the service signature is getTrialBalance(companyId, opts?) — not an
  // options object — so `getTrialBalance({ companyId: 1 })` is expressed here
  // as getTrialBalance(1).
  const trialBalance = await accounting.getTrialBalance(1);

  console.log("");
  console.log(rule);
  console.log("STEP 2 - SYSTEM TRIAL BALANCE (AccountingService.getTrialBalance, companyId 1)");
  console.log(rule);
  console.log(
    `  ${pad("Code", 6)}${pad("Account", 30)}${pad("Type", 10)}${left("Debit (PKR)", 16)}${left("Credit (PKR)", 16)}`,
  );

  let systemDebit = 0;
  let systemCredit = 0;
  for (const row of trialBalance) {
    if (row.debit === 0 && row.credit === 0) continue;
    systemDebit += row.debit;
    systemCredit += row.credit;
    console.log(
      `  ${pad(row.accountCode, 6)}${pad(row.accountName, 30)}${pad(row.accountType, 10)}${money(row.debit)}${money(row.credit)}`,
    );
  }
  console.log(`  ${"-".repeat(82)}`);
  console.log(
    `  ${pad("", 6)}${pad("TOTAL", 36)}${money(systemDebit)}${money(systemCredit)}`,
  );
  console.log("");
  const systemByCode = new Map(
    trialBalance.map((r) => [r.accountCode, { debit: r.debit, credit: r.credit }]),
  );
  const mismatches: string[] = [];
  for (const code of new Set([...manualTb.keys(), ...systemByCode.keys()])) {
    const m = manualTb.get(code) ?? { debit: 0, credit: 0 };
    const s = systemByCode.get(code) ?? { debit: 0, credit: 0 };
    // The manual view only carries accounts that actually moved in these four
    // vouchers, so ignore system rows that are zero on both sides (seeded
    // accounts with no movement).
    if (m.debit === 0 && m.credit === 0 && s.debit === 0 && s.credit === 0) continue;
    if (m.debit !== s.debit || m.credit !== s.credit) {
      mismatches.push(`${code}: manual ${m.debit}/${m.credit} vs system ${s.debit}/${s.credit}`);
    }
  }
  const totalsMatch =
    manualTbDebit === systemDebit && manualTbCredit === systemCredit;
  console.log(
    `CROSS-CHECK: manual TB ${formatAmount(manualTbDebit)}/${formatAmount(manualTbCredit)} vs system TB ${formatAmount(systemDebit)}/${formatAmount(systemCredit)} -> ${totalsMatch ? "MATCH" : "MISMATCH"}`,
  );
  console.log(
    mismatches.length === 0
      ? "PER-ACCOUNT CHECK: every account agrees with the manual calculation."
      : `PER-ACCOUNT CHECK: ${mismatches.length} mismatch(es):\n  ${mismatches.join("\n  ")}`,
  );

  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});