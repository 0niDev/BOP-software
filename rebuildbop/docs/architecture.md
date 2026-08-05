# Architecture Documentation

## System Overview

The rebuilt Pharmaceutical ERP system follows a layered architecture optimized for SQLite Cloud with network latency considerations.

```
┌─────────────────────────────────────────────────────────────┐
│                      Presentation Layer                      │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
│  │   Login   │  │ Main Win  │  │  Widgets  │  │ Dialogs  │ │
│  └───────────┘  └───────────┘  └───────────┘  └──────────┘ │
├─────────────────────────────────────────────────────────────┤
│                     Controller Layer                         │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
│  │   Auth    │  │  Account  │  │   Party   │  │  Report  │ │
│  └───────────┘  └───────────┘  └───────────┘  └──────────┘ │
├─────────────────────────────────────────────────────────────┤
│                       Service Layer                          │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
│  │  Account  │  │  Invoice  │  │  Payment  │  │ Banking  │ │
│  └───────────┘  └───────────┘  └───────────┘  └──────────┘ │
├─────────────────────────────────────────────────────────────┤
│                     Repository Layer                         │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
│  │   Base    │  │  Account  │  │   Party   │  │   Item   │ │
│  └───────────┘  └───────────┘  └───────────┘  └──────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      Database Layer                          │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
│  │Connection │  │Pool (10-50)│  │Transaction│  │  Cache   │ │
│  └───────────┘  └───────────┘  └───────────┘  └──────────┘ │
├─────────────────────────────────────────────────────────────┤
│                    SQLite Cloud (Network)                    │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Read Operation (Optimized)

```
View → Controller → Service → Repository → Cache Check
                                          ↓ (miss)
                                    Connection Pool
                                          ↓
                                    SQLite Cloud
                                          ↓
                                    Cache Store (L1→L2)
                                          ↓
                                    Repository ← Service ← Controller ← View
```

### Write Operation (With Transaction)

```
View → Controller → Service → Begin Transaction
                                 ↓
                            Repository (Batch Operations)
                                 ↓
                            Connection Pool
                                 ↓
                            SQLite Cloud
                                 ↓
                            Commit/Rollback
                                 ↓
                            Cache Invalidate
                                 ↓
                            Service ← Controller ← View
```

## Component Responsibilities

### Database Layer

**Connection Pool (`connection_pool.py`)**
- Manages 10-50 connections
- Health checking and automatic recycling
- Statistics tracking

**Transaction Manager (`transaction_manager.py`)**
- Savepoints for nested transactions
- Automatic retry with exponential backoff
- Timeout enforcement

**Cache Manager (`cache_manager.py`)**
- L1: In-memory LRU cache (microseconds)
- L2: Disk-based SQLite cache (milliseconds)
- Write-through invalidation

### Repository Layer

**Base Repository (`base_repository.py`)**
- Batch operations (find_by_ids, insert_batch, update_batch, delete_batch)
- Pagination support
- Relation loading (eager/lazy)
- Caching integration

### Service Layer

- Business logic implementation
- Batch processing for bulk operations
- Lazy loading of related data
- Validation rules

### Controller Layer

- Async/await pattern for UI responsiveness
- Error handling with retry logic
- Loading state management
- Request deduplication

### View Layer

- QThread for background operations
- Progressive rendering for large datasets
- Skeleton screens during loading
- Virtual scrolling for lists

## Performance Optimizations

### Network Latency Mitigation

| Strategy | Implementation | Impact |
|----------|----------------|--------|
| Connection Pooling | 10 warm connections ready | Eliminates connection overhead |
| Batch Operations | IN clauses, executemany | Reduces round-trips by 80%+ |
| Caching | L1/L2 with write-through | 90%+ hit rate for reads |
| Prepared Statements | Query caching | Faster repeated queries |
| Compression | SQLite Cloud built-in | Reduced bandwidth |

### Query Optimization

```sql
-- Before: N queries for N items
SELECT * FROM items WHERE id = ?  -- Called N times

-- After: Single batch query
SELECT * FROM items WHERE id IN (?, ?, ?, ...)  -- Called once
```

### Caching Strategy

| Data Type | Cache Level | TTL | Invalidation |
|-----------|-------------|-----|--------------|
| Accounts | L1 + L2 | 60s | On write |
| Parties | L1 + L2 | 60s | On write |
| Items | L1 + L2 | 60s | On write |
| Invoices | L1 only | 30s | On write |
| Reports | L1 + L2 | 300s | Manual |

## Concurrency Model

```
┌─────────────────────────────────────────────────────────┐
│                    Main Thread (UI)                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Event Loop (PySide6)                 │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         ↕ Signals/Slots
┌─────────────────────────────────────────────────────────┐
│                   Worker Threads                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Thread 1 │  │ Thread 2 │  │ Thread 3 │  │ ...    │  │
│  │   DB     │  │   DB     │  │   DB     │  │        │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
└─────────────────────────────────────────────────────────┘
         ↕ Connection Pool (Thread-safe)
┌─────────────────────────────────────────────────────────┐
│                  SQLite Cloud                            │
└─────────────────────────────────────────────────────────┘
```

## Error Handling

### Retry Logic

```python
# Exponential backoff with jitter
delay = min(base_delay * (2 ** attempt), max_delay)
jitter = delay * 0.1 * (random() * 2 - 1)
final_delay = delay + jitter
```

### Transaction Rollback

All write operations are wrapped in transactions:
- Automatic rollback on any exception
- Savepoints for nested operations
- Connection returned to pool in clean state

## Security Considerations

- SQL injection prevention via parameterized queries
- Password hashing with salt (bcrypt)
- Role-based access control
- Audit logging for all write operations

## Monitoring & Logging

### Slow Query Detection

Queries exceeding 100ms are logged with:
- SQL statement (truncated)
- Execution time
- Parameters (sanitized)

### Statistics Tracking

- Connection pool usage
- Cache hit/miss rates
- Transaction counts
- Query execution times

## Deployment Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Client PC 1   │     │   Client PC N   │
│  (rebuildbop)   │     │  (rebuildbop)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │   SQLite Cloud Host   │
         │   (Multi-region)      │
         └───────────────────────┘
```

## Future Enhancements

1. **L3 Cache**: Redis for distributed caching across nodes
2. **Read Replicas**: SQLite Cloud read replicas for reporting
3. **Async I/O**: Full asyncio integration for non-blocking operations
4. **GraphQL API**: Optional REST/GraphQL API for integrations
5. **Offline Mode**: Local SQLite with sync to cloud
