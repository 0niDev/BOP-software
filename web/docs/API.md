# HTTP API reference

The server exposes a JSON API under `/api`. It is the only way the client reads
or writes data — there are no server-rendered pages and no client-side SQL.

## Conventions

- **Base URL**: `http://<host>:<port>/api` (default port `4000`).
- **Content type**: request and response bodies are `application/json` except
  the CSV/Excel downloads and the built client.
- **Body limit**: 1 MB (`express.json`).
- **Auth**: every endpoint except `/api/health` and `/api/auth/login` requires
  `Authorization: Bearer <token>` from the login response.
- **Dates**: request dates are `YYYY-MM-DD`; invalid formats and impossible
  dates (`2026-02-30`) are rejected with `400 VALIDATION_ERROR`.
- **Unsigned numbers** (`debit`, `credit`, `quantity`, `amount`) are sent as
  JSON numbers. The server rounds money to 2 dp and quantities to 6 dp.
- **Ids** are positive integers. Unknown ids yield `404 NOT_FOUND`.
- **Timestamps** (`created_at`) are database text (`"2026-10-18 09:15:00"`).
- **CORS**: open (`Access-Control-Allow-Origin: *`) because the app may be
  reached from a LAN; put it behind a proxy if that is unacceptable.

### Error responses

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload.",
    "details": [{ "path": ["invoiceDate"], "message": "…" }]
  }
}
```

| Status | Codes | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR`, `NUMBERING_ERROR`* | Bad payload or a business rule rejected the request |
| 401 | `UNAUTHORIZED` | Missing, unknown or expired token; or bad credentials on login/change-password |
| 404 | `NOT_FOUND` | Unknown id, or unknown `/api` path |
| 409 | `CONFLICT`, `INSUFFICIENT_STOCK` | Duplicate document/code; not enough batch stock |
| 500 | `CONFIGURATION_ERROR`, `DATABASE_ERROR`, `UNBALANCED_JOURNAL_ENTRY`, `INTERNAL_ERROR` | Environment/database fault; not client-correctable |

\* `NUMBERING_ERROR` is returned with status 500 in practice (allocation
failure), not 400.

### Common query parameters

| Parameter | Endpoints | Effect |
| --- | --- | --- |
| `activeOnly` | accounts, parties, items, expense-items | `false` includes deactivated rows; anything else means active only |
| `search` | parties, items, sales-invoices, purchase-invoices | Case-insensitive substring match |
| `type` | parties (`CUSTOMER`/`SUPPLIER`), items (`RAW_MATERIAL`/`PACKING_MATERIAL`/`FINISHED_GOOD`) | Filter by kind; unknown values are ignored |
| `limit`, `offset` | sales/purchase invoice lists | `limit` 1–500, default 100; `offset` default 0 |
| `from`, `to` | reports | `YYYY-MM-DD`, inclusive; empty means unbounded |
| `asAt` | balance sheet | `YYYY-MM-DD`; empty means “all posted entries” |
| `partyId` | party ledger (+ export) | Required, positive integer |
| `status` | cheques | `UNCLEARED`, `CLEARED`, `BOUNCED`, `LOST` |
| `categoryId` | expense-items | Filter by category |

## Authentication

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | `{ username, password }` | `200` `{ token, user: { id, username, fullName, roleName } }` |
| `POST` | `/api/auth/change-password` | `{ currentPassword, newPassword }` | `{ ok: true }` |

Tokens are opaque UUIDs, valid for 12 hours and held in server memory. A restart
invalidates every session.

## Health

| Method | Path | Auth | Response |
| --- | --- | --- | --- |
| `GET` | `/api/health` | none | `{ "status": "ok" }` |

