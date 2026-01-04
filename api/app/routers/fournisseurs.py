"""
Router pour la gestion des fournisseurs
"""
import uuid as uuid_module
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, ConfigDict, EmailStr

from app.database import get_db
from app.models import User
from app.models.inventory import Fournisseur, BonCommande
from app.schemas import UserRole, BaseSchema
from app.security import get_current_user

router = APIRouter(prefix="/fournisseurs", tags=["Fournisseurs"])


# ===========================================================================
# SCHEMAS
# ===========================================================================

class FournisseurBase(BaseSchema):
    """Schéma de base pour un fournisseur"""
    code: str = Field(min_length=1, max_length=50)
    nom: str = Field(min_length=2, max_length=200)
    contact_nom: Optional[str] = Field(None, max_length=200)
    telephone: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    adresse: Optional[str] = None
    ville: Optional[str] = Field(None, max_length=100)
    pays: str = Field(default="Mali", max_length=100)
    is_active: bool = True


class FournisseurCreate(FournisseurBase):
    """Schéma pour créer un fournisseur"""
    pass


class FournisseurUpdate(BaseModel):
    """Schéma pour mettre à jour un fournisseur"""
    nom: Optional[str] = Field(None, min_length=2, max_length=200)
    contact_nom: Optional[str] = Field(None, max_length=200)
    telephone: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    adresse: Optional[str] = None
    ville: Optional[str] = Field(None, max_length=100)
    pays: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


class FournisseurOut(FournisseurBase):
    """Schéma de sortie pour un fournisseur"""
    id: uuid_module.UUID
    created_at: datetime
    updated_at: datetime


class BonCommandeSimple(BaseModel):
    """Bon de commande simplifié"""
    id: uuid_module.UUID
    numero: str
    date_commande: datetime
    statut: str
    montant_total: Optional[float]
    site_id: uuid_module.UUID

    model_config = ConfigDict(from_attributes=True)


class FournisseurDetails(FournisseurOut):
    """Fournisseur avec nombre de bons de commande"""
    nb_bons_commande: int = 0


# ===========================================================================
# HELPER FUNCTIONS - PERMISSIONS
# ===========================================================================

def require_pharmacien_or_admin(current_user: User = Depends(get_current_user)) -> User:
    """Vérifie que l'utilisateur est pharmacien ou admin"""
    if current_user.role not in [UserRole.PHARMACIEN, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux pharmaciens et administrateurs"
        )
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Vérifie que l'utilisateur est admin"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs"
        )
    return current_user


# ===========================================================================
# LISTE DES FOURNISSEURS (tous utilisateurs authentifiés)
# ===========================================================================

@router.get("", response_model=dict)
async def list_fournisseurs(
    search: Optional[str] = Query(None, description="Recherche par nom, code, ville, pays ou contact"),
    pays: Optional[str] = Query(None, description="Filtrer par pays"),
    actif: Optional[bool] = Query(None, description="Filtrer par statut actif/inactif"),
    cursor: Optional[str] = Query(None, description="Curseur de pagination"),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Liste tous les fournisseurs avec pagination et filtres
    
    Permissions: Tous les utilisateurs authentifiés
    """
    # Query de base
    query = select(Fournisseur).order_by(Fournisseur.nom)
    
    # Filtres
    conditions = []
    
    if search:
        search_pattern = f"%{search}%"
        conditions.append(
            or_(
                Fournisseur.nom.ilike(search_pattern),
                Fournisseur.code.ilike(search_pattern),
                Fournisseur.ville.ilike(search_pattern),
                Fournisseur.pays.ilike(search_pattern),
                Fournisseur.contact_nom.ilike(search_pattern),
            )
        )
    
    if pays:
        conditions.append(Fournisseur.pays.ilike(f"%{pays}%"))
    
    if actif is not None:
        conditions.append(Fournisseur.is_active == actif)
    
    if conditions:
        query = query.where(and_(*conditions))
    
    # Pagination par curseur
    if cursor:
        try:
            cursor_id = uuid_module.UUID(cursor)
            query = query.where(Fournisseur.id > cursor_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Curseur invalide"
            )
    
    # Limiter les résultats
    query = query.limit(limit + 1)
    
    result = await db.execute(query)
    fournisseurs = result.scalars().all()
    
    # Déterminer le prochain curseur
    has_more = len(fournisseurs) > limit
    if has_more:
        fournisseurs = fournisseurs[:limit]
        next_cursor = str(fournisseurs[-1].id) if fournisseurs else None
    else:
        next_cursor = None
    
    return {
        "items": [FournisseurOut.model_validate(f) for f in fournisseurs],
        "next_cursor": next_cursor,
        "has_more": has_more,
    }


# ===========================================================================
# DÉTAILS D'UN FOURNISSEUR
# ===========================================================================

@router.get("/{fournisseur_id}", response_model=FournisseurDetails)
async def get_fournisseur(
    fournisseur_id: uuid_module.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Récupère les détails d'un fournisseur
    
    Permissions: Tous les utilisateurs authentifiés
    """
    # Récupérer le fournisseur
    stmt = select(Fournisseur).where(Fournisseur.id == fournisseur_id)
    result = await db.execute(stmt)
    fournisseur = result.scalar_one_or_none()
    
    if not fournisseur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fournisseur non trouvé"
        )
    
    # Compter les bons de commande
    count_stmt = select(func.count(BonCommande.id)).where(
        BonCommande.fournisseur_id == fournisseur_id
    )
    count_result = await db.execute(count_stmt)
    nb_bons_commande = count_result.scalar_one()
    
    # Retourner le fournisseur avec le nombre de bons de commande
    return FournisseurDetails(
        **FournisseurOut.model_validate(fournisseur).model_dump(),
        nb_bons_commande=nb_bons_commande,
    )


