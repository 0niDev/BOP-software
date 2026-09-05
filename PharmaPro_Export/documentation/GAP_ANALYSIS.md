# PharmaPro Export → BOP App — Gap Analysis

What is already in the app, what is not, and what can still be added
**without touching inventory, stock, or normal items** (ghost items only).

Checked against the live database (`erp_backup_20260820_023705.db`).

---

## 1. Already imported (verified in the live DB)

| Data | Source | In app |
|---|---|---|
| Parties (customers + vendors) | `Parties.csv` (83) | ✅ 83 in `parties` |
| Sales invoices | `Sales.csv` (289) | ✅ 289 in `sales_invoices` |
| Sales invoice lines | `SalesBody.csv` (721) | ✅ 721 in `sales_invoice_items` |
| Purchase invoices | `Purchases.csv` (307) | ✅ 307 in `purchase_invoices` |
| Purchase invoice lines | `PurchasesBody.csv` (741) | ✅ 741 in `purchase_invoice_items` |
| Customer collections (receipts) | `CashCollection.csv` + `CollectionBody.csv` (301) | ✅ 301 in `receipts` |
| Supplier payments (vendor DV lines) | `DebitVouchersBody.csv` (vendor party lines, 61 vouchers) | ✅ 61 `PAYMENT` journal entries |
| Non-party DV expenses | `DebitVouchersBody.csv` (477 lines) | ✅ 463 `OPENING` journal entries |
| JV expense side | `JournalVouchersBody.csv` (3 expense lines) | ✅ 3 `OPENING` journal entries |
| Party opening balances | `AccountsBalances.csv` (party accounts) | ✅ 527 `OPENING` journal entries |
| Fixed-asset reconcile | DV asset lines | ✅ `OPENING-00551` |
| Cash zero-out vs old books | — | ✅ done |
| Formula BOMs | `FormulaHeader/Body` (250) | ✅ 250 BOMs |
| Filling BOMs | `FillingHeader/Body` (314) | ✅ 314 BOMs |
| Production runs | `Productions/ProductionBody` (571) | ✅ 571 production orders |
| Packing runs | `PackingHeader/Body` (617) | ✅ 617 production orders |
| Ghost stock batches (FK only, qty 0, inactive) | manufacturing | ✅ 4,916 |
| Ghost items (inactive) | on-demand products | ✅ 997 |
| Expenses tab | DV/JV expenses | ✅ 468 expenses, 32 categories, 326 expense items |
| Chart of accounts (new) | mapped | ✅ 26 accounts |

**Verified totals in DB:** `parties=83`, `sales_invoices=289`, `purchase_invoices=307`,
`receipts=301`, `journal_entries=1485`, `bill_of_materials=566`,
`bom_components=2567`, `production_orders=1188`, `production_consumption=4916`,
`stock_batches=4916` (all inactive/qty 0), `stock_movements=0`, `expenses=468`,
`items=1752` (741 active + 997 ghost + 14 inactive/other).

---

## 2. NOT imported (gaps)

### 2.1 Product catalog — 217 products have no item at all
`Products.csv` has **1,342** products. **1,125** are matched by name to an item
(active or ghost). **217** have **no** matching item.

- Only **4** of the 217 are referenced anywhere — and only in
  `OpeningStock`/`CurrentStock` (inventory, which we do not import):
  `01039 Pectin`, `02321 Packet Udder Boost 500 gm`, `02324 Shipper [L] Nilli Bar`,
  `02361 Packet Dairy Yeast 1 kg`.
- The other **213** are never referenced by any invoice/production/voucher.

→ These can be added as **ghost items** (`is_active=0`, zero prices/stock) so the
full PharmaPro catalog is preserved, without touching inventory or active items.

### 2.2 Sale returns — 4 returns / 17 lines
`sales_returns` / `sales_return_items` tables are **empty**.
Source: `SaleReturns.csv` (4) + `SaleReturnsBody.csv` (17 lines).
In old books all 4 have `IsPosted=False` → **no financial impact**.

⚠️ The app's `sales_returns` schema requires a non-null `invoice_id`; the old
returns have **no** `SaleId`, so they cannot be cleanly linked to an invoice.

### 2.3 Expiries — 1 claim / 6 lines
`stock_losses` table is **empty**. Source: `Expiries.csv` + `ExpiriesBody.csv` +
`ExpiriesBatch.csv` (1 claim, products 00399–00404 ×24 each).

