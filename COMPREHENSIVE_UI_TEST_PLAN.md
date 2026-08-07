# COMPLETE ERP UI TESTING GUIDE

## 📋 OVERVIEW
This guide provides step-by-step testing instructions for all ERP modules with edge cases to ensure consistency across all tabs.

---

## 🚀 PRE-TESTING SETUP

### 1. Initial Setup
```bash
cd /workspace
python main.py
```

### 2. Login Credentials (Default)
- **Username:** admin
- **Password:** admin123 (or as configured)

### 3. Test Data Preparation
Before starting, ensure you have:
- [ ] Database initialized
- [ ] At least one company created
- [ ] Basic accounts setup (Chart of Accounts)

---

## 📦 MODULE 1: INVENTORY MANAGEMENT (Items)

### Test Case 1.1: Create New Item
**Steps:**
1. Navigate to **Inventory** tab
2. Leave form fields empty initially
3. Enter item name: "Test Product Alpha"
4. Select Unit: TABLET
5. Enter Purchase Price: 100.00
6. Enter Selling Price: 150.00
7. Enter Minimum Stock: 10
8. Enter Maximum Stock: 1000
9. Select Item Type: Finished Good
10. Click **Save**

**Expected Results:**
- ✅ Auto-generated code appears (read-only field)
- ✅ Success message displayed
- ✅ Form clears automatically for next entry
- ✅ Item appears in table immediately
- ✅ Stock shows 0 initially

**Edge Cases:**
- [ ] Save with empty name → Should show validation error
- [ ] Enter negative price → Should show validation error
- [ ] Enter non-numeric values in price fields → Should show validation error
- [ ] Click Save multiple times rapidly → Should prevent duplicate saves
- [ ] Special characters in name (e.g., "Product & Co.") → Should save correctly

### Test Case 1.2: Edit Existing Item
**Steps:**
1. Click on any item in the table
2. Click **Edit** button
3. Modify selling price to 200.00
4. Update notes field
5. Click **Save**

**Expected Results:**
- ✅ Form populates with selected item data
- ✅ Edit and Delete buttons enabled
- ✅ Changes saved successfully
- ✅ Table updates with new values

**Edge Cases:**
- [ ] Edit without selecting item → Buttons should be disabled
- [ ] Change item type while stock exists → Should warn or allow
- [ ] Set min stock > max stock → Should validate

### Test Case 1.3: Search and Filter Items
**Steps:**
1. Type in search box: "Test"
2. Clear search box
3. Type item code

**Expected Results:**
- ✅ Real-time filtering by name or code
- ✅ Case-insensitive search
- ✅ Empty results shown gracefully

### Test Case 1.4: Delete Item
**Steps:**
1. Select an item with NO transactions
2. Click **Delete**
3. Confirm deletion

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ Item removed from table
- ✅ Form clears

**Edge Cases:**
- [ ] Delete item with existing stock → Should warn or prevent
- [ ] Delete item used in invoices → Should prevent with clear message

### Test Case 1.5: Stock Verification
**Steps:**
1. Create purchase invoice with items (see Module 4)
2. Return to Inventory tab
3. Click Refresh
4. Verify stock quantities updated

**Expected Results:**
- ✅ Stock quantities reflect purchases
- ✅ Multiple batches aggregated correctly
- ✅ Stock loads asynchronously (no UI freeze)

---

## 👥 MODULE 2: PARTY MANAGEMENT (Customers/Suppliers)

### Test Case 2.1: Create Customer
**Steps:**
1. Navigate to **Parties** tab
2. Select Party Type: Customer
3. Enter Name: "ABC Corporation"
4. Enter Code: (auto-generated or manual)
5. Enter Contact Info:
   - Phone: +1234567890
   - Email: contact@abc.com
   - Address: 123 Main St
6. Enter Opening Balance: 0
7. Click **Save**

**Expected Results:**
- ✅ Customer created successfully
- ✅ Form clears for next entry
- ✅ Customer appears in table

