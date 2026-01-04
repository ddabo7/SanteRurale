"""
Router pour la gestion des médicaments (inventaire)
"""
import uuid as uuid_module
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, or_, and_, String, cast
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field, ConfigDict

from app.database import get_db
from app.models import User
from app.models.inventory import Medicament, StockSite
from app.schemas import UserRole, BaseSchema
from app.security import get_current_user

router = APIRouter(prefix="/medicaments", tags=["Medicaments"])


# ===========================================================================
# SCHEMAS
# ===========================================================================

class MedicamentBase(BaseSchema):
    """Schéma de base pour un médicament"""
    code: str = Field(min_length=1, max_length=50)
    nom: str = Field(min_length=2, max_length=200)
    dci: Optional[str] = Field(None, max_length=200)
    forme: str = Field(description="Forme pharmaceutique")
    dosage: str = Field(description="Dosage du médicament")
    unite_conditionnement: Optional[str] = Field(None, max_length=50)
    quantite_par_unite: Optional[int] = Field(None, ge=1)
    prix_unitaire_reference: float = Field(default=0, ge=0)
    seuil_alerte_defaut: Optional[int] = Field(None, ge=0)
    is_active: bool = True


class MedicamentCreate(MedicamentBase):
    """Schéma pour créer un médicament"""
    pass


class MedicamentUpdate(BaseModel):
    """Schéma pour mettre à jour un médicament"""
    nom: Optional[str] = Field(None, min_length=2, max_length=200)
    dci: Optional[str] = Field(None, max_length=200)
    forme: Optional[str] = None
    dosage: Optional[str] = Field(None, max_length=100)
    unite_conditionnement: Optional[str] = Field(None, max_length=50)
    quantite_par_unite: Optional[int] = Field(None, ge=1)
    prix_unitaire_reference: Optional[float] = Field(None, ge=0)
    seuil_alerte_defaut: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class StockInfo(BaseModel):
    """Information de stock par site"""
    site_id: uuid_module.UUID
    site_nom: str
    quantite_actuelle: int
    seuil_alerte: Optional[int]
    en_alerte: bool

    model_config = ConfigDict(from_attributes=True)


class MedicamentOut(MedicamentBase):
    """Schéma de sortie pour un médicament"""
    id: uuid_module.UUID
    created_at: datetime
    updated_at: datetime


class MedicamentDetails(MedicamentOut):
    """Médicament avec stocks par site"""
    stocks: List[StockInfo] = []


class MedicamentLowStock(BaseModel):
    """Médicament avec stock faible"""
    medicament_id: uuid_module.UUID
    code: str
    nom: str
    dci: Optional[str]
    forme: Optional[str]
    site_id: uuid_module.UUID
    site_nom: str
    quantite_actuelle: int
    seuil_alerte: int

    model_config = ConfigDict(from_attributes=True)


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
# LISTE DES MÉDICAMENTS (tous utilisateurs authentifiés)
# ===========================================================================

