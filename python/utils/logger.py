"""
Centralized logging configuration.

Every module obtains a logger via `get_logger(__name__)` instead of
configuring logging itself, guaranteeing one consistent log format
and one rotating log file for the whole application.
"""
from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler

from config.app_config import get_config

_configured = False


def _configure_root_logger() -> None:
    global _configured
    if _configured:
        return

    cfg = get_config().logging
    root = logging.getLogger("erp")
    root.setLevel(cfg.level)
    root.propagate = False

    formatter = logging.Formatter(cfg.fmt)

    file_handler = RotatingFileHandler(
        cfg.log_file, maxBytes=cfg.max_bytes, backupCount=cfg.backup_count, encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    root.addHandler(console_handler)

    _configured = True


def get_logger(name: str) -> logging.Logger:
    """Return a namespaced logger, e.g. get_logger(__name__)."""
    _configure_root_logger()
    return logging.getLogger(f"erp.{name}")