## Dashboard

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/api/dashboard` | Aggregated KPIs (below) |

```json
{
  "today": { "salesTotal": 0, "salesCount": 0, "purchasesTotal": 0, "purchasesCount": 0 },
  "balances": { "cash": 0, "bank": 0, "inventory": 0, "total": 0 },
  "receivablesPayables": { "receivable": 0, "payable": 0 },
  "profitLoss": { "revenue": 0, "expenses": 0, "profit": 0, "isProfit": true },
  "recentTransactions": [{ "reference": "SI-00001", "date": "2026-10-18", "type": "Sales", "amount": 0, "partyName": null }],
  "inventory": {
    "totalItems": 0,
    "lowStockCount": 0,
    "lowStockItems": [{ "itemCode": "", "itemName": "", "currentStock": 0, "minimumStock": 0 }],
    "expiringCount": 0,
    "expiringItems": [{ "itemCode": "", "itemName": "", "batchNumber": "", "expiryDate": null, "quantityInStock": 0 }]
  },
  "alerts": { "count": 0, "alerts": [{ "type": "warning", "title": "", "message": "" }] },
  "monthlyTrend": [{ "month": "2026-05-01", "revenue": 0, "expenses": 0, "profit": 0 }],
  "topItems": [{ "itemCode": "", "itemName": "", "quantity": 0, "revenue": 0, "customers": 0 }],
  "salesByCustomer": [{ "partyName": "", "revenue": 0, "invoices": 0 }]
}
```

Computed live on every request (no cache). `monthlyTrend` covers the last six
months, oldest first.

## Chart of accounts

| Method | Path | Body / query | Response |
| --- | --- | --- | --- |
| `GET` | `/api/accounts` | `?activeOnly=false` | `Account[]` |
| `POST` | `/api/accounts` | `{ accountCode, accountName, accountType, parentAccountId?, openingBalance?, accountSubtype? }` | `201` account |
| `PUT` | `/api/accounts/:id` | `{ accountName, openingBalance, parentAccountId?, isActive? }` | account |
| `POST` | `/api/accounts/:id/deactivate` | — | `{ ok: true }` |
| `POST` | `/api/accounts/opening-balances` | `{ entries: [{ accountId, debit?, credit? }] }` | `201` `{ journalEntryId, totalDebit, totalCredit, accountsUpdated }` |

`accountType` is one of `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`.
Opening balances must balance (total debit = total credit) and post one `OPENING`
entry against Retained Earnings (`3100`). System accounts (`is_system_account =
1`) cannot be deactivated; accounts with posted movement cannot be deactivated.

## Backup (both engines)

| Method | Path | Response |
| --- | --- | --- |
| `GET` | `/api/backup/status` | `{ engine, directory, supported, exists, count, latest, totalBytes, backups: [{ file, bytes, modifiedAt }] }` |
| `POST` | `/api/backup` | `201` `{ file, path, bytes, createdAt }` |
| `GET` | `/api/backups/:file/download` | `.db` file download |
| `POST` | `/api/backups/:file/restore` | Always an error explaining why restore is refused |
| `GET` | `/api/backup/mirror` | Live local copy status `{ enabled, path, exists, bytes, updatedAt, lagSeconds, pending, lastError, pcDirectory, pcUpdatedAt, pcError }` |
| `POST` | `/api/backup/mirror` | Rewrites the live local copy now, returns the same status |
| `GET` | `/api/backup/mirror/download` | Live local copy as a `.db` download |

Both engines produce a portable SQLite file: `VACUUM INTO` locally, and a
schema+row rebuild for `sqlitecloud` (the gateway cannot write to this machine).
Restore is refused while this process holds the database open. `:file` must be a
bare `erp_backup_*.db` name; anything else is `400` or `404`.

## Fixed assets

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `GET` | `/api/assets` | — | `Asset[]` (account + detail + current balance) |
| `GET` | `/api/asset-codes` | — | `[{ code, label }]` — `1501`…`1506` |
| `POST` | `/api/assets` | `{ assetName, assetCode, amount, purchaseDate, paymentType?, classification?, supplierId?, dueDate?, notes? }` | `201` asset |

`paymentType`: `CREDIT` (default), `CASH`, `BANK`, `CHEQUE`. `classification`:
`CURRENT` / `NON_CURRENT` (default `NON_CURRENT`). `assetCode` must be one of the
offered codes.

## Parties

| Method | Path | Body / query | Response |
| --- | --- | --- | --- |
| `GET` | `/api/parties` | `?type=&search=&activeOnly=` | `Party[]` |
| `POST` | `/api/parties` | `{ name, partyType, code?, creditLimit?, accountId?, phone?, address?, email?, customerCategory? }` | `201` party |
| `PUT` | `/api/parties/:id` | `{ name, creditLimit, accountId?, isActive?, partyType?, phone?, address?, email?, customerCategory? }` | party |
| `POST` | `/api/parties/:id/deactivate` | — | `{ ok: true }` |

Auto code (`CUST-00001` / `SUPP-00001`) when `code` is omitted. The linked
`accountId` must exist and be a receivable/payable control account appropriate
for the party type. Deactivation is refused while transactions are open.

## Items

| Method | Path | Body / query | Response |
| --- | --- | --- | --- |
| `GET` | `/api/items` | `?type=&search=&activeOnly=` | `Item[]` with `current_stock` |
| `GET` | `/api/tax-rates` | — | `TaxRate[]` |
| `POST` | `/api/items` | `{ itemName, unit?, itemCode?, notes?, purchasePrice?, sellingPrice?, minimumStock?, maximumStock?, taxRateId?, itemType?, categoryId? }` | `201` item |
| `PUT` | `/api/items/:id` | same fields, all required except `notes`/`taxRateId`/`categoryId`/`isActive` | item |
| `POST` | `/api/items/:id/deactivate` | — | `{ ok: true }` |
| `POST` | `/api/items/:id/opening-stock` | `{ quantity, unitCost?, batchNumber?, expiryDate?, partyId?, warehouseId? }` | `201` batch |

Rules: maximum stock ≥ minimum stock; the tax rate must exist and be
`SALES_TAX`; opening stock creates a batch, an `OPENING` stock movement, and —
when a supplier is supplied — an `OPENING` entry crediting Accounts Payable.

## Sales invoices

| Method | Path | Body / query | Response |
| --- | --- | --- | --- |
| `GET` | `/api/sales-invoices` | `?search=&limit=&offset=` | `SalesInvoice[]` with customer name/code |
| `GET` | `/api/sales-invoices/:id` | — | `{ invoice, items }` |
| `POST` | `/api/sales-invoices` | see below | `201` `{ id, invoiceNumber, customerId, subtotal, discountAmount, taxAmount, totalAmount, journalEntryId }` |

```json
{
  "customerId": 1,
  "invoiceDate": "2026-10-18",
  "paymentType": "CREDIT",
  "invoiceNumber": null,
  "notes": null,
  "bankAccountId": null,
  "warehouseId": 1,
  "items": [
    { "itemId": 1, "quantity": 2, "unitPrice": 100, "discountAmount": 0, "taxAmount": 0 }
  ]
}
```

- `paymentType` `CREDIT` → `paid_amount = 0`, debits Accounts Receivable for the
  customer; `CASH` debits `1000`; `BANK`/`CHEQUE` debit the supplied
  `bankAccountId`'s COA account, falling back to the shared `1010` control
  account when no bank account is supplied.
- Stock is consumed FIFO per line; insufficient stock returns `409`.
- Generates `SI-#####` when no number is supplied; duplicates return `409`.
- Posts revenue (`4000`), output tax (`2100`) when non-zero, and COGS (`5000`)
  against the inventory accounts by item type.

