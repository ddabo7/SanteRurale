"""
Router pour les références/évacuations
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from datetime import datetime
import uuid
import logging

from app.database import get_db
from app.models.base_models import Reference, Encounter, ReferenceStatutEnum
from app.routers.auth import get_current_user

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/references", tags=["references"])


# ===========================================================================
# SCHEMAS
# ===========================================================================

class ReferenceCreate(BaseModel):
    """Schéma pour créer une référence"""
    encounter_id: str
    etablissement_destination: str = Field(..., min_length=1, max_length=500)
    motif: str = Field(..., min_length=1)
    statut: str = "en_attente"
    date_reference: str | None = None
    commentaire: str | None = None


class ReferenceResponse(BaseModel):
    """Schéma de réponse pour une référence"""
    id: str
    encounter_id: str
    etablissement_destination: str
    motif: str
    statut: str
    date_reference: datetime
    date_confirmation: datetime | None
    commentaire: str | None
    site_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===========================================================================
# ENDPOINTS
# ===========================================================================

@router.post("", response_model=ReferenceResponse, status_code=201)
async def create_reference(
    data: ReferenceCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Créer une nouvelle référence/évacuation pour une consultation
    """
    # Vérifier que la consultation existe et appartient au même site
    stmt = select(Encounter).where(
        Encounter.id == uuid.UUID(data.encounter_id),
        Encounter.site_id == current_user.site_id
    )
    result = await db.execute(stmt)
    encounter = result.scalar_one_or_none()

    if not encounter:
        raise HTTPException(status_code=404, detail="Consultation non trouvée")

    # Valider et convertir le statut
    logger.info(f"🔍 DEBUG: data.statut reçu = '{data.statut}'")
    try:
        # Chercher l'enum par sa valeur, pas par son nom
        statut_enum = next(e for e in ReferenceStatutEnum if e.value == data.statut)
        logger.info(f"✅ DEBUG: statut_enum trouvé = {statut_enum}, value = {statut_enum.value}")
    except StopIteration:
        logger.warning(f"⚠️ DEBUG: Statut non trouvé, utilisation de en_attente par défaut")
        statut_enum = ReferenceStatutEnum.en_attente

    # Créer la référence
    reference = Reference(
        encounter_id=uuid.UUID(data.encounter_id),
        etablissement_destination=data.etablissement_destination,
        motif=data.motif,
        statut=statut_enum,
        date_reference=datetime.fromisoformat(data.date_reference) if data.date_reference else datetime.now(),
        commentaire=data.commentaire,
        site_id=current_user.site_id,
    )

    db.add(reference)
    await db.commit()
    await db.refresh(reference)

    # Convertir en ReferenceResponse avec les UUIDs en string
    return ReferenceResponse(
        id=str(reference.id),
        encounter_id=str(reference.encounter_id),
        etablissement_destination=reference.etablissement_destination,
        motif=reference.motif,
        statut=reference.statut.value,
        date_reference=reference.date_reference,
        date_confirmation=reference.date_confirmation,
        commentaire=reference.commentaire,
        site_id=str(reference.site_id),
        created_at=reference.created_at,
        updated_at=reference.updated_at,
    )


@router.get("/encounter/{encounter_id}", response_model=list[ReferenceResponse])
async def get_references_by_encounter(
    encounter_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Récupérer toutes les références pour une consultation donnée
    """
    # Vérifier l'accès à la consultation
    stmt = select(Encounter).where(Encounter.id == uuid.UUID(encounter_id))
    result = await db.execute(stmt)
    encounter = result.scalar_one_or_none()

    if not encounter:
        raise HTTPException(status_code=404, detail="Consultation non trouvée")

    # Vérifier l'accès via tenant_id plutôt que site_id (multi-tenancy)
    if current_user.tenant_id and str(encounter.tenant_id) != str(current_user.tenant_id):
        raise HTTPException(status_code=403, detail="Accès non autorisé")

    # Récupérer les références
    stmt = select(Reference).where(Reference.encounter_id == uuid.UUID(encounter_id))
    result = await db.execute(stmt)
    references = result.scalars().all()

    return references
