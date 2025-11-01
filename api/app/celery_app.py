"""
Configuration Celery pour tâches asynchrones
"""
from celery import Celery
from app.config import settings

# Initialiser Celery
celery_app = Celery(
    "sante_rurale",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

# Configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=1000,
)

# Autodiscover tasks dans app/tasks/
celery_app.autodiscover_tasks(["app.tasks"])

# Tâches périodiques (Celery Beat)
celery_app.conf.beat_schedule = {
    # Rafraîchir les statistiques toutes les heures
    "refresh-site-statistics": {
        "task": "app.tasks.refresh_site_statistics",
        "schedule": 3600.0,  # 1 heure
    },
    # Export DHIS2 mensuel (le 1er de chaque mois à 2h du matin)
    "monthly-dhis2-export": {
        "task": "app.tasks.export_dhis2_monthly",
        "schedule": {
            "hour": 2,
            "minute": 0,
            "day_of_month": 1,
        },
    },
    # Nettoyage des anciennes opérations de sync (tous les jours à 3h)
    "cleanup-old-sync-operations": {
        "task": "app.tasks.cleanup_sync_operations",
        "schedule": {
            "hour": 3,
            "minute": 0,
        },
    },
}
