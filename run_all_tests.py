#!/usr/bin/env python3
"""Run the full BOP test suite from one command.

Usage:
    python run_all_tests.py            # run everything, fastest config
    python run_all_tests.py -v         # verbose
    python run_all_tests.py --no-gui   # skip GUI tests (headless CI w/o Qt/DB)

Exit code is 0 if and only if every test passes.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main() -> int:
    args = sys.argv[1:]
    cmd = [sys.executable, "-m", "pytest", "-q", str(ROOT / "tests")]

    if "--no-gui" in args:
        cmd.append("-m")
        cmd.append("not gui")
        args = [a for a in args if a != "--no-gui"]

    cmd.extend(args)

    print("Running:", " ".join(cmd))
    print("=" * 72)
    result = subprocess.run(cmd, cwd=ROOT)
    print("=" * 72)
    if result.returncode == 0:
        print("All tests passed.")
    else:
        print(f"Tests failed (exit code {result.returncode}).")
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())