"""
Tâches de gestion des abonnements et du mécanisme de blocage

Exécutées quotidiennement pour:
- Mettre à jour les statuts des abonnements expirés
- Envoyer les notifications de rappel
- Supprimer les données des comptes suspendus depuis plus de 90 jours
"""
import asyncio
from datetime import datetime, timedelta
import structlog

from app.celery_app import celery_app
from app.database import AsyncSessionLocal
from app.models.tenant import Subscription, SubscriptionStatus, Tenant
from app.services.subscription_service import SubscriptionService, GRACE_PERIOD_DAYS, DEGRADED_DAYS, READ_ONLY_DAYS, DELETE_AFTER_DAYS

logger = structlog.get_logger()


@celery_app.task(name="app.tasks.update_subscription_statuses")
def update_subscription_statuses():
    """
    Met à jour les statuts des abonnements expirés.
    Exécuté quotidiennement à 2h du matin.

    Transitions:
    - ACTIVE → GRACE_PERIOD (jour 0)
    - GRACE_PERIOD → DEGRADED (jour 7)
    - DEGRADED → READ_ONLY (jour 14)
    - READ_ONLY → SUSPENDED (jour 30)
    """
    return asyncio.run(_update_subscription_statuses_async())


async def _update_subscription_statuses_async():
    """Version async de la mise à jour des statuts"""
    async with AsyncSessionLocal() as db:
        try:
            service = SubscriptionService(db)
            to_transition = await service.get_subscriptions_to_transition()

            results = {
                "to_grace_period": 0,
                "to_degraded": 0,
                "to_read_only": 0,
                "to_suspended": 0,
                "to_delete": 0,
                "errors": []
            }

            # Transition vers GRACE_PERIOD
            for sub in to_transition["to_grace_period"]:
                try:
                    await service.transition_subscription(sub, SubscriptionStatus.GRACE_PERIOD)
                    results["to_grace_period"] += 1
                    logger.info(
                        "Abonnement passé en période de grâce",
                        subscription_id=str(sub.id),
                        tenant_id=str(sub.tenant_id)
                    )
                    # TODO: Envoyer notification email
                except Exception as e:
                    results["errors"].append(f"GRACE_PERIOD {sub.id}: {str(e)}")

            # Transition vers DEGRADED
            for sub in to_transition["to_degraded"]:
                try:
                    await service.transition_subscription(sub, SubscriptionStatus.DEGRADED)
                    results["to_degraded"] += 1
                    logger.warning(
                        "Abonnement passé en mode dégradé",
                        subscription_id=str(sub.id),
                        tenant_id=str(sub.tenant_id)
                    )
                    # TODO: Envoyer notification email urgente
                except Exception as e:
                    results["errors"].append(f"DEGRADED {sub.id}: {str(e)}")

            # Transition vers READ_ONLY
            for sub in to_transition["to_read_only"]:
                try:
                    await service.transition_subscription(sub, SubscriptionStatus.READ_ONLY)
                    results["to_read_only"] += 1
                    logger.warning(
                        "Abonnement passé en lecture seule",
                        subscription_id=str(sub.id),
                        tenant_id=str(sub.tenant_id)
                    )
                    # TODO: Envoyer notification email critique
                except Exception as e:
                    results["errors"].append(f"READ_ONLY {sub.id}: {str(e)}")

            # Transition vers SUSPENDED
            for sub in to_transition["to_suspended"]:
                try:
                    await service.transition_subscription(sub, SubscriptionStatus.SUSPENDED)
                    results["to_suspended"] += 1
                    logger.error(
                        "Abonnement suspendu",
                        subscription_id=str(sub.id),
                        tenant_id=str(sub.tenant_id)
                    )
                    # TODO: Envoyer notification email finale
                except Exception as e:
                    results["errors"].append(f"SUSPENDED {sub.id}: {str(e)}")

            # Suppression des données (à implémenter avec précaution)
            for sub in to_transition["to_delete"]:
                try:
                    # Pour l'instant, on ne supprime pas automatiquement
                    # On log juste pour une action manuelle
                    logger.critical(
                        "Abonnement prêt pour suppression définitive",
                        subscription_id=str(sub.id),
                        tenant_id=str(sub.tenant_id),
                        days_since_expiration=DELETE_AFTER_DAYS
                    )
                    results["to_delete"] += 1
                    # TODO: Implémenter la suppression après validation humaine
                except Exception as e:
                    results["errors"].append(f"DELETE {sub.id}: {str(e)}")

            logger.info(
                "Mise à jour des statuts d'abonnement terminée",
                results=results
            )

            return results

        except Exception as e:
            logger.error("Erreur lors de la mise à jour des statuts", error=str(e))
            raise


