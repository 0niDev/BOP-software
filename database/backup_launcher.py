#!/usr/bin/env python3
"""
Backup launcher for Windows Task Scheduler.
This script runs auto_backup.py and logs the result.
"""
import subprocess
import datetime
import os
import sys

def run_backup():
    """Run the backup script and log output."""
    log_dir = "backups/logs"
    os.makedirs(log_dir, exist_ok=True)
    
    log_file = os.path.join(log_dir, f"backup_{datetime.datetime.now().strftime('%Y%m%d')}.log")
    
    try:
        result = subprocess.run(
            [sys.executable, "auto_backup.py"],
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes timeout
        )
        
        with open(log_file, 'a') as f:
            f.write(f"\n{'='*60}\n")
            f.write(f"Backup run at: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Status: {'SUCCESS' if result.returncode == 0 else 'FAILED'}\n")
            f.write(f"Output:\n{result.stdout}\n")
            if result.stderr:
                f.write(f"Errors:\n{result.stderr}\n")
            f.write(f"{'='*60}\n")
        
        return result.returncode == 0
        
    except Exception as e:
        with open(log_file, 'a') as f:
            f.write(f"\n{'='*60}\n")
            f.write(f"Backup run at: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Status: FAILED\n")
            f.write(f"Error: {str(e)}\n")
            f.write(f"{'='*60}\n")
        return False

if __name__ == "__main__":
    success = run_backup()
    sys.exit(0 if success else 1)