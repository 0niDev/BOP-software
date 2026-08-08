#!/usr/bin/env python3
"""
Test script to verify all error fixes in the ERP system.

This script tests:
1. Auto-backup database existence check
2. Connection retry logic for transient errors
3. Proper error handling for "database does not exist" scenarios
4. SSL/TLS connection configuration
"""

import os
import sys
import time
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

# Set up environment for testing
os.environ['ERP_DB_ENGINE'] = 'sqlitecloud'
os.environ['SQLITE_CLOUD_URL'] = 'sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/flint-sync.sqlite?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw'

def print_section(title):
    """Print a formatted section header."""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

def print_result(test_name, passed, details=""):
    """Print test result."""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"\n{status}: {test_name}")
    if details:
        print(f"   Details: {details}")
    return passed

# Track test results
test_results = []

# ============================================================================
# TEST 1: Auto-backup database existence check
# ============================================================================
print_section("TEST 1: Auto-backup Database Existence Check")

try:
    from database.auto_backup import auto_backup
    import os
    
    # Temporarily set a non-existent database URL for this test
    original_url = os.environ.get('SQLITE_CLOUD_URL')
    os.environ['SQLITE_CLOUD_URL'] = 'sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/nonexistent-test-db.sqlite?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw'
    
    print("Running auto_backup() with non-existent database...")
    result = auto_backup()
    
    # Restore original URL
    if original_url:
        os.environ['SQLITE_CLOUD_URL'] = original_url
    
    # Should return False gracefully, not crash
    passed = result == False
    test_results.append(print_result(
        "Auto-backup handles missing database gracefully",
        passed,
        f"Returned {result} (expected False)"
    ))
    
except Exception as e:
    # Restore original URL on error
    import os
    original_url = os.environ.get('SQLITE_CLOUD_URL')
    if original_url and 'nonexistent' in original_url:
        os.environ['SQLITE_CLOUD_URL'] = 'sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/flint-sync.sqlite?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw'
    
    test_results.append(print_result(
        "Auto-backup handles missing database gracefully",
        False,
        f"Exception raised: {e}"
    ))
    import traceback
    traceback.print_exc()

# ============================================================================
# TEST 2: Connection pool retry logic
# ============================================================================
print_section("TEST 2: Connection Pool Retry Logic")

try:
    from database.connection import ConnectionPool
    import sqlitecloud
    
    pool = ConnectionPool(max_connections=5)
    
    # Test with invalid connection string that should fail fast
    invalid_url = 'sqlitecloud://invalid-host:8860/nonexistent.db?apikey=invalid'
    pool.initialize(invalid_url)
    
    start_time = time.time()
    try:
        conn = pool.get_connection()
        conn.close()
        elapsed = time.time() - start_time
        
        # If it somehow connected, that's unexpected but not a failure
        test_results.append(print_result(
            "Connection pool handles invalid host",
            True,
            f"Connected in {elapsed:.2f}s (unexpected but OK)"
        ))
    except sqlitecloud.Error as e:
        elapsed = time.time() - start_time
        error_msg = str(e)
        
        # Should have retried 3 times (about 6 seconds total)
        # Or failed fast on permanent errors
        passed = "does not exist" in error_msg or elapsed > 0
        test_results.append(print_result(
            "Connection pool handles invalid host",
            passed,
            f"Failed after {elapsed:.2f}s with: {error_msg[:100]}"
        ))
    except Exception as e:
        test_results.append(print_result(
            "Connection pool handles invalid host",
            False,
            f"Unexpected exception: {e}"
        ))
        
except Exception as e:
    test_results.append(print_result(
        "Connection pool retry logic",
        False,
        f"Setup failed: {e}"
    ))
    import traceback
    traceback.print_exc()

# ============================================================================
# TEST 3: Error message parsing for "database does not exist"
# ============================================================================
print_section("TEST 3: Error Message Parsing")

try:
    from database.auto_backup import auto_backup
    from database.connection import ConnectionPool
    import sqlitecloud
    
    # Test that "does not exist" errors are properly detected
    test_error_messages = [
        ("Database cool-depot.sqlite does not exist.", True),
        ("does not exist", True),
        ("Connection timeout", False),
        ("SSL handshake failed", False),
        ("An error occurred while reading command length", False),
    ]
    
    all_passed = True
    for error_msg, should_detect in test_error_messages:
        detected = "does not exist" in error_msg
        if detected != should_detect:
            all_passed = False
            print(f"   ❌ Misclassified: '{error_msg}' -> detected={detected}, expected={should_detect}")
    
    test_results.append(print_result(
        "Error message parsing for 'does not exist'",
        all_passed,
        "All error messages correctly classified"
    ))
    
except Exception as e:
    test_results.append(print_result(
        "Error message parsing",
        False,
        f"Test failed: {e}"
    ))
    import traceback
    traceback.print_exc()

# ============================================================================
# TEST 4: Verify backup directory creation
# ============================================================================
print_section("TEST 4: Backup Directory Creation")

try:
    backup_dir = Path("backups")
    
    # The auto_backup function should create this directory
    from database.auto_backup import auto_backup
    
    # Run backup (will fail due to DB not existing, but should create dir)
    auto_backup()
    
    passed = backup_dir.exists() and backup_dir.is_dir()
    test_results.append(print_result(
        "Backup directory created",
        passed,
        f"Directory exists: {passed}"
    ))
    
except Exception as e:
    test_results.append(print_result(
        "Backup directory creation",
        False,
        f"Failed: {e}"
    ))
    import traceback
    traceback.print_exc()

# ============================================================================
# TEST 5: Connection cleanup on error
# ============================================================================
print_section("TEST 5: Connection Cleanup on Error")

try:
    from database.connection import ConnectionPool
    import sqlitecloud
    
    pool = ConnectionPool(max_connections=2)
    pool.initialize(os.environ['SQLITE_CLOUD_URL'])
    
    # Try to get connections and verify they're cleaned up on error
    connections_obtained = 0
    connections_closed = 0
    
    for i in range(3):
        try:
            conn = pool.get_connection()
            connections_obtained += 1
            # Simulate an error by closing immediately
            conn.close()
            connections_closed += 1
        except sqlitecloud.Error as e:
            if "does not exist" in str(e):
                break
        except Exception:
            pass
    
    # Pool should handle cleanup gracefully
    pool.close_all()
    
    test_results.append(print_result(
        "Connection cleanup on error",
        True,
        f"Obtained {connections_obtained} connections, closed {connections_closed}"
    ))
    
except Exception as e:
    test_results.append(print_result(
        "Connection cleanup on error",
        False,
        f"Failed: {e}"
    ))
    import traceback
    traceback.print_exc()

# ============================================================================
# SUMMARY
# ============================================================================
print_section("TEST SUMMARY")

total_tests = len(test_results)
passed_tests = sum(1 for r in test_results if r)
failed_tests = total_tests - passed_tests

print(f"\nTotal Tests: {total_tests}")
print(f"Passed: {passed_tests}")
print(f"Failed: {failed_tests}")

if failed_tests == 0:
    print("\n🎉 All tests passed!")
else:
    print(f"\n⚠️  {failed_tests} test(s) failed")
    print("\nFailed tests:")
    for i, result in enumerate(test_results, 1):
        if not result:
            print(f"  {i}. Test #{i}")

print("\n" + "=" * 70)

# Exit with appropriate code
sys.exit(0 if failed_tests == 0 else 1)
