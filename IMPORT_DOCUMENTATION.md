# PharmaPro → BOP Data Import — Full Documentation

This document explains how the historical data from the old **PharmaPro** system
was migrated into the current **BOP ERP** database, why the data is stored the
way it is, and how everything was reconciled against the old books.

---

## 1. Objective

Migrate every meaningful record from the old PharmaPro system into BOP as a
**faithful historical log** so that:

- Old sales, purchases, collections, payments, expenses and balances appear in
  the new system's reports.
- The new system's **balance sheet, P&L, party balances, inventory and fixed
  assets** match the old books **exactly** (amount-for-amount).
- Nothing is duplicated, and nothing is silently dropped.

## 2. Standing rules (per user, applied to every import)

1. **Never touch current products.** Old products that don't already exist are
   imported as **inactive "ghost" items** so historical records can reference
   them without polluting the live product list.
2. **No stock effect.** No stock batches, stock movements, or inventory value
   changes are ever created for historical data (stock is represented only by
   the opening inventory balance).
3. **No bank/cash transactions.** Cash is reconciled to old books by a single
   zero-out entry, not by re-booking every bank transaction.
4. **All IDs/codes are software-generated** from `numbering_sequences`
   (`OPENING-xxxxx`, `PI-xxxxx`, `SI-xxxxx`, `PV-xxxxx`, `PO-xxxxx`,
   `BOM-xxxxx`, `ITEM-xxxxx`, …). Nothing is hard-coded.
5. **Resumable.** Every script skips records already imported (marker in
   `notes`/narration), so re-running is safe.
6. **Historical entries post to retained earnings (3100)** as the counter-account
   so the balance sheet stays balanced without inventing cash/bank flows.

## 3. Why ghost items?

The old system's products (`Products.csv`) don't map 1:1 to the new system's
`items`. When we import historical sales, purchases, or manufacturing records,
the foreign key from `items` is **required** — every line must point at a real
item row.

- If the product already exists by name → we reuse the existing item.
- If it doesn't → we create a **ghost item**: `is_active=0`, all prices/stock 0,
  unit `UNIT`, note *"Ghost item from PharmaPro import (old ProductId=…)"*.

Because `is_active=0`, ghost items:
- never appear in product/item pickers or the live inventory screens,
- are invisible to stock lookups (all stock queries filter `is_active=1`),
- yet still let historical invoices/orders reference the correct product.

Total across all imports: **997 ghost items** (sales/purchases + 537 added for
manufacturing). Active (real) items remained **741** throughout.

## 4. Import phases

### 4.1 Raw materials list — `import_raw_materials.py`
Reads the user's `list of raw material.txt`, creates each raw material via
`ItemService` (unit `KG`, type `RAW_MATERIAL`, prices/stock 0). Existing items
skipped by name.

### 4.2 Parties — `import_parties.py`
Imports `Parties.csv` (83 parties) as customers/suppliers. Existing parties
skipped by code + type.

### 4.3 Sales invoices — `import_sales_invoices.py`
Imports `Sales.csv` (289 invoices / 721 lines) as posted sales invoices with
party, items (ghost items created on demand), quantities, and tax. Invoice
numbers from the `SALES_INVOICE` sequence. No stock effect.

### 4.4 Purchase invoices — `import_purchase_invoices.py`
Imports `Purchases.csv` (307 invoices / 741 lines) as posted purchase invoices
with party, items (ghost items on demand), quantities. Numbers from the
`PURCHASE_INVOICE` sequence. No stock effect.

### 4.5 Customer collections — `import_collections.py`
Imports `CashCollection.csv` + `CollectionBody.csv` (301 receipts) as cash
receipt vouchers **logged against the party**, without allocating to specific
invoices (so `paid_amount` on invoices is untouched). Numbers from the
`RECEIPT` sequence. No bank/cash account movement.

### 4.6 Supplier payments — `import_supplier_payments.py`
From `DebitVouchers.csv` + `DebitVouchersBody.csv`, only the **vendor-party
payment lines** are imported: `Dr A/P (2000) + party_id, Cr Cash (1000)` as
payment vouchers (`PAYMENT` sequence, `PV-xxxxx`). This fixed the payables.

### 4.7 Non-party debit-voucher expenses — `import_dv_expenses.py`
Every non-party DV line (salaries, building, utilities, market expenses, asset
instalments, …) is booked as **one journal entry per line**:
`Dr expense/asset account, Cr 3100 Retained Earnings`, each with its own date
and narration. Classification:
- 6000 (G&A): salaries, building, utilities, registration, DR. Abdul Razzaq, …
- 6100 (Selling): market team, incentives, market salary, tours
- 1500 (Fixed Assets): HBL instalment, car instalment, vehicles, furniture

### 4.8 Journal-voucher expenses — `import_jv_expenses.py`
The JV party credits (620080/620083/620096) were **already absorbed** into
opening balances, and the Credit Voucher (14001/1505) was already reflected in
the fixed-asset reconcile. So only the **expense side** was booked:
`Dr 6000/6100, Cr 3100` (3 lines, 25,650 total).