**Edge Cases:**
- [ ] Duplicate party code → Should prevent
- [ ] Invalid email format → Should validate
- [ ] Very long names (>100 chars) → Should truncate or validate

### Test Case 2.2: Create Supplier
**Steps:**
1. Select Party Type: Supplier
2. Enter Name: "XYZ Suppliers Ltd"
3. Fill contact details
4. Set Opening Balance: 5000 (credit balance)
5. Click **Save**

**Expected Results:**
- ✅ Supplier created
- ✅ Opening balance posted to ledger

### Test Case 2.3: Search Parties
**Steps:**
1. Use search box to find "ABC"
2. Filter by Party Type dropdown
3. Toggle Active/Inactive filter

**Expected Results:**
- ✅ Search works on name and code
- ✅ Filter by type works
- ✅ Inactive parties hidden by default

### Test Case 2.4: Edit Party
**Steps:**
1. Select party from table
2. Click Edit
3. Change contact info
4. Update opening balance
5. Save

**Expected Results:**
- ✅ Changes saved
- ✅ Ledger updated if opening balance changed

**Edge Cases:**
- [ ] Change party type (Customer→Supplier) → Should handle correctly
- [ ] Deactivate party with pending invoices → Should warn

---

## 💰 MODULE 3: SALES INVOICE

### Test Case 3.1: Create Sales Invoice
**Prerequisites:** 
- At least 1 customer created
- At least 2 items with stock > 0

**Steps:**
1. Navigate to **Sales Invoice** tab
2. Click **Add Invoice** or similar
3. Select Customer (use search to find)
4. Invoice Date: Today
5. Payment Type: Cash
6. Add Items:
   - Click **Add Item**
   - Search and select "Test Product Alpha"
   - Quantity: 5
   - Unit Price: (auto-filled from item)
   - Discount: 0
   - Tax: 0
   - Click OK
   - Add second item
7. Verify totals calculate correctly
8. Click **Save**

**Expected Results:**
- ✅ Invoice number auto-generated
- ✅ Customer searchable and selectable
- ✅ Item prices auto-fill from item master
- ✅ Line totals calculate: (qty × price) - discount + tax
- ✅ Grand total sums all lines
- ✅ Stock reduced after save
- ✅ Customer ledger updated

**Edge Cases:**
- [ ] Sell more than available stock → Should warn or prevent
- [ ] Negative quantity → Should validate
- [ ] Zero unit price → Should allow or warn
- [ ] Discount > line total → Should validate
- [ ] Save without items → Should prevent
- [ ] Select inactive customer → Should prevent or warn

### Test Case 3.2: Edit Sales Invoice
**Steps:**
1. Select invoice from table
2. Click **Edit**
3. Add/remove items
4. Change quantity
5. Save changes

**Expected Results:**
- ✅ Invoice loads with all items
- ✅ Stock adjusted for changes
- ✅ Ledger entries updated

**Edge Cases:**
- [ ] Edit cancelled invoice → Should prevent
- [ ] Reduce quantity below already delivered → Should warn

### Test Case 3.3: Cancel Sales Invoice
**Steps:**
1. Select confirmed invoice
2. Click **Cancel**
3. Confirm cancellation

**Expected Results:**
- ✅ Invoice status changes to CANCELLED
- ✅ Stock returned
- ✅ Ledger reversed

**Edge Cases:**
- [ ] Cancel invoice with payments received → Should warn about payment reversal

### Test Case 3.4: Search and Filter Invoices
**Steps:**
1. Search by invoice number
2. Search by customer name
3. Filter by status (Confirmed/Cancelled)

**Expected Results:**
- ✅ Search works on invoice number and customer
- ✅ Status filter works correctly

---

## 🛒 MODULE 4: PURCHASE INVOICE

### Test Case 4.1: Create Purchase Invoice
**Prerequisites:**
- At least 1 supplier created
- At least 1 item created

