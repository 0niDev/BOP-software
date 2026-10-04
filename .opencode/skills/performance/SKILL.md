# Performance Skill for BOP-software ERP

## Overview
Performance optimization and profiling for the Pharmaceutical ERP system. Focuses on report generation, database queries, and UI responsiveness.

## When to Use
- Optimizing financial report generation
- Improving database query performance
- Reducing UI lag in large datasets
- Memory optimization
- Startup performance

## Project Performance Areas

### Report Optimization
- Trial Balance reports (`reports/trial_balance_report.py`)
- Profit & Loss reports (`reports/profit_loss_report.py`)
- Balance Sheet reports (`reports/balance_sheet_report.py`)
- Party Ledger reports (`reports/party_ledger_report.py`)
- Cash Book reports (`reports/cash_book_report.py`)

### Database Performance
- Connection pool warming (3 pre-warmed connections)
- Idempotent migrations (run on every startup)
- Efficient query patterns in repositories

### UI Performance
- PySide6 dark theme rendering
- Lazy data loading in MainWindow
- Batch operations vs. individual queries

## Optimization Techniques

### Connection Pool Warm-up
```python
import threading
from database.connection import get_pool
threading.Thread(target=lambda: get_pool().warm_up(count=3), daemon=True).start()
```

### Report Caching
- Consider caching frequently accessed reports
- Use database indexes on frequently filtered columns
- Batch read operations instead of individual queries

### Startup Optimization
- Run migrations idempotently (safe on every launch)
- Pre-warm connections before UI shows
- Lazy-load data after window is displayed

### Memory Management
- Close database connections on exit
- Use auto-backup before shutdown
- Avoid holding references to large datasets

## Monitoring Performance

### Check Report Generation Time
```python
import time
start = time.time()
# ... generate report ...
elapsed = time.time() - start
print(f"Report generated in {elapsed:.2f}s")
```

### Profile Database Queries
```python
# Enable query logging or use EXPLAIN
db.fetch_one("EXPLAIN SELECT * FROM invoices WHERE date > ?", (date,))
```

## Skill Commands
```bash
# Run performance-related diagnostics
python diag_*.py

# Check database optimization
python probe_schema.py

# Review optimization summaries
cat docs/OPTIMIZATION_SUMMARY.md
cat docs/PERFORMANCE_OPTIMIZATIONS.md
```