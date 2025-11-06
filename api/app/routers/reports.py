"""
Routes pour les rapports et statistiques
"""
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Condition, Encounter, Patient, User
from app.schemas import ReportOverview, ReportPeriod, ReferenceStats, TopDiagnostic
from app.security import get_current_user

router = APIRouter(prefix="/reports", tags=["Reports"])


# ===========================================================================
# ENDPOINTS RAPPORTS
# ===========================================================================


@router.get("/overview", response_model=ReportOverview)
async def get_overview(
    from_date: date = Query(alias="from"),
    to_date: date = Query(alias="to"),
    site_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Génère un rapport d'aperçu pour une période donnée (filtré par tenant)
    """
    # Construire les requêtes de base avec filtres de dates
    encounters_query = select(Encounter).where(
        Encounter.date >= from_date,
        Encounter.date <= to_date,
    )

    # ISOLATION MULTI-TENANT : Filtrer par tenant_id (CRITIQUE)
    if current_user.tenant_id:
        encounters_query = encounters_query.where(Encounter.tenant_id == current_user.tenant_id)

    # Filtre par site si fourni
    if site_id:
        encounters_query = encounters_query.where(Encounter.site_id == site_id)

    # 1. Total consultations
    total_consultations_query = select(func.count(Encounter.id)).where(
        Encounter.date >= from_date,
        Encounter.date <= to_date,
    )
    # ISOLATION MULTI-TENANT
    if current_user.tenant_id:
        total_consultations_query = total_consultations_query.where(Encounter.tenant_id == current_user.tenant_id)
    if site_id:
        total_consultations_query = total_consultations_query.where(Encounter.site_id == site_id)

    result = await db.execute(total_consultations_query)
    total_consultations = result.scalar() or 0

    # 2. Total patients uniques
    total_patients_query = select(func.count(func.distinct(Encounter.patient_id))).where(
        Encounter.date >= from_date,
        Encounter.date <= to_date,
    )
    # ISOLATION MULTI-TENANT
    if current_user.tenant_id:
        total_patients_query = total_patients_query.where(Encounter.tenant_id == current_user.tenant_id)
    if site_id:
        total_patients_query = total_patients_query.where(Encounter.site_id == site_id)

    result = await db.execute(total_patients_query)
    total_patients = result.scalar() or 0

    # 3. Nouveaux patients (patients créés pendant la période)
    nouveaux_patients_query = select(func.count(Patient.id)).where(
        Patient.created_at >= datetime.combine(from_date, datetime.min.time()),
        Patient.created_at <= datetime.combine(to_date, datetime.max.time()),
    )
    # ISOLATION MULTI-TENANT
    if current_user.tenant_id:
        nouveaux_patients_query = nouveaux_patients_query.where(Patient.tenant_id == current_user.tenant_id)
    if site_id:
        nouveaux_patients_query = nouveaux_patients_query.where(Patient.site_id == site_id)

    result = await db.execute(nouveaux_patients_query)
    nouveaux_patients = result.scalar() or 0

    # 4. Consultations moins de 5 ans (calculé via l'année de naissance du patient)
    # On récupère les encounters avec les patients
    current_year = datetime.now().year
    year_threshold = current_year - 5

    consultations_moins_5_query = select(func.count(Encounter.id)).join(
        Patient, Encounter.patient_id == Patient.id
    ).where(
        Encounter.date >= from_date,
        Encounter.date <= to_date,
        Patient.annee_naissance >= year_threshold,
    )
    # ISOLATION MULTI-TENANT
    if current_user.tenant_id:
        consultations_moins_5_query = consultations_moins_5_query.where(Encounter.tenant_id == current_user.tenant_id)
    if site_id:
        consultations_moins_5_query = consultations_moins_5_query.where(Encounter.site_id == site_id)

    result = await db.execute(consultations_moins_5_query)
    consultations_moins_5_ans = result.scalar() or 0

    # 5. Top 10 diagnostics
    top_diagnostics_query = (
        select(
            Condition.code_icd10,
            Condition.libelle,
            func.count(Condition.id).label("count")
        )
        .join(Encounter, Condition.encounter_id == Encounter.id)
        .where(
            Encounter.date >= from_date,
            Encounter.date <= to_date,
        )
        .group_by(Condition.code_icd10, Condition.libelle)
        .order_by(func.count(Condition.id).desc())
        .limit(10)
    )
    # ISOLATION MULTI-TENANT
    if current_user.tenant_id:
        top_diagnostics_query = top_diagnostics_query.where(Encounter.tenant_id == current_user.tenant_id)
    if site_id:
        top_diagnostics_query = top_diagnostics_query.where(Encounter.site_id == site_id)

    result = await db.execute(top_diagnostics_query)
    top_diagnostics_raw = result.all()

    top_diagnostics = [
        TopDiagnostic(
            code=row[0],
            libelle=row[1],
            count=row[2]
        )
        for row in top_diagnostics_raw
    ]

    # 6. Statistiques de références (pour l'instant, on retourne des valeurs à 0)
    # TODO: Implémenter quand le modèle Reference sera créé
    references = ReferenceStats(
        total=0,
        confirmes=0,
        completes=0,
        en_attente=0,
    )

    return ReportOverview(
        period=ReportPeriod(from_date=from_date, to_date=to_date),
        total_consultations=total_consultations,
        total_patients=total_patients,
        nouveaux_patients=nouveaux_patients,
        consultations_moins_5_ans=consultations_moins_5_ans,
        top_diagnostics=top_diagnostics,
        references=references,
    )
