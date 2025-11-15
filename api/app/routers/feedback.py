"""
Routes API pour les feedbacks utilisateurs
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.feedback import Feedback, FeedbackType, FeedbackStatus
from app.models.base_models import User
from app.security import get_current_user, get_current_admin_user
from pydantic import BaseModel, EmailStr, Field
import uuid as uuid_module


# ===========================================================================
# Schemas Pydantic
# ===========================================================================

class FeedbackCreate(BaseModel):
    """Schéma pour créer un feedback"""
    type: str = "general"  # Accepter directement une string
    subject: str = Field(..., min_length=5, max_length=255)
    message: str = Field(..., min_length=10, max_length=5000)
    user_email: Optional[EmailStr] = None
    user_name: Optional[str] = None
    browser_info: Optional[str] = None
    screen_size: Optional[str] = None
    url: Optional[str] = None


class FeedbackResponse(BaseModel):
    """Schéma de réponse pour un feedback"""
    id: int
    type: str  # String au lieu de FeedbackType
    status: str  # String au lieu de FeedbackStatus
    subject: str
    message: str
    user_email: Optional[str]
    user_name: Optional[str]
    browser_info: Optional[str]
    admin_response: Optional[str]
    responded_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FeedbackUpdate(BaseModel):
    """Schéma pour mettre à jour un feedback (admin)"""
    status: Optional[str] = None  # Accepter directement une string
    admin_response: Optional[str] = None


class FeedbackStats(BaseModel):
    """Statistiques des feedbacks"""
    total: int
    by_type: dict
    by_status: dict
    recent_count: int  # Dernières 24h


# ===========================================================================
# Router
# ===========================================================================

router = APIRouter(prefix="/feedback", tags=["Feedback"])


@router.post("/", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def create_feedback(
    feedback_data: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Créer un nouveau feedback

    - Nécessite authentification
    - user_id est automatiquement rempli depuis l'utilisateur connecté
    """
    try:
        # Créer le feedback (type et status sont des strings maintenant)
        feedback = Feedback(
            type=feedback_data.type,
            subject=feedback_data.subject,
            message=feedback_data.message,
            user_id=current_user.id,
            user_email=feedback_data.user_email or current_user.email,
            user_name=feedback_data.user_name or f"{current_user.nom} {current_user.prenom}",
            browser_info=feedback_data.browser_info,
            screen_size=feedback_data.screen_size,
            url=feedback_data.url,
            status="new",
        )

        db.add(feedback)
        await db.commit()
        await db.refresh(feedback)

        return feedback

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la création du feedback: {str(e)}"
        )


@router.get("/my-feedbacks", response_model=List[FeedbackResponse])
async def get_my_feedbacks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Récupérer les feedbacks de l'utilisateur connecté"""
    result = await db.execute(
        select(Feedback)
        .where(Feedback.user_id == current_user.id)
        .order_by(Feedback.created_at.desc())
    )
    feedbacks = result.scalars().all()
    return feedbacks


@router.get("/admin/all", response_model=List[FeedbackResponse])
async def get_all_feedbacks(
    skip: int = 0,
    limit: int = 50,
    feedback_type: Optional[FeedbackType] = None,
    feedback_status: Optional[FeedbackStatus] = None,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """
    Récupérer tous les feedbacks (admin seulement)

    - Filtrage par type et statut
    - Pagination
    """
    query = select(Feedback).order_by(Feedback.created_at.desc())

    if feedback_type:
        query = query.where(Feedback.type == feedback_type)

    if feedback_status:
        query = query.where(Feedback.status == feedback_status)

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    feedbacks = result.scalars().all()
    return feedbacks


@router.get("/admin/stats", response_model=FeedbackStats)
async def get_feedback_stats(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """Statistiques des feedbacks (admin seulement)"""

    # Total
    total_result = await db.execute(select(func.count(Feedback.id)))
    total = total_result.scalar() or 0

    # Par type (row[0] est déjà une string maintenant, pas un enum)
    by_type_result = await db.execute(
        select(Feedback.type, func.count(Feedback.id))
        .group_by(Feedback.type)
    )
    by_type = {row[0]: row[1] for row in by_type_result.all()}

    # Par statut (row[0] est déjà une string maintenant, pas un enum)
    by_status_result = await db.execute(
        select(Feedback.status, func.count(Feedback.id))
        .group_by(Feedback.status)
    )
    by_status = {row[0]: row[1] for row in by_status_result.all()}

    # Dernières 24h
    from datetime import timedelta
    yesterday = datetime.utcnow() - timedelta(days=1)
    recent_result = await db.execute(
        select(func.count(Feedback.id))
        .where(Feedback.created_at >= yesterday)
    )
    recent_count = recent_result.scalar() or 0

    return FeedbackStats(
        total=total,
        by_type=by_type,
        by_status=by_status,
        recent_count=recent_count,
    )


@router.patch("/admin/{feedback_id}", response_model=FeedbackResponse)
async def update_feedback(
    feedback_id: int,
    feedback_update: FeedbackUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """
    Mettre à jour un feedback (admin seulement)

    - Changer le statut
    - Ajouter une réponse
    """
    result = await db.execute(
        select(Feedback).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()

    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback non trouvé"
        )

    # Mettre à jour
    if feedback_update.status:
        feedback.status = feedback_update.status

    if feedback_update.admin_response:
        feedback.admin_response = feedback_update.admin_response
        feedback.admin_id = current_admin.id
        feedback.responded_at = datetime.utcnow()

    await db.commit()
    await db.refresh(feedback)

    return feedback


@router.delete("/admin/{feedback_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feedback(
    feedback_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin_user),
):
    """Supprimer un feedback (admin seulement)"""
    result = await db.execute(
        select(Feedback).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()

    if not feedback:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feedback non trouvé"
        )

    await db.delete(feedback)
    await db.commit()

    return None
