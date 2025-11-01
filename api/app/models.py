"""
Modèles de base de données pour Santé Rurale Mali
"""
import uuid as uuid_module
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Classe de base pour tous les modèles"""
    pass


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


class Region(Base, TimestampMixin):
    """Modèle pour les régions du Mali"""
    __tablename__ = "regions"

    id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_module.uuid4)
    nom: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    # Relations
    districts: Mapped[list["District"]] = relationship(back_populates="region", cascade="all, delete-orphan")


class District(Base, TimestampMixin):
    """Modèle pour les districts"""
    __tablename__ = "districts"

    id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_module.uuid4)
    nom: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    region_id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("regions.id"), nullable=False)

    # Relations
    region: Mapped["Region"] = relationship(back_populates="districts")
    sites: Mapped[list["Site"]] = relationship(back_populates="district", cascade="all, delete-orphan")


class Site(Base, TimestampMixin):
    """Modèle pour les sites de santé (CSCOM, Centres de référence, etc.)"""
    __tablename__ = "sites"

    id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_module.uuid4)
    nom: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # cscom, csref, hopital
    district_id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("districts.id"), nullable=False)
    actif: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Informations supplémentaires optionnelles
    adresse: Mapped[str | None] = mapped_column(String(500))
    telephone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(200))

    # Relations
    district: Mapped["District"] = relationship(back_populates="sites")
    users: Mapped[list["User"]] = relationship(back_populates="site")
    patients: Mapped[list["Patient"]] = relationship(back_populates="site")


class User(Base, TimestampMixin):
    """Modèle pour les utilisateurs (personnel de santé)"""
    __tablename__ = "users"

    id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_module.uuid4)
    nom: Mapped[str] = mapped_column(String(200), nullable=False)
    prenom: Mapped[str | None] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(500), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # admin, medecin, major, soignant
    site_id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"), nullable=False)
    actif: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Champs pour la vérification d'email
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verification_token: Mapped[str | None] = mapped_column(String(500))
    verification_token_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Champs pour la réinitialisation de mot de passe
    reset_token: Mapped[str | None] = mapped_column(String(500))
    reset_token_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Informations supplémentaires optionnelles
    telephone: Mapped[str | None] = mapped_column(String(50))

    # Relations
    site: Mapped["Site"] = relationship(back_populates="users")


class Patient(Base, TimestampMixin):
    """Modèle pour les patients"""
    __tablename__ = "patients"

    id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_module.uuid4)
    nom: Mapped[str] = mapped_column(String(200), nullable=False)
    prenom: Mapped[str] = mapped_column(String(200), nullable=False)
    sexe: Mapped[str] = mapped_column(String(1), nullable=False)  # M ou F
    date_naissance: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    annee_naissance: Mapped[int | None] = mapped_column(Integer)

    # Contact
    telephone: Mapped[str | None] = mapped_column(String(50))
    telephone_urgence: Mapped[str | None] = mapped_column(String(50))

    # Localisation
    village: Mapped[str | None] = mapped_column(String(200))
    commune: Mapped[str | None] = mapped_column(String(200))

    # Site d'enregistrement
    site_id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"), nullable=False)

    # Informations médicales de base
    groupe_sanguin: Mapped[str | None] = mapped_column(String(10))
    allergies: Mapped[str | None] = mapped_column(Text)
    antecedents_medicaux: Mapped[str | None] = mapped_column(Text)

    # Statut
    actif: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relations
    site: Mapped["Site"] = relationship(back_populates="patients")
