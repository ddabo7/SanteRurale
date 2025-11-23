"""
Router pour la gestion des patients - Version production
"""
import uuid as uuid_module
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Patient, User, Site
from app.models.tenant import Tenant
from app.schemas import PatientCreate, PatientUpdate, PatientOut, UserRole
from app.security import get_current_user
from app.dependencies.tenant import check_quota, get_current_tenant, require_active_subscription, require_write_access

router = APIRouter(prefix="/patients", tags=["Patients"])


# ===========================================================================
# HELPER FUNCTIONS
# ===========================================================================

def generate_village_code(village_name: str) -> str:
    """
    Génère un code de 4 lettres à partir du nom du village
    Ex: "Konobougou" → "KONO", "Siby" → "SIBY"
    """
    if not village_name:
        return "UNKN"  # Code par défaut si pas de village

    # Nettoyer le nom du village
    name = village_name.strip()

    # Prendre les 4 premières lettres
    code = "".join([c for c in name if c.isalpha()])[:4].upper()

    # Si moins de 4 lettres, compléter avec 'X'
    while len(code) < 4:
        code += "X"

    return code


async def generate_matricule(db: AsyncSession, village: str | None, year: int) -> str:
    """
    Génère un matricule unique au format: SIBY-2025-0001

    Args:
        db: Session de base de données
        village: Nom du village du patient
        year: Année en cours

    Returns:
        Matricule unique (ex: "SIBY-2025-0001", "KATI-2025-0001")
    """
    # Générer le code du village
    village_code = generate_village_code(village or "UNKN")

    # Chercher le dernier matricule pour ce village et cette année
    prefix = f"{village_code}-{year}-%"
    result = await db.execute(
        select(func.max(Patient.matricule))
        .where(Patient.matricule.like(prefix))
    )
    last_matricule = result.scalar()

    # Déterminer le prochain numéro
    if last_matricule:
        # Extraire le numéro (ex: "SIBY-2025-0042" → 42)
        try:
            last_number = int(last_matricule.split("-")[-1])
            next_number = last_number + 1
        except (ValueError, IndexError):
            next_number = 1
    else:
        next_number = 1

    # Formater le matricule
    matricule = f"{village_code}-{year}-{next_number:04d}"

    return matricule


# ===========================================================================
# LIST PATIENTS
# ===========================================================================

@router.get("", response_model=dict)
async def list_patients(
    search: Optional[str] = Query(None, description="Recherche par nom/prénom/téléphone"),
    village: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Liste les patients accessibles à l'utilisateur

    Permissions:
    - Tous les utilisateurs: patients de leur site uniquement
    - Note: L'admin plateforme n'a pas accès aux données patients (confidentialité médicale)
    """
    # Base query - exclure les patients supprimés
    query = select(Patient).where(Patient.deleted_at == None)

    # Toujours filtrer par site - même pour les admins/médecins
    # Cela garantit que chaque utilisateur ne voit que les patients de son établissement
    query = query.where(Patient.site_id == current_user.site_id)

    # Recherche textuelle
    if search:
        search_filter = or_(
            Patient.nom.ilike(f"%{search}%"),
            Patient.prenom.ilike(f"%{search}%"),
            Patient.telephone.ilike(f"%{search}%")
        )
        query = query.where(search_filter)

    # Filtre village
    if village:
        query = query.where(Patient.village.ilike(f"%{village}%"))

    # Ordre et limite
    query = query.order_by(Patient.created_at.desc()).limit(limit)

    # Exécuter
    result = await db.execute(query)
    patients = result.scalars().all()

    return {
        "data": [PatientOut.model_validate(p) for p in patients],
        "pagination": {
            "cursor": None,
            "next_cursor": None,
            "has_more": len(patients) >= limit
        }
    }


# ===========================================================================
# GET PATIENT BY ID
# ===========================================================================

@router.get("/{patient_id}", response_model=PatientOut)
async def get_patient(
    patient_id: uuid_module.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Récupérer les détails d'un patient
    """
    query = select(Patient).where(
        Patient.id == patient_id,
        Patient.deleted_at == None
    )

    # ISOLATION MULTI-TENANT : Vérifier que le patient appartient au tenant
    result = await db.execute(query)
    patient = result.scalar_one_or_none()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient non trouvé"
        )

    # Vérifier l'accès par site - tous les utilisateurs sont limités à leur site
    if patient.site_id != current_user.site_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès non autorisé à ce patient"
        )

    return PatientOut.model_validate(patient)


# ===========================================================================
# CREATE PATIENT
# ===========================================================================

