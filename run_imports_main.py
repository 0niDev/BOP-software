#!/usr/bin/env python3
"""
Threaded Import Runner for BOP ERP - PharmaPro Data Migration

Runs all import files in parallel threads while respecting dependency ordering.
Reads IMPORT_DOCUMENTATION.md for execution order and timing information.

NOTE: Import scripts are ONE-TIME migration scripts (not scheduled).
Only auto-backup runs on schedule (default: every 24 hours).

Usage:
    python run_imports_main.py                # run all phases
    python run_imports_main.py --workers 3    # parallel workers
    python run_imports_main.py --phase 1      # run only phase 1
    python run_imports_main.py --list         # list phases and scripts
    python run_imports_main.py --check        # check required CSV files
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

os.environ.setdefault("ERP_LOG_LEVEL", "CRITICAL")
os.environ.setdefault("ERP_DB_ENGINE", "sqlitecloud")

PROJECT_ROOT = Path(__file__).parent.resolve()

IMPORT_SCRIPTS = {
    "create_system_accounts.py":    {"phase": 0, "deps": [], "desc": "Create BOP system accounts"},
    "coa_import.py":               {"phase": 1, "deps": ["create_system_accounts.py"], "desc": "Chart of Accounts"},
    "import_raw_materials.py":     {"phase": 1, "deps": [], "desc": "Raw materials list"},
    "import_parties.py":           {"phase": 1, "deps": [], "desc": "83 parties"},
    "import_sales_invoices.py":    {"phase": 2, "deps": ["import_parties.py"], "desc": "289 sales invoices"},
    "import_purchase_invoices.py": {"phase": 2, "deps": ["import_parties.py"], "desc": "307 purchase invoices"},
    "import_collections.py":       {"phase": 3, "deps": ["import_parties.py", "import_sales_invoices.py"], "desc": "301 receipts"},
    "import_supplier_payments.py": {"phase": 3, "deps": ["import_parties.py", "import_purchase_invoices.py"], "desc": "Vendor payments"},
    "import_dv_expenses.py":       {"phase": 4, "deps": [], "desc": "Non-party DV expenses"},
    "import_jv_expenses.py":       {"phase": 4, "deps": [], "desc": "JV expense side"},
    "import_opening_balances.py":  {"phase": 5, "deps": ["import_parties.py"], "desc": "Party opening balances"},
    "import_cash_zeroout.py":      {"phase": 5, "deps": [], "desc": "Cash zero-out (85M)"},
    "import_fa_reconcile.py":      {"phase": 6, "deps": ["import_dv_expenses.py"], "desc": "FA reconciliation (7.1M)"},
    "import_manufacturing.py":     {"phase": 7, "deps": ["import_raw_materials.py"], "desc": "564 BOMs + 1188 orders"},
    "import_remaining_gaps.py":    {"phase": 8, "deps": ["import_parties.py", "import_sales_invoices.py", "import_purchase_invoices.py", "import_dv_expenses.py", "import_jv_expenses.py"], "desc": "Remaining gaps A+B+C+D"},
    "import_expenses_tab.py":      {"phase": 8, "deps": ["import_dv_expenses.py", "import_jv_expenses.py"], "desc": "Populate expenses tab"},
}

REQUIRED_CSV_FILES = [
    "ChartOfAccounts.csv", "Parties.csv", "Products.csv",
    "Sales.csv", "SalesBody.csv", "Purchases.csv", "PurchasesBody.csv",
    "CashCollection.csv", "CollectionBody.csv",
    "DebitVouchers.csv", "DebitVouchersBody.csv",
    "JournalVouchersBody.csv", "AccountsBalances.csv",
    "FormulaHeader.csv", "FormulaBody.csv",
    "FillingHeader.csv", "FillingBody.csv",
    "Productions.csv", "ProductionBody.csv",
    "PackingHeader.csv", "PackingBody.csv",
    "SaleReturns.csv", "SaleReturnsBody.csv",
    "Expiries.csv", "ExpiriesBody.csv", "ExpiriesBatch.csv",
]


class ImportResult:
    def __init__(self, script_name: str):
        self.script_name = script_name
        self.success = False
        self.stdout = ""
        self.stderr = ""
        self.return_code = -1
        self.elapsed_time = 0.0
        self.error_message: str | None = None


def print_banner(title: str) -> None:
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70 + "\n")


def run_import_script(script_path: Path) -> ImportResult:
    result = ImportResult(script_path.name)
    start_time = time.time()

    env = os.environ.copy()
    env["ERP_LOG_LEVEL"] = "CRITICAL"
    env["ERP_DB_ENGINE"] = "sqlitecloud"

    # Stream output in real-time
    try:
        proc = subprocess.Popen(
            [sys.executable, "-u", str(script_path)],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env,
            cwd=str(PROJECT_ROOT),
        )
        stdout_lines = []
        stderr_lines = []
        # Read stdout line by line in real-time
        while True:
            line = proc.stdout.readline()
            if not line and proc.poll() is not None:
                break
            if line:
                stdout_lines.append(line)
                # Don't print here - we're in a thread, print in the main thread
        # Read remaining stderr
        stderr_lines = proc.stderr.readlines()
        proc.wait()
        result.stdout = "".join(stdout_lines)
        result.stderr = "".join(stderr_lines)
        result.return_code = proc.returncode
        result.success = proc.returncode == 0
        if proc.returncode != 0:
            result.error_message = result.stderr or result.stdout
    except subprocess.TimeoutExpired:
        proc.kill()
        result.success = False
        result.error_message = "Timeout after 300s"
    except Exception as e:
        result.success = False
        result.error_message = str(e)

    result.elapsed_time = time.time() - start_time
    return result


def check_csv_files() -> None:
    print_banner("CSV FILE CHECK")
    export_dir = PROJECT_ROOT / "PharmaPro_FullExport"
    if not export_dir.exists():
        print(f"  FATAL: {export_dir} directory not found!")
        return
    missing = []
    for f in REQUIRED_CSV_FILES:
        path = export_dir / f
        status = "OK" if path.exists() else "MISSING"
        if not path.exists():
            missing.append(f)
        print(f"  [{status}] {f}")
    if missing:
        print(f"\n  {len(missing)} file(s) missing - imports will fail!")
    else:
        print(f"\n  All {len(REQUIRED_CSV_FILES)} required CSV files present.")


def list_phases() -> None:
    print_banner("IMPORT PHASES")
    phases: dict[int, list[tuple[str, dict]]] = {}
    for name, info in IMPORT_SCRIPTS.items():
        phases.setdefault(info["phase"], []).append((name, info))
    for phase in sorted(phases):
        print(f"  Phase {phase}:")
        for name, info in phases[phase]:
            deps = info.get("deps", [])
            dep_str = f" (deps: {', '.join(deps)})" if deps else ""
            print(f"    {name:40s} {info['desc']}{dep_str}")
        print()


def run_phase(phase: int, max_workers: int = 3) -> list[ImportResult]:
    phase_scripts = {
        name: info for name, info in IMPORT_SCRIPTS.items() if info["phase"] == phase
    }
    if not phase_scripts:
        return []

    print_banner(f"PHASE {phase} - {len(phase_scripts)} script(s)")
    for name, info in phase_scripts.items():
        deps = info.get("deps", [])
        dep_str = f" (deps: {', '.join(deps)})" if deps else ""
        print(f"  [{name}] {info['desc']}{dep_str}")
    print()

    results = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_script = {
            executor.submit(run_import_script, PROJECT_ROOT / name): name
            for name in phase_scripts
        }
        for future in as_completed(future_to_script):
            script_name = future_to_script[future]
            try:
                result = future.result()
                results.append(result)
                status = "OK" if result.success else "FAIL"
                print(f"\n  [{'='*60}]")
                print(f"  [{status}] {script_name} ({result.elapsed_time:.1f}s)")
                print(f"  [{'='*60}]")
                if result.stdout:
                    lines = result.stdout.strip().split("\n")
                    for line in lines:
                        if line.strip():
                            print(f"    {line.strip()}")
                if result.stderr and not result.success:
                    lines = result.stderr.strip().split("\n")
                    for line in lines[-10:]:
                        if line.strip():
                            print(f"    STDERR: {line.strip()}")
                if result.error_message and not result.success:
                    print(f"    ERROR: {result.error_message[:300]}")
            except Exception as e:
                result = ImportResult(script_name)
                result.success = False
                result.error_message = str(e)
                results.append(result)
                print(f"\n  [EXCEPTION] {script_name}: {e}")

    return results


def run_all(max_workers: int = 3) -> None:
    print_banner("BOP ERP - PharmaPro Data Import Runner")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Workers: {max_workers}")
    print(f"  Total phases: {len(set(info['phase'] for info in IMPORT_SCRIPTS.values()))}")
    print(f"  Total scripts: {len(IMPORT_SCRIPTS)}")

    total_start = time.time()
    all_results: list[ImportResult] = []
    completed: set[str] = set()

    phases = sorted(set(info["phase"] for info in IMPORT_SCRIPTS.values()))

    for i, phase in enumerate(phases, 1):
        elapsed = time.time() - total_start
        print(f"\n  >>> Phase {phase}/{phases[-1]} ({i}/{len(phases)}) - Elapsed: {elapsed:.0f}s <<<")

        phase_scripts = {
            name: info for name, info in IMPORT_SCRIPTS.items()
            if info["phase"] == phase and name not in completed
        }
        if not phase_scripts:
            print(f"  (all scripts already completed, skipping)")
            continue

        phase_results = run_phase(phase, max_workers)
        all_results.extend(phase_results)

        for r in phase_results:
            if r.success:
                completed.add(r.script_name)

        phase_ok = sum(1 for r in phase_results if r.success)
        phase_fail = sum(1 for r in phase_results if not r.success)
        print(f"\n  Phase {phase} complete: {phase_ok} ok, {phase_fail} failed")

        failed = [r for r in phase_results if not r.success]
        if failed:
            print(f"  WARNING: {len(failed)} script(s) failed in phase {phase}:")
            for r in failed:
                print(f"    - {r.script_name}: {(r.error_message or 'unknown')[:150]}")

    total_elapsed = time.time() - total_start

    print_banner("SUMMARY")
    succeeded = [r for r in all_results if r.success]
    failed = [r for r in all_results if not r.success]
    not_run = set(IMPORT_SCRIPTS.keys()) - completed

    print(f"  Succeeded: {len(succeeded)}/{len(all_results)}")
    print(f"  Failed:    {len(failed)}/{len(all_results)}")
    print(f"  Not run:   {len(not_run)}/{len(IMPORT_SCRIPTS)}")
    print(f"  Total time: {total_elapsed:.1f}s ({total_elapsed/60:.1f}m)")

    if succeeded:
        print(f"\n  Succeeded scripts:")
        for r in succeeded:
            print(f"    + {r.script_name:40s} {r.elapsed_time:6.1f}s")

    if failed:
        print(f"\n  Failed scripts:")
        for r in failed:
            print(f"    - {r.script_name:40s} {(r.error_message or 'unknown')[:120]}")

    if not_run:
        print(f"\n  Not run (dependency not met):")
        for name in sorted(not_run):
            info = IMPORT_SCRIPTS[name]
            print(f"    - {name} (phase {info['phase']}, deps: {', '.join(info['deps'])})")


def main() -> None:
    parser = argparse.ArgumentParser(description="BOP ERP Import Runner")
    parser.add_argument("--workers", type=int, default=3, help="Parallel workers (default: 3)")
    parser.add_argument("--phase", type=int, help="Run only a specific phase")
    parser.add_argument("--list", action="store_true", help="List phases and scripts")
    parser.add_argument("--check", action="store_true", help="Check required CSV files")
    args = parser.parse_args()

    if args.list:
        list_phases()
        return

    if args.check:
        check_csv_files()
        return

    if args.phase:
        run_phase(args.phase, args.workers)
    else:
        run_all(args.workers)


if __name__ == "__main__":
    main()
