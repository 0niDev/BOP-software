"""
Cache management utilities for the ERP system.

Provides centralized cache control, invalidation triggers, and monitoring.
"""
from __future__ import annotations

from repositories.base_repository import BaseRepository
from utils.logger import get_logger

logger = get_logger(__name__)


class CacheManager:
    """Centralized cache management for all repositories."""
    
    @staticmethod
    def clear_all() -> None:
        """Clear all repository caches."""
        BaseRepository.clear_all_cache()
        logger.info("All repository caches cleared")
    
    @staticmethod
    def set_enabled(enabled: bool) -> None:
        """Enable or disable caching globally."""
        BaseRepository._cache_enabled = enabled
        logger.info(f"Repository caching {'enabled' if enabled else 'disabled'}")
    
    @staticmethod
    def set_ttl(seconds: int) -> None:
        """Set global cache TTL in seconds."""
        BaseRepository._cache_ttl = seconds
        logger.info(f"Repository cache TTL set to {seconds} seconds")
    
    @staticmethod
    def get_stats() -> dict:
        """Get cache statistics."""
        return {
            "cached_entries": len(BaseRepository._cache),
            "ttl_seconds": BaseRepository._cache_ttl,
            "enabled": BaseRepository._cache_enabled,
        }


def invalidate_on_change(table_name: str, record_id: int | None = None) -> None:
    """
    Invalidate cache when data changes.
    
    Args:
        table_name: Name of the table that changed
        record_id: Optional specific record ID that changed
    """
    pattern = f"{table_name}:"
    keys_to_delete = [k for k in BaseRepository._cache if k.startswith(pattern)]
    for key in keys_to_delete:
        del BaseRepository._cache[key]
    
    if record_id:
        logger.debug(f"Cache invalidated for {table_name}:{record_id}")
    else:
        logger.debug(f"Cache invalidated for all {table_name}")
