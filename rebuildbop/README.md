# rebuildbop

Pharmaceutical ERP & Accounting System - Rebuilt for SQLite Cloud

## Overview

This is a complete rebuild of the Pharmaceutical ERP system, optimized from the ground up for SQLite Cloud with network latency (50-200ms) in mind.

## Key Improvements

### Performance Optimizations

1. **Connection Pooling**: 10-50 connections with health checking and automatic recycling
2. **Batch Operations**: Reduce round-trips by 80%+ with bulk INSERT/UPDATE/DELETE
3. **Multi-level Caching**: L1 (memory) + L2 (disk) caching with write-through invalidation
4. **Async UI**: All database operations run in background threads
5. **Query Optimization**: Prepared statement caching and slow query detection

### Architecture

- **Database Layer**: Connection pool, transaction manager with savepoints and retry logic
- **Repository Layer**: Base repository with batch operations, caching, pagination
- **Service Layer**: Business logic with batch processing and lazy loading
- **Controller Layer**: Async/await pattern with error handling and retry logic
- **View Layer**: Progressive rendering, skeleton screens, loading indicators

## Setup Instructions

### Prerequisites

- Python 3.9 or higher
- SQLite Cloud account and connection URL
- PySide6 for GUI

### Installation

1. **Install dependencies:**

```bash
cd rebuildbop
pip install -r requirements.txt
```

2. **Configure SQLite Cloud:**

Set the `SQLITE_CLOUD_URL` environment variable:

```bash
export SQLITE_CLOUD_URL="sqlitecloud://user:password@host:port/database"
```

Or edit `src/config/app_config.py` to set it directly.

3. **Initialize the database:**

```bash
python src/main.py --init-db
```

### Configuration

Edit `src/config/app_config.py` to customize:

- Database connection pool size (default: min=10, max=50)
- Cache settings (L1/L2 enabled, TTL values)
- Performance thresholds (slow query detection, batch sizes)
- Logging levels

## Project Structure

```
rebuildbop/
├── src/
│   ├── config/           # Application configuration
│   │   ├── __init__.py
│   │   └── app_config.py
│   ├── database/         # Database layer
│   │   ├── __init__.py
│   │   ├── connection.py
│   │   ├── connection_pool.py
│   │   └── transaction_manager.py
│   ├── models/           # Data models
│   │   └── __init__.py
│   ├── repositories/     # Data access layer
│   │   ├── __init__.py
│   │   └── base_repository.py
│   ├── services/         # Business logic layer
│   ├── controllers/      # Application controllers
│   ├── views/            # PySide6 UI components
│   ├── utils/            # Utilities (logging, cache, exceptions)
│   │   ├── __init__.py
│   │   ├── cache_manager.py
│   │   ├── exceptions.py
│   │   └── logger.py
│   └── main.py           # Application entry point
├── tests/                # Test suite
├── docs/                 # Documentation
│   ├── analysis.md       # Analysis of old system
│   └── architecture.md   # Architecture documentation
├── requirements.txt      # Python dependencies
└── README.md            # This file
```

## Running the Application

```bash
cd rebuildbop
python src/main.py
```

## Running Tests

```bash
cd rebuildbop
pytest tests/ -v --cov=src
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SQLITE_CLOUD_URL` | SQLite Cloud connection URL | Required |
| `ERP_DB_ENGINE` | Database engine | `sqlitecloud` |
| `ERP_DB_POOL_MIN` | Minimum pool connections | `10` |
| `ERP_DB_POOL_MAX` | Maximum pool connections | `50` |
| `ERP_DB_POOL_TIMEOUT` | Connection timeout (seconds) | `30` |
| `ERP_DB_QUERY_TIMEOUT` | Query timeout (seconds) | `60` |
| `ERP_DB_RETRY_ATTEMPTS` | Retry attempts on failure | `3` |
| `ERP_DB_SLOW_QUERY_MS` | Slow query threshold (ms) | `100` |
| `ERP_LOG_LEVEL` | Logging level | `INFO` |

## Performance Targets

| Operation | Target Time |
|-----------|-------------|
| Load Chart of Accounts | <500ms |
| Create Sales Invoice | <1s |
| Load Party Ledger | <1s |
| Generate Balance Sheet | <2s |
| Dashboard Load | <1s |

## Troubleshooting

### Connection Issues

If you see "SQLITE_CLOUD_URL not set":
- Set the environment variable before running
- Check that the URL format is correct: `sqlitecloud://user:pass@host:port/dbname`

### Slow Queries

Check logs for "Slow query detected" messages. Consider:
- Adding indexes for frequently queried columns
- Increasing connection pool size
- Checking network latency to SQLite Cloud server

### Cache Issues

To clear all caches:
```python
from utils.cache_manager import get_cache_manager
cache = get_cache_manager()
cache.clear_all()
```

## License

Proprietary - BOP Nutraceuticals

## Support

For issues and questions, contact the development team.
