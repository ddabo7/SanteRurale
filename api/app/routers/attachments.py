"""
Router pour la gestion des pièces jointes (fichiers uploadés)
"""
import os
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.security import get_current_user
from app.models.base_models import User, Patient, Encounter

# Configuration MinIO
MINIO_ENABLED = os.getenv("MINIO_ENABLED", "true").lower() == "true"
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ROOT_USER", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "sante-rurale-uploads")

if MINIO_ENABLED:
    try:
        from minio import Minio
        minio_client = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=False  # True en production avec HTTPS
        )
        # Créer le bucket s'il n'existe pas
        if not minio_client.bucket_exists(MINIO_BUCKET):
            minio_client.make_bucket(MINIO_BUCKET)
    except ImportError:
        print("⚠️  MinIO client non installé. Installez avec: pip install minio")
        MINIO_ENABLED = False
    except Exception as e:
        print(f"⚠️  Erreur MinIO: {e}")
        MINIO_ENABLED = False

router = APIRouter(prefix="/attachments", tags=["attachments"])

# ===========================================================================
# MODELS
# ===========================================================================

class AttachmentResponse(BaseModel):
    id: str
    filename: str
    mime_type: str
    size_bytes: int
    patient_id: Optional[str] = None
    encounter_id: Optional[str] = None
    uploaded: bool
    uploaded_at: Optional[datetime] = None
    created_at: datetime
    download_url: Optional[str] = None

    class Config:
        from_attributes = True


class StorageStats(BaseModel):
    total_bytes: int
    total_gb: float
    total_files: int
    quota_gb: int
    quota_bytes: int
    usage_percent: float


# ===========================================================================
# UPLOAD FILE
# ===========================================================================

