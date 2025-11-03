"""
Endpoints pour la gestion des tenants et abonnements (SaaS)
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr, Field
import uuid

from app.database import get_db
from app.models.tenant import Tenant, Subscription, Plan, SubscriptionStatus
from app.dependencies.tenant import get_current_tenant
from app.security import get_current_user
from app.models import User
from app.services.subscription_service import SubscriptionService, STRIPE_ENABLED

router = APIRouter(prefix="/api/tenants", tags=["tenants"])


# ============================================================================
# Schemas Pydantic
# ============================================================================

class TenantCreate(BaseModel):
    """Schema pour créer un tenant pilote (Phase 1)"""
    name: str = Field(..., min_length=3, max_length=200)
    slug: str = Field(..., min_length=3, max_length=100, pattern="^[a-z0-9-]+$")
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country_code: Optional[str] = Field(None, min_length=2, max_length=2)


class TenantResponse(BaseModel):
    """Schema de réponse pour un tenant"""
    id: uuid.UUID
    name: str
    slug: str
    email: str
    is_active: bool
    is_pilot: bool
    created_at: datetime

    class Config:
        from_attributes = True


class SubscriptionCreate(BaseModel):
    """Schema pour créer un abonnement payant (Phase 2)"""
    plan_code: str = Field(..., pattern="^(starter|pro|enterprise)$")
    payment_method_id: Optional[str] = None  # ID Stripe du moyen de paiement
    trial_days: int = Field(default=30, ge=0, le=90)


class SubscriptionResponse(BaseModel):
    """Schema de réponse pour un abonnement"""
    id: uuid.UUID
    status: str
    current_period_start: datetime
    current_period_end: datetime
    trial_end: Optional[datetime]
    plan: "PlanResponse"

    class Config:
        from_attributes = True


class PlanResponse(BaseModel):
    """Schema de réponse pour un plan"""
    id: uuid.UUID
    code: str
    name: str
    description: Optional[str]
    price_monthly: float
    price_yearly: Optional[float]
    max_users: Optional[int]
    max_patients_per_month: Optional[int]
    max_sites: Optional[int]
    max_storage_gb: Optional[int]
    features: List[str]

    class Config:
        from_attributes = True


class UsageStatsResponse(BaseModel):
    """Schema pour les statistiques d'utilisation"""
    active_users: int
    patients_this_month: int
    encounters_this_month: int
    storage_used_mb: int
    quotas: dict


# ============================================================================
# Endpoints - Gestion des Tenants
# ============================================================================