@router.get("", response_model=dict)
async def list_medicaments(
    search: Optional[str] = Query(None, description="Recherche par nom, code ou DCI"),
    forme: Optional[str] = Query(None, description="Filtrer par forme pharmaceutique"),
    actif: Optional[bool] = Query(None, description="Filtrer par statut actif/inactif"),
    cursor: Optional[str] = Query(None, description="Curseur de pagination"),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Liste tous les médicaments avec pagination et filtres
    
    Permissions: Tous les utilisateurs authentifiés
    """
    # Query de base
    query = select(Medicament).order_by(Medicament.nom)
    
    # Filtres
    conditions = []
    
    if search:
        search_pattern = f"%{search}%"
        conditions.append(
            or_(
                Medicament.nom.ilike(search_pattern),
                Medicament.code.ilike(search_pattern),
                Medicament.dci.ilike(search_pattern),
            )
        )
    
    if forme:
        conditions.append(cast(Medicament.forme, String).ilike(f"%{forme}%"))
    
    if actif is not None:
        conditions.append(Medicament.is_active == actif)
    
    if conditions:
        query = query.where(and_(*conditions))
    
    # Pagination par curseur
    if cursor:
        try:
            cursor_id = uuid_module.UUID(cursor)
            query = query.where(Medicament.id > cursor_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Curseur invalide"
            )
    
    # Limiter les résultats
    query = query.limit(limit + 1)
    
    result = await db.execute(query)
    medicaments = result.scalars().all()
    
    # Déterminer le prochain curseur
    has_more = len(medicaments) > limit
    if has_more:
        medicaments = medicaments[:limit]
        next_cursor = str(medicaments[-1].id) if medicaments else None
    else:
        next_cursor = None
    
    return {
        "items": [MedicamentOut.model_validate(m) for m in medicaments],
        "next_cursor": next_cursor,
        "has_more": has_more,
    }


# ===========================================================================
# DÉTAILS D'UN MÉDICAMENT (avec stocks par site)
# ===========================================================================

@router.get("/{medicament_id}", response_model=MedicamentDetails)
async def get_medicament(
    medicament_id: uuid_module.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Récupère les détails d'un médicament avec les stocks par site
    
    Permissions: Tous les utilisateurs authentifiés
    """
    # Récupérer le médicament
    stmt = select(Medicament).where(Medicament.id == medicament_id)
    result = await db.execute(stmt)
    medicament = result.scalar_one_or_none()
    
    if not medicament:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Médicament non trouvé"
        )
    
    # Récupérer les stocks par site avec jointure sur Site
    from app.models.base_models import Site
    
    stocks_stmt = (
        select(StockSite, Site)
        .join(Site, StockSite.site_id == Site.id)
        .where(StockSite.medicament_id == medicament_id)
        .order_by(Site.nom)
    )
    
    stocks_result = await db.execute(stocks_stmt)
    stocks_data = stocks_result.all()
    
    # Construire la liste des stocks
    stocks = []
    for stock, site in stocks_data:
        en_alerte = False
        if stock.seuil_alerte is not None:
            en_alerte = stock.quantite_actuelle <= stock.seuil_alerte
        elif medicament.seuil_alerte_defaut is not None:
            en_alerte = stock.quantite_actuelle <= medicament.seuil_alerte_defaut

        stocks.append(StockInfo(
            site_id=site.id,
            site_nom=site.nom,
            quantite_actuelle=stock.quantite_actuelle,
            seuil_alerte=stock.seuil_alerte,
            en_alerte=en_alerte,
        ))

    # Retourner le médicament avec ses stocks
    return MedicamentDetails(
        **MedicamentOut.model_validate(medicament).model_dump(),
        stocks=stocks,
    )


# ===========================================================================
# STOCKS D'UN MÉDICAMENT PAR SITE
# ===========================================================================