@router.post("/upload", response_model=AttachmentResponse)
async def upload_file(
    file: UploadFile = File(...),
    patient_id: Optional[str] = Query(None),
    encounter_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload un fichier (photo patient, document consultation, etc.)

    Limites:
    - Taille max: 50 MB
    - Types acceptés: images (jpeg, png), PDF, documents
    """
    # Validation: au moins patient_id ou encounter_id
    if not patient_id and not encounter_id:
        raise HTTPException(
            status_code=400,
            detail="patient_id ou encounter_id requis"
        )

    # Vérifier que le patient/consultation existe et appartient au même site
    if patient_id:
        result = await db.execute(
            select(Patient).where(
                Patient.id == patient_id,
                Patient.site_id == current_user.site_id
            )
        )
        patient = result.scalar_one_or_none()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient non trouvé")

    if encounter_id:
        result = await db.execute(
            select(Encounter).where(
                Encounter.id == encounter_id,
                Encounter.site_id == current_user.site_id
            )
        )
        encounter = result.scalar_one_or_none()
        if not encounter:
            raise HTTPException(status_code=404, detail="Consultation non trouvée")

    # Vérifier la taille du fichier (max 50 MB)
    file_content = await file.read()
    file_size = len(file_content)

    MAX_SIZE = 50 * 1024 * 1024  # 50 MB
    if file_size > MAX_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Fichier trop volumineux. Maximum: 50 MB"
        )

    # Vérifier le quota de stockage du tenant
    # TODO: Implémenter vérification quota par rapport au plan

    # Générer clé S3 unique
    file_extension = os.path.splitext(file.filename)[1]
    s3_key = f"{current_user.site_id}/{uuid.uuid4()}{file_extension}"

    # Upload vers MinIO
    uploaded = False
    if MINIO_ENABLED:
        try:
            from io import BytesIO
            minio_client.put_object(
                MINIO_BUCKET,
                s3_key,
                BytesIO(file_content),
                length=file_size,
                content_type=file.content_type or "application/octet-stream"
            )
            uploaded = True
        except Exception as e:
            print(f"Erreur upload MinIO: {e}")
            raise HTTPException(status_code=500, detail="Erreur lors de l'upload")

    # Créer l'entrée en base de données
    from sqlalchemy import text

    attachment_id = uuid.uuid4()
    query = text("""
        INSERT INTO attachments (
            id, patient_id, encounter_id, filename, s3_key, s3_bucket,
            mime_type, size_bytes, uploaded, uploaded_at, created_by
        ) VALUES (
            :id, :patient_id, :encounter_id, :filename, :s3_key, :s3_bucket,
            :mime_type, :size_bytes, :uploaded, :uploaded_at, :created_by
        )
        RETURNING id, filename, mime_type, size_bytes, patient_id, encounter_id,
                  uploaded, uploaded_at, created_at
    """)

    result = await db.execute(query, {
        "id": attachment_id,
        "patient_id": patient_id,
        "encounter_id": encounter_id,
        "filename": file.filename,
        "s3_key": s3_key,
        "s3_bucket": MINIO_BUCKET,
        "mime_type": file.content_type or "application/octet-stream",
        "size_bytes": file_size,
        "uploaded": uploaded,
        "uploaded_at": datetime.utcnow() if uploaded else None,
        "created_by": current_user.id
    })

    await db.commit()

    row = result.fetchone()

    return AttachmentResponse(
        id=str(row.id),
        filename=row.filename,
        mime_type=row.mime_type,
        size_bytes=row.size_bytes,
        patient_id=str(row.patient_id) if row.patient_id else None,
        encounter_id=str(row.encounter_id) if row.encounter_id else None,
        uploaded=row.uploaded,
        uploaded_at=row.uploaded_at,
        created_at=row.created_at,
        download_url=f"/api/attachments/{attachment_id}/download" if uploaded else None
    )


# ===========================================================================
# LIST ATTACHMENTS
# ===========================================================================

@router.get("", response_model=list[AttachmentResponse])
async def list_attachments(
    patient_id: Optional[str] = Query(None),
    encounter_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Liste les fichiers uploadés pour un patient ou une consultation"""
    from sqlalchemy import text

    # Construction de la requête avec filtres optionnels
    from sqlalchemy import UUID as SQLAlchemyUUID

    base_query = """
        SELECT DISTINCT a.id, a.filename, a.mime_type, a.size_bytes, a.patient_id, a.encounter_id,
               a.uploaded, a.uploaded_at, a.created_at
        FROM attachments a
        LEFT JOIN patients p ON a.patient_id = p.id
        LEFT JOIN encounters e ON a.encounter_id = e.id
        WHERE (
            (a.patient_id IS NOT NULL AND p.site_id = :site_id)
            OR (a.encounter_id IS NOT NULL AND e.site_id = :site_id)
        )
    """

    params = {"site_id": current_user.site_id}

    # Ajouter filtres optionnels
    if patient_id:
        base_query += " AND a.patient_id = CAST(:patient_id AS UUID)"
        params["patient_id"] = patient_id

    if encounter_id:
        base_query += " AND a.encounter_id = CAST(:encounter_id AS UUID)"
        params["encounter_id"] = encounter_id

    base_query += f" ORDER BY a.created_at DESC LIMIT {limit}"

    query = text(base_query)
    result = await db.execute(query, params)

    rows = result.fetchall()

    return [
        AttachmentResponse(
            id=str(row.id),
            filename=row.filename,
            mime_type=row.mime_type,
            size_bytes=row.size_bytes,
            patient_id=str(row.patient_id) if row.patient_id else None,
            encounter_id=str(row.encounter_id) if row.encounter_id else None,
            uploaded=row.uploaded,
            uploaded_at=row.uploaded_at,
            created_at=row.created_at,
            download_url=f"/api/attachments/{row.id}/download" if row.uploaded else None
        )
        for row in rows
    ]


# ===========================================================================
# GET STORAGE STATS
# ===========================================================================

@router.get("/storage-stats", response_model=StorageStats)
async def get_storage_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retourne les statistiques de stockage pour le tenant actuel"""
    from sqlalchemy import text

    # Calculer le stockage total utilisé par le site (patients + consultations)
    query = text("""
        SELECT
            COALESCE(SUM(a.size_bytes), 0) as total_bytes,
            COUNT(*) as total_files
        FROM attachments a
        LEFT JOIN patients p ON a.patient_id = p.id
        LEFT JOIN encounters e ON a.encounter_id = e.id
        WHERE (
            (a.patient_id IS NOT NULL AND p.site_id = :site_id)
            OR (a.encounter_id IS NOT NULL AND e.site_id = :site_id)
        )
        AND a.uploaded = true
    """)

    result = await db.execute(query, {"site_id": current_user.site_id})
    row = result.fetchone()

    total_bytes = int(row.total_bytes)
    total_files = int(row.total_files)

    # Récupérer le quota du plan depuis la subscription
    # Note: on utilise tenant_id ici car la table subscriptions a bien cette colonne
    quota_query = text("""
        SELECT p.max_storage_gb
        FROM subscriptions s
        JOIN plans p ON s.plan_id = p.id
        WHERE s.tenant_id = :tenant_id
        AND s.status = 'active'
        LIMIT 1
    """)

    quota_result = await db.execute(quota_query, {"tenant_id": current_user.tenant_id})
    quota_row = quota_result.fetchone()

    quota_gb = quota_row.max_storage_gb if quota_row and quota_row.max_storage_gb else 10
    quota_bytes = quota_gb * 1024 * 1024 * 1024

    return StorageStats(
        total_bytes=total_bytes,
        total_gb=round(total_bytes / (1024**3), 2),
        total_files=total_files,
        quota_gb=quota_gb,
        quota_bytes=quota_bytes,
        usage_percent=round((total_bytes / quota_bytes * 100), 2) if quota_bytes > 0 else 0
    )


# ===========================================================================
# DOWNLOAD FILE
# ===========================================================================

@router.get("/{attachment_id}/download")
async def download_file(
    attachment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Télécharge un fichier"""
    from sqlalchemy import text
    from fastapi.responses import StreamingResponse
    from io import BytesIO

    # Récupérer l'attachment
    query = text("""
        SELECT a.id, a.filename, a.s3_key, a.s3_bucket, a.mime_type,
               a.uploaded, p.site_id
        FROM attachments a
        LEFT JOIN patients p ON a.patient_id = p.id
        LEFT JOIN encounters e ON a.encounter_id = e.id
        WHERE a.id = :id
    """)

    result = await db.execute(query, {"id": attachment_id})
    row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Fichier non trouvé")

    # Vérifier que le fichier appartient au même site que l'utilisateur
    if row.site_id != current_user.site_id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    if not row.uploaded:
        raise HTTPException(status_code=404, detail="Fichier pas encore uploadé")

    # Télécharger depuis MinIO
    if MINIO_ENABLED:
        try:
            response = minio_client.get_object(row.s3_bucket, row.s3_key)
            file_data = response.read()

            return StreamingResponse(
                BytesIO(file_data),
                media_type=row.mime_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{row.filename}"'
                }
            )
        except Exception as e:
            print(f"Erreur téléchargement MinIO: {e}")
            raise HTTPException(status_code=500, detail="Erreur lors du téléchargement")
    else:
        raise HTTPException(status_code=503, detail="Service de stockage non disponible")


