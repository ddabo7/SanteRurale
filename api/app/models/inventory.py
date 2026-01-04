"""
Modèles de base de données pour la gestion de pharmacie/inventaire
"""
import uuid as uuid_module
from datetime import datetime, date
from typing import Optional
import enum

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, Enum as SQLEnum, Index
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base_models import Base, TimestampMixin


# ============================================================================
# ENUMS
# ============================================================================

class FormeMedicamentEnum(str, enum.Enum):
    """Formes pharmaceutiques disponibles"""
    COMPRIME = "comprime"
    GELULE = "gelule"
    SIROP = "sirop"
    SUSPENSION = "suspension"
    INJECTABLE = "injectable"
    POMMADE = "pommade"
    COLLYRE = "collyre"
    SUPPOSITOIRE = "suppositoire"
    AUTRES = "autres"


class TypeMouvementEnum(str, enum.Enum):
    """Types de mouvements de stock"""
    ENTREE = "entree"  # Réception de commande
    SORTIE = "sortie"  # Délivrance patient
    AJUSTEMENT_POSITIF = "ajustement_positif"  # Correction inventaire +
    AJUSTEMENT_NEGATIF = "ajustement_negatif"  # Correction inventaire -
    PEREMPTION = "peremption"  # Destruction périmé
    PERTE = "perte"  # Perte/casse


class StatutCommandeEnum(str, enum.Enum):
    """Statuts des bons de commande"""
    BROUILLON = "brouillon"
    VALIDEE = "validee"
    EN_COURS = "en_cours"
    LIVREE = "livree"
    ANNULEE = "annulee"


# ============================================================================
# MODÈLES
# ============================================================================

class Medicament(Base, TimestampMixin):
    """
    Catalogue global des médicaments (partagé entre tous les sites)
    PAS de tenant_id car c'est un catalogue de référence global
    """
    __tablename__ = "medicaments"

    # Primary Key
    id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid_module.uuid4
    )

    # Identifiants et informations de base
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    nom: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    dci: Mapped[str | None] = mapped_column(String(200))  # Dénomination Commune Internationale

    # Forme et dosage
    forme: Mapped[FormeMedicamentEnum] = mapped_column(
        SQLEnum(FormeMedicamentEnum, name="forme_medicament", create_type=False),
        nullable=False
    )
    dosage: Mapped[str] = mapped_column(String(100), nullable=False)

    # Conditionnement
    unite_conditionnement: Mapped[str | None] = mapped_column(String(50))  # ex: "boîte", "flacon"
    quantite_par_unite: Mapped[int | None] = mapped_column(Integer)  # ex: 20 comprimés/boîte

    # Prix et alertes
    prix_unitaire_reference: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    seuil_alerte_defaut: Mapped[int | None] = mapped_column(Integer)  # Suggestion pour alertes stock

    # Métadonnées
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relations
    stocks_sites: Mapped[list["StockSite"]] = relationship(
        back_populates="medicament",
        cascade="all, delete-orphan"
    )
    lots: Mapped[list["LotMedicament"]] = relationship(
        back_populates="medicament",
        cascade="all, delete-orphan"
    )
    mouvements: Mapped[list["StockMovement"]] = relationship(
        back_populates="medicament"
    )

    __table_args__ = (
        Index('idx_medicaments_nom', 'nom'),
        Index('idx_medicaments_code', 'code'),
        Index('idx_medicaments_dci', 'dci'),
        Index('idx_medicaments_forme', 'forme'),
    )


