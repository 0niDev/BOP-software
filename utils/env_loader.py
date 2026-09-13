"""Load environment variables from the project's git-ignored .env file.

Every entry-point script (main.py, import scripts, backup tools) should get
database credentials through this module instead of hardcoding API keys.
"""
from __future__ import annotations

import os
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parent.parent


def load_dotenv(path: Path | None = None) -> None:
    """Populate os.environ from a .env file. Existing env vars win."""
    path = path or _PROJECT_ROOT / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def require_db_url() -> str:
    """Return SQLITE_CLOUD_URL, loading .env first. Raises if missing."""
    load_dotenv()
    url = os.environ.get("SQLITE_CLOUD_URL")
    if not url:
        raise RuntimeError(
            "SQLITE_CLOUD_URL is not set. Copy .env.example to .env and fill in "
            "your database credentials."
        )
    return url
