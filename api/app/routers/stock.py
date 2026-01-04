"""
Router pour la gestion des stocks de médicaments
"""
import uuid as uuid_module
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, ConfigDict

from app.database import get_db
from app.models import User, Site
from app.models.inventory import (
    StockSite,
    Medicament,
    LotMedicament,
    StockMovement,
    TypeMouvementEnum
)
from app.schemas import UserRole, BaseSchema
from app.security import get_current_user

router = APIRouter(prefix="/stock", tags=["Stock"])


# ===========================================================================
# SCHEMAS
# ===========================================================================

class StockSiteOut(BaseSchema):
    """Schéma de sortie pour un stock de site"""
    id: uuid_module.UUID
    medicament_id: uuid_module.UUID
    site_id: uuid_module.UUID
    quantite_actuelle: int
    seuil_alerte: Optional[int]
    created_at: datetime
    updated_at: datetime


class StockSiteDetails(StockSiteOut):
    """Stock avec détails"""
    medicament_nom: str
    medicament_code: str
    medicament_dci: Optional[str]
    site_nom: str
    en_alerte: bool


class StockMovementCreate(BaseModel):
    """Schéma pour créer un mouvement de stock"""
    type_mouvement: str = Field(description="Type: entree, sortie, ajustement_positif, ajustement_negatif, peremption, perte")
    medicament_id: uuid_module.UUID
    quantite: int = Field(ge=1)
    lot_id: Optional[uuid_module.UUID] = None
    reference_externe: Optional[str] = None
    commentaire: Optional[str] = None


class StockMovementOut(BaseSchema):
    """Schéma de sortie pour un mouvement de stock"""
    id: uuid_module.UUID
    type_mouvement: str
    medicament_id: uuid_module.UUID
    site_id: uuid_module.UUID
    created_by: uuid_module.UUID
    quantite: int
    date_mouvement: datetime
    reference_externe: Optional[str]
    commentaire: Optional[str]
    created_at: datetime


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


# ===========================================================================
# LISTE DES STOCKS PAR SITE
# ===========================================================================

@router.get("/sites/{site_id}", response_model=dict)
async def list_stock_site(
    site_id: uuid_module.UUID,
    search: Optional[str] = Query(None, description="Recherche par nom ou code médicament"),
    en_alerte: Optional[bool] = Query(None, description="Filtrer par alerte de stock"),
    cursor: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Liste les stocks d'un site"""
    # Vérifier permissions
    if current_user.role not in [UserRole.ADMIN, UserRole.PHARMACIEN]:
        if current_user.site_id != site_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vous ne pouvez consulter que les stocks de votre site"
            )
    
    # Query avec jointures
    query = (
        select(StockSite, Medicament, Site)
        .join(Medicament, StockSite.medicament_id == Medicament.id)
        .join(Site, StockSite.site_id == Site.id)
        .where(StockSite.site_id == site_id)
        .where(Medicament.is_active == True)
        .order_by(Medicament.nom)
    )
    
    # Filtres
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            or_(
                Medicament.nom.ilike(search_pattern),
                Medicament.code.ilike(search_pattern),
                Medicament.dci.ilike(search_pattern),
            )
        )
    
    if en_alerte is not None:
        if en_alerte:
            query = query.where(
                StockSite.quantite_actuelle <= func.coalesce(
                    StockSite.seuil_alerte,
                    Medicament.seuil_alerte_defaut,
                    0
                )
            )
    
    if cursor:
        query = query.where(StockSite.id > uuid_module.UUID(cursor))
    
    query = query.limit(limit + 1)
    result = await db.execute(query)
    rows = result.all()
    
    has_more = len(rows) > limit
    if has_more:
        rows = rows[:limit]
    
    items = []
    for stock, medicament, site_obj in rows:
        seuil = stock.seuil_alerte if stock.seuil_alerte is not None else medicament.seuil_alerte_defaut
        en_alerte = seuil is not None and stock.quantite_actuelle <= seuil
        
        items.append(StockSiteDetails(
            id=stock.id,
            medicament_id=stock.medicament_id,
            site_id=stock.site_id,
            quantite_actuelle=stock.quantite_actuelle,
            seuil_alerte=stock.seuil_alerte,
            created_at=stock.created_at,
            updated_at=stock.updated_at,
            medicament_nom=medicament.nom,
            medicament_code=medicament.code,
            medicament_dci=medicament.dci,
            site_nom=site_obj.nom,
            en_alerte=en_alerte,
        ))
    
    return {
        "items": items,
        "next_cursor": str(rows[-1][0].id) if rows else None,
        "has_more": has_more,
    }