@celery_app.task(name="app.tasks.send_subscription_reminders")
def send_subscription_reminders():
    """
    Envoie des rappels pour les abonnements qui vont expirer.
    Exécuté quotidiennement.

    Rappels:
    - J-7: "Votre abonnement expire dans 7 jours"
    - J-3: "Votre abonnement expire dans 3 jours"
    - J-1: "Votre abonnement expire demain"
    """
    return asyncio.run(_send_subscription_reminders_async())


async def _send_subscription_reminders_async():
    """Version async de l'envoi des rappels"""
    async with AsyncSessionLocal() as db:
        try:
            service = SubscriptionService(db)
            results = {"sent": 0, "errors": []}

            # Rappels à J-7
            expiring_7 = await service.get_expiring_subscriptions(days_before=7)
            for sub in expiring_7:
                try:
                    # TODO: Implémenter l'envoi d'email
                    # await send_reminder_email(sub.tenant, days_remaining=7)
                    logger.info(
                        "Rappel J-7 à envoyer",
                        tenant_id=str(sub.tenant_id),
                        expires_at=sub.expires_at.isoformat() if sub.expires_at else None
                    )
                    results["sent"] += 1
                except Exception as e:
                    results["errors"].append(f"J-7 {sub.id}: {str(e)}")

            # Rappels à J-3
            expiring_3 = await service.get_expiring_subscriptions(days_before=3)
            for sub in expiring_3:
                # Éviter les doublons avec J-7
                if sub not in expiring_7:
                    try:
                        logger.info(
                            "Rappel J-3 à envoyer",
                            tenant_id=str(sub.tenant_id),
                            expires_at=sub.expires_at.isoformat() if sub.expires_at else None
                        )
                        results["sent"] += 1
                    except Exception as e:
                        results["errors"].append(f"J-3 {sub.id}: {str(e)}")

            # Rappels à J-1
            expiring_1 = await service.get_expiring_subscriptions(days_before=1)
            for sub in expiring_1:
                if sub not in expiring_3 and sub not in expiring_7:
                    try:
                        logger.info(
                            "Rappel J-1 à envoyer",
                            tenant_id=str(sub.tenant_id),
                            expires_at=sub.expires_at.isoformat() if sub.expires_at else None
                        )
                        results["sent"] += 1
                    except Exception as e:
                        results["errors"].append(f"J-1 {sub.id}: {str(e)}")

            logger.info("Envoi des rappels terminé", results=results)
            return results

        except Exception as e:
            logger.error("Erreur lors de l'envoi des rappels", error=str(e))
            raise


@celery_app.task(name="app.tasks.generate_subscription_report")
def generate_subscription_report():
    """
    Génère un rapport quotidien sur l'état des abonnements.
    Utile pour le monitoring et les alertes.
    """
    return asyncio.run(_generate_subscription_report_async())


async def _generate_subscription_report_async():
    """Version async du rapport"""
    from sqlalchemy import select, func

    async with AsyncSessionLocal() as db:
        try:
            # Compter par statut
            from app.models.tenant import Subscription, Plan

            report = {
                "date": datetime.utcnow().isoformat(),
                "by_status": {},
                "by_plan": {},
                "expiring_soon": 0,
                "recently_expired": 0
            }

            # Par statut
            for status in SubscriptionStatus:
                count_stmt = select(func.count()).select_from(Subscription).where(
                    Subscription.status == status.value
                )
                count = await db.scalar(count_stmt) or 0
                report["by_status"][status.value] = count

            # Expirant dans les 7 jours
            now = datetime.utcnow()
            expiring_stmt = select(func.count()).select_from(Subscription).where(
                Subscription.status == SubscriptionStatus.ACTIVE.value,
                Subscription.expires_at <= now + timedelta(days=7),
                Subscription.expires_at > now
            )
            report["expiring_soon"] = await db.scalar(expiring_stmt) or 0

            # Expirés récemment (dernières 24h)
            expired_stmt = select(func.count()).select_from(Subscription).where(
                Subscription.expires_at <= now,
                Subscription.expires_at > now - timedelta(days=1)
            )
            report["recently_expired"] = await db.scalar(expired_stmt) or 0

            logger.info("Rapport d'abonnements généré", report=report)
            return report

        except Exception as e:
            logger.error("Erreur lors de la génération du rapport", error=str(e))
            raise