⚠️ This is an **inventory loss event** (returned goods that expired). It matches
Sale Return #4 exactly (same products/quantities). Importing it as `stock_losses`
would be an inventory record — **excluded by your rules** unless added as a
passive ghost log.

### 2.4 Customer-party DV lines — 13 lines to account 620041 (Qazi Irfan)
These are salary/advance payments **debited to customer 620041**
(e.g. “Salary Faisal Sakhar”, “Salary Qazim”, “Sarfraz Salary”) —
**1,481,055 total**, on 9 vouchers.

They were **not** imported: `import_supplier_payments.py` handles only *vendor*
party lines; `import_dv_expenses.py` skips all 61/62 party accounts.

⚠️ Reconciliation check: 620041's balance in the DB **exactly equals** the old
books (`Cr 3,327,211`) because the opening-balance computation absorbed them.
Importing these 13 lines as new journal entries would **break the match** unless
we also reduce 620041's opening balance by the same amount (compensating entry).

### 2.5 Credit Voucher — 1 line (200,000 → 14001)
The credit voucher “Cash Received Advance MG sale” (200,000 to Car Sale &
Purchase 14001) is **already reflected** in the fixed-asset reconcile
(`OPENING-00551`, 1505 Cr 375,700 = DV 175,700 + CV 200,000). No action needed.

### 2.6 JV party credits (620080 / 620083 / 620096)
Already absorbed into party opening balances (balances match old books exactly).
No action needed.

### 2.7 History log — 11,040 rows
`History.csv` is a raw stock-batch audit log. Not imported (reconstructed from
the structured imports above). Not needed.

### 2.8 Geo / config data
- `ActualSectors.csv` (5) / `ActualTowns.csv` (49) — no target table in the app.
- `Project_Registry.csv` (122) / `Project_Tasks.csv` (258) — PharmaPro app
  settings/features; `settings` table in the app is unused (0 rows).
- `Companies.csv` (4) — old product categories, not needed.
- `CompIDs.csv`, `Users.csv` (1) — internal/system, not needed.
- `ChartOfAccounts.csv` (260) — old chart; the app uses its own 26-account chart.
- `AccountsBalances.csv` (202) — used to compute party openings; old COA balances
  themselves are not imported (by design).

---

## 3. Imported on 2026-08-20 (user-approved: A + B + C + D)

All four gaps below were imported with `import_remaining_gaps.py`.
**No inventory was touched** (`stock_movements=0`,
`stock_batches active+qty=0`), and **no normal items were created/edited**
(`items active` unchanged at 741).

| # | Item | What was done | Result |
|---|---|---|---|
| A | Missing products | **209 ghost items** created (`is_active=0`, zero price/stock) — the other 8 of the 217 already existed as inactive items with matching names | `items` 1752 → **1961**; every one of the 1,342 old products now has an item (active or ghost) |
| B | 13 customer-DV lines (620041) | 13 journal entries **Dr A/R(1100) 620041 / Cr 3100** (`OPENING-00555..00567`) **+** one compensating entry **Cr A/R(1100) 620041 / Dr 3100** (`OPENING-00568`) so the party balance still equals old books exactly | 620041 net **unchanged** = Cr 3,327,211 ✅ |
| C | Sale returns (4) | 4 passive `audit_log` records (`IMPORT_PHARMAPRO_SALE_RETURN`) with header + line details | `audit_log` +4 |
| D | Expiries (1) | 1 passive `audit_log` record (`IMPORT_PHARMAPRO_EXPIRY`) with lines + batches | `audit_log` +1 |

Post-import verification:
- `journal_entries` 1485 → **1499** (13 DV lines + 1 compensating entry)
- Balance sheet still balanced: total debit = total credit = **561,307,168.42**
- 620041 Qazi Irfan net = **Cr 3,327,211** (matches old books exactly)

---

## 4. Remaining non-applicable / intentionally not imported

- **2.5** Credit Voucher (200,000) — already absorbed in fixed-asset reconcile.
- **2.6** JV party credits — already absorbed into party opening balances.
- **2.7** History log — raw audit log, reconstructed from structured imports.
- **2.8** Geo data, Project Registry/Tasks, Companies, CompIDs, old Chart of
  Accounts, old COA balances — no target table / not applicable.
