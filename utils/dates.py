"""Central date guard: every date that enters the DB or a SQL filter goes through parse_date.

Services validate at their boundary; views already format QDate as yyyy-MM-dd.
Rejects empty strings, garbage, non-zero-padded/slash formats, calendar-impossible
dates, and datetime strings carrying a time or UTC offset - all of which would
otherwise be persisted verbatim and mis-bucketed by lexicographic range filters.
"""
from __future__ import annotations

import datetime

from utils.exceptions import ValidationError


def parse_date(value, field: str = "date") -> str:
    """Return value as a canonical YYYY-MM-DD string, or raise ValidationError."""
    if isinstance(value, datetime.datetime):
        raise ValidationError(
            f"{field} must be a plain date (YYYY-MM-DD), not a datetime."
        )
    if isinstance(value, datetime.date):
        return value.isoformat()
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"{field} is required (YYYY-MM-DD).")
    text = value.strip()
    try:
        parsed = datetime.date.fromisoformat(text)
    except ValueError:
        raise ValidationError(
            f"{field} must be a valid date in YYYY-MM-DD format (got {value!r})."
        ) from None
    if parsed.isoformat() != text:
        # fromisoformat also accepts basic formats like 20260105; require strict form
        raise ValidationError(
            f"{field} must be a valid date in YYYY-MM-DD format (got {value!r})."
        )
    return text
