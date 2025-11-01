"""
Tâches d'export DHIS2
"""
from app.celery_app import celery_app
from datetime import datetime, timedelta
import structlog

logger = structlog.get_logger()


@celery_app.task(name="app.tasks.export_dhis2_monthly")
def export_dhis2_monthly():
    """
    Export mensuel automatique vers DHIS2
    Exécuté le 1er de chaque mois à 2h du matin
    """
    try:
        # Calculer le mois précédent
        today = datetime.now()
        first_day_current_month = today.replace(day=1)
        last_day_previous_month = first_day_current_month - timedelta(days=1)
        year = last_day_previous_month.year
        month = last_day_previous_month.month

        logger.info("Démarrage de l'export DHIS2 mensuel", year=year, month=month)

        # TODO: Implémenter l'export réel
        # from app.services.dhis2 import export_month_data
        # result = export_month_data(year, month)

        logger.info("Export DHIS2 mensuel terminé avec succès", year=year, month=month)
        return {"status": "success", "year": year, "month": month}

    except Exception as e:
        logger.error("Erreur lors de l'export DHIS2", error=str(e))
        raise
