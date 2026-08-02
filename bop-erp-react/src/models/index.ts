// Model type definitions for the ERP system
// DEBUG: Mirrors Python dataclasses with from_row() and to_dict() methods

import { AccountType } from '../enums';
import { PartyType } from '../enums';
import { ItemType } from '../enums';
import { DocumentStatus } from '../enums';
import { UserRole } from '../enums';
import { VoucherType } from '../enums';
import { ProductionStatus } from '../enums';
import { PaymentType } from '../enums';
import { BankTransactionType } from '../enums';

// ==================== MASTER DATA MODELS ====================

export interface Company {
  id: number;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  tax_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Warehouse {
  id: number;
  company_id: number;
  name: string;
  code: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Role {
  id: number;
  name: string;
  code: UserRole;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface Permission {
  id: number;
  name: string;
  code: string;
  description?: string;
  module: string;
  created_at: string;
}

export interface RolePermission {
  id: number;
  role_id: number;
  permission_id: number;
  created_at: string;
}

export interface User {
  id: number;
  username: string;
  password_hash: string;
  full_name: string;
  email?: string;
  phone?: string;
  role_id: number;
  company_id: number;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at?: string;
}

export interface Party {
  id: number;
  company_id: number;
  name: string;
  code: string;
  party_type: PartyType;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  gstin?: string;
  pan?: string;
  credit_limit?: number;
  opening_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ItemCategory {
  id: number;
  company_id: number;
  name: string;
  code: string;
  parent_category_id?: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Item {
  id: number;
  company_id: number;
  name: string;
  code: string;
  item_type: ItemType;
  category_id?: number;
  unit_of_measure: string;
  purchase_price: number;
  sales_price: number;
  mrp: number;
  gst_rate: number;
  reorder_level: number;
  max_stock_level: number;
  is_batch_required: boolean;
  is_expiry_required: boolean;
  shelf_life_days?: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface StockBatch {
  id: number;
  company_id: number;
  warehouse_id: number;
  item_id: number;
  batch_number: string;
  quantity_in_stock: number;
  purchase_price: number;
  sales_price: number;
  mfg_date?: string;
  expiry_date?: string;
  created_at: string;
  updated_at?: string;
}

export interface Account {
  id: number;
  company_id: number;
  name: string;
  code: string;
  account_type: AccountType;
  parent_account_id?: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// ==================== TRANSACTION MODELS ====================

export interface JournalEntry {
  id: number;
  company_id: number;
  voucher_type: VoucherType;
  voucher_number: string;
  date: string;
  narration?: string;
  status: DocumentStatus;
  source_table?: string;
  source_id?: number;
  created_by: number;
  created_at: string;
  updated_at?: string;
}

export interface JournalEntryLine {
  id: number;
  journal_entry_id: number;
  account_id: number;
  debit: number;
  credit: number;
  party_id?: number;
  narration?: string;
  created_at: string;
}

export interface SalesInvoice {
  id: number;
  company_id: number;
  invoice_number: string;
  party_id: number;
  warehouse_id: number;
  date: string;
  due_date?: string;
  payment_type: PaymentType;
  bank_account_id?: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  status: DocumentStatus;
  narration?: string;
  created_by: number;
  created_at: string;
  updated_at?: string;
}

export interface SalesInvoiceItem {
  id: number;
  invoice_id: number;
  item_id: number;
  batch_id?: number;
  quantity: number;
  rate: number;
  amount: number;
  gst_rate: number;
  gst_amount: number;
  discount_percent: number;
  discount_amount: number;
  cogs_amount: number;
  created_at: string;
}

export interface PurchaseInvoice {
  id: number;
  company_id: number;
  invoice_number: string;
  party_id: number;
  warehouse_id: number;
  date: string;
  due_date?: string;
  payment_type: PaymentType;
  bank_account_id?: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  status: DocumentStatus;
  narration?: string;
  created_by: number;
  created_at: string;
  updated_at?: string;
}

export interface PurchaseInvoiceItem {
  id: number;
  invoice_id: number;
  item_id: number;
  batch_id?: number;
  quantity: number;
  rate: number;
  amount: number;
  gst_rate: number;
  gst_amount: number;
  discount_percent: number;
  discount_amount: number;
  batch_number?: string;
  mfg_date?: string;
  expiry_date?: string;
  created_at: string;
}

export interface Payment {
  id: number;
  company_id: number;
  payment_number: string;
  party_id: number;
  date: string;
  amount: number;
  payment_type: PaymentType;
  bank_account_id?: number;
  reference_number?: string;
  narration?: string;
  source_invoice_id?: number;
  status: DocumentStatus;
  created_by: number;
  created_at: string;
  updated_at?: string;
}

export interface PaymentAllocation {
  id: number;
  payment_id: number;
  invoice_id: number;
  invoice_type: 'sales' | 'purchase';
  allocated_amount: number;
  created_at: string;
}

export interface Receipt {
  id: number;
  company_id: number;
  receipt_number: string;
  party_id: number;
  date: string;
  amount: number;
  payment_type: PaymentType;
  bank_account_id?: number;
  reference_number?: string;
  narration?: string;
  source_invoice_id?: number;
  status: DocumentStatus;
  created_by: number;
  created_at: string;
  updated_at?: string;
}

export interface ReceiptAllocation {
  id: number;
  receipt_id: number;
  invoice_id: number;
  allocated_amount: number;
  created_at: string;
}

export interface ProductionOrder {
  id: number;
  company_id: number;
  order_number: string;
  bom_id: number;
  warehouse_id: number;
  planned_quantity: number;
  actual_quantity?: number;
  status: ProductionStatus;
  start_date?: string;
  completion_date?: string;
  notes?: string;
  created_by: number;
  created_at: string;
  updated_at?: string;
}

export interface ProductionConsumption {
  id: number;
  production_order_id: number;
  item_id: number;
  batch_id?: number;
  required_quantity: number;
  consumed_quantity: number;
  wastage_quantity: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
}

export interface BillOfMaterial {
  id: number;
  company_id: number;
  finished_item_id: number;
  output_quantity: number;
  version: number;
  is_active: boolean;
  created_by: number;
  created_at: string;
  updated_at?: string;
}

export interface BOMComponent {
  id: number;
  bom_id: number;
  item_id: number;
  qty: number;
  wastage_percent: number;
  unit_cost: number;
  created_at: string;
}

export interface BankAccount {
  id: number;
  company_id: number;
  name: string;
  bank_name: string;
  account_number: string;
  ifsc_code?: string;
  branch?: string;
  account_type?: string;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface BankTransaction {
  id: number;
  company_id: number;
  bank_account_id: number;
  transaction_type: BankTransactionType;
  amount: number;
  date: string;
  reference_number?: string;
  narration?: string;
  source_table?: string;
  source_id?: number;
  created_by: number;
  created_at: string;
}

export interface Expense {
  id: number;
  company_id: number;
  expense_number: string;
  category_id: number;
  date: string;
  amount: number;
  payment_type: PaymentType;
  bank_account_id?: number;
  party_id?: number;
  narration?: string;
  reference_number?: string;
  status: DocumentStatus;
  created_by: number;
  created_at: string;
  updated_at?: string;
}

export interface ExpenseCategory {
  id: number;
  company_id: number;
  name: string;
  code: string;
  account_id?: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface StockMovement {
  id: number;
  company_id: number;
  warehouse_id: number;
  item_id: number;
  batch_id?: number;
  movement_type: string;
  quantity: number;
  balance_after: number;
  reference_type?: string;
  reference_id?: number;
  narration?: string;
  created_by: number;
  created_at: string;
}

export interface AuditLog {
  id: number;
  company_id: number;
  table_name: string;
  record_id: number;
  action: string;
  old_values?: string;
  new_values?: string;
  user_id: number;
  created_at: string;
}

export interface NumberingSequence {
  id: number;
  company_id: number;
  document_type: VoucherType;
  prefix: string;
  suffix: string;
  next_number: number;
  min_digits: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Convert database row to model object
 * DEBUG: Used by all repositories for consistent data transformation
 */
export function fromRow<T>(row: any): T {
  if (!row) {
    throw new Error('Cannot convert null/undefined row to model');
  }
  return row as T;
}

/**
 * Convert model object to database insert/update object
 * DEBUG: Removes computed fields and ensures proper formatting
 */
export function toDict<T extends Record<string, any>>(model: T): Partial<T> {
  const dict = { ...model };
  // Remove undefined values for cleaner SQL
  Object.keys(dict).forEach(key => {
    if (dict[key] === undefined) {
      delete dict[key];
    }
  });
  return dict;
}

console.log('[Models] All model interfaces defined');
console.log('[Models] Master data models:', 11);
console.log('[Models] Transaction models:', 13);
