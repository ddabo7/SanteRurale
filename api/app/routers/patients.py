"""
Router pour la gestion des patients
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from typing import Optional, List
import uuid
import logging

from app.database import get_db
from app.models import Patient, Encounter, User, UserRole
from app.schemas import (
    PatientCreate,
    PatientUpdate,
    PatientOut,
    PatientDetails,
    EncounterOut,
    AttachmentOut,
    PaginationMeta,
)
from app.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/patients", tags=["patients"])


@router.get("", response_model=dict)
async def list_patients(
    search: Optional[str] = Query(None, description="Recherche par nom/prénom/téléphone"),
    village: Optional[str] = Query(None),
    cursor: Optional[str] = Query(None, description="Curseur de pagination"),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Liste les patients accessibles à l'utilisateur

    - **search**: Recherche floue sur nom, prénom, téléphone
    - **village**: Filtrer par village
    - **cursor**: Curseur pour pagination
    - **limit**: Nombre de résultats (max 200)

    Permissions:
    - Admin/Médecin: tous les patients
    - Autres: patients de leur site uniquement
    """
    # Base query
    stmt = select(Patient).where(Patient.deleted_at == None)

    # Filtrer par site si pas admin/médecin
    if current_user.role not in [UserRole.ADMIN, UserRole.MEDECIN]:
        stmt = stmt.where(Patient.site_id == current_user.site_id)

    # Recherche textuelle
    if search:
        search_filter = or_(
            Patient.nom.ilike(f"%{search}%"),
            Patient.prenom.ilike(f"%{search}%"),
            Patient.telephone.ilike(f"%{search}%")
        )
        stmt = stmt.where(search_filter)

    # Filtre village
    if village:
        stmt = stmt.where(Patient.village.ilike(f"%{village}%"))

    # Pagination par curseur (created_at)
    if cursor:
        try:
            cursor_patient = await db.get(Patient, uuid.UUID(cursor))
            if cursor_patient:
                stmt = stmt.where(Patient.created_at < cursor_patient.created_at)
        except ValueError:
            pass

    # Ordre et limite
    stmt = stmt.order_by(Patient.created_at.desc()).limit(limit + 1)

    # Exécuter
    result = await db.execute(stmt)
    patients = result.scalars().all()

    # Pagination
    has_more = len(patients) > limit
    if has_more:
        patients = patients[:limit]

    next_cursor = str(patients[-1].id) if patients and has_more else None

    # Compter le total (optionnel, peut être coûteux)
    count_stmt = select(func.count()).select_from(
        select(Patient).where(Patient.deleted_at == None).subquery()
    )
    if current_user.role not in [UserRole.ADMIN, UserRole.MEDECIN]:
        count_stmt = select(func.count()).select_from(
            select(Patient).where(
                and_(Patient.deleted_at == None, Patient.site_id == current_user.site_id)
            ).subquery()
        )

    total_count = await db.scalar(count_stmt)

    return {
        "data": [PatientOut.model_validate(p) for p in patients],
        "pagination": PaginationMeta(
            cursor=cursor,
            next_cursor=next_cursor,
            has_more=has_more
        ),
        "total": total_count
    }


