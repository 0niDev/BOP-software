"""Controller for Dashboard."""
from __future__ import annotations

from services.dashboard_service import DashboardService
from utils.exceptions import ERPException
from utils.logger import get_logger

logger = get_logger(__name__)


class DashboardController:
    """Controller for dashboard data."""

    def __init__(self, dashboard_service: DashboardService | None = None):
        self.service = dashboard_service or DashboardService()

    def get_dashboard_data(self) -> tuple[dict | None, str | None]:
        """Get all dashboard data."""
        try:
            print("📊 DashboardController: Fetching data...")
            data = self.service.get_dashboard_data()
            print(f"📊 DashboardController: Data fetched: {len(data)} sections")
            return data, None
        except ERPException as exc:
            return None, str(exc)
        except Exception:
            logger.exception("Unexpected error getting dashboard data")
            return None, "An unexpected error occurred."