"""
Router pour la gestion des bons de commande
"""
import uuid as uuid_module
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, and_, or_, desc, String, cast
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, ConfigDict

from app.database import get_db
from app.models import User
from app.models.inventory import BonCommande, BonCommandeLigne, Fournisseur, Medicament, StatutCommandeEnum
from app.schemas import UserRole, BaseSchema
from app.security import get_current_user

router = APIRouter(prefix="/bons-commande", tags=["Bons de Commande"])


# ===========================================================================
# SCHEMAS
# ===========================================================================

class BonCommandeLigneCreate(BaseModel):
    """Ligne de bon de commande"""
    medicament_id: uuid_module.UUID
    quantite_commandee: int = Field(ge=1)
    prix_unitaire: Optional[Decimal] = Field(None, ge=0)


class BonCommandeCreate(BaseModel):
    """Créer un bon de commande"""
    fournisseur_id: uuid_module.UUID
    date_commande: date
    date_livraison_prevue: Optional[date] = None
    commentaire: Optional[str] = None
    lignes: List[BonCommandeLigneCreate] = Field(min_length=1)


class BonCommandeLigneOut(BaseSchema):
    """Ligne de bon de commande"""
    id: uuid_module.UUID
    bon_commande_id: uuid_module.UUID
    medicament_id: uuid_module.UUID
    medicament_nom: Optional[str] = None
    quantite_commandee: int
    quantite_recue: int
    prix_unitaire: Optional[Decimal]
    created_at: datetime


class BonCommandeOut(BaseSchema):
    """Bon de commande"""
    id: uuid_module.UUID
    numero: str
    fournisseur_id: uuid_module.UUID
    fournisseur_nom: Optional[str] = None
    site_id: uuid_module.UUID
    statut: str
    date_commande: date
    date_livraison_prevue: Optional[date]
    date_livraison_effective: Optional[date]
    montant_total: Optional[Decimal]
    commentaire: Optional[str]
    created_at: datetime
    updated_at: datetime


class BonCommandeDetails(BonCommandeOut):
    """Bon de commande avec lignes"""
    lignes: List[BonCommandeLigneOut] = []


# ===========================================================================
# HELPER FUNCTIONS
# ===========================================================================

def require_pharmacien_or_admin(current_user: User = Depends(get_current_user)) -> User:
    """Vérifie que l'utilisateur est pharmacien ou admin"""
    if current_user.role not in [UserRole.PHARMACIEN, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux pharmaciens et administrateurs"
        )
    return current_user


async def generate_numero_bon_commande(db: AsyncSession, site_id: uuid_module.UUID, year: int) -> str:
    """Génère un numéro de bon de commande unique"""
    prefix = f"BC-{year}-"
    
    stmt = select(func.count(BonCommande.id)).where(
        and_(
            BonCommande.site_id == site_id,
            func.extract('year', BonCommande.date_commande) == year
        )
    )
    result = await db.execute(stmt)
    count = result.scalar_one() or 0
    
    return f"{prefix}{count + 1:04d}"


# ===========================================================================
# LISTE DES BONS DE COMMANDE
# ===========================================================================

