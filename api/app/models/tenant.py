"""
Modèles pour le système multi-tenant SaaS
"""
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, Numeric, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.models.base_models import Base


class PlanType(str, Enum):
    """Types de plans d'abonnement"""
    FREE = "free"  # Phase 1 : Pilotes gratuits
    STARTER = "starter"  # 50€/mois : 1-5 utilisateurs
    PRO = "pro"  # 150€/mois : 10-50 utilisateurs
    ENTERPRISE = "enterprise"  # 500€/mois : Illimité


class SubscriptionStatus(str, Enum):
    """
    Statuts d'abonnement avec mécanisme de blocage progressif

    Flux: ACTIVE → GRACE_PERIOD → DEGRADED → READ_ONLY → SUSPENDED → (suppression)
    """
    ACTIVE = "active"  # Abonnement payé et valide
    TRIALING = "trialing"  # Période d'essai (pour futurs usages)
    GRACE_PERIOD = "grace_period"  # Jour 0-7 après expiration - accès complet + notifications
    DEGRADED = "degraded"  # Jour 7-14 - Nouveaux patients/rapports/exports bloqués
    READ_ONLY = "read_only"  # Jour 14-30 - Lecture seule uniquement
    SUSPENDED = "suspended"  # Jour 30+ - Compte inaccessible, données conservées 90j
    CANCELED = "canceled"  # Annulé volontairement


class Plan(Base):
    """
    Plans d'abonnement disponibles
    """
    __tablename__ = "plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), unique=True, nullable=False)  # free, starter, pro, enterprise
    name = Column(String(100), nullable=False)  # "Plan Gratuit", "Plan Starter", etc.
    description = Column(String(500))

    # Tarification
    price_monthly = Column(Numeric(10, 2), nullable=False, default=0)  # Prix en €
    price_yearly = Column(Numeric(10, 2))  # Prix annuel (optionnel, avec réduction)

    # Quotas et limitations
    max_users = Column(Integer)  # null = illimité
    max_patients_total = Column(Integer)  # Nombre total de patients (plan gratuit uniquement, null = illimité)
    max_patients_per_month = Column(Integer)  # Limite mensuelle de patients (plans payants, null = illimité)
    max_sites = Column(Integer, default=1)
    max_storage_gb = Column(Integer, default=5)

    # Fonctionnalités activées
    features = Column(JSON, default=list)  # ["dhis2_export", "multi_sites", "advanced_stats"]

    # Stripe
    stripe_price_id = Column(String(100))  # ID du prix dans Stripe

    # Métadonnées
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    subscriptions = relationship("Subscription", back_populates="plan")


class Tenant(Base):
    """
    Tenant = Organisation cliente (centre de santé, district, région, etc.)
    Chaque tenant a ses propres données isolées
    """
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Informations de base
    name = Column(String(200), nullable=False)  # "Centre de Santé de Koulikoro"
    slug = Column(String(100), unique=True, nullable=False)  # "cscom-koulikoro"

    # Contact
    email = Column(String(200), nullable=False)
    phone = Column(String(50))

    # Adresse
    address = Column(String(500))
    city = Column(String(100))
    country_code = Column(String(2))  # ISO 3166-1 alpha-2 (ML, SN, BF, etc.)
    currency = Column(String(3), default="XOF")  # ISO 4217 (XOF, EUR, USD, GNF, etc.)

    # Statut
    is_active = Column(Boolean, default=True)
    is_pilot = Column(Boolean, default=False)  # Phase 1 : Pilotes gratuits

    # Stripe (pour Phase 2)
    stripe_customer_id = Column(String(100))  # ID client Stripe

    # Métadonnées
    settings = Column(JSON, default=dict)  # Configuration spécifique au tenant
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    subscription = relationship("Subscription", back_populates="tenant", uselist=False)
    users = relationship("User", back_populates="tenant")
    # Autres relations seront ajoutées (patients, encounters, etc.)


class Subscription(Base):
    """
    Abonnement d'un tenant à un plan
    """
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Relations
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id"), nullable=False)

    # Statut et dates
    status = Column(String(20), nullable=False, default=SubscriptionStatus.ACTIVE.value)
    trial_end = Column(DateTime)  # Fin de la période d'essai
    current_period_start = Column(DateTime, nullable=False, default=datetime.utcnow)
    current_period_end = Column(DateTime, nullable=False)
    canceled_at = Column(DateTime)

    # Mécanisme de blocage progressif
    expires_at = Column(DateTime)  # Date d'expiration du paiement
    grace_period_ends_at = Column(DateTime)  # expires_at + 7 jours
    degraded_at = Column(DateTime)  # Date passage en mode dégradé
    read_only_at = Column(DateTime)  # Date passage en lecture seule
    suspended_at = Column(DateTime)  # Date de suspension
    delete_scheduled_at = Column(DateTime)  # Date de suppression prévue (suspended_at + 90 jours)

    # Stripe
    stripe_subscription_id = Column(String(100))  # ID de l'abonnement Stripe

    # Usage (pour facturation à l'usage si nécessaire)
    current_usage = Column(JSON, default=dict)  # {"users": 3, "patients_this_month": 45}

    # Métadonnées
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    tenant = relationship("Tenant", back_populates="subscription")
    plan = relationship("Plan", back_populates="subscriptions")


class TenantUsageLog(Base):
    """
    Log de l'utilisation par tenant (pour analytics et facturation)
    """
    __tablename__ = "tenant_usage_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)

    # Période
    date = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Métriques
    active_users = Column(Integer, default=0)
    patients_created = Column(Integer, default=0)
    encounters_created = Column(Integer, default=0)
    api_calls = Column(Integer, default=0)
    storage_used_mb = Column(Integer, default=0)

    # Métadonnées
    created_at = Column(DateTime, default=datetime.utcnow)
