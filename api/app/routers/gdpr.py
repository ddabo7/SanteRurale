"""
Routes RGPD/GDPR pour la conformite aux reglementations
sur la protection des donnees personnelles.
"""
import json
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, Patient, Encounter
from app.security import get_current_user, verify_password

router = APIRouter(prefix="/gdpr", tags=["GDPR/RGPD"])


class DeleteAccountRequest(BaseModel):
    """Schema pour la demande de suppression de compte"""
    password: str
    confirmation: str  # Doit etre "SUPPRIMER MON COMPTE"


class DataExportResponse(BaseModel):
    """Schema pour la reponse d'export de donnees"""
    user_data: dict
    activity_summary: dict
    export_date: str
    format_version: str


@router.get("/export-data")
async def export_user_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Exporte toutes les donnees personnelles de l'utilisateur (Droit a la portabilite - RGPD Art. 20)

    Retourne un fichier JSON contenant:
    - Informations du profil utilisateur
    - Historique d'activite (resume)
    - Preferences de consentement

    Note: Les donnees des patients ne sont PAS incluses car elles appartiennent
    a la structure de sante, pas a l'utilisateur individuel.
    """
    # Recuperer l'utilisateur avec ses relations
    result = await db.execute(
        select(User)
        .options(selectinload(User.site))
        .where(User.id == current_user.id)
    )
    user = result.scalar_one()

    # Compter l'activite de l'utilisateur
    # Patients crees par cet utilisateur
    patients_result = await db.execute(
        select(Patient).where(Patient.created_by == str(user.id))
    )
    patients_count = len(patients_result.scalars().all())

    # Consultations creees par cet utilisateur
    encounters_result = await db.execute(
        select(Encounter).where(Encounter.created_by == str(user.id))
    )
    encounters_count = len(encounters_result.scalars().all())

    # Preparer les donnees d'export
    export_data = {
        "user_data": {
            "id": str(user.id),
            "email": user.email,
            "nom": user.nom,
            "prenom": user.prenom,
            "telephone": user.telephone,
            "sexe": user.sexe.value if user.sexe else None,
            "role": user.role,
            "date_creation": user.created_at.isoformat() if user.created_at else None,
            "derniere_mise_a_jour": user.updated_at.isoformat() if user.updated_at else None,
            "email_verifie": user.email_verified,
            "compte_actif": user.actif,
            "structure_sante": {
                "nom": user.site.nom if user.site else None,
                "type": user.site.type if user.site else None,
                "ville": user.site.ville if user.site else None,
                "pays": user.site.pays if user.site else None,
            } if user.site else None,
        },
        "activity_summary": {
            "patients_enregistres": patients_count,
            "consultations_effectuees": encounters_count,
            "note": "Les donnees detaillees des patients appartiennent a la structure de sante."
        },
        "consent_preferences": {
            "note": "Preferences de cookies stockees localement dans le navigateur."
        },
        "export_metadata": {
            "export_date": datetime.now(timezone.utc).isoformat(),
            "format_version": "1.0",
            "rgpd_article": "Article 20 - Droit a la portabilite des donnees"
        }
    }

    # Retourner comme fichier JSON telechargeable
    json_content = json.dumps(export_data, ensure_ascii=False, indent=2)

    return Response(
        content=json_content,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="sante_rurale_export_{user.email}_{datetime.now().strftime("%Y%m%d")}.json"'
        }
    )


@router.post("/delete-account")
async def delete_account(
    request: DeleteAccountRequest,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Supprime le compte utilisateur (Droit a l'effacement - RGPD Art. 17)

    Cette action est IRREVERSIBLE et:
    - Anonymise les donnees creees par l'utilisateur (patients, consultations)
    - Supprime le compte utilisateur
    - Deconnecte l'utilisateur

    Securite:
    - Le mot de passe actuel est requis
    - Une confirmation textuelle est requise
    """
    # Verification de la confirmation
    if request.confirmation != "SUPPRIMER MON COMPTE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation invalide. Veuillez saisir exactement: SUPPRIMER MON COMPTE"
        )

    # Recuperer l'utilisateur
    result = await db.execute(
        select(User).where(User.id == current_user.id)
    )
    user = result.scalar_one()

    # Verifier le mot de passe
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mot de passe incorrect"
        )

    # Verifier que l'utilisateur n'est pas un admin systeme
    if user.role in ["super_admin", "system"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Les comptes administrateurs systeme ne peuvent pas etre supprimes via cette interface."
        )

    user_id_str = str(user.id)
    user_email = user.email

    # Anonymiser les references a cet utilisateur dans les donnees
    # Au lieu de supprimer, on anonymise pour conserver l'integrite des donnees medicales

    # Anonymiser dans les patients
    patients_result = await db.execute(
        select(Patient).where(Patient.created_by == user_id_str)
    )
    patients = patients_result.scalars().all()
    for patient in patients:
        patient.created_by = "[UTILISATEUR_SUPPRIME]"
        if patient.updated_by == user_id_str:
            patient.updated_by = "[UTILISATEUR_SUPPRIME]"

    # Anonymiser dans les consultations
    encounters_result = await db.execute(
        select(Encounter).where(Encounter.created_by == user_id_str)
    )
    encounters = encounters_result.scalars().all()
    for encounter in encounters:
        encounter.created_by = "[UTILISATEUR_SUPPRIME]"
        if encounter.updated_by == user_id_str:
            encounter.updated_by = "[UTILISATEUR_SUPPRIME]"

    # Supprimer le compte utilisateur
    await db.delete(user)

    # Commit toutes les modifications
    await db.commit()

    # Supprimer les cookies d'authentification
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")

    return {
        "success": True,
        "message": "Votre compte a ete supprime avec succes. Vos donnees personnelles ont ete effacees conformement au RGPD.",
        "deleted_email": user_email,
        "deletion_date": datetime.now(timezone.utc).isoformat()
    }


