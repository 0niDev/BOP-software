# PharmaPro Export — Complete Data Documentation

Full documentation of every table and every record in the `PharmaPro_Export/` folder of the old **PharmaPro** system for **BOP NUTRACEUTICALS**.

## Contents

| File | What it covers |
|---|---|
| [master_data.md](master_data.md) | Companies, sectors, towns, users, Chart of Accounts, Parties, project registry/tasks |
| [products.md](products.md) | All 1,342 products (finished goods, raw, packing, semi-finished) |
| [sales_invoices.md](sales_invoices.md) | Every sales invoice (289) and every line item (721) |
| [purchase_invoices.md](purchase_invoices.md) | Every purchase invoice (307) and every line item (741) |
| [sale_returns.md](sale_returns.md) | Sale returns (4) |
| [collections.md](collections.md) | Cash collections / payments received (301) |
| [vouchers.md](vouchers.md) | Every expense & payment (debit/credit/journal vouchers, 605 lines) |
| [all_vouchers_ledger.md](all_vouchers_ledger.md) | Combined voucher ledger (686 lines) |
| [inventory.md](inventory.md) | Opening stock, current stock, opening batches, expiries |
| [manufacturing.md](manufacturing.md) | Formulas/BOMs, filling, production & packing runs |
| [history.md](history.md) | History/audit log summary (11,040 rows) |
| [account_balances.md](account_balances.md) | Final account balances (202 accounts) |
| [GAP_ANALYSIS.md](GAP_ANALYSIS.md) | What's imported in the app vs. what's not, and what was added |

## Table inventory (46 tables, 34,675 rows)

| Table | Rows | File |
|---|---|---|
| History | 11040 | History.csv |
| ProductionBatch | 3031 | ProductionBatch.csv |
| ProductionBody | 3010 | ProductionBody.csv |
| PackingBatch | 1918 | PackingBatch.csv |
| PackingBody | 1906 | PackingBody.csv |
| FormulaBody | 1667 | FormulaBody.csv |
| Products | 1342 | Products.csv |
| CompIDs | 1036 | CompIDs.csv |
| FillingBody | 895 | FillingBody.csv |
| PurchasesBody | 741 | PurchasesBody.csv |
| PurchasesBatch | 741 | PurchasesBatch.csv |
| SalesBatch | 727 | SalesBatch.csv |
| SalesBody | 721 | SalesBody.csv |
| AllVouchers | 686 | AllVouchers.csv |
| PackingHeader | 617 | PackingHeader.csv |
| DebitVouchersBody | 598 | DebitVouchersBody.csv |
| Productions | 571 | Productions.csv |
| FillingHeader | 314 | FillingHeader.csv |
| Purchases | 307 | Purchases.csv |
| CollectionBody | 301 | CollectionBody.csv |
| CashCollection | 301 | CashCollection.csv |
| Sales | 289 | Sales.csv |
| CurrentStock | 272 | CurrentStock.csv |
| ChartOfAccounts | 260 | ChartOfAccounts.csv |
| Project_Tasks | 258 | Project_Tasks.csv |
| FormulaHeader | 250 | FormulaHeader.csv |
| AccountsBalances | 202 | AccountsBalances.csv |
| Project_Registry | 122 | Project_Registry.csv |
| OpeningStock | 121 | OpeningStock.csv |
| OpeningBatch | 121 | OpeningBatch.csv |
| DebitVouchers | 106 | DebitVouchers.csv |
| Parties | 83 | Parties.csv |
| ActualTowns | 49 | ActualTowns.csv |
| SaleReturnsBatch | 17 | SaleReturnsBatch.csv |
| SaleReturnsBody | 17 | SaleReturnsBody.csv |
| JournalVouchersBody | 6 | JournalVouchersBody.csv |
| ExpiriesBatch | 6 | ExpiriesBatch.csv |
| ExpiriesBody | 6 | ExpiriesBody.csv |
| ActualSectors | 5 | ActualSectors.csv |
| Companies | 4 | Companies.csv |
| SaleReturns | 4 | SaleReturns.csv |
| JournalVouchers | 3 | JournalVouchers.csv |
| CreditVouchers | 1 | CreditVouchers.csv |
| Users | 1 | Users.csv |
| Expiries | 1 | Expiries.csv |
| CreditVouchersBody | 1 | CreditVouchersBody.csv |

## Data dictionary (schema of every CSV)

**`AccountsBalances.csv`** — columns:

```
AccountNo,Debit,Credit,Bal,BalType
```

**`ActualSectors.csv`** — columns:

```
ActualSectorId,SectorName
```

**`ActualTowns.csv`** — columns:

```
ActualTownId,ActualSectorId,TownName
```

**`AllVouchers.csv`** — columns:

```
VoucherType,VoucherNo,VoucherDate,ChequeNo,ChequeDate,DepositDate,ReconcileDate,AccountNo,Narration,Debit,Credit
```

**`CashCollection.csv`** — columns:

```
CollectionId,CollectionDate,IsWithInvoices,IsPosted,SalesmanID,UserNo,CashAccount
```

**`ChartOfAccounts.csv`** — columns:

```
AccountNo,UserNo,AccountName,AccountType,AccountDepth,Narration,ParentAccountNo,OpeningDebit,OpeningCredit,AdjustedDebit,AdjustedCredit,IsDetailed,IsLocked,IsPosted,IsEditable,BalFlag,PLFlag,ExpFlag
```

**`CollectionBody.csv`** — columns:

```
SerialNo,CollectionId,CustomerId,CompanyID,Amount,Discount,isDeleted,Remarks,PrevBal
```

**`Companies.csv`** — columns:

```
CompanyId,CompanyName,ExternalCode,IsActive
```

**`CompIDs.csv`** — columns:

```
SerialNo,CompanyID
```

**`CreditVouchers.csv`** — columns:

```
VoucherNo,VoucherDate,UserNo,IsPosted
```

**`CreditVouchersBody.csv`** — columns:

```
SerialNo,AccountNo,VoucherNo,VoucherDate,Narration,Credit
```

**`CurrentStock.csv`** — columns:

```
ProductId,BatchNo,Quantity,Cost,ExpiryDate
```

**`DebitVouchers.csv`** — columns:

```
VoucherNo,VoucherDate,UserNo,IsPosted
```

**`DebitVouchersBody.csv`** — columns:

```
SerialNo,AccountNo,VoucherNo,VoucherDate,Narration,Debit
```

**`Expiries.csv`** — columns:

```
ExpiryId,InvoiceDate,LastUpdateDate,TimeKey,IsPosted,InvoiceType,UserNo,Remarks
```

**`ExpiriesBatch.csv`** — columns:

```
ExpiryId,ProductId,BatchNo,ExpiryDate,Quantity,Cost,IsDeleted
```

**`ExpiriesBody.csv`** — columns:

```
ExpiryId,ProductId,Quantity,IsDeleted
```

**`FillingBody.csv`** — columns:

```
FormulaID,ProductID,Qty,IsDeleted
```

**`FillingHeader.csv`** — columns:

```
FormulaID,ProductID,Qty,IsPosted
```

**`FormulaBody.csv`** — columns:

```
FormulaID,ProductID,Qty,IsDeleted
```

**`FormulaHeader.csv`** — columns:

```
FormulaID,ProductID,Qty,IsPosted
```

**`History.csv`** — columns:

```
HistoryId,TimeKey,ProcessName,ProcessId,ProductId,BatchNoOld,QuantityOld,CostOld,BatchNoNew,QuantityNew,CostNew
```

**`JournalVouchers.csv`** — columns:

```
VoucherNo,VoucherDate,UserNo,IsPosted
```

**`JournalVouchersBody.csv`** — columns:

```
SerialNo,AccountNo,VoucherNo,VoucherDate,Narration,Debit,Credit
```

**`OpeningBatch.csv`** — columns:

```
SerialID,ProductId,BatchNo,Quantity,ExpiryDate,Cost,IsDeleted
```

**`OpeningStock.csv`** — columns:

```
ProductId,Quantity,Bonus,Price,DiscRatio1,DiscRatio2,STValue,STRatio,TTLValue,TTLSalestax,IsDeleted,UserNo
```

**`PackingBatch.csv`** — columns:

```
PackingID,ProductID,BatchNo,ExpiryDate,Quantity,Cost,IsDeleted
```

**`PackingBody.csv`** — columns:

```
PackingID,ProductID,Quantity,Cost,TTLValue,IsDeleted
```

**`PackingHeader.csv`** — columns:

```
PackingID,PackingDate,Remarks,ProductID,Quantity,BatchNo,ExpiryDate,Cost,TTLValue,Expense,UserNo,IsPosted
```

**`Parties.csv`** — columns:

```
AccountNo,ActualTownId,Address,City,ContactPerson,Phone1,Phone2,Phone3,Fax,Mobile,EMail,WWW,NTN,STN,IsCustomer,IsVendor,CustomerType,CreditLimit,CreditPeriod,IsValidLicense,LicenseNo,LicenseExpiryDate,BirthDate,PartyName,PriceCategory,IsActive
```