@router.get("/{medicament_id}/stocks", response_model=List[StockInfo])
async def get_medicament_stocks(
    medicament_id: uuid_module.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Liste les stocks d'un médicament par site
    
    Permissions: Tous les utilisateurs authentifiés
    """
    # Vérifier que le médicament existe
    stmt = select(Medicament).where(Medicament.id == medicament_id)
    result = await db.execute(stmt)
    medicament = result.scalar_one_or_none()
    
    if not medicament:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Médicament non trouvé"
        )
    
    # Récupérer les stocks
    from app.models.base_models import Site
    
    stocks_stmt = (
        select(StockSite, Site)
        .join(Site, StockSite.site_id == Site.id)
        .where(StockSite.medicament_id == medicament_id)
        .order_by(Site.nom)
    )
    
    stocks_result = await db.execute(stocks_stmt)
    stocks_data = stocks_result.all()
    
    stocks = []
    for stock, site in stocks_data:
        en_alerte = False
        if stock.seuil_alerte is not None:
            en_alerte = stock.quantite_actuelle <= stock.seuil_alerte
        elif medicament.seuil_alerte_defaut is not None:
            en_alerte = stock.quantite_actuelle <= medicament.seuil_alerte_defaut

        stocks.append(StockInfo(
            site_id=site.id,
            site_nom=site.nom,
            quantite_actuelle=stock.quantite_actuelle,
            seuil_alerte=stock.seuil_alerte,
            en_alerte=en_alerte,
        ))

    return stocks


# ===========================================================================
# MÉDICAMENTS EN ALERTE DE STOCK
# ===========================================================================

@router.get("/low-stock/list", response_model=List[MedicamentLowStock])
async def get_low_stock_medicaments(
    site_id: Optional[uuid_module.UUID] = Query(None, description="Filtrer par site"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Liste les médicaments dont le stock est sous le seuil d'alerte
    
    Permissions: Tous les utilisateurs authentifiés
    """
    from app.models.base_models import Site
    
    # Query avec jointures
    query = (
        select(
            StockSite.medicament_id,
            Medicament.code,
            Medicament.nom,
            Medicament.dci,
            Medicament.forme,
            StockSite.site_id,
            Site.nom.label("site_nom"),
            StockSite.quantite_actuelle,
            func.coalesce(
                StockSite.seuil_alerte,
                Medicament.seuil_alerte_defaut,
                0
            ).label("seuil_alerte")
        )
        .select_from(StockSite)
        .join(Medicament, StockSite.medicament_id == Medicament.id)
        .join(Site, StockSite.site_id == Site.id)
        .where(
            and_(
                Medicament.is_active == True,
                StockSite.quantite_actuelle <= func.coalesce(
                    StockSite.seuil_alerte,
                    Medicament.seuil_alerte_defaut,
                    0
                )
            )
        )
    )
    
    # Filtrer par site si demandé
    if site_id:
        query = query.where(StockSite.site_id == site_id)
    
    # Filtrer par site de l'utilisateur si pas admin
    if current_user.role not in [UserRole.ADMIN, UserRole.PHARMACIEN]:
        query = query.where(StockSite.site_id == current_user.site_id)
    
    query = query.order_by(Site.nom, Medicament.nom)
    
    result = await db.execute(query)
    rows = result.all()
    
    return [
        MedicamentLowStock(
            medicament_id=row.medicament_id,
            code=row.code,
            nom=row.nom,
            dci=row.dci,
            forme=row.forme,
            site_id=row.site_id,
            site_nom=row.site_nom,
            quantite_actuelle=row.quantite_actuelle,
            seuil_alerte=row.seuil_alerte,
        )
        for row in rows
    ]


# ===========================================================================
# CRÉER UN MÉDICAMENT (pharmacien/admin uniquement)
# ===========================================================================

@router.post("", response_model=MedicamentOut, status_code=status.HTTP_201_CREATED)
async def create_medicament(
    medicament_data: MedicamentCreate,
    current_user: User = Depends(require_pharmacien_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Créer un nouveau médicament
    
    Permissions: Pharmacien ou Admin uniquement
    """
    # Vérifier l'unicité du code
    stmt = select(Medicament).where(Medicament.code == medicament_data.code)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Un médicament avec le code '{medicament_data.code}' existe déjà"
        )
    
    # Créer le médicament
    medicament = Medicament(
        id=uuid_module.uuid4(),
        **medicament_data.model_dump(),
    )
    
    db.add(medicament)
    await db.commit()
    await db.refresh(medicament)
    
    return MedicamentOut.model_validate(medicament)


# ===========================================================================
# METTRE À JOUR UN MÉDICAMENT (pharmacien/admin uniquement)
# ===========================================================================

@router.put("/{medicament_id}", response_model=MedicamentOut)
async def update_medicament(
    medicament_id: uuid_module.UUID,
    medicament_data: MedicamentUpdate,
    current_user: User = Depends(require_pharmacien_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Mettre à jour un médicament
    
    Permissions: Pharmacien ou Admin uniquement
    """
    # Récupérer le médicament
    stmt = select(Medicament).where(Medicament.id == medicament_id)
    result = await db.execute(stmt)
    medicament = result.scalar_one_or_none()
    
    if not medicament:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Médicament non trouvé"
        )
    
    # Mettre à jour les champs fournis
    update_data = medicament_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(medicament, field, value)
    
    medicament.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(medicament)
    
    return MedicamentOut.model_validate(medicament)


# ===========================================================================
# SUPPRIMER UN MÉDICAMENT (soft delete, admin uniquement)
# ===========================================================================

@router.delete("/{medicament_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_medicament(
    medicament_id: uuid_module.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Supprime un médicament (soft delete en mettant is_active=False)
    
    Permissions: Admin uniquement
    """
    # Récupérer le médicament
    stmt = select(Medicament).where(Medicament.id == medicament_id)
    result = await db.execute(stmt)
    medicament = result.scalar_one_or_none()
    
    if not medicament:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Médicament non trouvé"
        )
    
    # Soft delete
    medicament.is_active = False
    medicament.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return None
