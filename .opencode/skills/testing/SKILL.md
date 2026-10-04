# Testing Skill for BOP-software ERP

## Overview
Provides testing capabilities for the Pharmaceutical ERP system including pytest integration, GUI testing, and workflow validation.

## When to Use
- Writing new unit tests for controllers, services, models, or repositories
- Running pytest test suites
- Debugging GUI issues with pytest-qt
- Integration test workflows

## Usage Examples

### Run all tests
```bash
pytest
```

### Run GUI-specific tests
```bash
pytest -m qt
```

### Run specific test file
```bash
pytest tests/test_invoice.py -v
```

### Run with verbose output
```bash
pytest --tb=short --co
```

## Project-specific Tests
This project already has these test files:
- `tests/test_accounting.py` - Chart of accounts tests
- `tests/test_items.py` - Inventory/item management tests
- `tests/test_sales_purchase.py` - Sales and purchase invoice tests
- `tests/test_manufacturing.py` - Manufacturing/BOM tests
- `tests/test_parties.py` - Party/customer/supplier tests
- `tests/test_expenses.py` - Expense tracking tests
- `tests/test_payments.py` - Payment processing tests
- `tests/test_base_repository.py` - Repository base tests
- `tests/test_base_repository.py` - Base repository tests
- `tests/test_auth_users.py` - Authentication user tests
- `tests/test_banking.py` - Banking/tests
- `tests/test_settings.py` - Settings tests
- `tests/helpers/` - Test helper utilities
- `tests/conftest.py` - Test fixtures and configuration
- `tests/integration_workflows.py` - End-to-end workflow tests

## Adding New Tests
1. Create test file in `tests/` directory
2. Follow existing patterns from `tests/conftest.py`
3. Use pytest fixtures from `tests/helpers/`
4. Run `pytest` to verify

## Skill Commands
```bash
# Run full test suite
pytest

# Run with coverage
pytest --cov=.

# Run specific module
pytest tests/test_accounting.py
```