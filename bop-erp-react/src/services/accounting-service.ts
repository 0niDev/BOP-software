// Accounting Service - Core double-entry bookkeeping engine
// DEBUG: This is the heart of the ERP system - all financial transactions go through here

import { dbConnection } from '../utils/database';
import { AccountRepository } from '../repositories/account-repository';
import { JournalEntry, JournalEntryLine } from '../models';
import { VoucherType, DocumentStatus, AccountType } from '../enums';
import { ACCOUNT_CODES, debugLog, errorLog, warnLog } from '../config';

export interface JournalLineInput {
  accountId: number;
  debit: number;
  credit: number;
  partyId?: number;
  narration?: string;
}

export class UnbalancedJournalEntryError extends Error {
  constructor(totalDebit: number, totalCredit: number) {
    super(`Journal entry not balanced: Debit=${totalDebit}, Credit=${totalCredit}`);
    this.name = 'UnbalancedJournalEntryError';
  }
}

export class AccountNotFoundError extends Error {
  constructor(accountCode: string) {
    super(`Account with code ${accountCode} not found`);
    this.name = 'AccountNotFoundError';
  }
}

/**
 * Accounting Service - Handles all journal entry posting
 * DEBUG: Enforces double-entry bookkeeping rules
 */
export class AccountingService {
  private accountRepository: AccountRepository;

  constructor() {
    this.accountRepository = new AccountRepository();
    debugLog('AccountingService', 'Accounting service initialized');
  }

  /**
   * Post a journal entry with double-entry validation
   * DEBUG: Critical - ensures debit = credit before posting
   */
  async postJournalEntry(
    companyId: number,
    voucherType: VoucherType,
    date: string,
    lines: JournalLineInput[],
    narration?: string,
    sourceTable?: string,
    sourceId?: number,
    createdBy: number = 1
  ): Promise<number> {
    debugLog('AccountingService', `Posting journal entry for ${voucherType}`, {
      companyId,
      date,
      linesCount: lines.length,
      sourceTable,
      sourceId,
    });

    // Validate that debits equal credits
    const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

    debugLog('AccountingService', `Entry totals - Debit: ${totalDebit}, Credit: ${totalCredit}`);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      errorLog('AccountingService', `Unbalanced entry detected!`);
      throw new UnbalancedJournalEntryError(totalDebit, totalCredit);
    }

    if (lines.length === 0) {
      throw new Error('Journal entry must have at least one line');
    }

