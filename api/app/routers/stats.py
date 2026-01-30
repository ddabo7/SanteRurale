"""
Router pour les statistiques publiques de la plateforme
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.base_models import Site, User, Patient

router = APIRouter(prefix="/stats", tags=["Statistics"])


@router.get("/public")
async def get_public_stats(db: AsyncSession = Depends(get_db)):
    """
    Récupère les statistiques publiques pour la landing page.
    Cet endpoint est public (pas d'authentification requise).
    """
    # Nombre de sites actifs (centres de santé)
    sites_count_result = await db.execute(
        select(func.count(Site.id)).where(Site.actif == True)
    )
    sites_count = sites_count_result.scalar() or 0

    # Nombre d'utilisateurs actifs (soignants)
    users_count_result = await db.execute(
        select(func.count(User.id)).where(User.actif == True)
    )
    users_count = users_count_result.scalar() or 0

    # Nombre de patients (non supprimés)
    patients_count_result = await db.execute(
        select(func.count(Patient.id)).where(Patient.deleted_at == None)
    )
    patients_count = patients_count_result.scalar() or 0

    # Disponibilité (statique pour l'instant - pourrait être calculée depuis un monitoring)
    availability = 99.9

    return {
        "health_centers": sites_count,
        "active_caregivers": users_count,
        "patients_followed": patients_count,
        "availability": availability
    }