@router.get("", response_model=dict)
async def list_bons_commande(
    fournisseur_id: Optional[uuid_module.UUID] = Query(None),
    statut: Optional[str] = Query(None),
    cursor: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Liste les bons de commande"""
    query = (
        select(BonCommande, Fournisseur)
        .join(Fournisseur, BonCommande.fournisseur_id == Fournisseur.id)
        .order_by(desc(BonCommande.date_commande))
    )
    
    # Filtres
    conditions = []
    
    # Limiter au site de l'utilisateur (sauf admin/pharmacien)
    if current_user.role not in [UserRole.ADMIN, UserRole.PHARMACIEN]:
        conditions.append(BonCommande.site_id == current_user.site_id)
    
    if fournisseur_id:
        conditions.append(BonCommande.fournisseur_id == fournisseur_id)
    
    if statut:
        # Comparer directement avec la valeur string (SQLAlchemy gère la conversion)
        conditions.append(cast(BonCommande.statut, String) == statut)
    
    if conditions:
        query = query.where(and_(*conditions))
    
    if cursor:
        query = query.where(BonCommande.id > uuid_module.UUID(cursor))
    
    query = query.limit(limit + 1)
    result = await db.execute(query)
    rows = result.all()
    
    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]
    
    items = []
    for bon, fournisseur in rows:
        items.append(BonCommandeOut(
            id=bon.id,
            numero=bon.numero,
            fournisseur_id=bon.fournisseur_id,
            fournisseur_nom=fournisseur.nom,
            site_id=bon.site_id,
            statut=bon.statut.value,
            date_commande=bon.date_commande,
            date_livraison_prevue=bon.date_livraison_prevue,
            date_livraison_effective=bon.date_livraison_effective,
            montant_total=bon.montant_total,
            commentaire=bon.commentaire,
            created_at=bon.created_at,
            updated_at=bon.updated_at,
        ))
    
    return {
        "items": items,
        "next_cursor": str(rows[-1][0].id) if rows else None,
        "has_more": has_more,
    }


# ===========================================================================
# DÉTAILS D'UN BON DE COMMANDE
# ===========================================================================

@router.get("/{bon_id}", response_model=BonCommandeDetails)
async def get_bon_commande(
    bon_id: uuid_module.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Récupère les détails d'un bon de commande"""
    stmt = (
        select(BonCommande, Fournisseur)
        .join(Fournisseur, BonCommande.fournisseur_id == Fournisseur.id)
        .where(BonCommande.id == bon_id)
    )
    result = await db.execute(stmt)
    row = result.one_or_none()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bon de commande non trouvé"
        )
    
    bon, fournisseur = row
    
    # Vérifier permissions
    if current_user.role not in [UserRole.ADMIN, UserRole.PHARMACIEN]:
        if bon.site_id != current_user.site_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accès refusé"
            )
    
    # Récupérer les lignes
    lignes_stmt = (
        select(BonCommandeLigne, Medicament)
        .join(Medicament, BonCommandeLigne.medicament_id == Medicament.id)
        .where(BonCommandeLigne.bon_commande_id == bon_id)
    )
    lignes_result = await db.execute(lignes_stmt)
    lignes_rows = lignes_result.all()
    
    lignes = []
    for ligne, medicament in lignes_rows:
        lignes.append(BonCommandeLigneOut(
            id=ligne.id,
            bon_commande_id=ligne.bon_commande_id,
            medicament_id=ligne.medicament_id,
            medicament_nom=medicament.nom,
            quantite_commandee=ligne.quantite_commandee,
            quantite_recue=ligne.quantite_recue,
            prix_unitaire=ligne.prix_unitaire,
            created_at=ligne.created_at,
        ))
    
    return BonCommandeDetails(
        id=bon.id,
        numero=bon.numero,
        fournisseur_id=bon.fournisseur_id,
        fournisseur_nom=fournisseur.nom,
        site_id=bon.site_id,
        statut=bon.statut.value,
        date_commande=bon.date_commande,
        date_livraison_prevue=bon.date_livraison_prevue,
        date_livraison_effective=bon.date_livraison_effective,
        montant_total=bon.montant_total,
        commentaire=bon.commentaire,
        created_at=bon.created_at,
        updated_at=bon.updated_at,
        lignes=lignes,
    )


# ===========================================================================
# CRÉER UN BON DE COMMANDE
# ===========================================================================