    try {
      return await dbConnection.transaction(async () => {
        // Step 1: Generate voucher number
        const voucherNumber = await this.generateVoucherNumber(companyId, voucherType);
        debugLog('AccountingService', `Generated voucher number: ${voucherNumber}`);

        // Step 2: Insert journal entry header
        const journalEntryId = await this.insertJournalEntryHeader({
          company_id: companyId,
          voucher_type: voucherType,
          voucher_number: voucherNumber,
          date,
          narration,
          status: DocumentStatus.CONFIRMED,
          source_table: sourceTable,
          source_id: sourceId,
          created_by: createdBy,
        });

        debugLog('AccountingService', `Created journal entry header with id ${journalEntryId}`);

        // Step 3: Insert journal entry lines
        for (const line of lines) {
          await this.insertJournalEntryLine(journalEntryId, line);
          debugLog('AccountingService', `Inserted line: ${line.debit}/${line.credit} for account ${line.accountId}`);
        }

        debugLog('AccountingService', `Journal entry ${journalEntryId} posted successfully`);
        return journalEntryId;
      });
    } catch (error) {
      errorLog('AccountingService', 'Failed to post journal entry', error);
      throw error;
    }
  }

  /**
   * Generate sequential voucher number (gap-free)
   * DEBUG: Uses numbering_sequences table
   */
  private async generateVoucherNumber(companyId: number, voucherType: VoucherType): Promise<string> {
    try {
      // Get or create numbering sequence
      const sequenceResult = await dbConnection.query<any>(
        `SELECT * FROM numbering_sequences 
         WHERE document_type = ? AND company_id = ?`,
        [voucherType, companyId]
      );

      let sequence: any;
      
      if (sequenceResult.length === 0) {
        // Create default sequence
        const prefix = voucherType.substring(0, 3);
        await dbConnection.query(
          `INSERT INTO numbering_sequences 
           (company_id, document_type, prefix, suffix, next_number, min_digits, is_active)
           VALUES (?, ?, ?, '', 1, 4, 1)`,
          [companyId, voucherType, prefix]
        );

        sequence = {
          prefix,
          suffix: '',
          next_number: 1,
          min_digits: 4,
        };
      } else {
        sequence = sequenceResult[0];
      }

      // Format voucher number
      const numberStr = sequence.next_number.toString().padStart(sequence.min_digits, '0');
      const voucherNumber = `${sequence.prefix}${numberStr}${sequence.suffix || ''}`;

      // Increment next_number
      await dbConnection.query(
        `UPDATE numbering_sequences SET next_number = ? WHERE id = ?`,
        [sequence.next_number + 1, sequence.id]
      );

      debugLog('AccountingService', `Generated voucher: ${voucherNumber} (next: ${sequence.next_number + 1})`);
      return voucherNumber;
    } catch (error) {
      errorLog('AccountingService', 'Failed to generate voucher number', error);
      throw error;
    }
  }

  /**
   * Insert journal entry header
   */
  private async insertJournalEntryHeader(data: Partial<JournalEntry>): Promise<number> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const columnNames = columns.join(', ');
    const placeholders = values.map(() => '?').join(', ');

    const sql = `INSERT INTO journal_entries (${columnNames}) VALUES (${placeholders})`;
    
    const result = await dbConnection.query([sql], ...values);
    
    const idResult = await dbConnection.query<{ last_insert_rowid: number }>(
      'SELECT last_insert_rowid() as last_insert_rowid'
    );
    
    return idResult[0]?.last_insert_rowid || 0;
  }

  /**
   * Insert single journal entry line
   */
  private async insertJournalEntryLine(journalEntryId: number, line: JournalLineInput): Promise<void> {
    await dbConnection.query(
      `INSERT INTO journal_entry_lines 
       (journal_entry_id, account_id, debit, credit, party_id, narration)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        journalEntryId,
        line.accountId,
        line.debit,
        line.credit,
        line.partyId || null,
        line.narration || null,
      ]
    );
  }

  /**
   * Get account by code or throw error
   * DEBUG: Helper method for common pattern
   */
  async getAccountByCode(code: string): Promise<{ id: number }> {
    const account = await this.accountRepository.findByCode(code);
    
    if (!account) {
      errorLog('AccountingService', `Account not found: ${code}`);
      throw new AccountNotFoundError(code);
    }
    
    debugLog('AccountingService', `Found account ${code} with id ${account.id}`);
    return { id: account.id };
  }

  /**
   * Create standard journal lines for sales
   * DEBUG: DEBIT Cash/AR, CREDIT Revenue, CREDIT Tax
   */
  createSalesJournalLines(
    debitAccountId: number,
    revenueAccountId: number,
    taxAccountId: number | null,
    subtotal: number,
    discountAmount: number,
    taxAmount: number,
    partyId?: number
  ): JournalLineInput[] {
    const lines: JournalLineInput[] = [];
    
    // Debit: Cash/Bank/AR
    lines.push({
      accountId: debitAccountId,
      debit: subtotal - discountAmount + taxAmount,
      credit: 0,
      partyId,
      narration: 'Sales invoice',
    });

    // Credit: Revenue
    lines.push({
      accountId: revenueAccountId,
      debit: 0,
      credit: subtotal - discountAmount,
      narration: 'Sales revenue',
    });

    // Credit: Tax (if applicable)
    if (taxAccountId && taxAmount > 0) {
      lines.push({
        accountId: taxAccountId,
        debit: 0,
        credit: taxAmount,
        narration: 'Tax on sales',
      });
    }

    debugLog('AccountingService', 'Created sales journal lines', lines);
    return lines;
  }

  /**
   * Create COGS journal lines
   * DEBUG: DEBIT COGS, CREDIT Inventory
   */
  createCOGSJournalLines(
    cogsAccountId: number,
    inventoryAccountId: number,
    cogsAmount: number
  ): JournalLineInput[] {
    const lines: JournalLineInput[] = [
      {
        accountId: cogsAccountId,
        debit: cogsAmount,
        credit: 0,
        narration: 'Cost of goods sold',
      },
      {
        accountId: inventoryAccountId,
        debit: 0,
        credit: cogsAmount,
        narration: 'Inventory reduction',
      },
    ];

    debugLog('AccountingService', 'Created COGS journal lines', lines);
    return lines;
  }

  /**
   * Create purchase journal lines
   * DEBUG: DEBIT Inventory, CREDIT AP/Cash/Bank
   */
  createPurchaseJournalLines(
    inventoryAccountId: number,
    creditAccountId: number,
    taxAccountId: number | null,
    totalAmount: number,
    taxAmount: number,
    partyId?: number
  ): JournalLineInput[] {
    const lines: JournalLineInput[] = [];

    // Debit: Inventory
    lines.push({
      accountId: inventoryAccountId,
      debit: totalAmount - taxAmount,
      credit: 0,
      narration: 'Purchase inventory',
    });

    // Credit: AP/Cash/Bank
    lines.push({
      accountId: creditAccountId,
      debit: 0,
      credit: totalAmount,
      partyId,
      narration: 'Purchase payment',
    });

    // Debit: Tax (if applicable - input tax credit)
    if (taxAccountId && taxAmount > 0) {
      lines.push({
        accountId: taxAccountId,
        debit: taxAmount,
        credit: 0,
        narration: 'Input tax credit',
      });
    }

    debugLog('AccountingService', 'Created purchase journal lines', lines);
    return lines;
  }
}

console.log('[AccountingService] Accounting service with double-entry enforcement initialized');
console.log('[AccountingService] Voucher types supported:', Object.keys(VoucherType).length);