**Steps:**
1. Navigate to **Purchase Invoice** tab
2. Select Supplier (use search)
3. Invoice Date: Today
4. Payment Type: Credit
5. Add Items:
   - Click **Add Item**
   - Select item
   - Quantity: 100
   - Unit Cost: 100.00
   - Discount: 0
   - Tax: 0
   - Click OK
6. Verify totals
7. Click **Save**

**Expected Results:**
- ✅ Invoice created
- ✅ Stock increased
- ✅ Supplier ledger updated (accounts payable)
- ✅ Item average cost recalculated (if using weighted average)

**Edge Cases:**
- [ ] Purchase at different cost than existing → Should update average cost
- [ ] Purchase from inactive supplier → Should warn
- [ ] Duplicate invoice number → Should prevent

### Test Case 4.2: Edit Purchase Invoice
**Steps:**
1. Select invoice
2. Click Edit
3. Modify quantity or cost
4. Save

**Expected Results:**
- ✅ Stock adjusted
- ✅ Average cost recalculated
- ✅ Ledger updated

### Test Case 4.3: Cancel Purchase Invoice
**Steps:**
1. Select invoice
2. Click Cancel
3. Confirm

**Expected Results:**
- ✅ Stock reduced
- ✅ Liability reversed

---

## 🏦 MODULE 5: BANKING

### Test Case 5.1: Create Bank Account
**Steps:**
1. Navigate to **Banking** tab
2. Go to Bank Accounts sub-tab
3. Click **Add Account**
4. Enter:
   - Account Name: "Main Operating Account"
   - Bank Name: "First National Bank"
   - Account Number: 123456789
   - Branch: Downtown
   - Opening Balance: 10000
5. Save

**Expected Results:**
- ✅ Account created
- ✅ Opening balance posted to cash book

### Test Case 5.2: Record Bank Transaction
**Steps:**
1. Go to Transactions sub-tab
2. Click **Add Transaction**
3. Select Account
4. Transaction Type: Deposit
5. Amount: 5000
6. Date: Today
7. Description: "Cash deposit"
8. Save

**Expected Results:**
- ✅ Transaction recorded
- ✅ Bank balance updated
- ✅ Entry in cash book

**Edge Cases:**
- [ ] Withdraw more than balance → Should prevent overdraft (or allow based on settings)
- [ ] Negative amount → Should validate

### Test Case 5.3: Cheque Management
**Steps:**
1. Go to Cheques sub-tab
2. Record cheque received:
   - From: Customer
   - Amount: 2000
   - Date: Today
   - Status: Pending
3. Save
4. Later, mark as Cleared

**Expected Results:**
- ✅ Cheque recorded
- ✅ Balance updates when cleared
- ✅ Bounced cheques handled correctly

**Edge Cases:**
- [ ] Mark cheque as bounced → Should reverse entry and add penalty if configured

---

## 💸 MODULE 6: EXPENSES

### Test Case 6.1: Create Expense Category
**Steps:**
1. Navigate to **Expenses** tab
2. Go to Categories sub-tab
3. Click **Add Category**
4. Name: "Office Supplies"
5. Select Account: (or auto-create)
6. Save

**Expected Results:**
- ✅ Category created
- ✅ Expense account linked

### Test Case 6.2: Record Expense
**Steps:**
1. Go to Expenses sub-tab
2. Click **Add Expense**
3. Select Category
4. Amount: 500
5. Date: Today
6. Payment Method: Cash
7. Description: "Bought printer paper"
8. Save

**Expected Results:**
- ✅ Expense recorded
- ✅ Cash/Bank reduced
- ✅ Expense account debited

**Edge Cases:**
- [ ] Expense without category → Should require or auto-create
- [ ] Very large amount → Should flag for review (optional)

---

## 🔄 MODULE 7: PAYMENTS

### Test Case 7.1: Make Payment to Supplier
**Prerequisites:**
- Outstanding purchase invoice