class StockSite(Base, TimestampMixin):
    """
    Stock actuel d'un médicament dans un site spécifique
    AVEC tenant_id pour isolation multi-tenant
    """
    __tablename__ = "stock_sites"

    # Primary Key
    id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid_module.uuid4
    )

    # Foreign Keys
    medicament_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("medicaments.id"),
        nullable=False
    )
    site_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sites.id"),
        nullable=False
    )
    tenant_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # Quantités
    quantite_actuelle: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    seuil_alerte: Mapped[int | None] = mapped_column(Integer)  # Personnalisable par site
    valeur_stock: Mapped[float | None] = mapped_column(Numeric(10, 2))  # Calculé automatiquement

    # Dernières opérations (pour référence rapide)
    derniere_entree: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    derniere_sortie: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Optimistic locking
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Relations
    medicament: Mapped["Medicament"] = relationship(back_populates="stocks_sites")
    site: Mapped["Site"] = relationship(back_populates="stocks_medicaments")
    tenant: Mapped["Tenant"] = relationship()

    __table_args__ = (
        Index('idx_stock_sites_medicament', 'medicament_id'),
        Index('idx_stock_sites_site', 'site_id'),
        Index('idx_stock_sites_tenant', 'tenant_id'),
        Index('idx_stock_sites_site_tenant', 'site_id', 'tenant_id'),
    )


class LotMedicament(Base, TimestampMixin):
    """
    Gestion des lots de médicaments avec dates de péremption
    AVEC tenant_id pour isolation multi-tenant
    """
    __tablename__ = "lots_medicament"

    # Primary Key
    id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid_module.uuid4
    )

    # Foreign Keys
    medicament_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("medicaments.id"),
        nullable=False
    )
    site_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sites.id"),
        nullable=False
    )
    tenant_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    bon_commande_ligne_id: Mapped[uuid_module.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bons_commande_lignes.id")
    )

    # Informations du lot
    numero_lot: Mapped[str] = mapped_column(String(100), nullable=False)
    date_peremption: Mapped[date] = mapped_column(Date, nullable=False)
    quantite_restante: Mapped[int] = mapped_column(Integer, nullable=False)
    prix_achat_unitaire: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    # Relations
    medicament: Mapped["Medicament"] = relationship(back_populates="lots")
    site: Mapped["Site"] = relationship()
    tenant: Mapped["Tenant"] = relationship()
    bon_commande_ligne: Mapped["BonCommandeLigne"] = relationship(back_populates="lots")

    __table_args__ = (
        Index('idx_lots_medicament', 'medicament_id'),
        Index('idx_lots_site', 'site_id'),
        Index('idx_lots_tenant', 'tenant_id'),
        Index('idx_lots_peremption', 'date_peremption'),
        Index('idx_lots_medicament_site', 'medicament_id', 'site_id'),
    )


class StockMovement(Base):
    """
    Traçabilité complète de tous les mouvements de stock
    AVEC tenant_id pour isolation multi-tenant
    Immutable: une fois créé, un mouvement ne peut pas être modifié
    """
    __tablename__ = "stock_movements"

    # Primary Key
    id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid_module.uuid4
    )

    # Foreign Keys
    medicament_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("medicaments.id"),
        nullable=False
    )
    site_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sites.id"),
        nullable=False
    )
    tenant_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    lot_id: Mapped[uuid_module.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lots_medicament.id")
    )
    bon_commande_id: Mapped[uuid_module.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bons_commande.id")
    )
    delivrance_id: Mapped[uuid_module.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("delivrances_patient.id")
    )
    created_by: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    # Type et quantité
    type_mouvement: Mapped[TypeMouvementEnum] = mapped_column(
        SQLEnum(TypeMouvementEnum, name="type_mouvement", create_type=False),
        nullable=False
    )
    quantite: Mapped[int] = mapped_column(Integer, nullable=False)

    # Métadonnées
    date_mouvement: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.utcnow(),
        nullable=False
    )
    reference_externe: Mapped[str | None] = mapped_column(String(200))  # ex: numéro BC, ID consultation
    commentaire: Mapped[str | None] = mapped_column(Text)

    # Timestamp de création uniquement (immutable)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.utcnow(),
        nullable=False
    )

    # Relations
    medicament: Mapped["Medicament"] = relationship(back_populates="mouvements")
    site: Mapped["Site"] = relationship()
    tenant: Mapped["Tenant"] = relationship()
    lot: Mapped["LotMedicament"] = relationship()
    bon_commande: Mapped["BonCommande"] = relationship(back_populates="mouvements")
    delivrance: Mapped["DelivrancePatient"] = relationship(back_populates="mouvements")
    user: Mapped["User"] = relationship()

    __table_args__ = (
        Index('idx_movements_medicament', 'medicament_id'),
        Index('idx_movements_site', 'site_id'),
        Index('idx_movements_tenant', 'tenant_id'),
        Index('idx_movements_type', 'type_mouvement'),
        Index('idx_movements_date', 'date_mouvement'),
        Index('idx_movements_medicament_date', 'medicament_id', 'date_mouvement'),
        Index('idx_movements_site_tenant', 'site_id', 'tenant_id'),
    )


