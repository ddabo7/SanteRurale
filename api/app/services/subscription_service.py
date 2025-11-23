"""
Service de gestion des abonnements et billing

Mécanisme de blocage progressif:
- ACTIVE: Abonnement payé et valide
- GRACE_PERIOD (Jour 0-7): Accès complet + notifications
- DEGRADED (Jour 7-14): Nouveaux patients/rapports/exports bloqués
- READ_ONLY (Jour 14-30): Lecture seule uniquement
- SUSPENDED (Jour 30+): Compte inaccessible, données conservées 90j
"""
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant, Subscription, Plan, SubscriptionStatus


# Délais en jours pour les transitions de blocage
GRACE_PERIOD_DAYS = 7
DEGRADED_DAYS = 14  # Total depuis expiration
READ_ONLY_DAYS = 30  # Total depuis expiration
DELETE_AFTER_DAYS = 120  # 90 jours après suspension

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

    # ==========================================
    # MÉCANISME DE BLOCAGE PROGRESSIF
    # ==========================================

    async def get_computed_status(
        self, subscription: Subscription
    ) -> SubscriptionStatus:
        """
        Calcule le statut actuel d'un abonnement basé sur les dates.
        """
        if not subscription:
            return None

        # Plan gratuit : toujours actif (pas d'expiration basée sur paiement)
        plan = subscription.plan
        if plan and plan.code == 'free':
            return SubscriptionStatus.ACTIVE

        # Si annulé volontairement
        if subscription.status == SubscriptionStatus.CANCELED.value:
            return SubscriptionStatus.CANCELED

        # Calculer le statut basé sur expires_at
        now = datetime.utcnow()
        expires_at = subscription.expires_at or subscription.current_period_end

        if not expires_at:
            return SubscriptionStatus.ACTIVE

        # Abonnement toujours valide
        if now < expires_at:
            return SubscriptionStatus.ACTIVE

        # Calculer les jours depuis expiration
        days_expired = (now - expires_at).days

        if days_expired < GRACE_PERIOD_DAYS:
            return SubscriptionStatus.GRACE_PERIOD
        elif days_expired < DEGRADED_DAYS:
            return SubscriptionStatus.DEGRADED
        elif days_expired < READ_ONLY_DAYS:
            return SubscriptionStatus.READ_ONLY
        else:
            return SubscriptionStatus.SUSPENDED

    async def check_can_create_patient(
        self, subscription: Subscription
    ) -> Tuple[bool, Optional[str]]:
        """
        Vérifie si le tenant peut créer un nouveau patient.
        Retourne (autorisé, message_erreur)
        """
        status = await self.get_computed_status(subscription)

        if status in [
            SubscriptionStatus.DEGRADED,
            SubscriptionStatus.READ_ONLY,
            SubscriptionStatus.SUSPENDED,
            SubscriptionStatus.CANCELED
        ]:
            messages = {
                SubscriptionStatus.DEGRADED: "Votre abonnement a expiré. Renouvelez pour enregistrer de nouveaux patients.",
                SubscriptionStatus.READ_ONLY: "Compte en lecture seule. Renouvelez votre abonnement pour continuer.",
                SubscriptionStatus.SUSPENDED: "Compte suspendu. Contactez le support pour réactiver.",
                SubscriptionStatus.CANCELED: "Abonnement annulé. Souscrivez à nouveau pour continuer."
            }
            return False, messages.get(status, "Accès refusé")

        return True, None

    async def check_can_modify_data(
        self, subscription: Subscription
    ) -> Tuple[bool, Optional[str]]:
        """
        Vérifie si le tenant peut modifier des données existantes.
        """
        status = await self.get_computed_status(subscription)

        if status in [
            SubscriptionStatus.READ_ONLY,
            SubscriptionStatus.SUSPENDED,
            SubscriptionStatus.CANCELED
        ]:
            messages = {
                SubscriptionStatus.READ_ONLY: "Compte en lecture seule. Renouvelez pour modifier les données.",
                SubscriptionStatus.SUSPENDED: "Compte suspendu. Contactez le support.",
                SubscriptionStatus.CANCELED: "Abonnement annulé."
            }
            return False, messages.get(status, "Accès refusé")

        return True, None

    async def check_can_access_feature(
        self, subscription: Subscription, feature: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Vérifie l'accès aux fonctionnalités avancées (rapports, exports, API, multi-sites).
        Bloqué dès le mode DEGRADED.
        """
        status = await self.get_computed_status(subscription)
        blocked_features = ["advanced_reports", "data_export", "dhis2_export", "api_access", "multi_sites"]

        if feature in blocked_features and status in [
            SubscriptionStatus.DEGRADED,
            SubscriptionStatus.READ_ONLY,
            SubscriptionStatus.SUSPENDED,
            SubscriptionStatus.CANCELED
        ]:
            feature_names = {
                "advanced_reports": "rapports avancés",
                "data_export": "export de données",
                "dhis2_export": "export DHIS2",
                "api_access": "accès API",
                "multi_sites": "multi-sites"
            }
            return False, f"Accès aux {feature_names.get(feature, feature)} bloqué. Renouvelez votre abonnement."

        return True, None

    async def check_can_login(
        self, subscription: Subscription
    ) -> Tuple[bool, Optional[str]]:
        """
        Vérifie si l'utilisateur peut se connecter.
        Bloqué uniquement en mode SUSPENDED.
        """
        status = await self.get_computed_status(subscription)

        if status == SubscriptionStatus.SUSPENDED:
            return False, "Compte suspendu. Vos données seront supprimées prochainement. Contactez le support."

        return True, None

    async def renew_subscription(
        self, subscription: Subscription, months: int = 1
    ) -> Subscription:
        """
        Renouvelle un abonnement pour N mois.
        Réinitialise tous les statuts de blocage.
        """
        now = datetime.utcnow()

        # Calculer la nouvelle période
        if subscription.expires_at and subscription.expires_at > now:
            # Prolonger depuis la date d'expiration actuelle
            new_start = subscription.expires_at
        else:
            # Commencer depuis maintenant
            new_start = now

        new_end = new_start + timedelta(days=30 * months)

        # Mettre à jour l'abonnement
        subscription.status = SubscriptionStatus.ACTIVE.value
        subscription.current_period_start = new_start
        subscription.current_period_end = new_end
        subscription.expires_at = new_end
        subscription.grace_period_ends_at = new_end + timedelta(days=GRACE_PERIOD_DAYS)

        # Réinitialiser les dates de blocage
        subscription.degraded_at = None
        subscription.read_only_at = None
        subscription.suspended_at = None
        subscription.delete_scheduled_at = None
        subscription.canceled_at = None

        await self.db.commit()
        await self.db.refresh(subscription)

        return subscription

    async def get_expiring_subscriptions(self, days_before: int = 7) -> List[Subscription]:
        """
        Récupère les abonnements qui expirent dans N jours.
        Pour envoyer des notifications de rappel.
        """
        now = datetime.utcnow()
        target_date = now + timedelta(days=days_before)

        stmt = select(Subscription).where(
            and_(
                Subscription.status == SubscriptionStatus.ACTIVE.value,
                Subscription.expires_at <= target_date,
                Subscription.expires_at > now
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_subscriptions_to_transition(self) -> dict:
        """
        Récupère les abonnements qui doivent changer de statut.
        Utilisé par le job CRON quotidien.
        """
        now = datetime.utcnow()

        to_transition = {
            "to_grace_period": [],
            "to_degraded": [],
            "to_read_only": [],
            "to_suspended": [],
            "to_delete": []
        }

        # Récupérer tous les abonnements non-gratuits actifs ou en transition
        stmt = select(Subscription).join(Plan).where(
            and_(
                Plan.code != 'free',
                Subscription.status.in_([
                    SubscriptionStatus.ACTIVE.value,
                    SubscriptionStatus.GRACE_PERIOD.value,
                    SubscriptionStatus.DEGRADED.value,
                    SubscriptionStatus.READ_ONLY.value,
                    SubscriptionStatus.SUSPENDED.value
                ])
            )
        )
        result = await self.db.execute(stmt)
        subscriptions = result.scalars().all()

        for sub in subscriptions:
            expires_at = sub.expires_at or sub.current_period_end
            if not expires_at:
                continue

            days_expired = (now - expires_at).days
            current_status = sub.status

            # Déterminer la transition nécessaire
            if days_expired >= 0 and days_expired < GRACE_PERIOD_DAYS:
                if current_status == SubscriptionStatus.ACTIVE.value:
                    to_transition["to_grace_period"].append(sub)

            elif days_expired >= GRACE_PERIOD_DAYS and days_expired < DEGRADED_DAYS:
                if current_status in [SubscriptionStatus.ACTIVE.value, SubscriptionStatus.GRACE_PERIOD.value]:
                    to_transition["to_degraded"].append(sub)

            elif days_expired >= DEGRADED_DAYS and days_expired < READ_ONLY_DAYS:
                if current_status in [
                    SubscriptionStatus.ACTIVE.value,
                    SubscriptionStatus.GRACE_PERIOD.value,
                    SubscriptionStatus.DEGRADED.value
                ]:
                    to_transition["to_read_only"].append(sub)

            elif days_expired >= READ_ONLY_DAYS and days_expired < DELETE_AFTER_DAYS:
                if current_status != SubscriptionStatus.SUSPENDED.value:
                    to_transition["to_suspended"].append(sub)

            elif days_expired >= DELETE_AFTER_DAYS:
                to_transition["to_delete"].append(sub)

        return to_transition

    async def transition_subscription(
        self, subscription: Subscription, new_status: SubscriptionStatus
    ) -> Subscription:
        """
        Effectue la transition d'un abonnement vers un nouveau statut.
        """
        now = datetime.utcnow()

        subscription.status = new_status.value

        if new_status == SubscriptionStatus.GRACE_PERIOD:
            subscription.grace_period_ends_at = (subscription.expires_at or now) + timedelta(days=GRACE_PERIOD_DAYS)

        elif new_status == SubscriptionStatus.DEGRADED:
            subscription.degraded_at = now

        elif new_status == SubscriptionStatus.READ_ONLY:
            subscription.read_only_at = now

        elif new_status == SubscriptionStatus.SUSPENDED:
            subscription.suspended_at = now
            subscription.delete_scheduled_at = now + timedelta(days=90)

        await self.db.commit()
        await self.db.refresh(subscription)

        return subscription

    def get_status_info(self, subscription: Subscription) -> dict:
        """
        Retourne les informations de statut pour affichage frontend.
        """
        import asyncio
        # Pour appel synchrone depuis un contexte sync
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # On est dans un contexte async, utiliser await directement n'est pas possible ici
                # Cette méthode doit être appelée avec await
                pass
        except RuntimeError:
            pass

        expires_at = subscription.expires_at or subscription.current_period_end
        now = datetime.utcnow()

        if not expires_at:
            return {
                "status": "active",
                "message": "Abonnement actif",
                "days_remaining": None,
                "is_blocked": False
            }

        days_until_expiry = (expires_at - now).days

        if days_until_expiry > 0:
            return {
                "status": "active",
                "message": f"Abonnement actif - expire dans {days_until_expiry} jours",
                "days_remaining": days_until_expiry,
                "is_blocked": False,
                "expires_at": expires_at.isoformat()
            }

        days_expired = abs(days_until_expiry)

        if days_expired < GRACE_PERIOD_DAYS:
            return {
                "status": "grace_period",
                "message": f"Période de grâce - {GRACE_PERIOD_DAYS - days_expired} jours restants",
                "days_remaining": GRACE_PERIOD_DAYS - days_expired,
                "is_blocked": False,
                "expires_at": expires_at.isoformat()
            }
        elif days_expired < DEGRADED_DAYS:
            return {
                "status": "degraded",
                "message": "Fonctionnalités limitées - Renouvelez votre abonnement",
                "days_remaining": DEGRADED_DAYS - days_expired,
                "is_blocked": True,
                "blocked_features": ["new_patients", "reports", "exports", "api"],
                "expires_at": expires_at.isoformat()
            }
        elif days_expired < READ_ONLY_DAYS:
            return {
                "status": "read_only",
                "message": "Compte en lecture seule - Renouvelez immédiatement",
                "days_remaining": READ_ONLY_DAYS - days_expired,
                "is_blocked": True,
                "blocked_features": ["all_modifications"],
                "expires_at": expires_at.isoformat()
            }
        else:
            delete_in = DELETE_AFTER_DAYS - days_expired
            return {
                "status": "suspended",
                "message": f"Compte suspendu - Suppression dans {delete_in} jours",
                "days_until_deletion": max(0, delete_in),
                "is_blocked": True,
                "expires_at": expires_at.isoformat()
            }


# Fonction utilitaire pour récupérer le statut d'un tenant
async def get_tenant_subscription_status(
    tenant_id: uuid.UUID, db: AsyncSession
) -> Tuple[Optional[Subscription], Optional[SubscriptionStatus]]:
    """
    Récupère l'abonnement d'un tenant et calcule son statut actuel.
    """
    stmt = select(Subscription).where(Subscription.tenant_id == tenant_id)
    result = await db.execute(stmt)
    subscription = result.scalar_one_or_none()

    if not subscription:
        return None, None

    service = SubscriptionService(db)
    status = await service.get_computed_status(subscription)
    return subscription, status