**Steps:**
1. Navigate to **Payments** tab
2. Select Supplier
3. Select Invoice(s) to pay
4. Payment Amount: (full or partial)
5. Payment Method: Bank
6. Select Bank Account
7. Date: Today
8. Save

**Expected Results:**
- ✅ Payment recorded
- ✅ Invoice balance reduced
- ✅ Bank balance reduced
- ✅ Payment appears in supplier ledger

**Edge Cases:**
- [ ] Overpayment → Should create credit balance or warn
- [ ] Pay inactive supplier → Should warn
- [ ] Payment date before invoice date → Should allow or warn

### Test Case 7.2: Receive Payment from Customer
**Steps:**
1. Select Customer
2. Select outstanding invoice(s)
3. Enter amount received
4. Payment Method: Cash/Bank
5. Save

**Expected Results:**
- ✅ Payment recorded
- ✅ Customer balance reduced
- ✅ Cash/Bank increased

---

## 🏭 MODULE 8: MANUFACTURING

### Test Case 8.1: Create Bill of Materials (BOM)
**Prerequisites:**
- Raw material items created
- Finished good item created

**Steps:**
1. Navigate to **Manufacturing** tab
2. Go to BOM sub-tab
3. Click **Add BOM**
4. Select Finished Good
5. Add Components:
   - Component 1: Raw Material A, Qty: 2
   - Component 2: Raw Material B, Qty: 3
6. Save

**Expected Results:**
- ✅ BOM created
- ✅ Components linked to finished good

**Edge Cases:**
- [ ] Circular BOM (A uses B, B uses A) → Should prevent
- [ ] Component not in items → Should validate

### Test Case 8.2: Create Production Order
**Steps:**
1. Go to Production Orders sub-tab
2. Click **Add Order**
3. Select BOM
4. Quantity to Produce: 10
5. Planned Date: Today
6. Save

**Expected Results:**
- ✅ Order created
- ✅ Status: Planned

### Test Case 8.3: Complete Production Order
**Steps:**
1. Select order
2. Click **Complete** or **Start Production**
3. Confirm consumption of materials
4. Mark as Completed

**Expected Results:**
- ✅ Raw materials consumed (stock reduced)
- ✅ Finished good produced (stock increased)
- ✅ Order status: Completed
- ✅ Cost calculated (optional)

**Edge Cases:**
- [ ] Insufficient raw material stock → Should warn or prevent
- [ ] Partial completion → Should handle if supported

---

## 📊 MODULE 9: REPORTS

### Test Case 9.1: Trial Balance
**Steps:**
1. Navigate to **Reports** tab
2. Select Trial Balance tab
3. Select Date Range
4. Click Generate
5. Verify debits = credits
6. Export to PDF/Excel

**Expected Results:**
- ✅ Report generates
- ✅ Totals balance
- ✅ Export works

### Test Case 9.2: Profit & Loss
**Steps:**
1. Select P&L tab
2. Select period
3. Generate
4. Verify income - expenses = net profit

**Expected Results:**
- ✅ Income shown
- ✅ Expenses shown
- ✅ Net profit calculated

### Test Case 9.3: Balance Sheet
**Steps:**
1. Select Balance Sheet tab
2. Select date
3. Generate
4. Verify Assets = Liabilities + Equity

**Expected Results:**
- ✅ All assets listed
- ✅ All liabilities listed
- ✅ Equation balances

### Test Case 9.4: Party Ledger
**Steps:**
1. Select Party Ledger tab
2. Select specific party
3. Select date range
4. Generate

**Expected Results:**
- ✅ All transactions for party shown
- ✅ Running balance calculated
- ✅ Opening + transactions = closing

### Test Case 9.5: Cash Book
**Steps:**
1. Select Cash Book tab
2. Select date range
3. Select bank account (or cash)
4. Generate

**Expected Results:**
- ✅ All cash/bank transactions
- ✅ Receipts and payments separated
- ✅ Closing balance matches

