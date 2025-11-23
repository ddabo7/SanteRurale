"""
Service de gestion des abonnements et billing
"""
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant, Subscription, Plan, SubscriptionStatus

# Stripe sera importé seulement si activé
STRIPE_ENABLED = os.getenv("STRIPE_ENABLED", "false").lower() == "true"

if STRIPE_ENABLED:
    try:
        import stripe
        stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
    except ImportError:
        print("⚠️  Stripe non installé. Installez avec: pip install stripe")
        STRIPE_ENABLED = False


class SubscriptionService:
    """Service de gestion des abonnements"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_pilot_tenant(
        self,
        name: str,
        slug: str,
        email: str,
        **kwargs
    ) -> Tenant:
        """
        Crée un tenant pilote gratuit (Phase 1)

        Args:
            name: Nom du centre de santé
            slug: Identifiant unique (ex: "cscom-koulikoro")
            email: Email de contact
            **kwargs: Autres champs (phone, address, city, country_code)

        Returns:
            Le tenant créé avec son abonnement gratuit
        """
        # Récupérer le plan gratuit
        result = await self.db.execute(
            select(Plan).where(Plan.code == "free")
        )
        free_plan = result.scalar_one()

        # Déterminer la devise selon le pays
        country_code = kwargs.get('country_code', 'ML')
        currency_map = {
            'ML': 'XOF', 'SN': 'XOF', 'BF': 'XOF', 'CI': 'XOF',
            'NE': 'XOF', 'TG': 'XOF', 'BJ': 'XOF',  # FCFA Ouest
            'GN': 'GNF',  # Franc Guinéen
            'FR': 'EUR', 'BE': 'EUR', 'LU': 'EUR',  # Euro
            'US': 'USD',  # Dollar
        }
        currency = currency_map.get(country_code, 'XOF')

        # Créer le tenant
        tenant = Tenant(
            name=name,
            slug=slug,
            email=email,
            is_pilot=True,
            is_active=True,
            currency=currency,
            **kwargs
        )
        self.db.add(tenant)
        await self.db.flush()

        # Créer l'abonnement gratuit (1 an)
        subscription = Subscription(
            tenant_id=tenant.id,
            plan_id=free_plan.id,
            status=SubscriptionStatus.ACTIVE.value,
            current_period_start=datetime.utcnow(),
            current_period_end=datetime.utcnow() + timedelta(days=365),  # 1 an
        )
        self.db.add(subscription)
        await self.db.flush()  # Flush seulement, le commit sera fait par l'appelant
        await self.db.refresh(tenant)

        return tenant

    async def create_paid_subscription(
        self,
        tenant: Tenant,
        plan_code: str,
        payment_method_id: Optional[str] = None,
        trial_days: int = 30
    ) -> Subscription:
        """
        Crée un abonnement payant avec Stripe (Phase 2)

        Args:
            tenant: Le tenant qui s'abonne
            plan_code: Code du plan (starter, pro, enterprise)
            payment_method_id: ID du moyen de paiement Stripe (optionnel si trial)
            trial_days: Nombre de jours d'essai gratuit

        Returns:
            L'abonnement créé

        Raises:
            ValueError: Si Stripe n'est pas activé ou si le plan n'existe pas
        """
        # Récupérer le plan
        result = await self.db.execute(
            select(Plan).where(Plan.code == plan_code)
        )
        plan = result.scalar_one_or_none()

        if not plan:
            raise ValueError(f"Plan {plan_code} introuvable")

        # Si Stripe est activé, créer l'abonnement Stripe
        stripe_subscription_id = None
        if STRIPE_ENABLED and plan.stripe_price_id:
            # Créer ou récupérer le client Stripe
            if not tenant.stripe_customer_id:
                customer = stripe.Customer.create(
                    email=tenant.email,
                    name=tenant.name,
                    metadata={
                        "tenant_id": str(tenant.id),
                        "tenant_slug": tenant.slug
                    }
                )
                tenant.stripe_customer_id = customer.id
                await self.db.flush()

            # Créer l'abonnement Stripe
            stripe_sub = stripe.Subscription.create(
                customer=tenant.stripe_customer_id,
                items=[{"price": plan.stripe_price_id}],
                payment_behavior="default_incomplete",
                payment_settings={"save_default_payment_method": "on_subscription"},
                trial_period_days=trial_days if not payment_method_id else None,
                default_payment_method=payment_method_id,
                metadata={
                    "tenant_id": str(tenant.id),
                    "plan_code": plan_code
                }
            )
            stripe_subscription_id = stripe_sub.id

        # Créer l'abonnement en DB
        trial_end = datetime.utcnow() + timedelta(days=trial_days) if trial_days > 0 else None
        period_end = trial_end or datetime.utcnow() + timedelta(days=30)

        subscription = Subscription(
            tenant_id=tenant.id,
            plan_id=plan.id,
            status=SubscriptionStatus.TRIALING.value if trial_days > 0 else SubscriptionStatus.ACTIVE.value,
            trial_end=trial_end,
            current_period_start=datetime.utcnow(),
            current_period_end=period_end,
            stripe_subscription_id=stripe_subscription_id
        )

        self.db.add(subscription)
        await self.db.commit()
        await self.db.refresh(subscription)

        return subscription

    async def cancel_subscription(
        self,
        subscription_id: uuid.UUID,
        immediate: bool = False
    ) -> Subscription:
        """
        Annule un abonnement

        Args:
            subscription_id: ID de l'abonnement
            immediate: Si True, annule immédiatement. Sinon, à la fin de la période

        Returns:
            L'abonnement annulé
        """
        result = await self.db.execute(
            select(Subscription).where(Subscription.id == subscription_id)
        )
        subscription = result.scalar_one()

        # Annuler dans Stripe si activé
        if STRIPE_ENABLED and subscription.stripe_subscription_id:
            stripe.Subscription.modify(
                subscription.stripe_subscription_id,
                cancel_at_period_end=not immediate
            )

            if immediate:
                stripe.Subscription.cancel(subscription.stripe_subscription_id)

        # Mettre à jour en DB
        if immediate:
            subscription.status = SubscriptionStatus.CANCELED.value
            subscription.canceled_at = datetime.utcnow()
        else:
            # Annulation à la fin de la période
            subscription.canceled_at = subscription.current_period_end

        await self.db.commit()
        await self.db.refresh(subscription)

        return subscription

    async def upgrade_subscription(
        self,
        subscription_id: uuid.UUID,
        new_plan_code: str
    ) -> Subscription:
        """
        Change le plan d'un abonnement

        Args:
            subscription_id: ID de l'abonnement
            new_plan_code: Code du nouveau plan

        Returns:
            L'abonnement mis à jour
        """
        # Récupérer l'abonnement actuel
        result = await self.db.execute(
            select(Subscription).where(Subscription.id == subscription_id)
        )
        subscription = result.scalar_one()

        # Récupérer le nouveau plan
        result = await self.db.execute(
            select(Plan).where(Plan.code == new_plan_code)
        )
        new_plan = result.scalar_one_or_none()

        if not new_plan:
            raise ValueError(f"Plan {new_plan_code} introuvable")

        # Mise à jour dans Stripe
        if STRIPE_ENABLED and subscription.stripe_subscription_id and new_plan.stripe_price_id:
            stripe_sub = stripe.Subscription.retrieve(subscription.stripe_subscription_id)

            stripe.Subscription.modify(
                subscription.stripe_subscription_id,
                items=[{
                    "id": stripe_sub["items"]["data"][0].id,
                    "price": new_plan.stripe_price_id,
                }],
                proration_behavior="always_invoice",  # Facturer au prorata
            )

        # Mise à jour en DB
        subscription.plan_id = new_plan.id
        await self.db.commit()
        await self.db.refresh(subscription)

        return subscription

    async def handle_stripe_webhook(self, event: dict):
        """
        Traite les webhooks Stripe

        Events importants:
        - customer.subscription.updated: Mise à jour du statut
        - customer.subscription.deleted: Abonnement annulé
        - invoice.payment_succeeded: Paiement réussi
        - invoice.payment_failed: Paiement échoué
        """
        if not STRIPE_ENABLED:
            return

        event_type = event["type"]
        data = event["data"]["object"]

        if event_type == "customer.subscription.updated":
            # Mettre à jour le statut de l'abonnement
            stripe_sub_id = data["id"]
            status = data["status"]

            result = await self.db.execute(
                select(Subscription).where(
                    Subscription.stripe_subscription_id == stripe_sub_id
                )
            )
            subscription = result.scalar_one_or_none()

            if subscription:
                subscription.status = status
                subscription.current_period_start = datetime.fromtimestamp(data["current_period_start"])
                subscription.current_period_end = datetime.fromtimestamp(data["current_period_end"])
                await self.db.commit()

        elif event_type == "customer.subscription.deleted":
            # Marquer l'abonnement comme annulé
            stripe_sub_id = data["id"]

            result = await self.db.execute(
                select(Subscription).where(
                    Subscription.stripe_subscription_id == stripe_sub_id
                )
            )
            subscription = result.scalar_one_or_none()

            if subscription:
                subscription.status = SubscriptionStatus.CANCELED.value
                subscription.canceled_at = datetime.utcnow()
                await self.db.commit()

        elif event_type == "invoice.payment_failed":
            # Paiement échoué - marquer comme en retard
            subscription_id = data.get("subscription")
            if subscription_id:
                result = await self.db.execute(
                    select(Subscription).where(
                        Subscription.stripe_subscription_id == subscription_id
                    )
                )
                subscription = result.scalar_one_or_none()

                if subscription:
                    subscription.status = SubscriptionStatus.PAST_DUE.value
                    await self.db.commit()

    async def get_usage_stats(self, tenant_id: uuid.UUID) -> dict:
        """
        Récupère les statistiques d'utilisation d'un tenant

        Returns:
            Dict avec les métriques d'utilisation
        """
        # À implémenter selon vos besoins
        # Ex: nombre d'utilisateurs actifs, patients créés ce mois, etc.
        return {
            "active_users": 0,
            "patients_this_month": 0,
            "encounters_this_month": 0,
            "storage_used_mb": 0
        }
