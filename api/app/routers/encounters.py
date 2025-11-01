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
from app.models import Condition, Encounter, MedicationRequest, Patient, Procedure
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
            selectinload(Encounter.conditions),
            selectinload(Encounter.medication_requests),
            selectinload(Encounter.procedures),
        )
    )

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
        selectinload(Encounter.conditions),
        selectinload(Encounter.medication_requests),
        selectinload(Encounter.procedures),
    )

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
    db: AsyncSession = Depends(get_db),
):
    """
    Crée une nouvelle consultation
    """
    # Vérifier que le patient existe
    patient_query = select(Patient).where(Patient.id == encounter_data.patient_id)
    patient_result = await db.execute(patient_query)
    patient = patient_result.scalar_one_or_none()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient non trouvé"
        )

    # TODO: Récupérer site_id et user_id depuis le token JWT
    # Pour l'instant, on utilise le site_id du patient
    site_id = patient.site_id
    # Et un user_id fictif (à remplacer par le vrai user_id du token)
    user_id = patient.site.users[0].id if patient.site.users else patient.site_id

    # Créer l'encounter
    new_encounter = Encounter(
        id=uuid_module.uuid4(),
        patient_id=encounter_data.patient_id,
        site_id=site_id,
        user_id=user_id,
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
    db: AsyncSession = Depends(get_db),
):
    """
    Ajoute un diagnostic à une consultation
    """
    # Vérifier que l'encounter existe
    encounter_query = select(Encounter).where(Encounter.id == condition_data.encounter_id)
    encounter_result = await db.execute(encounter_query)
    encounter = encounter_result.scalar_one_or_none()

    if not encounter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation non trouvée"
        )

    new_condition = Condition(
        id=uuid_module.uuid4(),
        encounter_id=condition_data.encounter_id,
        code_icd10=condition_data.code_icd10,
        libelle=condition_data.libelle,
        notes=condition_data.notes,
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
    db: AsyncSession = Depends(get_db),
):
    """
    Ajoute une prescription à une consultation
    """
    # Vérifier que l'encounter existe
    encounter_query = select(Encounter).where(Encounter.id == medication_data.encounter_id)
    encounter_result = await db.execute(encounter_query)
    encounter = encounter_result.scalar_one_or_none()

    if not encounter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation non trouvée"
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
    db: AsyncSession = Depends(get_db),
):
    """
    Ajoute un acte médical à une consultation
    """
    # Vérifier que l'encounter existe
    encounter_query = select(Encounter).where(Encounter.id == procedure_data.encounter_id)
    encounter_result = await db.execute(encounter_query)
    encounter = encounter_result.scalar_one_or_none()

    if not encounter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation non trouvée"
        )

    new_procedure = Procedure(
        id=uuid_module.uuid4(),
        encounter_id=procedure_data.encounter_id,
        type=procedure_data.type,
        description=procedure_data.description,
        resultat=procedure_data.resultat,
    )

    db.add(new_procedure)
    await db.commit()
    await db.refresh(new_procedure)

    return new_procedure