@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
async def create_patient(
    patient_data: PatientCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Créer un nouveau patient

    Le patient est automatiquement associé au site de l'utilisateur.

    Permissions: soignant, major, médecin, admin
    """
    # Créer le patient
    patient = Patient(
        **patient_data.model_dump(),
        site_id=current_user.site_id,
        created_by=current_user.id
    )

    db.add(patient)

    # Context pour audit log
    async with set_db_context(db, user_id=current_user.id):
        await db.commit()
        await db.refresh(patient)

    logger.info(
        "Patient créé",
        patient_id=str(patient.id),
        user_id=str(current_user.id),
        site_id=str(current_user.site_id)
    )

    return PatientOut.model_validate(patient)


@router.get("/{patient_id}", response_model=PatientDetails)
async def get_patient(
    patient_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    if_none_match: Optional[str] = Header(None)
):
    """
    Récupérer les détails d'un patient

    Inclut:
    - Informations de base
    - 5 dernières consultations
    - Fichiers joints

    Headers:
    - If-None-Match: ETag pour cache (format: "version:{version}")

    Returns:
    - 200: Patient trouvé
    - 304: Not Modified (si ETag match)
    - 404: Patient non trouvé
    """
    # Récupérer le patient
    stmt = select(Patient).where(
        Patient.id == patient_id,
        Patient.deleted_at == None
    )
    result = await db.execute(stmt)
    patient = result.scalar_one_or_none()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient non trouvé"
        )

    # Vérifier l'accès au site
    if current_user.role not in [UserRole.ADMIN, UserRole.MEDECIN]:
        if patient.site_id != current_user.site_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accès non autorisé à ce patient"
            )

    # Vérifier ETag (cache)
    current_etag = f'"version:{patient.version}"'
    if if_none_match == current_etag:
        raise HTTPException(
            status_code=status.HTTP_304_NOT_MODIFIED,
            detail="Not Modified"
        )

    # Charger les consultations récentes
    encounters_stmt = (
        select(Encounter)
        .where(
            Encounter.patient_id == patient_id,
            Encounter.deleted_at == None
        )
        .order_by(Encounter.date.desc())
        .limit(5)
    )
    encounters_result = await db.execute(encounters_stmt)
    recent_encounters = encounters_result.scalars().all()

    # Charger les attachments
    attachments_stmt = select(Attachment).where(
        Attachment.patient_id == patient_id
    ).order_by(Attachment.created_at.desc())
    attachments_result = await db.execute(attachments_stmt)
    attachments = attachments_result.scalars().all()

    return PatientDetails(
        **PatientOut.model_validate(patient).model_dump(),
        recent_encounters=[EncounterOut.model_validate(e) for e in recent_encounters],
        attachments=[AttachmentOut.model_validate(a) for a in attachments]
    )


@router.patch("/{patient_id}", response_model=PatientOut)
async def update_patient(
    patient_id: uuid.UUID,
    patient_data: PatientUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    if_match: Optional[str] = Header(None, description='ETag de version (ex: "version:3")')
):
    """
    Modifier un patient

    Headers:
    - If-Match: ETag de version pour gestion de conflits (optionnel mais recommandé)

    Returns:
    - 200: Patient modifié
    - 409: Conflict (version mismatch)
    - 412: Precondition Failed (If-Match requis ou invalide)
    """
    # Récupérer le patient
    stmt = select(Patient).where(
        Patient.id == patient_id,
        Patient.deleted_at == None
    )
    result = await db.execute(stmt)
    patient = result.scalar_one_or_none()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient non trouvé"
        )

    # Vérifier l'accès
    if current_user.role not in [UserRole.ADMIN, UserRole.MEDECIN]:
        if patient.site_id != current_user.site_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accès non autorisé"
            )

    # Vérifier If-Match si fourni
    if if_match:
        expected_etag = f'"version:{patient.version}"'
        if if_match != expected_etag:
            raise HTTPException(
                status_code=status.HTTP_412_PRECONDITION_FAILED,
                detail=f"Version mismatch. Version actuelle: {patient.version}"
            )

    # Appliquer les modifications
    update_data = patient_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(patient, field, value)

    patient.updated_by = current_user.id

    async with set_db_context(db, user_id=current_user.id):
        await db.commit()
        await db.refresh(patient)

    logger.info(
        "Patient modifié",
        patient_id=str(patient.id),
        user_id=str(current_user.id),
        version=patient.version
    )

    return PatientOut.model_validate(patient)


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_patient(
    patient_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Suppression douce (soft delete) d'un patient

    Le patient n'est pas réellement supprimé, mais marqué comme supprimé.

    Permissions: admin uniquement
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les admins peuvent supprimer des patients"
        )

    # Récupérer le patient
    stmt = select(Patient).where(
        Patient.id == patient_id,
        Patient.deleted_at == None
    )
    result = await db.execute(stmt)
    patient = result.scalar_one_or_none()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient non trouvé"
        )

    # Soft delete
    from datetime import datetime
    patient.deleted_at = datetime.utcnow()

    async with set_db_context(db, user_id=current_user.id):
        await db.commit()

    logger.warning(
        "Patient supprimé",
        patient_id=str(patient.id),
        user_id=str(current_user.id)
    )

    return None