### 4.9 Opening balances — `import_opening_balances.py`
Computes each party's opening balance:
`opening = old_final (AccountsBalances.csv) − current net balance in DB`,
then posts one `OPENING-xxxxx` journal per party:
`Dr/Cr A/R 1100 (customers) or A/P 2000 (suppliers)`, counter to 3100.

### 4.10 Cash zero-out — `import_cash_zeroout.py`
Posts a single entry that zeroes the cash account to match old books (no bank
transactions were re-booked).

### 4.11 Fixed-asset reconciliation — `import_fa_reconcile.py`
The DV import had booked the full debit side of asset instalments; the old
books' final balances reflect net asset values. The difference is reclassed to
3100 (user chose **"Reconcile to old books"**):
- 1501 HBL Instalment 9,750,372 → 3,650,372 (cr 6,100,000)
- 1502 Motor Car Instalment 738,150 → 47,500 (cr 690,650)
- 1505 Car Sale & Purchase 175,700 → Cr 200,000 (cr 375,700)
- total 7,166,350 cr assets / dr 3100.

All five asset accounts now match old books exactly.

### 4.12 Manufacturing / formula / BOM — `import_manufacturing.py`
Adds the entire manufacturing history as **logs only** (no inventory effect).
All old manufacturing data is `IsPosted=False`, so it never touched the old
ledger and has **zero financial impact** — it is imported purely for data
completeness.

**Ghost items:** 537 products referenced in manufacturing tables that didn't
exist yet were created as ghost items (broken down by old company:
00→119 finished, 01→7 raw, 02→155 packing, 03→256 unpacked/semi-finished).

**BOMs (recipes):**
- `FormulaHeader/FormulaBody` (250) → `bill_of_materials` + `bom_components`
- `FillingHeader/FillingBody` (314) → `bill_of_materials` + `bom_components`
- Output product is the `finished_item_id`; each body line is a component with
  its `quantity_required`. Names from the `BOM` sequence (`BOM-00003+`).
- Total: **564 BOMs, 2,562 components.**

**Production orders (runs):**
- `Productions/ProductionBody` (571) → production orders producing unpacked
  (company 03) items, linked to the matching formula BOM.
- `PackingHeader/PackingBody` (617) → production orders producing finished
  (company 00) items, linked to the matching filling BOM.
- Recorded as `status=COMPLETED`, with planned/actual quantity, batch number,
  manufacturing/expiry dates, and `production_cost` = old `TTLValue`.
- Numbers from the `PRODUCTION_ORDER` sequence (`PO-00001+`).
- Consumption lines (`ProductionBody`/`PackingBody`) are stored in
  `production_consumption`.

**Ghost stock batches:** `production_consumption.batch_id` is `NOT NULL` with a
foreign key to `stock_batches`, so one ghost batch per consumption line is
created with `is_active=0` and `quantity_in_stock=0`. These are invisible to
every stock operation (all stock queries require `is_active=1`) and carry zero
quantity — **they satisfy the foreign key without creating stock.** 4,916
created.

**Not imported (by design):** `Expiries` (1 row, already absorbed), sale
returns (user skipped), stock batches/movements, `CurrentStock`/`OpeningStock`
(inventory via balances), projects/tasks, geo data, and the full raw
`History.csv` (reconstructed from the structured imports above).

## 5. Verification & audit

After all imports, the system was audited end-to-end:

| Item | Value | Match |
|---|---|---|
| Balance sheet (debits = credits) | 558,345,058.42 | ✅ |
| Accounts Receivable (1100) | 60,619,263 | ✅ old books |
| Accounts Payable (2000) | −16,989,642.42 | ✅ old books |
| Cash | 0 | ✅ old books |
| Fixed assets (1501–1505) | 4,096,872 | ✅ old books |
| Inventory (opening balance) | 23,057,802.42 | ✅ old books |
| Revenue | 103,223,844 | ✅ |
| Expenses (DV + JV) | 80,302,393 | ✅ |
| Net profit | 22,921,451 | ✅ |
| Active items | 741 | unchanged |
| Ghost items | 997 | invisible to UI/stock |
| Stock batches (active / with qty) | 0 / 0 | ✅ no inventory created |

`AllVouchers.csv` was cross-checked against the imported journal entries to
confirm nothing historical was lost.

## 6. Files

All one-off import scripts live in the repo root:

| Script | Purpose |
|---|---|
| `import_raw_materials.py` | raw material list |
| `import_parties.py` | 83 parties |
| `import_sales_invoices.py` | 289 sales invoices |
| `import_purchase_invoices.py` | 307 purchase invoices |
| `import_collections.py` | 301 receipts |
| `import_supplier_payments.py` | vendor payment lines (payables fix) |
| `import_dv_expenses.py` | non-party DV expenses |
| `import_jv_expenses.py` | JV expense side |
| `import_opening_balances.py` | per-party opening balances |
| `import_cash_zeroout.py` | cash vs old books |
| `import_fa_reconcile.py` | fixed-asset reconciliation |
| `import_manufacturing.py` | 564 BOMs + 1,188 production orders |

All scripts follow the same pattern: read CSV from `PharmaPro_Export/`, connect
via the `sqlitecloud` wrapper, generate numbers from `numbering_sequences`, run
inside transactions, and skip already-imported records via `notes` markers.