---

## 📈 MODULE 10: DASHBOARD

### Test Case 10.1: View Dashboard Metrics
**Steps:**
1. Navigate to **Dashboard** tab
2. Wait for data to load
3. Verify metrics display

**Expected Results:**
- ✅ Total sales (current month)
- ✅ Total purchases
- ✅ Receivables
- ✅ Payables
- ✅ Bank balances
- ✅ Low stock alerts

**Edge Cases:**
- [ ] No data yet → Should show zeros, not errors
- [ ] Large dataset → Should load within reasonable time

### Test Case 10.2: Refresh Dashboard
**Steps:**
1. Make a transaction (e.g., create invoice)
2. Go to Dashboard
3. Click Refresh
4. Verify numbers updated

**Expected Results:**
- ✅ Metrics update to reflect new transaction

---

## ⚙️ MODULE 11: SETTINGS & ADMIN

### Test Case 11.1: Company Settings
**Steps:**
1. Navigate to Settings/Company
2. Update company info:
   - Name
   - Address
   - Phone
   - Email
   - Logo
3. Save

**Expected Results:**
- ✅ Settings saved
- ✅ Appears on reports/invoices

### Test Case 11.2: User Management
**Steps:**
1. Go to Users tab
2. Add new user:
   - Username
   - Password
   - Role
3. Save
4. Logout and login as new user

**Expected Results:**
- ✅ User created
- ✅ Can login
- ✅ Role permissions enforced

**Edge Cases:**
- [ ] Duplicate username → Should prevent
- [ ] Weak password → Should enforce policy if configured

### Test Case 11.3: Backup & Restore
**Steps:**
1. Go to Backup settings
2. Create manual backup
3. Note backup location
4. (Optional) Test restore on test database

**Expected Results:**
- ✅ Backup created successfully
- ✅ Backup file exists
- ✅ Restore works (test environment only)

---

## 🔄 CROSS-MODULE INTEGRATION TESTS

### Test Case C1: Complete Order-to-Cash Cycle
**Steps:**
1. Create Customer
2. Create Item with stock
3. Create Sales Invoice to Customer
4. Receive Payment from Customer
5. Check:
   - Customer ledger shows invoice and payment
   - Stock reduced
   - Cash/Bank increased
   - Sales account credited

**Expected Results:**
- ✅ All entries posted correctly
- ✅ Balances accurate across modules

### Test Case C2: Complete Procure-to-Pay Cycle
**Steps:**
1. Create Supplier
2. Create Purchase Invoice from Supplier
3. Make Payment to Supplier
4. Check:
   - Supplier ledger shows invoice and payment
   - Stock increased
   - Cash/Bank reduced
   - Expense/Asset account debited

**Expected Results:**
- ✅ Full cycle works
- ✅ No orphaned entries

### Test Case C3: Manufacturing Flow
**Steps:**
1. Create BOM
2. Purchase raw materials
3. Create Production Order
4. Complete Production
5. Sell finished good
6. Check:
   - Raw material stock reduced
   - Finished good stock increased then reduced
   - Costs tracked (if enabled)

**Expected Results:**
- ✅ Material flow tracked
- ✅ Stock accurate at each stage

### Test Case C4: Multi-User Concurrent Access
**Steps:**
1. Open application in two sessions (if possible)
2. User 1: Create sales invoice
3. User 2: Simultaneously create purchase invoice
4. Both save

**Expected Results:**
- ✅ No deadlocks
- ✅ Both transactions committed
- ✅ Stock accurate

**Edge Cases:**
- [ ] Same item in both invoices → Should handle stock correctly
- [ ] Same customer being edited → Should handle locking/conflicts

---

## 🐛 ERROR HANDLING TESTS

### Test Case E1: Network/Database Disconnection
**Steps:**
1. During operation, disconnect network (if using cloud DB)
2. Attempt to save

