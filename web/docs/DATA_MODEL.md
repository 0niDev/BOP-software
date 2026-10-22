# Data model

The database is SQLite — a local file in development, hosted SQLite Cloud in
production — and the DDL lives in `server/src/db/schema.ts`. It is ported
verbatim from the desktop app so both applications can share one database.

## Ground rules

- **Money columns are `REAL`.** SQLite has no fixed-point type. Rounding and
  arithmetic are the service layer's job (`Decimal`, 2 dp half-up). Never do
  `+`/`*` on these values in JavaScript.
- **Soft deletes.** Master data uses `is_active INTEGER NOT NULL DEFAULT 1`.
  Nothing in the web app deletes a party, item, account or user.
- **Company scoping.** Almost every business table carries `company_id`;
  services are constructed with `env.companyId` (default `1`) and every query
  filters on it.
- **Timestamps** are text: `datetime('now')` for `created_at`, business dates
  are `YYYY-MM-DD`.
- **Foreign keys** are declared in the DDL and enforced on the local adapter
  (`PRAGMA foreign_keys = ON`). The hosted driver enforces what the server
  enforces; code never relies on cascade deletes except for document lines
  (`ON DELETE CASCADE`), and documents are never deleted anyway.
- **Documents are immutable.** The API creates them and reads them; it does not
  update or delete invoices, returns, payments, expenses or journal entries.

## Entity map

```
companies ─┬─ warehouses ──┬─ stock_batches ── stock_movements
           │               ├─ sales_invoices ── sales_invoice_items ── sales_returns(_items)
           │               ├─ purchase_invoices ── purchase_invoice_items ── purchase_returns(_items)
           │               └─ production_orders ── production_consumption
           ├─ accounts ──┬─ journal_entry_lines ── journal_entries
           │             ├─ bank_accounts ──┬─ bank_transactions
           │             │                  └─ cheques
           │             ├─ parties
           │             └─ asset_details
           ├─ parties ──┬─ payments ── payment_allocations
           │            └─ receipts ── receipt_allocations
           ├─ items ──┬─ stock_batches
           │          └─ bom_components
           ├─ bill_of_materials ──┬─ bom_components
           │                      └─ production_orders
           ├─ expense_categories ──┬─ expenses
           │                       └─ expense_items
           ├─ roles ── users
           ├─ settings
           └─ numbering_sequences
```

## Tables by domain

### Organisation, users, settings

