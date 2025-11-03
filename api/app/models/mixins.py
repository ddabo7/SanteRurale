"""
Mixins pour les modèles SQLAlchemy
"""
from datetime import datetime
import uuid as uuid_module
from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class TimestampMixin:
    """Mixin pour ajouter created_at et updated_at à un modèle"""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.utcnow(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.utcnow(),
        onupdate=lambda: datetime.utcnow(),
        nullable=False
    )


class TenantMixin:
    """
    Mixin pour ajouter tenant_id aux modèles multi-tenant

    IMPORTANT: Ce mixin doit être utilisé sur tous les modèles qui doivent être
    isolés par tenant (patients, encounters, etc.)

    Le middleware se chargera de filtrer automatiquement les requêtes par tenant_id.
    """
    tenant_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
