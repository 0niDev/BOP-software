"""
Activity Logger Service
Logs all user activities to a text file for auditing.
"""
import os
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from database.connection import get_db_connection

class ActivityLogger:
    def __init__(self):
        self.log_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'activity_log.txt')
        self._ensure_log_file()
        
    def _ensure_log_file(self):
        """Ensure the log file exists."""
        if not os.path.exists(self.log_file):
            with open(self.log_file, 'w', encoding='utf-8') as f:
                f.write("=" * 80 + "\n")
                f.write("ACTIVITY LOG STARTED\n")
                f.write("=" * 80 + "\n\n")

    def log(self, user_username: str, action: str, entity_type: str, entity_id: Optional[int], 
            details: Optional[Dict[str, Any]] = None, status: str = "SUCCESS"):
        """
        Log an activity.
        
        Args:
            user_username: The username of the actor
            action: The action performed (CREATE, UPDATE, DELETE, LOGIN, SAVE, VOID, etc.)
            entity_type: The type of entity (Item, Sale, Purchase, Party, User, etc.)
            entity_id: The ID of the affected entity
            details: Additional details (dict) about the change
            status: SUCCESS or FAILURE
        """
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Format details string
        details_str = ""
        if details:
            parts = []
            for k, v in details.items():
                if v is not None:
                    parts.append(f"{k}='{v}'")
            details_str = " | " + ", ".join(parts)
        
        log_entry = (
            f"[{timestamp}] | {status:7} | User: {user_username:<15} | "
            f"{action:<8} {entity_type:<12} (ID: {entity_id}){details_str}\n"
        )
        
        try:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write(log_entry)
        except Exception as e:
            # Fallback to standard logging if file write fails
            logging.error(f"Failed to write to activity log: {e}")

# Global instance
activity_logger = ActivityLogger()

def get_activity_logger() -> ActivityLogger:
    return activity_logger