# ===========================================================================
# BONS DE COMMANDE D'UN FOURNISSEUR
# ===========================================================================

@router.get("/{fournisseur_id}/bons-commande", response_model=dict)
async def get_fournisseur_bons_commande(
    fournisseur_id: uuid_module.UUID,
    statut: Optional[str] = Query(None, description="Filtrer par statut (brouillon, validee, envoyee, recue, annulee)"),
    cursor: Optional[str] = Query(None, description="Curseur de pagination"),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Liste les bons de commande d'un fournisseur avec pagination
    
    Permissions: Tous les utilisateurs authentifiés
    """
    # Vérifier que le fournisseur existe
    stmt = select(Fournisseur).where(Fournisseur.id == fournisseur_id)
    result = await db.execute(stmt)
    fournisseur = result.scalar_one_or_none()
    
    if not fournisseur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fournisseur non trouvé"
        )
    
    # Query de base
    query = (
        select(BonCommande)
        .where(BonCommande.fournisseur_id == fournisseur_id)
        .order_by(BonCommande.date_commande.desc())
    )
    
    # Filtrer par statut si demandé
    if statut:
        query = query.where(BonCommande.statut == statut)
    
    # Pagination par curseur
    if cursor:
        try:
            cursor_id = uuid_module.UUID(cursor)
            query = query.where(BonCommande.id > cursor_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Curseur invalide"
            )
    
    # Limiter les résultats
    query = query.limit(limit + 1)
    
    result = await db.execute(query)
    bons_commande = result.scalars().all()
    
    # Déterminer le prochain curseur
    has_more = len(bons_commande) > limit
    if has_more:
        bons_commande = bons_commande[:limit]
        next_cursor = str(bons_commande[-1].id) if bons_commande else None
    else:
        next_cursor = None
    
    return {
        "items": [BonCommandeSimple.model_validate(bc) for bc in bons_commande],
        "next_cursor": next_cursor,
        "has_more": has_more,
    }


# ===========================================================================
# CRÉER UN FOURNISSEUR (pharmacien/admin uniquement)
# ===========================================================================

@router.post("", response_model=FournisseurOut, status_code=status.HTTP_201_CREATED)
async def create_fournisseur(
    fournisseur_data: FournisseurCreate,
    current_user: User = Depends(require_pharmacien_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Créer un nouveau fournisseur
    
    Permissions: Pharmacien ou Admin uniquement
    """
    # Vérifier l'unicité du code
    stmt = select(Fournisseur).where(Fournisseur.code == fournisseur_data.code)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Un fournisseur avec le code '{fournisseur_data.code}' existe déjà"
        )
    
    # Créer le fournisseur
    fournisseur = Fournisseur(
        id=uuid_module.uuid4(),
        **fournisseur_data.model_dump(),
    )
    
    db.add(fournisseur)
    await db.commit()
    await db.refresh(fournisseur)
    
    return FournisseurOut.model_validate(fournisseur)


# ===========================================================================
# METTRE À JOUR UN FOURNISSEUR (pharmacien/admin uniquement)
# ===========================================================================

@router.put("/{fournisseur_id}", response_model=FournisseurOut)
async def update_fournisseur(
    fournisseur_id: uuid_module.UUID,
    fournisseur_data: FournisseurUpdate,
    current_user: User = Depends(require_pharmacien_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Mettre à jour un fournisseur
    
    Permissions: Pharmacien ou Admin uniquement
    """
    # Récupérer le fournisseur
    stmt = select(Fournisseur).where(Fournisseur.id == fournisseur_id)
    result = await db.execute(stmt)
    fournisseur = result.scalar_one_or_none()
    
    if not fournisseur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fournisseur non trouvé"
        )
    
    # Mettre à jour les champs fournis
    update_data = fournisseur_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(fournisseur, field, value)
    
    fournisseur.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(fournisseur)
    
    return FournisseurOut.model_validate(fournisseur)


# ===========================================================================
# SUPPRIMER UN FOURNISSEUR (soft delete, admin uniquement)
# ===========================================================================

@router.delete("/{fournisseur_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fournisseur(
    fournisseur_id: uuid_module.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Supprime un fournisseur (soft delete en mettant is_active=False)
    
    Permissions: Admin uniquement
    """
    # Récupérer le fournisseur
    stmt = select(Fournisseur).where(Fournisseur.id == fournisseur_id)
    result = await db.execute(stmt)
    fournisseur = result.scalar_one_or_none()
    
    if not fournisseur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fournisseur non trouvé"
        )
    
    # Soft delete
    fournisseur.is_active = False
    fournisseur.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return None
