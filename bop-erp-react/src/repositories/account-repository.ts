// Account Repository - Chart of Accounts
// DEBUG: Handles all account-related database operations

import { BaseRepository } from './base-repository';
import { Account } from '../models';
import { AccountType } from '../enums';
import { debugLog, errorLog } from '../config';

export class AccountRepository extends BaseRepository<Account> {
  constructor() {
    super('accounts');
    debugLog('AccountRepository', 'Account repository initialized');
  }

  /**
   * Find account by code
   * DEBUG: Critical for accounting operations
   */
  async findByCode(code: string): Promise<Account | null> {
    const results = await this.executeQuery<Account>(
      'SELECT * FROM accounts WHERE code = ?',
      [code]
    );
    
    if (results.length === 0) {
      debugLog('AccountRepository', `No account found with code ${code}`);
      return null;
    }
    
    return results[0];
  }

  /**
   * Get account by type
   */
  async findByType(accountType: AccountType, companyId: number): Promise<Account[]> {
    const results = await this.executeQuery<Account>(
      'SELECT * FROM accounts WHERE account_type = ? AND company_id = ?',
      [accountType, companyId]
    );
    
    debugLog('AccountRepository', `Found ${results.length} accounts of type ${accountType}`);
    return results;
  }

  /**
   * Get current balance for an account
   * DEBUG: Sums all journal entry lines for the account
   */
  async getCurrentBalance(accountId: number, fromDate?: string, toDate?: string): Promise<number> {
    let sql = `
      SELECT COALESCE(SUM(debit - credit), 0) as balance
      FROM journal_entry_lines jel
      JOIN journal_entries je ON jel.journal_entry_id = je.id
      WHERE jel.account_id = ?
      AND je.status = 'CONFIRMED'
    `;
    
    const params: any[] = [accountId];
    
    if (fromDate) {
      sql += ' AND je.date >= ?';
      params.push(fromDate);
    }
    
    if (toDate) {
      sql += ' AND je.date <= ?';
      params.push(toDate);
    }
    
    const results = await this.executeQuery<{ balance: number }>(sql, params);
    const balance = results[0]?.balance || 0;
    
    debugLog('AccountRepository', `Account ${accountId} balance: ${balance}`);
    return balance;
  }

  /**
   * Get all active accounts for a company
   */
  async getActiveAccounts(companyId: number): Promise<Account[]> {
    const results = await this.executeQuery<Account>(
      'SELECT * FROM accounts WHERE company_id = ? AND is_active = 1 ORDER BY code',
      [companyId]
    );
    
    debugLog('AccountRepository', `Found ${results.length} active accounts for company ${companyId}`);
    return results;
  }

  /**
   * Find child accounts of a parent account
   */
  async findChildAccounts(parentAccountId: number): Promise<Account[]> {
    const results = await this.executeQuery<Account>(
      'SELECT * FROM accounts WHERE parent_account_id = ? AND is_active = 1',
      [parentAccountId]
    );
    
    return results;
  }

  /**
   * Get account hierarchy recursively
   */
  async getAccountHierarchy(rootAccountId: number): Promise<Account[]> {
    const accounts: Account[] = [];
    
    const fetchChildren = async (parentId: number) => {
      const children = await this.findChildAccounts(parentId);
      accounts.push(...children);
      
      for (const child of children) {
        await fetchChildren(child.id);
      }
    };
    
    await fetchChildren(rootAccountId);
    return accounts;
  }
}

console.log('[AccountRepository] Account repository with balance calculation initialized');
