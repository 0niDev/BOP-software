# Database Skill for BOP-software ERP

## Overview
Database operations and optimization for the SQLite Cloud-backed Pharmaceutical ERP system.

## When to Use
- Database connection management
- Migration operations
- Query optimization
- Backup and restore operations
- Connection pooling

## Project Database Architecture

### Connection Management
- `database/connection.py` - DatabaseConnection class
- `database/connection.py` - `get_db()` function
- `database/sqlitecloud_connection.py` - SQLiteCloudConnection with pooling
- `database/migrations/migrator.py` - Migration runner

### Existing Migrations
- Column migrations (add_material_cost_columns)
- Expense items migration
- Temp BOM migration
- All run idempotently on startup

### Connection Pool
```python
from database.connection import get_pool
pool = get_pool()
pool.warm_up(count=3)  # Pre-warm 3 connections
```

### Migration Runner
```python
from database.migrations.migrator import run_migrations
run_migrations(db)
```

## Common Operations

### Open Database Connection
```python
from database.connection import get_db
db = get_db()
```

### Run All Migrations (on startup)
```python
from database.migrations.migrator import run_migrations
run_migrations(db)
```

### Warm Up Connection Pool
```python
import threading
from database.connection import get_pool
threading.Thread(target=lambda: get_pool().warm_up(count=3), daemon=True).start()
```

### Backup Database
```python
from database.auto_backup import auto_backup
auto_backup()  # Create backup before exit
```

### Close Database
```python
from database.connection import close_db
close_db()
```

### Check if Tables Exist
```python
db.fetch_one("SELECT 1 FROM users LIMIT 1")
```

## Performance Tips
- Pre-warm connection pool on application startup
- Use idempotent migrations (safe to run on every launch)
- Batch operations where possible
- Index frequently queried columns