class Fournisseur(Base, TimestampMixin):
    """
    Catalogue global des fournisseurs (partagé entre tous les sites)
    PAS de tenant_id car c'est un catalogue de référence global
    """
    __tablename__ = "fournisseurs"

    # Primary Key
    id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid_module.uuid4
    )

    # Identifiants
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    nom: Mapped[str] = mapped_column(String(200), nullable=False, index=True)

    # Contact
    contact_nom: Mapped[str | None] = mapped_column(String(200))
    telephone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(200))

    # Adresse
    adresse: Mapped[str | None] = mapped_column(Text)
    ville: Mapped[str | None] = mapped_column(String(100))
    pays: Mapped[str] = mapped_column(String(100), default="Mali", nullable=False)

    # Métadonnées
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relations
    bons_commande: Mapped[list["BonCommande"]] = relationship(
        back_populates="fournisseur"
    )

    __table_args__ = (
        Index('idx_fournisseurs_code', 'code'),
        Index('idx_fournisseurs_nom', 'nom'),
    )


class BonCommande(Base, TimestampMixin):
    """
    Bons de commande pour les fournisseurs
    AVEC tenant_id pour isolation multi-tenant
    """
    __tablename__ = "bons_commande"

    # Primary Key
    id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid_module.uuid4
    )

    # Foreign Keys
    fournisseur_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fournisseurs.id"),
        nullable=False
    )
    site_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sites.id"),
        nullable=False
    )
    tenant_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    created_by: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    validated_by: Mapped[uuid_module.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id")
    )

    # Numéro et dates
    numero: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    date_commande: Mapped[date] = mapped_column(Date, nullable=False)
    date_livraison_prevue: Mapped[date | None] = mapped_column(Date)
    date_livraison_effective: Mapped[date | None] = mapped_column(Date)

    # Statut et montant
    statut: Mapped[StatutCommandeEnum] = mapped_column(
        SQLEnum(StatutCommandeEnum, name="statut_commande", create_type=False),
        default=StatutCommandeEnum.BROUILLON,
        nullable=False
    )
    montant_total: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)

    # Commentaire
    commentaire: Mapped[str | None] = mapped_column(Text)

    # Relations
    fournisseur: Mapped["Fournisseur"] = relationship(back_populates="bons_commande")
    site: Mapped["Site"] = relationship(back_populates="bons_commande")
    tenant: Mapped["Tenant"] = relationship()
    creator: Mapped["User"] = relationship(foreign_keys=[created_by])
    validator: Mapped["User"] = relationship(foreign_keys=[validated_by])
    lignes: Mapped[list["BonCommandeLigne"]] = relationship(
        back_populates="bon_commande",
        cascade="all, delete-orphan"
    )
    mouvements: Mapped[list["StockMovement"]] = relationship(back_populates="bon_commande")

    __table_args__ = (
        Index('idx_bc_fournisseur', 'fournisseur_id'),
        Index('idx_bc_site', 'site_id'),
        Index('idx_bc_tenant', 'tenant_id'),
        Index('idx_bc_statut', 'statut'),
        Index('idx_bc_numero', 'numero'),
        Index('idx_bc_site_tenant', 'site_id', 'tenant_id'),
    )