## Purchase invoices

| Method | Path | Body / query | Response |
| --- | --- | --- | --- |
| `GET` | `/api/purchase-invoices` | `?search=&limit=&offset=` | `PurchaseInvoice[]` |
| `GET` | `/api/purchase-invoices/:id` | — | `{ invoice, items }` |
| `POST` | `/api/purchase-invoices` | see below | `201` `{ id, invoiceNumber, supplierId, subtotal, discountAmount, taxAmount, totalAmount, journalEntryId }` |

```json
{
  "supplierId": 1,
  "invoiceDate": "2026-10-18",
  "paymentType": "CREDIT",
  "invoiceNumber": null,
  "bankAccountId": null,
  "warehouseId": 1,
  "items": [
    {
      "itemId": 1, "quantity": 10, "unitCost": 50, "discountAmount": 0, "taxAmount": 0,
      "batchNumber": "B-001", "manufacturingDate": null, "expiryDate": "2027-10-18"
    }
  ]
}
```

Creates or tops up a batch per line (unique per item + warehouse + batch
number), then debits inventory by item type and the input tax account, and
credits cash/bank or Accounts Payable.

## Payments and receipts

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `GET` | `/api/payments` | — | `Payment[]` |
| `GET` | `/api/receipts` | — | `Receipt[]` |
| `POST` | `/api/payments` | `{ supplierId, amount, paymentDate, paymentMethod, referenceNo?, notes?, purchaseInvoiceId? }` | `201` `{ id, voucherNumber, journalEntryId }` |
| `POST` | `/api/receipts` | `{ customerId, amount, paymentDate, paymentMethod, referenceNo?, notes?, salesInvoiceId? }` | `201` `{ id, voucherNumber, journalEntryId }` |

