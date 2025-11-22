"""
Modèle pour les feedbacks utilisateurs
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ENUM
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import uuid as uuid_module

from app.models.base_models import Base


class FeedbackType(str, enum.Enum):
    """Types de feedback"""
    BUG = "bug"
    FEATURE_REQUEST = "feature_request"
    IMPROVEMENT = "improvement"
    GENERAL = "general"
    COMPLAINT = "complaint"


class FeedbackStatus(str, enum.Enum):
    """Statuts du feedback"""
    NEW = "new"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class Feedback(Base):
    """Modèle pour les feedbacks utilisateurs"""

    __tablename__ = "feedbacks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid_module.uuid4, index=True)

    # Type et catégorie - utiliser ENUM PostgreSQL natif, pas les enums Python
    type = Column(ENUM('bug', 'feature_request', 'improvement', 'general', 'complaint', name='feedbacktype', create_type=True), nullable=False, default="general", server_default="general")
    status = Column(ENUM('new', 'in_progress', 'resolved', 'closed', name='feedbackstatus', create_type=True), nullable=False, default="new", server_default="new")

    # Contenu
    subject = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)

    # Informations utilisateur
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # Nullable pour feedback anonyme
    user_email = Column(String(255), nullable=True)  # Pour feedback sans compte
    user_name = Column(String(255), nullable=True)

    # Informations techniques (pour debugging)
    browser_info = Column(Text, nullable=True)
    screen_size = Column(String(50), nullable=True)
    url = Column(String(500), nullable=True)

    # Réponse admin
    admin_response = Column(Text, nullable=True)
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    responded_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relations
    user = relationship("User", foreign_keys=[user_id])
    admin = relationship("User", foreign_keys=[admin_id])

    def __repr__(self):
        return f"<Feedback {self.id}: {self.type.value} - {self.subject[:50]}>"