@router.post("/", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_pilot_tenant(
    tenant_data: TenantCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Crée un tenant pilote gratuit (Phase 1)

    **Accès**: Public (pour inscription self-service des pilotes)

    Note: En production, vous voudrez peut-être protéger cet endpoint
    avec un token d'invitation ou le réserver aux admins.
    """
    # Vérifier que le slug n'existe pas déjà
    result = await db.execute(
        select(Tenant).where(Tenant.slug == tenant_data.slug)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ce slug est déjà utilisé"
        )

    # Créer le tenant pilote
    service = SubscriptionService(db)
    tenant = await service.create_pilot_tenant(
        name=tenant_data.name,
        slug=tenant_data.slug,
        email=tenant_data.email,
        phone=tenant_data.phone,
        address=tenant_data.address,
        city=tenant_data.city,
        country_code=tenant_data.country_code
    )

    return tenant


@router.get("/me", response_model=TenantResponse)
async def get_my_tenant(
    tenant: Tenant = Depends(get_current_tenant)
):
    """Récupère les informations du tenant actuel"""
    return tenant


@router.get("/me/subscription", response_model=SubscriptionResponse)
async def get_my_subscription(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Récupère l'abonnement actuel du tenant"""
    result = await db.execute(
        select(Subscription)
        .where(Subscription.tenant_id == tenant.id)
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucun abonnement actif"
        )

    return subscription


@router.get("/me/usage", response_model=UsageStatsResponse)
async def get_my_usage(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Récupère les statistiques d'utilisation du tenant"""
    service = SubscriptionService(db)
    usage = await service.get_usage_stats(tenant.id)

    # Récupérer les quotas du plan
    result = await db.execute(
        select(Subscription)
        .where(Subscription.tenant_id == tenant.id)
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )
    subscription = result.scalar_one_or_none()

    quotas = {}
    if subscription and subscription.plan:
        quotas = {
            "max_users": subscription.plan.max_users,
            "max_patients_per_month": subscription.plan.max_patients_per_month,
            "max_sites": subscription.plan.max_sites,
            "max_storage_gb": subscription.plan.max_storage_gb,
        }

    return UsageStatsResponse(
        **usage,
        quotas=quotas
    )


# ============================================================================
# Endpoints - Gestion des Abonnements (Phase 2)
# ============================================================================

@router.post("/me/subscribe", response_model=SubscriptionResponse)
async def create_subscription(
    subscription_data: SubscriptionCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """
    Crée un abonnement payant (Phase 2)

    Nécessite:
    - Stripe activé (STRIPE_ENABLED=true)
    - payment_method_id si pas de période d'essai
    """
    if not STRIPE_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Les abonnements payants ne sont pas encore disponibles"
        )

    # Vérifier qu'il n'y a pas déjà un abonnement actif
    result = await db.execute(
        select(Subscription)
        .where(Subscription.tenant_id == tenant.id)
        .where(Subscription.status.in_([
            SubscriptionStatus.ACTIVE.value,
            SubscriptionStatus.TRIALING.value
        ]))
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vous avez déjà un abonnement actif. Utilisez l'endpoint /upgrade pour changer de plan."
        )

    service = SubscriptionService(db)
    subscription = await service.create_paid_subscription(
        tenant=tenant,
        plan_code=subscription_data.plan_code,
        payment_method_id=subscription_data.payment_method_id,
        trial_days=subscription_data.trial_days
    )

    return subscription


@router.post("/me/subscription/upgrade", response_model=SubscriptionResponse)
async def upgrade_subscription(
    new_plan_code: str,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Change le plan de l'abonnement actuel"""
    # Récupérer l'abonnement actuel
    result = await db.execute(
        select(Subscription)
        .where(Subscription.tenant_id == tenant.id)
        .where(Subscription.status.in_([
            SubscriptionStatus.ACTIVE.value,
            SubscriptionStatus.TRIALING.value
        ]))
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucun abonnement actif à modifier"
        )

    service = SubscriptionService(db)
    updated_subscription = await service.upgrade_subscription(
        subscription_id=subscription.id,
        new_plan_code=new_plan_code
    )

    return updated_subscription


@router.post("/me/subscription/cancel")
async def cancel_subscription(
    immediate: bool = False,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Annule l'abonnement actuel"""
    result = await db.execute(
        select(Subscription)
        .where(Subscription.tenant_id == tenant.id)
        .where(Subscription.status == SubscriptionStatus.ACTIVE.value)
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucun abonnement actif à annuler"
        )

    service = SubscriptionService(db)
    canceled_subscription = await service.cancel_subscription(
        subscription_id=subscription.id,
        immediate=immediate
    )

    return {
        "message": "Abonnement annulé avec succès",
        "canceled_at": canceled_subscription.canceled_at
    }


# ============================================================================
# Endpoints - Plans disponibles
# ============================================================================

@router.get("/plans", response_model=List[PlanResponse])
async def list_plans(
    db: AsyncSession = Depends(get_db)
):
    """Liste tous les plans disponibles"""
    result = await db.execute(
        select(Plan).where(Plan.is_active == True).order_by(Plan.price_monthly)
    )
    plans = result.scalars().all()
    return plans


# ============================================================================
# Webhook Stripe (Phase 2)
# ============================================================================

@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Webhook pour recevoir les events Stripe

    Note: En production, vous DEVEZ vérifier la signature du webhook
    avec stripe.Webhook.construct_event()
    """
    if not STRIPE_ENABLED:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED)

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    # TODO: Vérifier la signature
    # event = stripe.Webhook.construct_event(
    #     payload, sig_header, webhook_secret
    # )

    # Pour l'instant, parser le JSON directement
    import json
    event = json.loads(payload)

    service = SubscriptionService(db)
    await service.handle_stripe_webhook(event)

    return {"received": True}
