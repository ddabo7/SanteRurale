"""
Routes pour les consultations (encounters)
"""
import uuid as uuid_module
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Condition, Encounter, MedicationRequest, Patient, Procedure, User
from app.schemas import (
    ConditionCreate,
    ConditionOut,
    EncounterCreate,
    EncounterOut,
    MedicationRequestCreate,
    MedicationRequestOut,
    ProcedureCreate,
    ProcedureOut,
)
from app.security import get_current_user

router = APIRouter(prefix="/encounters", tags=["Encounters"])


# ===========================================================================
# ENDPOINTS ENCOUNTERS
# ===========================================================================


@router.get("", response_model=List[EncounterOut])
async def list_encounters(
    patient_id: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Liste les consultations avec filtres optionnels
    """
    # Exclure les consultations supprimées
    query = (
        select(Encounter)
        .where(Encounter.deleted_at == None)
        .options(
            selectinload(Encounter.patient),
            selectinload(Encounter.user),
            selectinload(Encounter.conditions),
            selectinload(Encounter.medication_requests),
            selectinload(Encounter.procedures),
        )
    )

    # ISOLATION MULTI-TENANT : Filtrer par tenant_id (CRITIQUE)
    if current_user.tenant_id:
        query = query.where(Encounter.tenant_id == current_user.tenant_id)

    # Filtres
    if patient_id:
        try:
            patient_uuid = uuid_module.UUID(patient_id)
            query = query.where(Encounter.patient_id == patient_uuid)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="patient_id invalide"
            )

    if from_date:
        query = query.where(Encounter.date >= from_date)

    if to_date:
        query = query.where(Encounter.date <= to_date)

    # Trier par date décroissante
    query = query.order_by(Encounter.date.desc()).limit(limit)

    result = await db.execute(query)
    encounters = result.scalars().all()

    return encounters


@router.get("/{encounter_id}", response_model=EncounterOut)
async def get_encounter(
    encounter_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Récupère une consultation par ID
    """
    try:
        encounter_uuid = uuid_module.UUID(encounter_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID invalide"
        )

    query = select(Encounter).where(Encounter.id == encounter_uuid).options(
        selectinload(Encounter.patient),
        selectinload(Encounter.user),
        selectinload(Encounter.conditions),
        selectinload(Encounter.medication_requests),
        selectinload(Encounter.procedures),
    )

    # ISOLATION MULTI-TENANT : Vérifier que l'encounter appartient au tenant
    if current_user.tenant_id:
        query = query.where(Encounter.tenant_id == current_user.tenant_id)

    result = await db.execute(query)
    encounter = result.scalar_one_or_none()

    if not encounter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation non trouvée"
        )

    return encounter


