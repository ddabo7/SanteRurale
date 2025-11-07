"""
Dépendances pour la gestion multi-tenant
"""
import uuid
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tenant import Tenant, Subscription, SubscriptionStatus
from app.security import get_current_user
from app.models import User


async def get_current_tenant(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Tenant:
    """
    Récupère le tenant actuel à partir du JWT de l'utilisateur

    Le tenant_id est stocké dans le token JWT lors de la connexion.
    Cette fonction valide que:
    1. Le tenant existe
    2. Le tenant est actif
    3. L'utilisateur appartient bien à ce tenant
    4. L'abonnement est valide
    """
    # Le tenant_id doit être dans le user (ajouté au modèle User)
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Utilisateur sans tenant assigné"
        )

    # Récupérer le tenant avec son abonnement
    result = await db.execute(
        select(Tenant)
        .where(Tenant.id == current_user.tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant introuvable"
        )

    # Vérifier que le tenant est actif
    if not tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ce compte est désactivé. Veuillez contacter le support."
        )

    # Vérifier l'abonnement (sauf pour les pilotes gratuits)
    if not tenant.is_pilot:
        subscription = await get_tenant_subscription(tenant.id, db)
        if not subscription:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Aucun abonnement actif. Veuillez souscrire à un plan."
            )

        if subscription.status not in [SubscriptionStatus.ACTIVE.value, SubscriptionStatus.TRIALING.value]:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Abonnement {subscription.status}. Veuillez mettre à jour votre abonnement."
            )

    # Injecter le tenant dans la request pour le middleware
    request.state.tenant = tenant
    request.state.tenant_id = tenant.id

    return tenant


async def get_tenant_subscription(
    tenant_id: uuid.UUID,
    db: AsyncSession
) -> Optional[Subscription]:
    """Récupère l'abonnement actuel d'un tenant"""
    result = await db.execute(
        select(Subscription)
        .where(Subscription.tenant_id == tenant_id)
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def require_feature(feature: str):
    """
    Décorateur pour vérifier qu'un tenant a accès à une fonctionnalité spécifique

    Usage:
        @router.post("/exports/dhis2")
        @require_feature("dhis2_export")
        async def export_dhis2(tenant: Tenant = Depends(get_current_tenant)):
            ...
    """
    async def dependency(
        tenant: Tenant = Depends(get_current_tenant),
        db: AsyncSession = Depends(get_db)
    ):
        subscription = await get_tenant_subscription(tenant.id, db)

        # Pilotes gratuits : accès limité
        if tenant.is_pilot:
            allowed_features = ["basic_features"]
        else:
            if not subscription or not subscription.plan:
                raise HTTPException(
                    status_code=status.HTTP_402_PAYMENT_REQUIRED,
                    detail="Aucun plan actif"
                )
            allowed_features = subscription.plan.features or []

        if feature not in allowed_features:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Cette fonctionnalité nécessite un plan supérieur. Fonctionnalité requise: {feature}"
            )

        return tenant

    return dependency


async def check_quota(
    tenant: Tenant,
    quota_type: str,
    current_value: int,
    db: AsyncSession
) -> bool:
    """
    Vérifie si un tenant a atteint son quota

    Args:
        tenant: Le tenant à vérifier
        quota_type: Type de quota ("users", "patients_per_month", "sites", "storage_gb")
        current_value: Valeur actuelle à comparer au quota
        db: Session de base de données

    Returns:
        True si dans les limites, False sinon

    Raises:
        HTTPException si quota dépassé
    """
    subscription = await get_tenant_subscription(tenant.id, db)

    # Si pas de subscription, utiliser quotas par défaut (pilotes gratuits)
    if not subscription or not subscription.plan:
        max_values = {
            "users": 5,
            "patients_per_month": None,  # Illimité
            "sites": 1,
            "storage_gb": 10
        }
    else:
        # Utiliser les quotas du plan de l'abonnement (même pour pilotes)
        plan = subscription.plan
        max_values = {
            "users": plan.max_users,
            "patients_per_month": plan.max_patients_per_month,
            "sites": plan.max_sites,
            "storage_gb": plan.max_storage_gb
        }

    max_value = max_values.get(quota_type)

    # None = illimité
    if max_value is None:
        return True

    if current_value >= max_value:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Quota {quota_type} atteint ({current_value}/{max_value}). Veuillez passer à un plan supérieur."
        )

    return True
