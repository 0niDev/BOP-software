# Opening Balance Fixes Summary

## Issues Fixed

### 1. Banking Service - Inconsistent Equity Account and Voucher Type
**File:** `services/banking_service.py`
**Problem:** 
- Used Owner's Equity (3000) instead of Retained Earnings (3100) for bank opening balances
- Used VoucherType.JOURNAL instead of VoucherType.OPENING

**Fix:**
- Changed to use SystemAccountResolver to get Retained Earnings (3100), consistent with AccountService
- Changed voucher type from JOURNAL to OPENING so balances appear in ODR/OCR columns, not CDR/CCR

### 2. Account Service - No Adjustment When Opening Balance Changes
**File:** `services/account_service.py`
**Problem:**
- When updating an account's opening_balance field, no journal entry was created to adjust the general ledger
- This caused the database field and actual ledger to become out of sync

**Fix:**
- Added `_adjust_opening_balance()` method that creates adjusting OPENING journal entries when opening_balance changes
- Modified `update_account()` to detect changes and call the adjustment method
- Uses Retained Earnings (3100) as the counterpart account for consistency

### 3. Opening Balance Dialog - Didn't Update accounts.opening_balance Field
**File:** `views/widgets/opening_balance_dialog.py`
**Problem:**
- Created OPENING journal entries correctly but didn't update the `accounts.opening_balance` column
- This meant the database field stayed at 0 even after setting opening balances

**Fix:**
- After posting the journal entry, now updates `accounts.opening_balance` for each account
- Properly handles sign based on account type (assets vs liabilities/equity)

### 4. Trial Balance Report - Mixing Opening and Current Balances
**File:** `reports/trial_balance_report.py`
**Problem:**
- CDR/CCR columns incorrectly included opening balances mixed with current transactions
- For assets: calculated `net = odr + total_debit - total_credit` then assigned to CDR/CCR
- This double-counted opening balances

**Fix:**
- CDR/CCR now show ONLY current period transactions (total_debit and total_credit)
- Opening balances stay strictly in ODR/OCR columns
- Separation is now clean: ODR/OCR for opening, CDR/CCR for current

### 5. Parties Summary - Incorrect Opening Balance Calculation
**Files:** `reports/trial_balance_report.py` and `controllers/report_controller.py`
**Problem:**
- Tried to allocate account-level opening balances to specific parties
- Opening balances don't have party information, so this logic was fundamentally flawed
- Caused incorrect party opening balances to be displayed

**Fix:**
- Removed the faulty logic that tried to distribute account opening balances to parties
- Party opening balances now correctly show as 0 (since they can't be determined from historical data)
- Only current period transactions are shown for parties
- Added comments explaining why opening balances aren't available at party level

## Answer to User Question: "Should Cash in Hand also include as Owner's Equity?"

**No.** Here's the correct accounting treatment:

### Opening Balances Flow to Retained Earnings (3100), NOT Owner's Equity (3000)

When you set opening balances:
- **Assets** (Cash in Hand, Bank Accounts, Inventory): Debit the asset, Credit Retained Earnings
- **Liabilities** (Accounts Payable): Credit the liability, Debit Retained Earnings  
- **Equity** accounts: Already have their balance carried forward

### Why Retained Earnings?
- **Owner's Equity (3000)**: Represents capital injected by owners during the business life, additional investments, drawings
- **Retained Earnings (3100)**: Represents accumulated profits/losses from prior periods PLUS opening net assets

Opening balances represent the financial position at the start date, which is the result of all prior period operations. This belongs in Retained Earnings, not Owner's Equity.

### Example:
If you have:
- Cash in Hand: 100 (opening)
- Bank Account: 899 (opening)
- No liabilities

The journal entry is:
```
Dr Cash in Hand          100
Dr Bank Account          899
    Cr Retained Earnings        999
```

NOT:
```
Dr Cash in Hand          100
Dr Bank Account          899
    Cr Owner's Equity           999  ❌ WRONG
```

### The 1,000 in Owner's Equity Was a Bug
The 1,000 credit you saw in Owner's Equity was caused by the banking service incorrectly using account 3000 instead of 3100. This has been fixed.

## Result After Fixes

Your trial balance should now show:
- **ODR/OCR**: Opening balances only (from OPENING voucher types)
- **CDR/CCR**: Current period transactions only (non-OPENING vouchers)
- **Retained Earnings (3100)**: Contains the balancing figure for all opening balances
- **Owner's Equity (3000)**: Only shows actual owner investments/withdrawals, not opening balances
- **Parties Summary**: Shows only current transactions (opening balances unavailable at party level)

All opening balances now consistently flow through Retained Earnings, maintaining proper accounting principles.