**Expected Results:**
- ✅ Graceful error message
- ✅ No crash
- ✅ Data not lost (if local cache exists)

### Test Case E2: Invalid Input Handling
**Steps:**
1. Enter SQL injection in text fields: `' OR '1'='1`
2. Enter script tags: `<script>alert('xss')</script>`
3. Enter extremely long text (1000+ chars)

**Expected Results:**
- ✅ Inputs sanitized
- ✅ No security vulnerabilities
- ✅ Application doesn't crash

### Test Case E3: File Import Errors
**Steps:**
1. Try to import corrupted CSV/Excel
2. Try to import wrong format

**Expected Results:**
- ✅ Clear error message
- ✅ No partial imports
- ✅ Rollback on error

---

## 📱 UI/UX CONSISTENCY CHECKS

### Test Case U1: Consistent Patterns Across Tabs
Check all tabs for:
- [ ] Same button styles (Save, Edit, Delete, Refresh)
- [ ] Same color scheme
- [ ] Same font sizes
- [ ] Consistent spacing
- [ ] Loading indicators during async operations
- [ ] Error messages in same format
- [ ] Success messages in same format
- [ ] Search boxes work similarly
- [ ] Tables have same behavior (selection, sorting)
- [ ] Forms clear after save (for create) or stay populated (for edit)

### Test Case U2: Keyboard Navigation
**Steps:**
1. Navigate forms using Tab key
2. Submit forms using Enter key
3. Use shortcuts if defined (Ctrl+S, Ctrl+N, etc.)

**Expected Results:**
- ✅ Logical tab order
- ✅ Enter submits form
- ✅ Shortcuts work

### Test Case U3: Responsive Design
**Steps:**
1. Resize window to different sizes
2. Test on minimum resolution
3. Test maximized

**Expected Results:**
- ✅ UI adapts gracefully
- ✅ No overlapping elements
- ✅ Scrollbars appear when needed

---

## 🔒 SECURITY TESTS

### Test Case S1: Authentication
**Steps:**
1. Try login with wrong password
2. Try login with non-existent user
3. Try SQL injection in login form
4. Test session timeout

**Expected Results:**
- ✅ Invalid credentials rejected
- ✅ No information leakage
- ✅ Session expires after timeout

### Test Case S2: Authorization
**Steps:**
1. Login as limited user
2. Try to access admin-only features
3. Try to modify another user's data

**Expected Results:**
- ✅ Access denied appropriately
- ✅ Role-based permissions enforced

### Test Case S3: Data Protection
**Steps:**
1. Check if passwords are stored encrypted
2. Verify sensitive data not logged
3. Check backup file security

**Expected Results:**
- ✅ Passwords hashed
- ✅ Logs don't contain sensitive data
- ✅ Backups protected

---

## 📝 PERFORMANCE TESTS

### Test Case P1: Large Dataset Performance
**Setup:** Create 1000+ items, 500+ parties, 2000+ invoices

**Steps:**
1. Load items list
2. Search items
3. Generate reports
4. Open dashboard

**Expected Results:**
- ✅ Lists load in < 3 seconds
- ✅ Search responds instantly
- ✅ Reports generate in < 5 seconds
- ✅ Dashboard loads in < 3 seconds

### Test Case P2: Concurrent Operations
**Steps:**
1. Start background backup
2. Create invoice
3. Generate report
4. All simultaneously

**Expected Results:**
- ✅ No deadlocks
- ✅ All operations complete
- ✅ No data corruption

---

## ✅ FINAL CHECKLIST

Before marking testing complete:

### Functionality
- [ ] All CRUD operations work in every module
- [ ] Search/filter works everywhere
- [ ] Reports generate correctly
- [ ] Dashboard shows accurate data
- [ ] All calculations correct (totals, taxes, balances)

### Data Integrity
- [ ] Stock quantities always accurate
- [ ] Ledgers always balance
- [ ] No orphaned records
- [ ] Foreign key constraints respected