# ===========================================================================
# DELETE FILE
# ===========================================================================

@router.delete("/{attachment_id}")
async def delete_file(
    attachment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprime un fichier"""
    from sqlalchemy import text

    # Récupérer l'attachment avec vérification du site
    query = text("""
        SELECT a.id, a.s3_key, a.s3_bucket, a.uploaded, p.site_id as patient_site_id, e.site_id as encounter_site_id
        FROM attachments a
        LEFT JOIN patients p ON a.patient_id = p.id
        LEFT JOIN encounters e ON a.encounter_id = e.id
        WHERE a.id = CAST(:id AS UUID)
    """)

    result = await db.execute(query, {"id": attachment_id})
    row = result.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Fichier non trouvé")

    # Vérifier que le fichier appartient au même site que l'utilisateur
    site_id = row.patient_site_id or row.encounter_site_id
    if site_id != current_user.site_id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    # Supprimer depuis MinIO si le fichier a été uploadé
    if row.uploaded and MINIO_ENABLED:
        try:
            minio_client.remove_object(row.s3_bucket, row.s3_key)
        except Exception as e:
            print(f"Erreur suppression MinIO: {e}")
            # On continue quand même pour supprimer l'entrée en base

    # Supprimer l'entrée en base de données
    delete_query = text("DELETE FROM attachments WHERE id = CAST(:id AS UUID)")
    await db.execute(delete_query, {"id": attachment_id})
    await db.commit()

    return {"message": "Fichier supprimé avec succès"}