# ===========================================================================
# MOUVEMENTS DE STOCK
# ===========================================================================

@router.post("/mouvements", response_model=StockMovementOut, status_code=status.HTTP_201_CREATED)
async def create_stock_movement(
    movement_data: StockMovementCreate,
    current_user: User = Depends(require_pharmacien_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Enregistre un mouvement de stock"""
    site_id = current_user.site_id
    
    # Récupérer ou créer le stock
    stock_stmt = select(StockSite).where(
        and_(
            StockSite.site_id == site_id,
            StockSite.medicament_id == movement_data.medicament_id
        )
    )
    stock_result = await db.execute(stock_stmt)
    stock = stock_result.scalar_one_or_none()
    
    if not stock:
        # Créer le stock automatiquement
        med_stmt = select(Medicament).where(Medicament.id == movement_data.medicament_id)
        med = (await db.execute(med_stmt)).scalar_one_or_none()

        stock = StockSite(
            id=uuid_module.uuid4(),
            site_id=site_id,
            tenant_id=current_user.tenant_id,
            medicament_id=movement_data.medicament_id,
            quantite_actuelle=0,
            seuil_alerte=med.seuil_alerte_defaut if med else None,
        )
        db.add(stock)
        await db.flush()

    stock_actuel = stock.quantite_actuelle

    # Calculer le nouveau stock
    if movement_data.type_mouvement in ["entree", "ajustement_positif"]:
        nouveau_stock = stock_actuel + movement_data.quantite
    else:
        nouveau_stock = stock_actuel - movement_data.quantite
        if nouveau_stock < 0 and movement_data.type_mouvement != "ajustement_negatif":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock insuffisant. Actuel: {stock_actuel}, demandé: {movement_data.quantite}"
            )

    # Créer le mouvement
    movement = StockMovement(
        id=uuid_module.uuid4(),
        type_mouvement=TypeMouvementEnum(movement_data.type_mouvement),
        medicament_id=movement_data.medicament_id,
        site_id=site_id,
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        quantite=movement_data.quantite,
        lot_id=movement_data.lot_id,
        reference_externe=movement_data.reference_externe,
        commentaire=movement_data.commentaire,
        date_mouvement=datetime.utcnow(),
    )

    stock.quantite_actuelle = nouveau_stock
    stock.updated_at = datetime.utcnow()
    
    db.add(movement)
    await db.commit()
    await db.refresh(movement)
    
    return StockMovementOut.model_validate(movement)


# ===========================================================================
# HISTORIQUE DES MOUVEMENTS
# ===========================================================================

@router.get("/mouvements", response_model=dict)
async def list_stock_movements(
    site_id: Optional[uuid_module.UUID] = Query(None),
    medicament_id: Optional[uuid_module.UUID] = Query(None),
    cursor: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Liste l'historique des mouvements de stock"""
    query = (
        select(StockMovement)
        .order_by(desc(StockMovement.date_mouvement))
    )
    
    # Filtres
    conditions = []
    
    if site_id:
        conditions.append(StockMovement.site_id == site_id)
    elif current_user.role not in [UserRole.ADMIN, UserRole.PHARMACIEN]:
        conditions.append(StockMovement.site_id == current_user.site_id)
    
    if medicament_id:
        conditions.append(StockMovement.medicament_id == medicament_id)
    
    if conditions:
        query = query.where(and_(*conditions))
    
    if cursor:
        query = query.where(StockMovement.id > uuid_module.UUID(cursor))
    
    query = query.limit(limit + 1)
    result = await db.execute(query)
    movements = result.scalars().all()
    
    has_more = len(movements) > limit
    if has_more:
        movements = movements[:limit]
    
    return {
        "items": [StockMovementOut.model_validate(m) for m in movements],
        "next_cursor": str(movements[-1].id) if movements else None,
        "has_more": has_more,
    }
