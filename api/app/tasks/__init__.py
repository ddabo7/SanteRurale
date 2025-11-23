"""
Tâches Celery asynchrones
"""
from app.tasks.statistics import refresh_site_statistics
from app.tasks.dhis2 import export_dhis2_monthly
from app.tasks.maintenance import cleanup_sync_operations
from app.tasks.subscriptions import (
    update_subscription_statuses,
    send_subscription_reminders,
    generate_subscription_report,
)

__all__ = [
    "refresh_site_statistics",
    "export_dhis2_monthly",
    "cleanup_sync_operations",
    # Abonnements
    "update_subscription_statuses",
    "send_subscription_reminders",
    "generate_subscription_report",
]