@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
async def create_patient(
    patient_data: PatientCreate,
    current_user: User = Depends(get_current_user),
    current_tenant: Tenant = Depends(require_active_subscription),  # 🔒 Vérifie abonnement actif
    db: AsyncSession = Depends(get_db),
):
    """
    Créer un nouveau patient avec génération automatique du matricule

    Le matricule est au format: SIBY-2025-0001
    - SIBY: code du village (4 lettres)
    - 2025: année
    - 0001: numéro séquentiel

    🔒 Blocage: Cette action est bloquée si l'abonnement est expiré (mode DEGRADED ou supérieur)
    """
    # Déterminer le type de quota à vérifier selon le plan
    from app.dependencies.tenant import get_tenant_subscription
    subscription = await get_tenant_subscription(current_tenant.id, db)
    
    # Plan gratuit : vérifier limite TOTALE
    if not subscription or not subscription.plan or subscription.plan.code == 'free':
        total_patients_result = await db.execute(
            select(func.count(Patient.id))
            .where(Patient.site_id == current_user.site_id)
            .where(Patient.deleted_at.is_(None))
        )
        total_patients = total_patients_result.scalar_one()
        await check_quota(current_tenant, "patients_total", total_patients, db)
    
    # Plans payants : vérifier limite MENSUELLE
    else:
        from datetime import datetime
        from sqlalchemy import extract
        current_month = datetime.now().month
        current_year = datetime.now().year
        
        monthly_patients_result = await db.execute(
            select(func.count(Patient.id))
            .where(Patient.site_id == current_user.site_id)
            .where(Patient.deleted_at.is_(None))
            .where(extract('month', Patient.created_at) == current_month)
            .where(extract('year', Patient.created_at) == current_year)
        )
        monthly_patients = monthly_patients_result.scalar_one()
        await check_quota(current_tenant, "patients_monthly", monthly_patients, db)

    # Créer le patient
    new_patient = Patient(
        id=uuid_module.uuid4(),
        nom=patient_data.nom,
        prenom=patient_data.prenom,
        sexe=patient_data.sexe,
        annee_naissance=patient_data.annee_naissance,
        telephone=patient_data.telephone,
        village=patient_data.village,
        site_id=current_user.site_id,  # Toujours le site de l'utilisateur
        created_by=current_user.id,
        version=1,
    )

    db.add(new_patient)
    await db.commit()
    await db.refresh(new_patient)

    return PatientOut.model_validate(new_patient)


# ===========================================================================
# UPDATE PATIENT
# ===========================================================================

@router.patch("/{patient_id}", response_model=PatientOut)
async def update_patient(
    patient_id: uuid_module.UUID,
    patient_data: PatientUpdate,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(require_write_access),  # 🔒 Vérifie accès en écriture
    db: AsyncSession = Depends(get_db),
):
    """
    Mettre à jour un patient

    🔒 Blocage: Cette action est bloquée si le compte est en lecture seule (mode READ_ONLY ou supérieur)
    """
    # Récupérer le patient
    query = select(Patient).where(
        Patient.id == patient_id,
        Patient.deleted_at == None
    )

    # ISOLATION MULTI-TENANT : Vérifier que le patient appartient au tenant
    result = await db.execute(query)
    patient = result.scalar_one_or_none()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient non trouvé"
        )

    # Vérifier l'accès par site - tous les utilisateurs sont limités à leur site
    if patient.site_id != current_user.site_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès non autorisé"
        )

    # Appliquer les modifications
    update_data = patient_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(patient, field, value)

    patient.updated_by = current_user.id
    patient.updated_at = datetime.now()
    patient.version += 1

    await db.commit()
    await db.refresh(patient)

    return PatientOut.model_validate(patient)


# ===========================================================================
# DELETE PATIENT (Soft Delete)
# ===========================================================================

@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_patient(
    patient_id: uuid_module.UUID,
    current_user: User = Depends(get_current_user),
    tenant: Tenant = Depends(require_write_access),  # 🔒 Vérifie accès en écriture
    db: AsyncSession = Depends(get_db),
):
    """
    Supprimer un patient (soft delete)

    🔒 Blocage: Cette action est bloquée si le compte est en lecture seule (mode READ_ONLY ou supérieur)
    """
    # Récupérer le patient
    query = select(Patient).where(
        Patient.id == patient_id,
        Patient.deleted_at == None
    )

    # ISOLATION MULTI-TENANT : Vérifier que le patient appartient au tenant
    result = await db.execute(query)
    patient = result.scalar_one_or_none()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient non trouvé"
        )

    # Vérifier l'accès (seulement admin)
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les administrateurs peuvent supprimer des patients"
        )

    # Soft delete
    patient.deleted_at = datetime.now()
    patient.updated_by = current_user.id

    await db.commit()

    return None