@router.post("", response_model=BonCommandeOut, status_code=status.HTTP_201_CREATED)
async def create_bon_commande(
    bon_data: BonCommandeCreate,
    current_user: User = Depends(require_pharmacien_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Créer un nouveau bon de commande"""
    # Vérifier que le fournisseur existe
    fournisseur_stmt = select(Fournisseur).where(Fournisseur.id == bon_data.fournisseur_id)
    fournisseur_result = await db.execute(fournisseur_stmt)
    fournisseur = fournisseur_result.scalar_one_or_none()
    
    if not fournisseur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fournisseur non trouvé"
        )
    
    # Générer le numéro
    year = bon_data.date_commande.year
    numero = await generate_numero_bon_commande(db, current_user.site_id, year)
    
    # Calculer le montant total
    montant_total = Decimal(0)
    for ligne in bon_data.lignes:
        if ligne.prix_unitaire:
            montant_total += ligne.prix_unitaire * ligne.quantite_commandee
    
    # Créer le bon de commande
    bon = BonCommande(
        id=uuid_module.uuid4(),
        numero=numero,
        fournisseur_id=bon_data.fournisseur_id,
        site_id=current_user.site_id,
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        statut=StatutCommandeEnum.BROUILLON,
        date_commande=bon_data.date_commande,
        date_livraison_prevue=bon_data.date_livraison_prevue,
        montant_total=montant_total if montant_total > 0 else None,
        commentaire=bon_data.commentaire,
    )
    
    db.add(bon)
    await db.flush()
    
    # Créer les lignes
    for ligne_data in bon_data.lignes:
        montant_ligne = (ligne_data.prix_unitaire or Decimal(0)) * ligne_data.quantite_commandee
        ligne = BonCommandeLigne(
            id=uuid_module.uuid4(),
            bon_commande_id=bon.id,
            medicament_id=ligne_data.medicament_id,
            quantite_commandee=ligne_data.quantite_commandee,
            quantite_recue=0,
            prix_unitaire=ligne_data.prix_unitaire or Decimal(0),
            montant_ligne=montant_ligne,
        )
        db.add(ligne)
    
    await db.commit()
    await db.refresh(bon)

    return BonCommandeOut(
        id=bon.id,
        numero=bon.numero,
        fournisseur_id=bon.fournisseur_id,
        fournisseur_nom=fournisseur.nom,
        site_id=bon.site_id,
        statut=bon.statut.value,
        date_commande=bon.date_commande,
        date_livraison_prevue=bon.date_livraison_prevue,
        date_livraison_effective=bon.date_livraison_effective,
        montant_total=bon.montant_total,
        commentaire=bon.commentaire,
        created_at=bon.created_at,
        updated_at=bon.updated_at,
    )


# ===========================================================================
# VALIDER UN BON DE COMMANDE
# ===========================================================================

@router.put("/{bon_id}/valider", response_model=BonCommandeOut)
async def valider_bon_commande(
    bon_id: uuid_module.UUID,
    current_user: User = Depends(require_pharmacien_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Valider un bon de commande (passe de brouillon à validée)"""
    stmt = select(BonCommande, Fournisseur).join(
        Fournisseur, BonCommande.fournisseur_id == Fournisseur.id
    ).where(BonCommande.id == bon_id)
    result = await db.execute(stmt)
    row = result.one_or_none()
    
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bon de commande non trouvé"
        )
    
    bon, fournisseur = row
    
    if bon.statut != StatutCommandeEnum.BROUILLON:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seuls les bons en brouillon peuvent être validés"
        )
    
    bon.statut = StatutCommandeEnum.VALIDEE
    bon.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(bon)

    return BonCommandeOut(
        id=bon.id,
        numero=bon.numero,
        fournisseur_id=bon.fournisseur_id,
        fournisseur_nom=fournisseur.nom,
        site_id=bon.site_id,
        statut=bon.statut.value,
        date_commande=bon.date_commande,
        date_livraison_prevue=bon.date_livraison_prevue,
        date_livraison_effective=bon.date_livraison_effective,
        montant_total=bon.montant_total,
        commentaire=bon.commentaire,
        created_at=bon.created_at,
        updated_at=bon.updated_at,
    )