`paymentMethod`: `CASH`, `BANK`, `CHEQUE`. With `purchaseInvoiceId` /
`salesInvoiceId`, the amount cannot exceed the invoice's outstanding balance
(`409`/`400` otherwise); the invoice's `paid_amount` is updated in the same
transaction. Posts `Dr AP / Cr cash-bank` and `Dr cash-bank / Cr AR`.

## Manufacturing

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `GET` | `/api/boms` | — | `Bom[]` (`?activeOnly=1` for active only) |
| `GET` | `/api/boms/:id` | — | BOM with components |
| `POST` | `/api/boms` | `{ finishedItemId?, outputQuantity, bomName?, notes?, components: [{ componentItemId, quantityRequired, wastagePercent? }] }` | `201` BOM |
| `PUT` | `/api/boms/:id` | same as `POST` plus `isActive?` | updated BOM |
| `DELETE` | `/api/boms/:id` | — | `{ ok: true }` |
| `GET` | `/api/production-orders` | — | `ProductionOrder[]` |
| `GET` | `/api/production-orders/:id` | — | order with BOM/components |
| `POST` | `/api/production-orders` | `{ bomId?, plannedQuantity, manufacturingDate, orderNumber?, expiryDate?, notes?, warehouseId?, bomName?, components? }` | `201` order |
| `POST` | `/api/production-orders/:id/start` | — | `{ status: "IN_PROGRESS" }` |
| `POST` | `/api/production-orders/:id/produce` | `{ actualQuantity, wastageQuantity?, outputBatchNumber?, ignoreStock? }` | `{ productionCost, journalEntryId, outputBatchNumber }` |
| `GET` | `/api/packing-orders` | — | `PackingOrder[]` |
| `GET` | `/api/packing-orders/:id` | — | order with consumptions |
| `POST` | `/api/packing-orders` | `{ bomId?, plannedQuantity, manufacturingDate, orderNumber?, expiryDate?, notes?, warehouseId?, packingBomName?, outputItemId?, unpackedItemId?, unpackedQuantity?, materials? }` | `201` order |
| `POST` | `/api/packing-orders/:id/start` | — | `{ status: "IN_PROGRESS" }` |
| `POST` | `/api/packing-orders/:id/pack` | `{ units?, unpackedQuantity?, outputBatchNumber?, ignoreStock?, materials?: [{ itemId, quantity }] }` | pack result |