@router.get("/privacy-info")
async def get_privacy_info():
    """
    Retourne les informations sur le traitement des donnees (RGPD Art. 13-14)

    Endpoint public qui fournit des informations sur:
    - Les donnees collectees
    - Les finalites du traitement
    - Les droits des utilisateurs
    """
    return {
        "data_controller": {
            "name": "Sante Rurale",
            "email": "privacy@santerurale.io",
            "address": "Bamako, Mali"
        },
        "data_collected": {
            "personal": [
                "Nom et prenom",
                "Adresse email",
                "Numero de telephone",
                "Photo de profil (optionnel)",
                "Role professionnel"
            ],
            "technical": [
                "Adresse IP",
                "Type de navigateur",
                "Donnees de connexion"
            ],
            "medical_note": "Les donnees des patients sont traitees pour le compte de la structure de sante."
        },
        "processing_purposes": [
            "Authentification et securisation de l'acces",
            "Gestion des dossiers medicaux",
            "Synchronisation des donnees",
            "Amelioration du service"
        ],
        "legal_basis": [
            "Consentement (Art. 6.1.a RGPD)",
            "Execution du contrat (Art. 6.1.b RGPD)",
            "Obligation legale (Art. 6.1.c RGPD) - Conservation des donnees medicales"
        ],
        "user_rights": {
            "access": "Droit d'acceder a vos donnees (Art. 15)",
            "rectification": "Droit de rectifier vos donnees (Art. 16)",
            "erasure": "Droit a l'effacement (Art. 17)",
            "portability": "Droit a la portabilite (Art. 20)",
            "objection": "Droit d'opposition (Art. 21)"
        },
        "data_retention": {
            "account_data": "Pendant la duree d'utilisation du service",
            "after_deletion": "Anonymisation immediate, donnees medicales conservees 5 ans (obligation legale)"
        },
        "contact": {
            "dpo_email": "privacy@santerurale.io",
            "complaint": "Vous pouvez deposer une plainte aupres de l'autorite de protection des donnees de votre pays."
        }
    }