**`ProductionBatch.csv`** — columns:

```
ProductionID,ProductID,BatchNo,ExpiryDate,Quantity,Cost,IsDeleted
```

**`ProductionBody.csv`** — columns:

```
ProductionID,ProductID,Quantity,Cost,TTLValue,IsDeleted
```

**`Productions.csv`** — columns:

```
ProductionID,ProductionDate,Remarks,ProductID,Quantity,BatchNo,ExpiryDate,Cost,TTLValue,Expense,UserNo,IsPosted
```

**`Products.csv`** — columns:

```
ProductId,CompanyId,GroupId,ProductName,Packing,PurchasePrice,PurchaseDiscRatio,PurchaseSTValue,PurchaseSTRatio,TradePrice,SaleDiscRatio,SaleDiscRatioRetail,SaleSTValue,SaleSTRatio,RetailPrice,MinStockLevel,OrderStockLevel,PurBonusBase,PurBonusQty,SalBonusBase,SalBonusQty,IsSaleOnTp,RetailPriceLoose,TradePrice2,TradePrice3,RPTOTPDisc,IsBonusItem,Carton,IsActive,IsInput,IsOutput,IsConsumable
```

**`Project_Registry.csv`** — columns:

```
RegistryKey,ParentRegistryKey,Narration,Value,IsEditable
```

**`Project_Tasks.csv`** — columns:

```
TaskKey,TaskName,TaskGroup,IsAutoPost,IsPosting,Edition,ApplicationMode
```

**`Purchases.csv`** — columns:

```
PurchaseId,LastUpdateDate,EntryDate,BillNo,BillDate,OrderID,PreviousCredit,Expenses,PaidAmount,VendorId,TimeKey,IsPosted,IsLocal,UserNo,Remarks
```

**`PurchasesBatch.csv`** — columns:

```
PurchaseId,ProductId,BatchNo,ExpiryDate,Quantity,Cost,IsDeleted
```

**`PurchasesBody.csv`** — columns:

```
SerialNo,PurchaseId,ProductId,Quantity,Bonus,Price,DiscRatio1,DiscRatio2,STValue,STRatio,TTLValue,TTLSalestax,IsDeleted
```

**`SaleReturns.csv`** — columns:

```
SReturnId,SaleId,LastUpdateDate,ReturnDate,PreviousDebit,PaidAmount,SpecialDiscount,CustomerId,IsUndelivered,TimeKey,IsPosted,SalesManId,UserNo,Remarks
```

**`SaleReturnsBatch.csv`** — columns:

```
SReturnId,ProductId,BatchNo,ExpiryDate,Quantity,Cost,IsDeleted
```

**`SaleReturnsBody.csv`** — columns:

```
SerialNo,SReturnId,ProductId,Quantity,Bonus,Price,DiscRatio1,DiscRatio2,STValue,STRatio,TTLValue,TTLSalestax,IsDeleted
```

**`Sales.csv`** — columns:

```
SaleId,SaleType,ExternalId,SalesManId,CustomerId,LastUpdateDate,SaleDate,IsCashInvoice,IsWarranted,PreviousDebit,IsAutoBatch,ReceivedAmount,SpecialDiscount,DueDate,IsPrinted,Remarks,TimeKey,IsPosted,SSInvNo,IsInvoiceClaimable,UserNo,PrintingCharges,DefCustomerName,OrderID,OrderDate,IsAvailability,BookingID
```

**`SalesBatch.csv`** — columns:

```
SaleId,ProductId,BatchNo,ExpiryDate,Quantity,Cost,IsDeleted
```

**`SalesBody.csv`** — columns:

```
SerialNo,SaleId,ProductId,IsSaleOnTp,Quantity,Bonus,Price,DiscRatio1,DiscRatio2,STValue,STRatio,TTLValue,TTLSalestax,IsDeleted,Description
```

**`Users.csv`** — columns:

```
UserNo,UserName,Password,Narration,IsEnabled,IsAdministrator
```

## Financial highlights

| Measure | Amount (PKR) |
|---|---|
| Sales invoices (289) — line total | 103,223,844.00 |
| Purchase invoices (307) — line total | 23,057,802.42 |
| Cash collections received (301) | 103,200,205.00 |
| Debit vouchers — payments/expenses (598 lines) | 111,036,017.00 |
| Credit vouchers — received (1 line) | 200,000.00 |
| Journal vouchers — debit | 25,650.00 |
| Journal vouchers — credit | 25,650.00 |