Rules: a BOM's phase comes from its components — raw materials only =
`FORMULATION` (its `(Unpacked) <name>` output item is created when
`finishedItemId` is omitted), otherwise `PACKING` with exactly one finished-good
component and an existing finished good as output. BOM names are unique; wastage
0–100 %; start only from `DRAFT`; production `produce` only from `IN_PROGRESS`
and packing `pack` only from `IN_PROGRESS`. Omitting `bomId` and passing
`bomName` + `components` (production) or `packingBomName` + the packing fields
saves a per-unit BOM (`output_quantity = 1`) from the run's totals.

Producing consumes raw stock FIFO, creates the unpacked batch and posts
`Dr Finished Goods / Cr Raw Materials`; packing consumes the unpacked batch plus
packing materials, creates the finished-goods batch and posts
`Dr Finished Goods / Cr Finished Goods (unpacked) / Cr Packing Materials`.
Insufficient stock → `409`; `ignoreStock: true` skips the check and deduction.

## Expenses

| Method | Path | Body / query | Response |
| --- | --- | --- | --- |
| `GET` | `/api/expense-categories` | — | `ExpenseCategory[]` |
| `POST` | `/api/expense-categories` | `{ name, accountId? }` | `201` category |
| `GET` | `/api/expenses` | — | `Expense[]` (generates any due recurring bills first) |
| `POST` | `/api/expenses` | `{ categoryId, expenseDate, amount, paymentMethod, payLater?, dueDate?, voucherNumber?, bankAccountId?, description? }` | `201` `{ id, voucherNumber, journalEntryId }` |
| `POST` | `/api/expenses/:id/pay` | `{ paymentMethod, paymentDate?, bankAccountId? }` | `{ id, voucherNumber, journalEntryId }` |
| `GET` | `/api/expense-items` | `?categoryId=&activeOnly=` | `ExpenseItem[]` |
| `POST` | `/api/expense-items` | `{ categoryId, name, amount?, frequency?, nextRunDate? }` | `201` item |
| `PUT` | `/api/expense-items/:id` | `{ name?, amount?, frequency?, nextRunDate? }` | item |
| `POST` | `/api/expense-items/:id/deactivate` | — | `{ ok: true }` |
| `POST` | `/api/expense-items/pay` | `{ categoryId, paymentMethod, expenseDate, selections: [{ itemId, amount, description? }] }` | `201` `{ voucherNumbers, totalPaid }` |

A category `accountId`, when given, must be an `EXPENSE` account; otherwise the
expense posts to `6000`. Paying selected items creates one `EV-` voucher per
item, all inside one outer transaction.

`payLater: true` records an unpaid bill (`status: "UNPAID"`, optional `dueDate`)
instead of paying immediately: **Dr expense / Cr Accounts Payable (2000)**.
`POST /api/expenses/:id/pay` settles it once (**Dr AP / Cr cash|bank**); a second
attempt is a `409`. `paymentMethod` on an unpaid bill is the planned method.
The web Expenses page no longer exposes pay-later or recurring auto-bills (both
understood for desktop parity only); corrections and adjustments go through
manual journal vouchers instead.

`frequency` (`WEEKLY|MONTHLY|QUARTERLY|YEARLY`) plus `nextRunDate` and a
positive `amount` turns an expense item into a recurring rule. Because there is
no scheduler, `GET /api/expenses` catches up every bill that is due
(`next_run_date <= today`) — one unpaid bill per missed period, dated on the due
date — and then advances `next_run_date`. The written documents and the date
advance share one transaction, so repeated calls never double-generate. Month-end
dates clamp (Jan 31 → Feb 28) but return to the anchor day afterwards (→ Mar 31).

## Banking

