"""Base classes for all reports."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from database.connection import DatabaseConnection, get_db
from utils.logger import get_logger

logger = get_logger(__name__)


class Report(ABC):
    """Base class for all reports."""

    def __init__(self, db: DatabaseConnection | None = None):
        self.db = db or get_db()
        self.title = ""
        self.date_from: str | None = None
        self.date_to: str | None = None
        self.company_id: int = 1

    @abstractmethod
    def generate(self) -> dict:
        """Generate the report data."""
        pass

    def set_date_range(self, date_from: str, date_to: str) -> None:
        """Set date range for the report."""
        self.date_from = date_from
        self.date_to = date_to

    def format_currency(self, amount: float) -> str:
        """Format currency amount in standard format."""
        return f"Rs. {amount:,.2f}"

    def format_currency_indian(self, amount: float) -> str:
        """Format currency in Indian/Pakistani style (e.g., 1,00,00,000)."""
        if amount == 0:
            return "Rs. 0"
        
        # Convert to string with 2 decimal places
        amount_str = f"{abs(amount):.2f}"
        parts = amount_str.split('.')
        integer_part = parts[0]
        decimal_part = parts[1]
        
        # Format with Indian numbering system (lakhs, crores)
        if len(integer_part) <= 3:
            formatted = integer_part
        else:
            # First group (rightmost) is 3 digits
            first_group = integer_part[-3:]
            remaining = integer_part[:-3]
            
            # Remaining groups are 2 digits each
            remaining_groups = []
            while remaining:
                remaining_groups.append(remaining[-2:] if len(remaining) >= 2 else remaining)
                remaining = remaining[:-2]
            
            formatted = ",".join(reversed(remaining_groups)) + "," + first_group
        
        sign = "-" if amount < 0 else ""
        return f"{sign}Rs. {formatted}.{decimal_part}"

    def format_indian_number(self, amount: float) -> str:
        """Format number in Indian/Pakistani style (e.g., 1,00,00,000)."""
        if amount == 0:
            return "0"
        
        amount_str = f"{abs(amount):.0f}"
        
        if len(amount_str) <= 3:
            return amount_str
        
        first_group = amount_str[-3:]
        remaining = amount_str[:-3]
        
        remaining_groups = []
        while remaining:
            remaining_groups.append(remaining[-2:] if len(remaining) >= 2 else remaining)
            remaining = remaining[:-2]
        
        sign = "-" if amount < 0 else ""
        return sign + ",".join(reversed(remaining_groups)) + "," + first_group

    def format_indian_currency(self, amount: float) -> str:
        """Format currency with Indian numbering and no decimal for whole numbers."""
        if amount == 0:
            return "Rs. 0"
        
        # Check if it's a whole number
        if amount == int(amount):
            amount_str = f"{abs(amount):.0f}"
        else:
            amount_str = f"{abs(amount):.2f}"
            parts = amount_str.split('.')
            integer_part = parts[0]
            decimal_part = parts[1]
        
        # Format integer part with Indian numbering
        if len(integer_part) <= 3:
            formatted_integer = integer_part
        else:
            first_group = integer_part[-3:]
            remaining = integer_part[:-3]
            remaining_groups = []
            while remaining:
                remaining_groups.append(remaining[-2:] if len(remaining) >= 2 else remaining)
                remaining = remaining[:-2]
            formatted_integer = ",".join(reversed(remaining_groups)) + "," + first_group
        
        sign = "-" if amount < 0 else ""
        
        if amount == int(amount):
            return f"{sign}Rs. {formatted_integer}"
        else:
            return f"{sign}Rs. {formatted_integer}.{decimal_part}"

    def format_date(self, date_str: str) -> str:
        """Format date string."""
        try:
            dt = datetime.fromisoformat(date_str)
            return dt.strftime("%d-%b-%Y")
        except:
            return date_str

    def format_date_long(self, date_str: str) -> str:
        """Format date string in long format."""
        try:
            dt = datetime.fromisoformat(date_str)
            return dt.strftime("%B %d, %Y")
        except:
            return date_str

    def get_period_label(self) -> str:
        """Get formatted period label."""
        if self.date_from and self.date_to:
            return f"Period: {self.format_date(self.date_from)} to {self.format_date(self.date_to)}"
        return "As at: " + datetime.now().strftime("%B %d, %Y")


class ReportSection:
    """A section in a report."""

    def __init__(self, title: str, data: list[dict] | None = None):
        self.title = title
        self.data = data or []
        self.total: float = 0.0
        self.sub_sections: list[ReportSection] = []

    def add_row(self, row: dict) -> None:
        """Add a row to the section."""
        self.data.append(row)

    def add_sub_section(self, section: ReportSection) -> None:
        """Add a sub-section."""
        self.sub_sections.append(section)

    def calculate_total(self) -> float:
        """Calculate total for the section."""
        total = 0.0
        for row in self.data:
            if "amount" in row:
                total += row["amount"]
            elif "balance" in row:
                total += row["balance"]
            elif "debit" in row and "credit" in row:
                total += row["debit"] - row["credit"]
        self.total = total
        return total

    def get_formatted_total(self, report: Report) -> str:
        """Get formatted total using Indian currency format."""
        return report.format_indian_currency(self.total)