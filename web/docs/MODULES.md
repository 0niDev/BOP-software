# Functional modules

One section per module: what the screen does, the rules the service enforces,
and the journal entry each action writes. Account codes refer to
[DATA_MODEL.md](DATA_MODEL.md#system-accounts).

## Dashboard

`DashboardPage` (the landing page after sign-in) renders one `GET
/api/dashboard` payload; there is no cache — every visit recomputes from posted
data, so a figure is never stale.

| Area | Content |
| --- | --- |
| KPI strip | Today's sales total/count and purchases total/count |
| Balances | Cash (`1000`), bank (all bank accounts), inventory value, total |
| Receivables / payables | Party-linked AR (`1100`) and AP (`2000`) balances |
| Profit & loss | Month-to-date revenue, expenses and profit |
| Revenue trend | Six-month revenue/expense/profit series (`RevenueTrendChart`) |
| Customer mix | Revenue share by customer (`CustomerDonut`) |
| Recent activity | Newest sales, purchases, payments, receipts and expenses; each row's menu jumps to the owning module (`ActivityList`) |
| Best sellers | Items ranked by revenue with quantity, revenue and customer count (`BestSellersTable`) |
| Low stock / expiring | Items at or below minimum stock; batches expiring soon (`LowStockTable`, `ExpiringTable`) |
| Alerts | Warnings/dangers/successes derived from the same figures (`AlertsCard`) |

Low stock uses `current_stock <= minimum_stock`; expiring uses batch expiry
dates within the service's horizon. The KPI tiles use compact formatting
(`3.1M`) and the detail tables use full money formatting.

## Chart of accounts

`AccountsPage` is the chart of accounts: a tree by `parent_account_id`, with
type, subtype, opening balance, system flag and active state.

- Codes are unique per company; types are `ASSET`, `LIABILITY`, `EQUITY`,
  `REVENUE`, `EXPENSE`.
- A parent must exist in the same company and have the **same account type** as
  the child; there is no cycle check, so choose an existing tree.
- **System accounts cannot be deactivated.**
- An account cannot be deactivated while it has active sub-accounts. It *can* be
  deactivated while it still carries posted movement — the trial balance keeps
  listing deactivated accounts with movement so the books stay balanced.
- Creating or editing an opening balance posts an `OPENING` entry against
  Retained Earnings (`3100`), so the books stay balanced. Editing an opening
  balance posts the difference (a new adjusting entry), it does not rewrite
  history.
- The bulk **Opening balances** form posts one `OPENING` entry for all entered
  accounts and requires total debit = total credit (tolerance 0.01).

```
Opening balance of a debit-normal account:   Dr account        Cr 3100
Opening balance of a credit-normal account:  Dr 3100           Cr account
```

## Customers & suppliers

`PartiesPage` manages parties (`CUSTOMER`, `SUPPLIER`, `BOTH`) with codes,
credit limits, contact details, customer category, active state and an optional
AR/AP account link.

- Codes are auto-generated (`CUST-00001` / `SUPP-00001`) unless supplied; both
  are checked for uniqueness.
- Credit limit cannot be negative.
- A linked account must exist and be of a type appropriate to a receivable or
  payable control account; the service rejects mismatches.
- **A party with open transactions cannot be deactivated** (invoices, payments,
  receipts or assets reference it).
- A party's `opening_balance` column exists for compatibility but the web app
  creates parties with `0` and does not post party opening balances. Use an
  account opening balance or a journal entry instead.

## Items and stock

`ItemsPage` manages items plus the opening-stock dialog.

- Units come from `ITEM_UNITS` (tablet, capsule, ml, gram, kg, unit, vial,
  ampoule); item types are raw material, packing material, finished good.
- Codes are auto-generated (`ITEM-00001`) or supplied; unique per company.
- Purchase/selling prices and min/max stock cannot be negative; maximum ≥
  minimum.
- A tax rate must exist, belong to the company, and be a `SALES_TAX` — a
  withholding tax is rejected.
- `current_stock` is aggregated from active batches and shown in the list.
- **Opening stock** creates a batch (number optional, defaults to
  `OPEN-<item code>-<timestamp>`), an `OPENING` stock movement, and — only when
  a supplier is supplied — an `OPENING` journal entry:

```
With supplier:      Dr inventory (1200 / 1210 / 1220 by type)   Cr Accounts Payable (2000, party)
Without supplier:   stock and batch only, no journal entry
```

Without a supplier the inventory value exists in stock but not in the GL, so
stock valuation and the trial balance diverge by that amount (see
[OPERATIONS.md](OPERATIONS.md#known-functional-limitations)).

Deactivating an item hides it from pickers but leaves history intact.

## Sales invoices

`SalesInvoicesPage` creates invoices with one or more lines, a payment type and
an optional explicit number; the list is searchable and paginated.

**Rules**

- Customer must exist, be active and be a customer (`CUSTOMER` or `BOTH`).
- At least one line; every item must exist, be active; quantity > 0; unit price
  ≥ 0; discounts and tax ≥ 0.
- `CASH` posts to `1000`; `BANK`/`CHEQUE` post to the selected bank account's
  COGS/GL account, falling back to `1010`; `CREDIT` posts to `1100` with the
  customer on the line and leaves `paid_amount = 0`.
- Invoice date must be a real `YYYY-MM-DD` date.
- Stock is consumed **FIFO** across the item's batches; a shortfall rejects the
  whole invoice with `INSUFFICIENT_STOCK` (nothing is partially written).
- Numbering: an explicit number is checked for duplicates; otherwise
  `SI-#####` is allocated inside the transaction.
- Line totals: `quantity × unitPrice − discount + tax`; invoice totals are the
  exact decimal sums, rounded once at storage.

**Posting**

```
Dr  payment account (1000 / bank / 1100)          total_amount
Cr  4000 Sales Revenue                            subtotal − discount
Cr  2100 Sales Tax Payable                        tax_amount (if any)
Dr  5000/5001/5002 COGS (by item type)            cost of batches sold
Cr  1220/1210/1200 inventory (by item type)       same cost
```

The COGS cost is the FIFO batch cost (`raw_unit_cost + packing_unit_cost`, with
the batch purchase price as fallback). An invoice whose lines all resolve to
zero COGS is rejected ("Sales invoice produced zero COGS") because that would
silently distort profit.

## Purchase invoices

`PurchaseInvoicesPage` mirrors sales for suppliers, with purchase costs and
batch details (batch number, manufacturing/expiry dates).

**Rules**

- Supplier must exist, be active and be a supplier.
- Quantities > 0, unit costs ≥ 0.
- Each line creates or tops up a batch: `(item, warehouse, batch number)` is
  unique, so a repeated batch number adds stock instead of duplicating. A missing
  batch number is generated. Manufacturing/expiry dates are stored on the batch.
  Topping up an existing batch does **not** re-weight its unit cost to the new
  purchase price, so inventory valuation can drift after a re-purchase at a
  different price.
- Payment type behaves like sales: cash (`1000`), bank/cheque, or credit
  (`2000`, `paid_amount = 0`).
- Duplicate explicit invoice numbers are rejected; otherwise `PI-#####`.

**Posting**

```
Dr  1200 / 1210 / 1220 inventory (by item type)   line totals INCLUDING tax
Cr  2100 Sales Tax Payable                        tax_amount (input tax)
Cr  payment account (1000 / bank / 2000)          total − tax
```

This is faithful to the desktop app: the inventory debit is the sum of tax-
inclusive line totals, and the input tax is credited back separately, so the
entry balances but inventory and the tax liability are both grossed up by the
tax. `2100` is used for input tax as well as output tax, a single tax control
account. See [OPERATIONS.md](OPERATIONS.md#known-functional-limitations).

## Payments and receipts

`PaymentsPage` has two tabs: supplier payments (`PV-`) and customer receipts
(`RV-`), each listable and creatable, with an optional invoice allocation.

- The party must be of the right kind (`SUPPLIER`/`BOTH` for payments,
  `CUSTOMER`/`BOTH` for receipts).
- Amount > 0; date must be valid; method is `CASH`, `BANK` or `CHEQUE`.
- With an invoice reference, the payment cannot exceed the invoice's
  outstanding amount (`total − paid`), the invoice must belong to that party, and
  the invoice's `paid_amount` is updated in the same transaction. Paying a
  cancelled invoice or an already fully-paid one is rejected.
- **Duplicate guard**: a second settlement with the same party, date, method,
  amount and reference is refused with `409 CONFLICT` (protects against a
  double-click or client retry). Reference-less payments differing in amount or
  date are still allowed.
- A `BANK`/`CHEQUE` payment cannot exceed the shared `1010` balance.
- Payment/receipt numbers are allocated from their sequences (`PV-`, `RV-`)
  only after all guards pass, so a rejected attempt burns no number.

```
Supplier payment:    Dr 2000 Accounts Payable (party)     Cr 1000 cash / 1010 bank
Customer receipt:    Dr 1000 cash / 1010 bank             Cr 1100 AR (party)
```

`CASH` moves `1000`; `BANK`/`CHEQUE` move `1010`. The API does not take a bank
account id for payments or receipts, so all non-cash settlement lands on the
shared bank control line.

## Returns

`ReturnsPage` has sales and purchase tabs. A return references an existing
invoice and lists per-line quantities.

**Sales return**

- The invoice must exist and not be cancelled; each `invoiceItemId` must belong
  to it; quantity is between 0 and the quantity sold on that line.
- Stock is restored to the original batch when the invoice line has one, with a
  `SALE_RETURN` movement. Lines written without a batch (rare, e.g. legacy
  data) are not put back into stock; their cost falls back to the item's
  `purchase_price` for the COGS reversal.
- The return value is `quantity × (line_total ÷ quantity sold)`.
- Numbers come from `SR-` (or an explicit unique number).

```
Dr 4100 Sales Returns          net total
Cr cash (1000) / 1100 AR       net total   (AR, with party, only for CREDIT sales)
Dr inventory (by type)         cost restored
Cr 5000/5001/5002 COGS         cost restored
```

**Purchase return**

- Same line checks against a purchase invoice; stock is removed from the
  invoice's batch with a `PURCHASE_RETURN` movement.
- Numbers come from `PR-`.

```
Dr 2000 Accounts Payable (party)    net total   (credit purchases)
Dr cash / bank                      net total   (cash/bank purchases = refund)
Cr inventory (by type)              cost returned
```

**Known limitations**: a sales return always settles to cash unless the
original invoice was a credit sale (the original bank account is not
remembered), and the quantity guard compares against the sold quantity only, so
two separate return requests could each return up to the full line. Check the
invoice before returning twice.

## Manufacturing

`ManufacturingPage` has three tabs, one per stage of the pipeline.

**Formulations** — the recipe library.

- A **formulation** BOM lists raw materials only. Its output item is created in
  inventory automatically as `(Unpacked) <BOM name>` (`FINISHED_GOOD`, unit of
  the first raw component); renaming the BOM leaves that item and its batches
  alone.
- A **packing** BOM lists the unpacked bulk item plus the packing materials and
  picks an existing finished good as its output. At most one finished-good
  component; raw materials cannot be mixed in.
- The phase is derived from the components, not chosen by hand. At least one
  component; each needs an item and quantity > 0; wastage 0–100 %.
- BOM name is unique per company; defaults to `BOM-#####`. A BOM still used by
  an order cannot be deleted.

**Production** — raw materials into unpacked bulk.

- Create from a saved formulation BOM, or run it manually: give the run a name
  and each raw material's per-item amount; the service saves those numbers as a
  per-unit BOM (`output_quantity = 1`) for reuse. Stock consumed is per item ×
  items produced.
- New orders are `DRAFT`; stock and the ledger only move when the order is
  produced. `DRAFT` → `startProduction` → `IN_PROGRESS` → `produceProduction` →
  `COMPLETED`; any other transition is rejected.
- Producing takes `actualQuantity` (> 0) and `wastageQuantity` (≥ 0), consumes
  raw stock FIFO scaled by `actualQuantity ÷ BOM outputQuantity`, and creates
  the unpacked output batch (the requested number, or the order number when
  blank). Insufficient stock aborts the whole run unless **Ignore stock** is
  ticked, which skips the check and the deduction.
- Wastage is capitalised into the output cost; account `5200` is seeded but not
  posted.

```
Dr 1220 Inventory — Finished Goods      total production cost
Cr 1200 Inventory — Raw Materials       raw component cost
```

**Packing** — unpacked bulk plus packaging into finished goods.

- Independent orders (`PCO-#####`) from a saved packing BOM, or manually: output
  item (must already exist), unpacked material, size per item and items
  generated (`Unpacked used = items generated × size per item`), plus packing
  materials.
- `DRAFT` → `startPackingOrder` → `IN_PROGRESS` → `packPackingOrder`. Packing can
  be partial: each call records what it used, and the order completes once
  `actualQuantity ≥ plannedQuantity`.
- Consumes the unpacked batch and the packing materials FIFO, then creates the
  finished-goods batch. **Ignore stock** skips the check and deduction.

```
Dr 1220 Inventory — Finished Goods      packed finished-goods cost
Cr 1220 Inventory — Finished Goods      unpacked bulk consumed
Cr 1210 Inventory — Packing Materials   packing material cost
```

Both stages post `MANUFACTURING` journal entries dated the day they run.

## Expenses and pay items

`ExpensesPage` combines four cards: record an expense, pay expense items, add an
expense item, and add a category (plus the expense history).

**Categories**

- Name unique per company; the linked account, when given, must be an `EXPENSE`
  account. Otherwise the expense falls back to `6000`.
- Categories are deactivatable; a payment cannot use an inactive category.

**Expenses**

- Amount > 0, valid date, method `CASH` / `BANK` / `CHEQUE`.
- Voucher number `EV-#####` unless supplied; duplicates rejected.
- `CASH` credits `1000`; `BANK`/`CHEQUE` the selected bank account.

```
Dr expense account (category account or 6000)   amount
Cr cash / bank                                  amount
```

**Pay items** — recurring bills under a category with an optional default
amount. `POST /api/expense-items/pay` takes a selection of items and amounts and
creates **one expense voucher per item**, all inside one outer transaction:

```
Per item:  Dr category expense account   Cr cash / bank
```

Zero-amount selections are ignored; a selection with no valid amount is an
error. Items can be renamed, re-amounted or deactivated, and are unique per
category.

## Banking

`BankingPage` has three tabs: accounts, transactions and cheques.

**Accounts**

- Bank name, account title and number are required; the number is unique per
  company; opening balance ≥ 0.
- Every bank account row points at the **same** chart-of-accounts control line,
  `1010 Bank Accounts`; there is no per-account COA child. Consequently the
  balance shown for any bank account, and the funds check on withdrawal, is the
  **combined** `1010` balance, not that account's own. The row's
  `opening_balance` is informational and is also posted to `1010`:

```
Dr 1010 Bank Accounts   opening balance      Cr 3100 Retained Earnings
```

**Movements**

- Deposit / withdrawal amount > 0, valid date.
- A withdrawal cannot take the shared `1010` balance below zero; with several
  bank accounts, one account's funds can therefore cover another's withdrawal.
- `DEPOSIT`: `Dr 1010 / Cr 1000 cash`. `WITHDRAWAL`: `Dr 1000 cash / Cr 1010`.

**Cheques** — issued (to a party) or received, status `UNCLEARED` by default.

- Number required, amount > 0, date valid.
- Clearing a non-uncleared cheque is rejected; clearing twice is rejected.
- `clear` posts depending on type and moves status to `CLEARED` with
  `cleared_date`. `bounce` and `lose` only change status; they do not post a
  reversing entry.

```
Issued cheque cleared:     Dr 2000 Accounts Payable (party)   Cr 1010 Bank Accounts
Received cheque cleared:   Dr 1010 Bank Accounts              Cr 1100 AR (party)
```

An uncleared cheque has no journal effect yet; only clearing moves the money.

## Fixed assets

`AssetsPage` lists fixed-asset accounts with their `asset_details` row and
current balance, and records purchases.

- Name required, amount > 0, valid date, one of the offered codes (`1501`–`1506`),
  payment type `CREDIT` / `CASH` / `BANK` / `CHEQUE`, classification
  `CURRENT` / `NON_CURRENT`.
- The asset account is created under the code if it does not exist (named
  `<asset name> (Asset)`); otherwise the existing account is reused and its
  detail row is **overwritten** (`asset_details` is unique per account, one asset
  per code — the same behaviour as the desktop app). Recording a second purchase
  against an existing code therefore replaces the detail record, though each
  purchase still posts its own journal entry.
- A credit purchase should name a supplier and can set a due date.

```
Dr asset account (1501…1506)     amount
Cr 2000 Accounts Payable         amount   (CREDIT, with supplier)
Cr 1000 Cash in Hand             amount   (CASH)
Cr 1010 Bank Accounts            amount   (BANK / CHEQUE — no specific bank account)
```

The seeded chart names `1501`–`1505` differently from the labels the asset
dialog offers (e.g. `1501` is seeded as “HBL Instalment” but offered as
“Furniture & Fixtures”). Reusing those codes keeps the desktop app's history but
can look inconsistent in reports; use `1506` or create a new account when the
name matters.

## Reports and exports

`TrialBalancePage` is the reporting screen. A period card sets `from`, `to` and
`asAt` (all optional); leaving them empty reports on every posted entry.

| Report | Calculation |
| --- | --- |
| Trial balance | One query over accounts × posted lines: opening (before `from`), period movement, closing, placed in each account's normal column. Includes deactivated accounts with movement. `balanced` compares total debit and credit |
| Profit & loss | Revenue accounts (credit − debit) minus expense accounts (debit − credit) for the range |
| Balance sheet | Cumulative closing balances at `asAt`: assets, liabilities, equity + net profit (revenue − expense). `equity` already includes net profit; `balanced` checks assets = liabilities + equity |
| Party ledger | Posted lines with `party_id`, date-ordered, with a running debit−credit balance |
| Cash book | Posted lines on account `1000`, date-ordered, with running balance |

Exports use the same services as the screen, so a workbook cannot disagree with
the report it was printed from:

- **CSV** — trial balance and “export all reports” (UTF-8, `text/csv`).
- **Excel** — one workbook per report plus a combined workbook; money cells are
  numeric and headers are formatted. Downloads go through `lib/download.ts` in
  the client, which revokes the blob URL after saving.

“Export all reports” offers monthly periods from August 2022 to the current
month, or whole years from 2022 to the current year — the web counterpart of the
desktop app's period export. The periods are calendar-based, not derived from
the ledger's first entry.

## Users, roles and authentication

`UsersPage` lists users (no password hashes), creates users, edits name, email,
role and active state, and resets passwords.

- Username required and unique; password ≥ 6 characters.
- Role must exist in `roles` (Admin, Accountant, Manager, Storekeeper,
  Production Manager).
- Editing a user can set a new password (same 6-character minimum).
- Resetting another user's password requires no current password; changing your
  own password (`Settings → Change your password`) does, and verifies it.
- **Roles are labels only.** No route checks them; the authorization gap is
  documented in [ARCHITECTURE.md](ARCHITECTURE.md#authentication-and-authorization).

## Settings

`SettingsPage` has six cards:

| Card | Backing | Notes |
| --- | --- | --- |
| Appearance | `APPEARANCE.theme_name` | `dark`, `light`, `system` (follows OS live), `custom` (falls back to the dark palette). Applied by setting `data-theme` on `<html>`; the login screen is always dark |
| Company profile | `GENERAL.company_name`, `currency`, `date_format` | Name required; stored exactly like the desktop app |
| Shortcuts | `SHORTCUTS.shortcut:<action>` | Full catalogue (26 actions) with edit/capture/reset/reset-all. Module jumps, next/previous module and search focus are live in the browser; browser-native actions (copy, undo, Ctrl+S/W) remain listed so both apps share one catalogue |
| Database | read-only | Engine, masked connection, configuration source, SQLite version, company/currency, and a warning that a connection change needs a restart |
| Backups | local engine only | Status (count, latest, size), “Back up now”, download; hosted engine shows “provider-managed” and no create button |
| Change your password | `auth/change-password` | Current password + new (≥ 6) + confirmation, verified server-side |

Shortcut sequences use the Qt style (`Ctrl+Shift+F`). Changes invalidate the
client cache and dispatch `bop-erp:shortcuts-changed`, so the shell rebinds
without a reload.