class BonCommandeLigne(Base, TimestampMixin):
    """
    Lignes d'un bon de commande
    """
    __tablename__ = "bons_commande_lignes"

    # Primary Key
    id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid_module.uuid4
    )

    # Foreign Keys
    bon_commande_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bons_commande.id", ondelete="CASCADE"),
        nullable=False
    )
    medicament_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("medicaments.id"),
        nullable=False
    )

    # Quantités et prix
    quantite_commandee: Mapped[int] = mapped_column(Integer, nullable=False)
    quantite_recue: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    prix_unitaire: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    montant_ligne: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)

    # Relations
    bon_commande: Mapped["BonCommande"] = relationship(back_populates="lignes")
    medicament: Mapped["Medicament"] = relationship()
    lots: Mapped[list["LotMedicament"]] = relationship(back_populates="bon_commande_ligne")

    __table_args__ = (
        Index('idx_bc_lignes_commande', 'bon_commande_id'),
        Index('idx_bc_lignes_medicament', 'medicament_id'),
    )


class DelivrancePatient(Base, TimestampMixin):
    """
    Délivrances de médicaments aux patients (dispensation)
    AVEC tenant_id pour isolation multi-tenant
    """
    __tablename__ = "delivrances_patient"

    # Primary Key
    id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid_module.uuid4
    )

    # Foreign Keys
    patient_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id"),
        nullable=False
    )
    encounter_id: Mapped[uuid_module.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("encounters.id")
    )
    medication_request_id: Mapped[uuid_module.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("medication_requests.id")
    )
    site_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sites.id"),
        nullable=False
    )
    tenant_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    delivered_by: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    # Date et commentaire
    date_delivrance: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.utcnow(),
        nullable=False
    )
    commentaire: Mapped[str | None] = mapped_column(Text)

    # Relations
    patient: Mapped["Patient"] = relationship(back_populates="delivrances")
    encounter: Mapped["Encounter"] = relationship()
    medication_request: Mapped["MedicationRequest"] = relationship()
    site: Mapped["Site"] = relationship()
    tenant: Mapped["Tenant"] = relationship()
    deliverer: Mapped["User"] = relationship()
    lignes: Mapped[list["DelivranceLigne"]] = relationship(
        back_populates="delivrance",
        cascade="all, delete-orphan"
    )
    mouvements: Mapped[list["StockMovement"]] = relationship(back_populates="delivrance")

    __table_args__ = (
        Index('idx_delivrances_patient', 'patient_id'),
        Index('idx_delivrances_encounter', 'encounter_id'),
        Index('idx_delivrances_site', 'site_id'),
        Index('idx_delivrances_tenant', 'tenant_id'),
        Index('idx_delivrances_date', 'date_delivrance'),
        Index('idx_delivrances_site_tenant', 'site_id', 'tenant_id'),
    )


class DelivranceLigne(Base):
    """
    Lignes d'une délivrance (médicaments délivrés)
    """
    __tablename__ = "delivrances_lignes"

    # Primary Key
    id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid_module.uuid4
    )

    # Foreign Keys
    delivrance_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("delivrances_patient.id", ondelete="CASCADE"),
        nullable=False
    )
    medicament_id: Mapped[uuid_module.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("medicaments.id"),
        nullable=False
    )
    lot_id: Mapped[uuid_module.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lots_medicament.id")
    )

    # Quantité et instructions
    quantite: Mapped[int] = mapped_column(Integer, nullable=False)
    instructions: Mapped[str | None] = mapped_column(Text)  # ex: "2x/jour pendant 5 jours"

    # Timestamp de création
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.utcnow(),
        nullable=False
    )

    # Relations
    delivrance: Mapped["DelivrancePatient"] = relationship(back_populates="lignes")
    medicament: Mapped["Medicament"] = relationship()
    lot: Mapped["LotMedicament"] = relationship()

    __table_args__ = (
        Index('idx_delivrances_lignes_delivrance', 'delivrance_id'),
        Index('idx_delivrances_lignes_medicament', 'medicament_id'),
    )
