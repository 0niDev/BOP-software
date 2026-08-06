"""
Run all tests for BOP Pharmaceutical ERP.

Usage:
    python run_tests.py           # Run all tests
    python run_tests.py -v        # Verbose output
    python run_tests.py --cov     # With coverage report
"""
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(__file__))

# Set environment variables
os.environ['ERP_DB_ENGINE'] = 'sqlitecloud'
os.environ['SQLITE_CLOUD_URL'] = 'sqlitecloud://cjja8z6pvz.g4.sqlite.cloud:8860/cool-depot.sqlite?apikey=bmJZ0l1RTFCoxS0Au17c0iofzZmrDn2Db94v0YtV9Uw'


def run_tests():
    """Run pytest on the tests directory."""
    import pytest
    
    # Build test arguments
    args = ['tests/', '-x']  # -x stops on first failure
    
    # Check for command line arguments
    if len(sys.argv) > 1:
        if '-v' in sys.argv or '--verbose' in sys.argv:
            args.append('-v')
        if '--cov' in sys.argv:
            args.extend(['--cov=.', '--cov-report=term-missing'])
        if '-k' in sys.argv:
            # Pass through filter argument
            try:
                k_index = sys.argv.index('-k')
                args.append('-k')
                args.append(sys.argv[k_index + 1])
            except (ValueError, IndexError):
                pass
    
    print("=" * 60)
    print("BOP Pharmaceutical ERP - Test Suite")
    print("=" * 60)
    print(f"Running tests with arguments: {' '.join(args)}")
    print("=" * 60)
    
    # Run pytest
    exit_code = pytest.main(args)
    
    print("\n" + "=" * 60)
    if exit_code == 0:
        print("✅ All tests passed!")
    else:
        print(f"❌ Tests failed with exit code {exit_code}")
    print("=" * 60)
    
    return exit_code


if __name__ == '__main__':
    sys.exit(run_tests())
