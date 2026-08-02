# BOP Nutraceuticals ERP - TypeScript + React

A complete Enterprise Resource Planning system rebuilt from Python/PySide6 to TypeScript + React with SQLiteCloud database integration.

## 📋 Project Overview

This is a full-featured ERP system for nutraceutical manufacturing with:
- **Sales Management** - Invoices, customers, returns
- **Purchase Management** - Supplier invoices, procurement
- **Manufacturing** - Production orders, BOM, material consumption
- **Accounting** - Double-entry bookkeeping, journal entries, financial reports
- **Inventory** - Batch-wise tracking, stock movements, warehousing
- **Banking** - Bank accounts, transactions, reconciliation
- **Reports** - Trial Balance, P&L, Balance Sheet, Party Ledger

## 🏗️ Architecture

```
src/
├── config/          # Configuration, constants, environment variables
├── context/         # React context providers (Auth, Theme, etc.)
├── controllers/     # Business logic controllers
├── enums/           # TypeScript enums (AccountType, VoucherType, etc.)
├── hooks/           # Custom React hooks
├── models/          # Data interfaces and types
├── repositories/    # Database access layer with caching
├── reports/         # Report generation services
├── services/        # Business logic services
├── utils/           # Utility functions (database connection, helpers)
├── views/           # React components (LoginView, MainWindow, etc.)
├── App.tsx          # Main application component
├── App.css          # Application styles
└── main.tsx         # Entry point
```

## 🔧 Technology Stack

- **Frontend**: React 19 + TypeScript
- **Build Tool**: Vite
- **Database**: SQLiteCloud (cloud-hosted SQLite)
- **Styling**: CSS3 with CSS Variables
- **Icons**: Lucide React
- **Date Handling**: date-fns
- **Routing**: React Router DOM

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
cd bop-erp-react
npm install
```

### Development

```bash
npm run dev
```

The application will start at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## 🔐 Default Credentials

```
Username: admin
Password: admin123
```

## 📊 Database Schema

The system uses 24 core tables including companies, warehouses, roles, permissions, users, parties, items, stock_batches, accounts, journal_entries, sales_invoices, purchase_invoices, payments, receipts, production_orders, bill_of_materials, bank_accounts, expenses, stock_movements, audit_log, and numbering_sequences.

## 🔑 Key Features

### Authentication & Authorization
- PBKDF2-HMAC-SHA256 password hashing (200k iterations)
- Role-based access control (RBAC)
- 6 predefined roles: Admin, Manager, Accountant, Sales, Warehouse, Operator
- Granular permissions per module

### Accounting Engine
- Double-entry bookkeeping enforcement
- Automatic journal entry generation
- Gap-free voucher numbering
- COGS calculation on sales

### Inventory Management
- FIFO batch tracking
- Expiry date management
- Real-time stock validation
- Negative stock prevention

### Manufacturing
- Bill of Materials (BOM)
- Production order tracking
- Material consumption with wastage
- Finished goods receipt

## ⚙️ Configuration

Database connection and account codes are configured in `src/config/index.ts`.

## 📝 Debug Logging

Extensive debug logging throughout the application. Check browser console for detailed logs.

## 🛡️ Data Integrity

1. Double-Entry Enforcement - All journal entries must balance
2. Transaction Atomicity - Related operations wrapped in database transactions
3. Cache Invalidation - 30-second TTL cache, invalidated on writes
4. Audit Trail - All changes logged

---

**Built with TypeScript + React + SQLiteCloud**