@router.post("", response_model=EncounterOut, status_code=status.HTTP_201_CREATED)
async def create_encounter(
    encounter_data: EncounterCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Crée une nouvelle consultation
    """
    # Vérifier que le patient existe ET appartient au même tenant
    patient_query = select(Patient).where(Patient.id == encounter_data.patient_id)

    # ISOLATION MULTI-TENANT : Le patient doit appartenir au même tenant
    if current_user.tenant_id:
        patient_query = patient_query.where(Patient.tenant_id == current_user.tenant_id)

    patient_result = await db.execute(patient_query)
    patient = patient_result.scalar_one_or_none()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient non trouvé ou n'appartient pas à votre organisation"
        )

    # Utiliser le site et l'user depuis le token JWT
    site_id = current_user.site_id
    user_id = current_user.id

    # Créer l'encounter avec tenant_id
    new_encounter = Encounter(
        id=uuid_module.uuid4(),
        patient_id=encounter_data.patient_id,
        site_id=site_id,
        user_id=user_id,
        tenant_id=current_user.tenant_id,  # IMPORTANT: Associer au tenant
        created_by=user_id,
        date=encounter_data.encounter_date,
        motif=encounter_data.motif,
        temperature=encounter_data.temperature,
        pouls=encounter_data.pouls,
        pression_systolique=encounter_data.pression_systolique,
        pression_diastolique=encounter_data.pression_diastolique,
        poids=encounter_data.poids,
        taille=encounter_data.taille,
        notes=encounter_data.notes,
    )

    db.add(new_encounter)
    await db.commit()
    await db.refresh(new_encounter)

    # Charger les relations
    query = select(Encounter).where(Encounter.id == new_encounter.id).options(
        selectinload(Encounter.patient),
        selectinload(Encounter.user),
        selectinload(Encounter.conditions),
        selectinload(Encounter.medication_requests),
        selectinload(Encounter.procedures),
    )
    result = await db.execute(query)
    encounter = result.scalar_one()

    return encounter


# ===========================================================================
# ENDPOINTS CONDITIONS (DIAGNOSTICS)
# ===========================================================================


@router.post("/conditions", response_model=ConditionOut, status_code=status.HTTP_201_CREATED)
async def create_condition(
    condition_data: ConditionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Ajoute un diagnostic à une consultation
    """
    # Vérifier que l'encounter existe ET appartient au tenant
    encounter_query = select(Encounter).where(Encounter.id == condition_data.encounter_id)

    # ISOLATION MULTI-TENANT : L'encounter doit appartenir au même tenant
    if current_user.tenant_id:
        encounter_query = encounter_query.where(Encounter.tenant_id == current_user.tenant_id)

    encounter_result = await db.execute(encounter_query)
    encounter = encounter_result.scalar_one_or_none()

    if not encounter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation non trouvée ou n'appartient pas à votre organisation"
        )

    new_condition = Condition(
        id=uuid_module.uuid4(),
        encounter_id=condition_data.encounter_id,
        code_icd10=condition_data.code_icd10,
        libelle=condition_data.libelle,
        notes=condition_data.notes,
        created_by=current_user.id,
    )

    db.add(new_condition)
    await db.commit()
    await db.refresh(new_condition)

    return new_condition


# ===========================================================================
# ENDPOINTS MEDICATION REQUESTS (ORDONNANCES)
# ===========================================================================


@router.post("/medication-requests", response_model=MedicationRequestOut, status_code=status.HTTP_201_CREATED)
async def create_medication_request(
    medication_data: MedicationRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Ajoute une prescription à une consultation
    """
    # Vérifier que l'encounter existe ET appartient au tenant
    encounter_query = select(Encounter).where(Encounter.id == medication_data.encounter_id)

    # ISOLATION MULTI-TENANT : L'encounter doit appartenir au même tenant
    if current_user.tenant_id:
        encounter_query = encounter_query.where(Encounter.tenant_id == current_user.tenant_id)

    encounter_result = await db.execute(encounter_query)
    encounter = encounter_result.scalar_one_or_none()

    if not encounter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation non trouvée ou n'appartient pas à votre organisation"
        )

    new_medication = MedicationRequest(
        id=uuid_module.uuid4(),
        encounter_id=medication_data.encounter_id,
        medicament=medication_data.medicament,
        posologie=medication_data.posologie,
        duree_jours=medication_data.duree_jours,
        quantite=medication_data.quantite,
        unite=medication_data.unite,
        notes=medication_data.notes,
        created_by=current_user.id,
    )

    db.add(new_medication)
    await db.commit()
    await db.refresh(new_medication)

    return new_medication


# ===========================================================================
# ENDPOINTS PROCEDURES (ACTES)
# ===========================================================================


@router.post("/procedures", response_model=ProcedureOut, status_code=status.HTTP_201_CREATED)
async def create_procedure(
    procedure_data: ProcedureCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Ajoute un acte médical à une consultation
    """
    # Vérifier que l'encounter existe ET appartient au tenant
    encounter_query = select(Encounter).where(Encounter.id == procedure_data.encounter_id)

    # ISOLATION MULTI-TENANT : L'encounter doit appartenir au même tenant
    if current_user.tenant_id:
        encounter_query = encounter_query.where(Encounter.tenant_id == current_user.tenant_id)

    encounter_result = await db.execute(encounter_query)
    encounter = encounter_result.scalar_one_or_none()

    if not encounter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation non trouvée ou n'appartient pas à votre organisation"
        )

    new_procedure = Procedure(
        id=uuid_module.uuid4(),
        encounter_id=procedure_data.encounter_id,
        type=procedure_data.type,
        description=procedure_data.description,
        resultat=procedure_data.resultat,
        created_by=current_user.id,
    )

    db.add(new_procedure)
    await db.commit()
    await db.refresh(new_procedure)

    return new_procedure