| Method | Path | Body / query | Response |
| --- | --- | --- | --- |
| `GET` | `/api/bank-accounts` | — | `BankAccount[]` |
| `POST` | `/api/bank-accounts` | `{ bankName, accountTitle, accountNumber, openingBalance?, branchCode?, iban? }` | `201` account |
| `GET` | `/api/bank-accounts/:id/balance` | — | `{ balance }` |
| `GET` | `/api/bank-transactions` | — | `BankTransaction[]` |
| `POST` | `/api/bank-transactions/deposit` | `{ bankAccountId, amount, date, referenceNo?, notes? }` | `201` transaction |
| `POST` | `/api/bank-transactions/withdraw` | same | `201` transaction |
| `GET` | `/api/cheques` | `?status=` | `Cheque[]` |
| `POST` | `/api/cheques/issue` | `{ bankAccountId, chequeNumber, amount, chequeDate, partyId?, notes? }` | `201` cheque |
| `POST` | `/api/cheques/receive` | same | `201` cheque |
| `POST` | `/api/cheques/:id/clear` | — | cheque (`CLEARED`) |
| `POST` | `/api/cheques/:id/bounce` | — | `{ status: "BOUNCED" }` |
| `POST` | `/api/cheques/:id/lose` | — | `{ status: "LOST" }` |

Every bank account points at the **same** COA control account (`1010`), so all
bank movement rolls up into one report line and `GET
/api/bank-accounts/:id/balance` returns that shared `1010` balance rather than a
per-account balance. Deposits move cash into the bank and withdrawals move it
back. Clearing an issued cheque posts `Dr AP / Cr 1010`; a received cheque posts
`Dr 1010 / Cr AR`. A withdrawal cannot take the `1010` balance below zero;
clearing a cheque twice is rejected.

## Returns

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `GET` | `/api/sales-returns` | — | return list |
| `POST` | `/api/sales-returns` | `{ invoiceId, returnDate, returnNumber?, notes?, items: [{ invoiceItemId, quantity }] }` | `201` return |
| `GET` | `/api/purchase-returns` | — | return list |
| `POST` | `/api/purchase-returns` | same shape against a purchase invoice | `201` return |

Cannot return a cancelled invoice, an unknown invoice line, or more than was
sold/purchased on that line. Sales returns reverse revenue into `4100`, restore
stock and COGS; purchase returns remove stock and reduce Accounts Payable.
Returns are not checked against previous returns of the same line by the UI —
the quantity guard is per request.

## Journal entries

| Method | Path | Body / query | Response |
| --- | --- | --- | --- |
| `GET` | `/api/journal-entries` | `?from=&to=` | Manual `JV-` vouchers, newest first |
| `POST` | `/api/journal-entries` | `{ entryDate, narration?, referenceNo?, voucherNumber?, lines: [{ accountId, partyId?, description?, debit?, credit? }] }` | `201` `{ id, voucherNumber }` |
| `POST` | `/api/journal-entries/:id/reverse` | `{ reversalDate?, narration? }` | `201` `{ id, voucherNumber }` |
| `GET` | `/api/journal-entries/:id/export.xlsx` | — | Excel workbook of that voucher (lines + totals) |
| `GET` | `/api/journal-entries/:sourceTable/:sourceId` | — | The entry header plus its lines, or `null` |

Manual vouchers are free-form balanced entries: at least two lines, each with a
debit or a credit (never both, never neither), and equal debit/credit totals.
There is no business document behind one — the entry is its own source, so
`sourceTable = "journal_entries"` and `sourceId` is the entry id. Numbers come
from the `JOURNAL_VOUCHER` sequence (`JV-`). Group/header accounts (accounts with
sub-accounts) are rejected as posting targets.

Posted vouchers are immutable. `POST /api/journal-entries/:id/reverse` posts the
opposite entry on the given date (defaults to today) and links it back through
`reference_no`; the original stays in the ledger. Only manual vouchers can be
reversed here — entries owned by a document are corrected through their own
module.

`sourceTable` on the lookup route matches `journal_entries.source_table`
(`sales_invoices`, `purchase_invoices`, `payments`, `receipts`, `expenses`,
`production_orders`, `sales_returns`, `purchase_returns`, …).

## Reports

All report endpoints accept the range parameters described above. They read
posted journal lines only.