| Table | Key columns | Notes |
| --- | --- | --- |
| `companies` | `id`, `name`, address/contact/`ntn`, `logo_path`, `is_active` | Seeded row `1` is the only company used |
| `warehouses` | `company_id`, `code`, `name`, `is_default` | Seeded `MAIN` / “Main Warehouse”, id 1 |
| `roles` | `name UNIQUE`, `description` | Seeded: Admin, Accountant, Manager, Storekeeper, Production Manager |
| `users` | `username UNIQUE`, `password_hash`, `password_salt`, `full_name`, `email`, `role_id`, `is_active`, `last_login_at` | PBKDF2 hashes are compatible with the desktop app |
| `settings` | `company_id`, `setting_key`, `setting_value`, `setting_group`, UNIQUE(company, key) | Values are text; see [Settings keys](#settings-keys) |
| `numbering_sequences` | `company_id`, `document_type`, `prefix`, `next_number`, `padding` | One row per document type per company |
| `permissions`, `role_permissions` | role/permission ids | Present in the schema for the desktop app; **unused** by the web app |
| `audit_log` | `user_id`, `action`, `entity_table`, `entity_id`, `details` | Present in the schema; **not written** by the web app yet |

### Accounting

| Table | Key columns | Notes |
| --- | --- | --- |
| `accounts` | `company_id`, `account_code`, UNIQUE(company, code), `account_name`, `parent_account_id`, `account_type`, `account_subtype`, `opening_balance`, `is_system_account`, `is_active` | Tree via `parent_account_id`; system accounts cannot be deactivated |
| `journal_entries` | `company_id`, `voucher_number` UNIQUE(company, number), `voucher_type`, `entry_date`, `reference_no`, `narration`, `source_table`, `source_id`, `is_posted`, `created_by` | One row per document or adjustment |
| `journal_entry_lines` | `journal_entry_id` (cascade), `account_id`, `party_id`, `debit`, `credit`, `description`, `line_order` | CHECK: non-negative, never both debit and credit |

Indexes cover date, source document, posted flag and `(account_id,
journal_entry_id)` for balance queries.

### Parties and items

| Table | Key columns | Notes |
| --- | --- | --- |
| `parties` | `company_id`, `code` UNIQUE(company, code), `name`, `party_type`, `customer_category`, contact fields, `opening_balance`, `credit_limit`, `account_id`, `is_active` | `party_type`: `CUSTOMER` / `SUPPLIER` / `BOTH`; the linked account is the AR/AP control account for that party |
| `item_categories` | `company_id`, `name` | Optional grouping |
| `items` | `company_id`, `item_code` UNIQUE(company, code), `item_name`, `generic_name`, `formula`, `strength`, `dosage_form`, `unit`, `manufacturer`, `category_id`, `item_type`, `purchase_price`, `selling_price`, `minimum_stock`, `maximum_stock`, `tax_rate_id`, `notes`, `is_active` | `item_type`: `RAW_MATERIAL`, `PACKING_MATERIAL`, `FINISHED_GOOD` |
| `tax_rates` | `company_id`, `name`, `tax_type`, `rate_percent`, `is_active` | `tax_type`: `SALES_TAX` / `WITHHOLDING_TAX`; items may only reference sales tax |

### Stock

| Table | Key columns | Notes |
| --- | --- | --- |
| `stock_batches` | `item_id`, `warehouse_id`, `batch_number`, UNIQUE(item, warehouse, batch), `manufacturing_date`, `expiry_date`, `purchase_price`, `raw_unit_cost`, `packing_unit_cost`, `quantity_in_stock`, `received_date`, `is_active` | A batch is the unit of cost and expiry |
| `stock_movements` | `item_id`, `batch_id`, `warehouse_id`, `movement_type`, `quantity` (signed), `unit_cost`, `reference_table`, `reference_id`, `movement_date` | `movement_type`: `PURCHASE`, `SALE`, `SALE_RETURN`, `PURCHASE_RETURN`, `PRODUCTION_IN`, `PRODUCTION_CONSUME`, `ADJUSTMENT`, `EXPIRY`, `DAMAGE`, `OPENING` |
| `stock_losses` | `item_id`, `batch_id`, `loss_type`, quantity/cost/date | Present in the schema; **no route** yet |

Stock on hand is the sum of `stock_batches.quantity_in_stock`; the Items list
also returns `current_stock` aggregated across active batches.

### Sales and purchases

| Table | Key columns | Notes |
| --- | --- | --- |
| `sales_invoices` | `company_id`, `warehouse_id`, `invoice_number` UNIQUE(company), `customer_id`, `invoice_date`, `payment_type`, `bank_account_id`, `subtotal`, `discount_amount`, `tax_amount`, `total_amount`, `paid_amount`, `status`, `notes`, `created_by` | `payment_type`: `CASH` / `BANK` / `CHEQUE` / `CREDIT`; `status` is `CONFIRMED` on create |
| `sales_invoice_items` | `invoice_id` (cascade), `item_id`, `batch_id`, `quantity`, `unit_price`, `discount_amount`, `tax_amount`, `line_total` | One batch per line, chosen FIFO |
| `sales_returns` / `sales_return_items` | `return_number` UNIQUE(company), `invoice_id`, `return_date`, `total_amount`; line references `invoice_item_id` + `quantity` | Partial returns are supported per line |
| `purchase_invoices` | same shape as sales, with `supplier_id` and purchase costs | `paid_amount` is `0` for credit purchases |
| `purchase_invoice_items` | `invoice_id` (cascade), `item_id`, `batch_id`, `batch_number`, `manufacturing_date`, `expiry_date`, `quantity`, `unit_cost`, `discount_amount`, `tax_amount`, `line_total` | Creates or tops up a batch |
| `purchase_returns` / `purchase_return_items` | mirror sales returns against a purchase invoice | |

### Payments, receipts, banking

| Table | Key columns | Notes |
| --- | --- | --- |
| `payments` | `company_id`, `voucher_number` UNIQUE, `party_id`, `payment_date`, `payment_method`, `bank_account_id`, `cheque_id`, `amount`, `notes` | Money out to a supplier |
| `payment_allocations` | `payment_id` (cascade), `purchase_invoice_id`, `allocated_amount` | At most one invoice per payment in the current UI |
| `receipts` | mirror of `payments` for customers | Money in |
| `receipt_allocations` | `receipt_id` (cascade), `sales_invoice_id`, `allocated_amount` | |
| `bank_accounts` | `company_id`, `account_id` → COA `1010`, `bank_name`, `account_title`, `account_number`, `branch_code`, `iban`, `opening_balance`, `is_active` | Every bank account posts into the single “Bank Accounts” account |
| `bank_transactions` | `bank_account_id`, `transaction_type`, `amount`, `transaction_date`, `reference_no`, `journal_entry_id` | `DEPOSIT` / `WITHDRAWAL` / `TRANSFER_IN` / `TRANSFER_OUT`; only deposits and withdrawals are exposed |
| `cheques` | `company_id`, `bank_account_id`, `party_id`, `cheque_number`, `cheque_type`, `amount`, `cheque_date`, `status`, `cleared_date` | `cheque_type`: `ISSUED` / `RECEIVED`; `status`: `UNCLEARED` / `CLEARED` / `BOUNCED` / `LOST` |

### Manufacturing

| Table | Key columns | Notes |
| --- | --- | --- |
| `bill_of_materials` | `company_id`, `finished_item_id`, `bom_name`, `output_quantity`, `notes`, `is_active`, `is_temp`, `is_ghost` | `is_temp = 1` marks a one-use BOM created by a production order; such BOMs are filtered out of the list |
| `bom_components` | `bom_id` (cascade), `component_item_id`, `quantity_required`, `wastage_percent` | Percent 0–100 |
| `production_orders` | `company_id`, `warehouse_id`, `order_number` UNIQUE(company), `bom_id`, `planned_quantity`, `actual_quantity`, `wastage_quantity`, `output_batch_number`, `manufacturing_date`, `expiry_date`, `production_cost`, `raw_material_cost`, `packing_material_cost`, `status`, `completed_at`, `is_ghost` | `status`: `DRAFT` → `IN_PROGRESS` → `COMPLETED`, or `CANCELLED` |
| `production_consumption` | `production_order_id` (cascade), `component_item_id`, `batch_id`, `quantity_consumed`, `unit_cost` | One row per batch actually consumed |

### Expenses and assets

| Table | Key columns | Notes |
| --- | --- | --- |
| `expense_categories` | `company_id`, `name` UNIQUE(company), `account_id`, `is_active` | Account must be type `EXPENSE`; falls back to `6000` |
| `expenses` | `company_id`, `voucher_number` UNIQUE(company), `category_id`, `expense_date`, `amount`, `payment_method`, `status` (`PAID`/`UNPAID`), `due_date`, `settlement_journal_entry_id`, `bank_account_id`, `cheque_id`, `description` | One voucher per payment. `UNPAID` = pay-later bill on AP 2000 (payment_method is the planned method) |
| `expense_items` | `company_id`, `category_id`, `name` UNIQUE(company, category, name), `amount`, `frequency`, `next_run_date`, `is_active` | Recurring “pay items”. `frequency` set + positive `amount` = auto-generated unpaid bill per due period, advanced on `GET /api/expenses` |
| `asset_details` | `account_id` UNIQUE, `asset_type`, `purchase_amount`, `purchase_date`, `supplier_id`, `due_date`, `notes` | One detail row per fixed-asset account |

## Enumerations

| Enum | Values |
| --- | --- |
| Account type | `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE` (assets and expenses are debit-normal) |
| Voucher type | `JOURNAL`, `SALES`, `SALES_RETURN`, `PURCHASE`, `PURCHASE_RETURN`, `PAYMENT`, `RECEIPT`, `MANUFACTURING`, `STOCK_ADJUSTMENT`, `OPENING` |
| Party type | `CUSTOMER`, `SUPPLIER`, `BOTH` |
| Customer category | `FARMER`, `INDIVIDUAL`, `BUSINESS` (nullable) |
| Item type | `RAW_MATERIAL`, `PACKING_MATERIAL`, `FINISHED_GOOD` |
| Payment type (invoice) | `CASH`, `BANK`, `CHEQUE`, `CREDIT` |
| Settlement method | `CASH`, `BANK`, `CHEQUE` |
| Document status | `DRAFT`, `CONFIRMED`, `CANCELLED` |

## System accounts

Resolved by code through `SystemAccountResolver`; services never hardcode ids.
Seeded by `bootstrapDatabase()`:

| Code | Name | Used by |
| --- | --- | --- |
| `1000` | Cash in Hand | Cash sales, cash expenses, cash payments/receipts, bank deposits/withdrawals, cash asset purchases |
| `1010` | Bank Accounts | Bank/cheque invoices, bank expenses, bank payments/receipts, every `bank_accounts` row |
| `1100` | Accounts Receivable | Credit sales, receipts, sales-return reversal |
| `1200` | Inventory — Raw Materials | Purchases/returns/opening stock/production of raw materials |
| `1210` | Inventory — Packing Materials | Same for packing materials |
| `1220` | Inventory — Finished Goods | Finished-goods purchases and production output |
| `2000` | Accounts Payable | Credit purchases, supplier payments, purchase returns, credit asset purchases |
| `2100` | Sales Tax Payable | Output tax on sales |
| `3100` | Retained Earnings | Opening balances and bank-account opening balances |
| `4000` | Sales Revenue | Sales invoices |
| `4100` | Sales Returns & Allowances | Sales returns |
| `5000` | Cost of Goods Sold | Sales COGS, restored on sales returns |
| `5200` | Manufacturing Wastage Expense | Reserved (seeded, not currently posted) |

The seed also creates `1300`, `1500`–`1505`, `2200`, `3000`, `5001`, `5002`,
`5100`, `5300`, `6000`, `6100` for the desktop app's chart. Asset codes
`1501`–`1506` are offered by the Fixed Assets page.

## Numbering sequences

Seeded document types and prefixes (padding 5):

| Document type | Prefix | Used for |
| --- | --- | --- |
| `SALES_INVOICE` | `SI-` | Sales invoices (and their journal entries) |
| `SALES_RETURN` | `SR-` | Sales returns |
| `PURCHASE_INVOICE` | `PI-` | Purchase invoices |
| `PURCHASE_RETURN` | `PR-` | Purchase returns |
| `PAYMENT` | `PV-` | Supplier payments |
| `RECEIPT` | `RV-` | Customer receipts |
| `JOURNAL_VOUCHER` | `JV-` | Manual/general journal entries |
| `OPENING` | `OB-` | Opening balance entries |
| `PRODUCTION_ORDER` | `PO-` | Production orders |
| `EXPENSE_VOUCHER` | `EV-` | Expenses |
| `CUSTOMER` | `CUST-` | Party codes (customers) |
| `SUPPLIER` | `SUPP-` | Party codes (suppliers) |
| `ITEM` | `ITEM-` | Item codes |
| `BOM` | `BOM-` | Bills of materials |

An explicit number supplied by the user (invoice number, order number) skips
the sequence but is still checked for duplicates and rolled back with the
document on failure.

## Settings keys

Values are text; the web app currently reads and writes:

| Group | Key | Value | Written by |
| --- | --- | --- | --- |
| `APPEARANCE` | `theme_name` | `dark`, `light`, `system`, `custom` | Settings → Appearance |
| `GENERAL` | `company_name` | text | Settings → Company profile |
| `GENERAL` | `currency` | `PKR`, `USD`, `EUR`, `GBP`, `SAR`, `AED` | Settings → Company profile |
| `GENERAL` | `date_format` | `yyyy-MM-dd`, `dd/MM/yyyy`, `MM/dd/yyyy`, `dd.MM.yyyy` | Settings → Company profile |
| `SHORTCUTS` | `shortcut:<action_id>` | JSON `{"action_id": …, "current_sequence": …}` | Settings → Shortcuts |

The `SHORTCUTS` encoding is the desktop app's, so a key rebound in either app
applies to both. `theme_name` in the database is the *saved* preference; the
`data-theme` attribute on `<html>` is derived from it at runtime.

## Invariants worth knowing

1. **Every posted amount is in a balanced entry.** Debit total equals credit
   total within 0.01; `journal_entry_lines` additionally forbids negative lines
   and a line with both sides filled.
2. **A document owns exactly one journal entry**, addressable by
   `source_table` + `source_id` (`GET /api/journal-entries/:sourceTable/:sourceId`).
3. **Stock cannot go negative through a sale or production.** FIFO consumption
   checks each batch before writing and returns `409 INSUFFICIENT_STOCK`.
4. **A party with posted transactions cannot be deactivated** (sales, purchases,
   payments, receipts, assets). Accounts likewise, when they carry movement —
   and system accounts can never be deactivated.
5. **Opening balances are posted immediately.** A non-zero opening balance on an
   account creates/updates an `OPENING` entry against `3100`, so the accounting
   equation always holds. The bulk opening-balance screen requires the entered
   debits to equal credits.
6. **Deactivated accounts with movement stay in reports** — the trial balance
   `HAVING` clause includes them, which is a deliberate fix over the desktop
   app's `is_active = 1` filter.
7. **Unique per company**: account code, party code, item code, invoice/return/
   payment/receipt/expense voucher numbers, production order number.
8. **Batch identity** is `(item_id, warehouse_id, batch_number)`; a repeated
   batch number on a purchase adds to the existing batch instead of creating a
   duplicate.
