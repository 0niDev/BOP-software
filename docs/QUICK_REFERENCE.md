# 📋 Quick Reference - Centralized Helpers

## Import Statement
```python
from utils.helpers import (
    fetch_all_items_with_stock,
    format_currency,
    batch_insert,
    validate_required_fields
)
```

---

## 🔍 Database Queries (All Auto-Cached)

| Function | Purpose | Returns |
|----------|---------|---------|
| `fetch_all_items_with_stock(db)` | Get all items with stock qty | `List[Dict]` with `stock_qty`, `batch_count` |
| `fetch_item_by_id_with_stock(db, item_id)` | Get single item with stock | `Dict` or `None` |
| `fetch_invoices_with_customer(db, 'sales_invoices')` | Invoices + customer names | `List[Dict]` with `customer_name` |
| `fetch_party_ledger(db, party_id)` | Party transactions + balance | `List[Dict]` with `running_balance` |
| `fetch_account_balances(db)` | All account balances | `List[Dict]` with `debit`, `credit`, `balance` |

---

## 🎨 Formatting

```python
format_currency(1234.56)          # → "Rs. 1,234.56"
format_date(date.today())         # → "2025-01-15"
format_datetime(datetime.now())   # → "2025-01-15 14:30"
safe_get(data, 'key', default=0)  # → Safe dict access
```

---

## ⚡ Batch Operations (5-10x Faster)

```python
batch_insert(db, 'table', records)     # Bulk insert
batch_update(db, 'table', records)     # Bulk update
```

---

## ✅ Validation

```python
is_valid, errors = validate_required_fields(data, ['name', 'price'])
is_valid, error = validate_numeric_field(value, 'Price', min_value=0)
is_valid, error = validate_date_range(from_date, to_date)
```

---

## ⏱️ Performance Monitoring

```python
@timed_operation("Loading data")
def load_data():
    pass

with TimedBlock("Processing"):
    process()
```

---

## 🎯 Common Patterns

### Load Items with Stock
```python
items = fetch_all_items_with_stock(db)
for item in items:
    print(f"{item['name']}: {item['stock_qty']} units")
```

### Create Invoice
```python
# Validate
is_valid, errors = validate_required_fields(
    data, 
    ['customer_id', 'invoice_date', 'total_amount']
)

# Batch insert items
batch_insert(db, 'sales_invoice_items', items)
```

### Format Display
```python
label.setText(format_currency(amount))
label.setText(format_date(date_obj))
```

---

## 📖 Full Documentation

See `/workspace/CENTRALIZED_HELPERS_GUIDE.md` for complete examples.

---

**💡 Rule of Thumb:** If you're writing the same logic twice, use a helper!