| Method | Path | Returns |
| --- | --- | --- |
| `GET` | `/api/reports/trial-balance` | `{ rows, totalDebit, totalCredit, balanced }` |
| `GET` | `/api/reports/profit-and-loss` | `{ revenue, expenses, netProfit }` |
| `GET` | `/api/reports/balance-sheet` | `{ assets, liabilities, equity, netProfit, balanced }` |
| `GET` | `/api/reports/party-ledger?partyId=` | `LedgerEntry[]`: `{ date, voucherNumber, voucherType, description, debit, credit, balance }` |
| `GET` | `/api/reports/cash-book` | `LedgerEntry[]` for account `1000` |

Ledger entries are in date order and `balance` is a running debit-minus-credit
balance that starts at zero at the first row **of the requested range**, not at
the account's opening balance. Ask for the full range when you need the true
closing figure.

Download variants (same query parameters):

| Path | Content |
| --- | --- |
| `/api/reports/trial-balance.csv`, `/api/reports/export-all.csv` | UTF-8 CSV, `text/csv` |
| `/api/reports/trial-balance.xlsx` | Excel workbook, one sheet |
| `/api/reports/profit-and-loss.xlsx`, `/api/reports/balance-sheet.xlsx`, `/api/reports/cash-book.xlsx` | Excel workbook, one sheet |
| `/api/reports/party-ledger.xlsx?partyId=` | Excel workbook for one party |
| `/api/reports/export-all.xlsx` | One workbook with trial balance, P&L, balance sheet and cash book sheets |

The `.xlsx` endpoints set `Content-Disposition: attachment` with a descriptive
name (`trial-balance_2026-10-01_to_2026-10-31.xlsx`). CSV responses are plain
text bodies; the client names the downloaded file itself.

## Users, roles, settings

| Method | Path | Body / query | Response |
| --- | --- | --- | --- |
| `GET` | `/api/users` | — | `UserRow[]` (no hashes) |
| `POST` | `/api/users` | `{ username, fullName, password, roleName, email?, isActive? }` | `201` user |
| `PUT` | `/api/users/:id` | `{ fullName, email?, roleName, isActive, password? }` | user |
| `POST` | `/api/users/:id/reset-password` | `{ newPassword }` | `{ ok: true }` |
| `GET` | `/api/roles` | — | `Role[]` |
| `GET` | `/api/settings` | `?group=` | All groups, or one group's key/value map |
| `PUT` | `/api/settings` | `{ group, settings: { key: value } }` | saved group |
| `DELETE` | `/api/settings/:group` | — | `{ group, removed }` |
| `GET` | `/api/settings/shortcuts` | — | `[{ actionId, description, category, context, defaultSequence, currentSequence }]` |
| `PUT` | `/api/settings/shortcuts/:actionId` | `{ sequence }` | updated shortcut |
| `DELETE` | `/api/settings/shortcuts/:actionId` | — | shortcut reset to default |
| `DELETE` | `/api/settings/shortcuts` | — | `{ removed }` |
| `GET` | `/api/settings/database` | — | `{ engine, location, source, sqliteVersion, companyId, currency, restartRequired }` |

Group names are upper-cased (`APPEARANCE`, `GENERAL`, `SHORTCUTS`). The only
validated setting today is `APPEARANCE.theme_name` ∈
`dark | light | system | custom`. Shortcut sequences use the Qt-style form
`Ctrl+Shift+F`. `database.location` masks credentials and is read-only;
changing the connection requires editing `.env` and restarting.

## Serving the built client

When the process runs with `ERP_SERVE_CLIENT=1` and `client/dist` exists:

| Path | Response |
| --- | --- |
| `/assets/*` | Hashed static files, `Cache-Control: public, max-age=31536000, immutable` |
| `/` and any non-`/api` GET | `index.html`, `Cache-Control: no-cache` |
| `/api/*` that does not match a route | JSON `404 NOT_FOUND` |
