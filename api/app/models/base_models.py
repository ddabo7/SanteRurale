"""
Modèles de base de données pour Santé Rurale
"""
import uuid as uuid_module
from datetime import datetime
from typing import Optional
import enum

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


# Enum pour le sexe
class SexeEnum(str, enum.Enum):
    M = "M"
    F = "F"


# Enum pour le rôle utilisateur
class UserRoleEnum(str, enum.Enum):
    soignant = "soignant"
    infirmier = "infirmier"
    major = "major"
    medecin = "medecin"
    pharmacien = "pharmacien"
    admin = "admin"


# Enum pour le statut des références
class ReferenceStatutEnum(str, enum.Enum):
    en_attente = "en_attente"
    confirme = "confirme"
    complete = "complete"
    annule = "annule"


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


class Region(Base):
    """Modèle pour les régions"""
    __tablename__ = "regions"

    id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_module.uuid4)
    nom: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.utcnow(), nullable=False)

    # Relations
    districts: Mapped[list["District"]] = relationship(back_populates="region", cascade="all, delete-orphan")


class District(Base):
    """Modèle pour les districts"""
    __tablename__ = "districts"

    id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_module.uuid4)
    nom: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    region_id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("regions.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.utcnow(), nullable=False)

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
    ville: Mapped[str | None] = mapped_column(String(200))
    pays: Mapped[str | None] = mapped_column(String(100))
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
    role: Mapped[UserRoleEnum] = mapped_column(SQLEnum(UserRoleEnum, name="user_role", create_type=False), nullable=False)
    site_id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"), nullable=False)
    tenant_id: Mapped[uuid_module.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"))
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
    avatar_url: Mapped[str | None] = mapped_column(Text)

    # Relations
    site: Mapped["Site"] = relationship(back_populates="users")
    tenant: Mapped["Tenant"] = relationship(back_populates="users")


class Patient(Base, TimestampMixin):
    """Modèle pour les patients - Correspond exactement à la structure DB"""
    __tablename__ = "patients"

    id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_module.uuid4)
    nom: Mapped[str] = mapped_column(String(200), nullable=False)
    prenom: Mapped[str | None] = mapped_column(String(200))
    sexe: Mapped[SexeEnum] = mapped_column(SQLEnum(SexeEnum, name="sexe", create_type=False), nullable=False)
    annee_naissance: Mapped[int | None] = mapped_column(Integer)
    telephone: Mapped[str | None] = mapped_column(String(50))
    village: Mapped[str | None] = mapped_column(String(200))
    site_id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"), nullable=False)

    # Audit fields
    created_by: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_by: Mapped[uuid_module.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    # Version for optimistic locking
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Soft delete
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relations
    site: Mapped["Site"] = relationship(back_populates="patients", foreign_keys=[site_id])
    encounters: Mapped[list["Encounter"]] = relationship(back_populates="patient", cascade="all, delete-orphan")


class Encounter(Base, TimestampMixin):
    """Modèle pour les consultations/rencontres médicales - Correspond exactement à la structure DB"""
    __tablename__ = "encounters"

    id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_module.uuid4)
    patient_id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    site_id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"), nullable=False)
    user_id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Date de la consultation
    date: Mapped[datetime] = mapped_column(Date, nullable=False)

    # Motif de consultation
    motif: Mapped[str | None] = mapped_column(Text)

    # Signes vitaux
    temperature: Mapped[float | None] = mapped_column(Numeric(4, 1))
    pouls: Mapped[int | None] = mapped_column(Integer)
    pression_systolique: Mapped[int | None] = mapped_column(Integer)
    pression_diastolique: Mapped[int | None] = mapped_column(Integer)
    poids: Mapped[float | None] = mapped_column(Numeric(5, 2))
    taille: Mapped[int | None] = mapped_column(Integer)

    # Notes
    notes: Mapped[str | None] = mapped_column(Text)

    # Version
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Soft delete
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relations
    patient: Mapped["Patient"] = relationship(back_populates="encounters")
    site: Mapped["Site"] = relationship()
    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    conditions: Mapped[list["Condition"]] = relationship(back_populates="encounter", cascade="all, delete-orphan")
    medication_requests: Mapped[list["MedicationRequest"]] = relationship(back_populates="encounter", cascade="all, delete-orphan")
    procedures: Mapped[list["Procedure"]] = relationship(back_populates="encounter", cascade="all, delete-orphan")
    references: Mapped[list["Reference"]] = relationship(back_populates="encounter", cascade="all, delete-orphan")


class Condition(Base):
    """Modèle pour les diagnostics"""
    __tablename__ = "conditions"

    id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_module.uuid4)
    encounter_id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("encounters.id"), nullable=False)

    # Code CIM-10
    code_icd10: Mapped[str | None] = mapped_column(String(10))
    libelle: Mapped[str] = mapped_column(String(500), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.utcnow(), nullable=False)
    created_by: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    # Relation
    encounter: Mapped["Encounter"] = relationship(back_populates="conditions")


class MedicationRequest(Base):
    """Modèle pour les prescriptions médicamenteuses"""
    __tablename__ = "medication_requests"

    id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_module.uuid4)
    encounter_id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("encounters.id"), nullable=False)

    medicament: Mapped[str] = mapped_column(String(500), nullable=False)
    posologie: Mapped[str] = mapped_column(String(500), nullable=False)
    duree_jours: Mapped[int | None] = mapped_column(Integer)
    quantite: Mapped[float | None] = mapped_column(Numeric(10, 2))
    unite: Mapped[str | None] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.utcnow(), nullable=False)
    
    # Relation
    encounter: Mapped["Encounter"] = relationship(back_populates="medication_requests")


class Procedure(Base):
    """Modèle pour les actes médicaux"""
    __tablename__ = "procedures"

    id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_module.uuid4)
    encounter_id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("encounters.id"), nullable=False)

    type: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    resultat: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.utcnow(), nullable=False)
    # Metadata
    created_by: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Relation
    encounter: Mapped["Encounter"] = relationship(back_populates="procedures")


class Reference(Base, TimestampMixin):
    """Modèle pour les références/évacuations"""
    __tablename__ = "referrals"

    id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_module.uuid4)
    encounter_id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("encounters.id"), nullable=False)

    destination: Mapped[str] = mapped_column(String(300), nullable=False)
    raison: Mapped[str] = mapped_column(Text, nullable=False)
    statut: Mapped[ReferenceStatutEnum] = mapped_column(SQLEnum(ReferenceStatutEnum, name="reference_statut"), nullable=False, default=ReferenceStatutEnum.en_attente)
    eta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_by: Mapped[uuid_module.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    # Relation
    encounter: Mapped["Encounter"] = relationship(back_populates="references")


class Attachment(Base, TimestampMixin):
    """Modèle pour les pièces jointes (fichiers uploadés)"""
    __tablename__ = "attachments"

    id: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid_module.uuid4)

    # Lien vers patient ou encounter (au moins un doit être fourni)
    patient_id: Mapped[uuid_module.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"))
    encounter_id: Mapped[uuid_module.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("encounters.id"))

    # Informations du fichier
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)

    # Stockage S3/MinIO
    s3_key: Mapped[str | None] = mapped_column(String(1000))
    s3_bucket: Mapped[str | None] = mapped_column(String(200))

    # Statut
    uploaded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Audit
    created_by: Mapped[uuid_module.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Relations
    patient: Mapped[Optional["Patient"]] = relationship(foreign_keys=[patient_id])
    encounter: Mapped[Optional["Encounter"]] = relationship(foreign_keys=[encounter_id])
    created_by_user: Mapped["User"] = relationship(foreign_keys=[created_by])
