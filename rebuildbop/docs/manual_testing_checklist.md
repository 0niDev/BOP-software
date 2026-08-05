# Manual Testing Checklist

## Pre-requisites
- [ ] SQLite Cloud connection configured
- [ ] Test database initialized
- [ ] Application running

## 1. Authentication Module

### Login
- [ ] Valid credentials - successful login
- [ ] Invalid username - error message displayed
- [ ] Invalid password - error message displayed
- [ ] Empty fields - validation error
- [ ] Network disconnection during login - retry logic works
- [ ] Loading indicator appears during authentication

## 2. Chart of Accounts

### View Accounts
- [ ] All accounts load within 500ms
- [ ] Tree structure displays correctly
- [ ] Account types color-coded properly
- [ ] Search/filter works efficiently
- [ ] Pagination works for large account lists

### Create Account
- [ ] New account created successfully
- [ ] Duplicate account code prevented
- [ ] Parent account selection works
- [ ] Opening balance validated
- [ ] Transaction created for opening balance

### Edit Account
- [ ] Account details update correctly
- [ ] Account type cannot be changed if transactions exist
- [ ] Cache invalidated after update

### Delete/Deactivate Account
- [ ] Cannot delete account with transactions
- [ ] Deactivation works correctly
- [ ] Child accounts handled properly

## 3. Party Management

### Customer Operations
- [ ] Customer list loads quickly
- [ ] Customer creation with auto-generated code
- [ ] Credit limit validation works
- [ ] Opening balance posts to correct account

### Supplier Operations
- [ ] Supplier list loads quickly
- [ ] Supplier creation works
- [ ] Payment terms configurable

### Party Ledger
- [ ] Ledger loads within 1s
- [ ] Running balance calculates correctly
- [ ] Date range filter works
- [ ] Transaction drill-down works

## 4. Sales Invoice

### Create Invoice
- [ ] Invoice form loads quickly
- [ ] Customer selection with autocomplete
- [ ] Item search and selection works
- [ ] Batch number tracking (pharma requirement)
- [ ] Expiry date validation
- [ ] Discount calculation correct
- [ ] Tax calculation correct
- [ ] Total amount accurate
- [ ] Invoice saves successfully
- [ ] Journal entry created automatically
- [ ] Stock reduced correctly

### Invoice Operations
- [ ] Invoice list with pagination
- [ ] Invoice editing (before posting)
- [ ] Invoice deletion (before posting)
- [ ] Invoice printing/PDF export
- [ ] Posted invoice cannot be modified

## 5. Purchase Invoice

### Create Purchase Invoice
- [ ] Supplier selection works
- [ ] Item receipt with batch tracking
- [ ] Cost price updates correctly
- [ ] Stock increased on save
- [ ] Journal entry created

## 6. Payments & Receipts

### Payment Entry
- [ ] Payment against invoice works
- [ ] Partial payment supported
- [ ] Advance payment supported
- [ ] Payment method selection (Cash/Bank/Cheque)
- [ ] Journal entry created

### Receipt Entry
- [ ] Customer receipt processing
- [ ] Receipt allocation to invoices
- [ ] Bank deposit recording

## 7. Banking

### Bank Accounts
- [ ] Bank account setup
- [ ] Bank reconciliation
- [ ] Cheque clearing tracking

## 8. Reports

### Financial Reports
- [ ] Balance Sheet generates in <2s
- [ ] Profit & Loss statement accurate
- [ ] Trial Balance balances
- [ ] Cash Flow statement correct

### Operational Reports
- [ ] Sales Register
- [ ] Purchase Register
- [ ] Stock Report
- [ ] Ageing Analysis (Receivables/Payables)
- [ ] Party-wise Sales/Purchase

### Report Features
- [ ] Date range filter
- [ ] Export to Excel
- [ ] Print preview
- [ ] Drill-down capability

## 9. Performance Tests

### Load Time Measurements
- [ ] Dashboard loads in <1s
- [ ] Chart of Accounts loads in <500ms
- [ ] Party ledger (1000 transactions) loads in <1s
- [ ] Sales invoice form loads in <500ms
- [ ] Report generation <2s

### Concurrent User Tests
- [ ] 5 users working simultaneously - no degradation
- [ ] 10 users working simultaneously - acceptable performance
- [ ] No deadlocks observed
- [ ] No data corruption

### Network Simulation
- [ ] 100ms latency - acceptable performance
- [ ] 200ms latency - still usable
- [ ] Temporary disconnection - graceful handling
- [ ] Reconnection automatic

## 10. Data Integrity

### Double-Entry Validation
- [ ] Every transaction has equal debits and credits
- [ ] Journal entries always balance
- [ ] No orphaned journal entry lines

### Referential Integrity
- [ ] Cannot delete party with transactions
- [ ] Cannot delete item with stock
- [ ] Cannot delete account with balance

### Audit Trail
- [ ] Created/Modified timestamps recorded
- [ ] User attribution works
- [ ] Change history available

## 11. Edge Cases

### Boundary Testing
- [ ] Zero quantity invoices
- [ ] Maximum decimal precision (2 decimal places)
- [ ] Very large amounts
- [ ] Future dated transactions
- [ ] Leap year dates

### Error Handling
- [ ] Database errors show user-friendly messages
- [ ] Network errors trigger retry
- [ ] Invalid input rejected with clear feedback

## Sign-off

| Module | Tester | Date | Status |
|--------|--------|------|--------|
| Authentication | | | |
| Chart of Accounts | | | |
| Party Management | | | |
| Sales Invoice | | | |
| Purchase Invoice | | | |
| Payments | | | |
| Banking | | | |
| Reports | | | |
| Performance | | | |

**Overall Status:** [ ] PASS [ ] FAIL

**Notes:**
_________________________________
_________________________________
_________________________________