### User Experience
- [ ] Consistent UI across all tabs
- [ ] Clear error messages
- [ ] Helpful success messages
- [ ] Loading indicators present
- [ ] No UI freezes during operations

### Security
- [ ] Authentication working
- [ ] Authorization enforced
- [ ] Input validation everywhere
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities

### Performance
- [ ] Acceptable load times
- [ ] No memory leaks
- [ ] Background tasks don't block UI
- [ ] Database queries optimized

### Edge Cases
- [ ] Empty states handled
- [ ] Division by zero prevented
- [ ] Null values handled
- [ ] Special characters work
- [ ] Very large numbers work
- [ ] Date boundaries work (year-end, leap year)

---

## 🐞 BUG REPORTING TEMPLATE

When you find issues, document them:

```markdown
**Module:** [e.g., Sales Invoice]
**Test Case:** [e.g., 3.1 - Create Sales Invoice]
**Severity:** Critical / High / Medium / Low

**Steps to Reproduce:**
1. ...
2. ...
3. ...

**Expected Result:**
...

**Actual Result:**
...

**Screenshot:** [if applicable]

**Environment:**
- OS: Windows 11
- Python version: 3.x
- Database: SQLite Cloud / Local

**Workaround:** [if any]
```

---

## 📊 TEST EXECUTION TRACKING

Use this table to track progress:

| Module | Test Cases | Pass | Fail | Blocked | Notes |
|--------|-----------|------|------|---------|-------|
| Inventory | 5 | 0 | 0 | 0 | Not started |
| Parties | 4 | 0 | 0 | 0 | Not started |
| Sales | 4 | 0 | 0 | 0 | Not started |
| Purchase | 3 | 0 | 0 | 0 | Not started |
| Banking | 3 | 0 | 0 | 0 | Not started |
| Expenses | 2 | 0 | 0 | 0 | Not started |
| Payments | 2 | 0 | 0 | 0 | Not started |
| Manufacturing | 3 | 0 | 0 | 0 | Not started |
| Reports | 5 | 0 | 0 | 0 | Not started |
| Dashboard | 2 | 0 | 0 | 0 | Not started |
| Settings | 3 | 0 | 0 | 0 | Not started |
| Integration | 4 | 0 | 0 | 0 | Not started |
| Error Handling | 3 | 0 | 0 | 0 | Not started |
| UI/UX | 3 | 0 | 0 | 0 | Not started |
| Security | 3 | 0 | 0 | 0 | Not started |
| Performance | 2 | 0 | 0 | 0 | Not started |
| **TOTAL** | **46** | **0** | **0** | **0** | |

---

## 🎯 PRIORITIZATION

If time is limited, test in this order:

**Priority 1 (Critical - Must Test):**
1. Create/Edit/Delete Items
2. Create Sales Invoice with stock impact
3. Create Purchase Invoice with stock impact
4. Receive Payment / Make Payment
5. All Reports (Trial Balance, P&L, Balance Sheet)

**Priority 2 (High - Should Test):**
1. Party management
2. Banking transactions
3. Expense recording
4. Dashboard accuracy
5. BOM and Production

**Priority 3 (Medium - Nice to Test):**
1. Advanced search features
2. Bulk operations
3. Export functionality
4. User management
5. Backup/Restore

**Priority 4 (Low - If Time Permits):**
1. Edge cases with extreme values
2. Performance with very large datasets
3. Security penetration testing
4. Accessibility features

---

## 📞 SUPPORT & DOCUMENTATION

If you encounter issues:
1. Check logs: `/workspace/logs/erp.log`
2. Review database: `/workspace/data/erp.db`
3. Consult documentation: `/workspace/COMPLETE_ERP_DOCUMENTATION.md`
4. Check known fixes: `/workspace/FIXES_SUMMARY.md`

---

**Last Updated:** 2026-08-07
**Version:** 1.0
**Author:** ERP Testing Team
