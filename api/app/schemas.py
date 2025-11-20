"""
Schémas Pydantic pour validation et sérialisation API
"""
from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict
from typing import Optional, List, Any
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID
import enum


# ===========================================================================
# ENUMS (matching models)
# ===========================================================================

class UserRole(str, enum.Enum):
    SOIGNANT = "soignant"
    INFIRMIER = "infirmier"
    MAJOR = "major"
    MEDECIN = "medecin"
    PHARMACIEN = "pharmacien"
    ADMIN = "admin"


class Sexe(str, enum.Enum):
    M = "M"
    F = "F"


class ReferenceStatut(str, enum.Enum):
    EN_ATTENTE = "en_attente"
    CONFIRME = "confirme"
    COMPLETE = "complete"
    ANNULE = "annule"


class EntityType(str, enum.Enum):
    PATIENT = "patient"
    ENCOUNTER = "encounter"
    CONDITION = "condition"
    MEDICATION_REQUEST = "medication_request"
    PROCEDURE = "procedure"
    REFERENCE = "reference"


class SyncOperationType(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


# ===========================================================================
# BASE SCHEMAS
# ===========================================================================

class BaseSchema(BaseModel):
    """Base pour tous les schémas"""
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)


# ===========================================================================
# AUTH SCHEMAS
# ===========================================================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int  # secondes
    user: "UserOut"


class RefreshRequest(BaseModel):
    refresh_token: str


class ProfileUpdateRequest(BaseModel):
    """Mise à jour du profil utilisateur"""
    nom: Optional[str] = Field(None, min_length=2, max_length=100)
    prenom: Optional[str] = Field(None, max_length=100)
    telephone: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = None
    avatar_url: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    """Changement de mot de passe"""
    current_password: str = Field(min_length=8)
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Le mot de passe doit contenir au moins 8 caractères")
        if not any(c.isupper() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule")
        if not any(c.isdigit() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        if not any(c in "!@#$%^&*" for c in v):
            raise ValueError("Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*)")
        return v


# ===========================================================================
# USER SCHEMAS
# ===========================================================================

class SiteBase(BaseSchema):
    nom: str
    district_id: Optional[UUID] = None
    village: Optional[str] = None


class SiteOut(SiteBase):
    id: UUID
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    actif: bool
    created_at: datetime


class UserBase(BaseSchema):
    nom: str
    email: EmailStr
    phone: Optional[str] = None
    role: UserRole
    site_id: UUID


class UserCreate(UserBase):
    password: str = Field(min_length=12, description="Minimum 12 caractères")

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 12:
            raise ValueError("Le mot de passe doit contenir au moins 12 caractères")
        if not any(c.isupper() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins une majuscule")
        if not any(c.islower() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins une minuscule")
        if not any(c.isdigit() for c in v):
            raise ValueError("Le mot de passe doit contenir au moins un chiffre")
        return v


class UserUpdate(BaseModel):
    nom: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[UserRole] = None
    actif: Optional[bool] = None


class UserSimple(BaseSchema):
    """User sans les relations (pour inclure dans d'autres schémas)"""
    id: UUID
    nom: str
    prenom: Optional[str] = None
    email: EmailStr
    role: UserRole
    site_id: UUID

class UserOut(UserBase):
    id: UUID
    actif: bool
    last_login: Optional[datetime] = None
    site: SiteOut
    created_at: datetime


# ===========================================================================
# PATIENT SCHEMAS
# ===========================================================================

class PatientBase(BaseSchema):
    nom: str = Field(min_length=2, max_length=100)
    prenom: Optional[str] = Field(None, max_length=100)
    sexe: Sexe
    annee_naissance: Optional[int] = Field(None, ge=1900, le=2025)
    telephone: Optional[str] = Field(None, max_length=20)
    village: Optional[str] = Field(None, max_length=200)


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    nom: Optional[str] = Field(None, min_length=2, max_length=100)
    prenom: Optional[str] = Field(None, max_length=100)
    telephone: Optional[str] = None
    village: Optional[str] = None


class PatientOut(PatientBase):
    id: UUID
    site_id: UUID
    matricule: Optional[str] = None
    age: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    version: int


class PatientDetails(PatientOut):
    """Patient avec consultations récentes"""
    recent_encounters: List["EncounterOut"] = []
    attachments: List["AttachmentOut"] = []


# ===========================================================================
# ENCOUNTER SCHEMAS
# ===========================================================================

class EncounterBase(BaseSchema):
    patient_id: UUID
    encounter_date: date = Field(default_factory=lambda: datetime.now().date(), serialization_alias="date", validation_alias="date")
    motif: Optional[str] = None
    temperature: Optional[Decimal] = Field(None, ge=25.0, le=45.0)  # Permettre hypothermie
    pouls: Optional[int] = Field(None, ge=20, le=300)
    pression_systolique: Optional[int] = Field(None, ge=50, le=250)
    pression_diastolique: Optional[int] = Field(None, ge=20, le=150)  # Permettre valeurs basses
    poids: Optional[Decimal] = Field(None, ge=0.5, le=300)
    taille: Optional[int] = Field(None, ge=30, le=250)
    notes: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True, from_attributes=True, use_enum_values=True)

    @field_validator("pression_systolique", "pression_diastolique")
    @classmethod
    def validate_pression(cls, v, info):
        """Valide que systolique > diastolique"""
        if info.field_name == "pression_systolique" and "pression_diastolique" in info.data:
            diastolic = info.data.get("pression_diastolique")
            if v and diastolic and v <= diastolic:
                raise ValueError("La pression systolique doit être supérieure à la diastolique")
        return v


class EncounterCreate(EncounterBase):
    pass


class EncounterUpdate(BaseModel):
    motif: Optional[str] = None
    temperature: Optional[Decimal] = Field(None, ge=25.0, le=45.0)
    pouls: Optional[int] = Field(None, ge=20, le=300)
    pression_systolique: Optional[int] = None
    pression_diastolique: Optional[int] = None
    poids: Optional[Decimal] = None
    taille: Optional[int] = None
    notes: Optional[str] = None


class EncounterOut(EncounterBase):
    id: UUID
    site_id: UUID
    user_id: UUID
    patient: Optional[PatientOut] = None
    user: Optional[UserSimple] = None
    created_at: datetime
    updated_at: datetime
    version: int


class EncounterDetails(EncounterOut):
    """Encounter avec diagnostics, ordonnances, actes"""
    conditions: List["ConditionOut"] = []
    medication_requests: List["MedicationRequestOut"] = []
    procedures: List["ProcedureOut"] = []
    reference: Optional["ReferenceOut"] = None


# ===========================================================================
# CONDITION (DIAGNOSTIC) SCHEMAS
# ===========================================================================

class ConditionBase(BaseSchema):
    encounter_id: UUID
    code_icd10: Optional[str] = Field(None, max_length=10)
    libelle: str = Field(min_length=2, max_length=500)
    notes: Optional[str] = None


class ConditionCreate(ConditionBase):
    pass


class ConditionOut(ConditionBase):
    id: UUID
    created_at: datetime


# ===========================================================================
# MEDICATION REQUEST (ORDONNANCE) SCHEMAS
# ===========================================================================

class MedicationRequestBase(BaseSchema):
    encounter_id: UUID
    medicament: str = Field(min_length=2, max_length=500)
    posologie: str = Field(min_length=2, max_length=500)
    duree_jours: Optional[int] = Field(None, gt=0)
    quantite: Optional[Decimal] = Field(None, gt=0)
    unite: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None


class MedicationRequestCreate(MedicationRequestBase):
    pass


class MedicationRequestOut(MedicationRequestBase):
    id: UUID
    created_at: datetime


# ===========================================================================
# PROCEDURE (ACTE) SCHEMAS
# ===========================================================================

class ProcedureBase(BaseSchema):
    encounter_id: UUID
    type: str = Field(min_length=2, max_length=200)
    description: Optional[str] = None
    resultat: Optional[str] = None


class ProcedureCreate(ProcedureBase):
    pass


class ProcedureOut(ProcedureBase):
    id: UUID
    created_at: datetime


# ===========================================================================
# REFERENCE SCHEMAS
# ===========================================================================

class ReferenceBase(BaseSchema):
    encounter_id: UUID
    destination: str = Field(min_length=2, max_length=500)
    raison: str = Field(min_length=5)
    eta: Optional[datetime] = None
    notes: Optional[str] = None


class ReferenceCreate(ReferenceBase):
    pass


class ReferenceUpdate(BaseModel):
    statut: Optional[ReferenceStatut] = None
    notes: Optional[str] = None
    arrived_at: Optional[datetime] = None


class ReferenceOut(ReferenceBase):
    id: UUID
    statut: ReferenceStatut
    arrived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# ===========================================================================
# ATTACHMENT SCHEMAS
# ===========================================================================

class AttachmentCreate(BaseModel):
    filename: str = Field(min_length=1, max_length=500)
    mime_type: str = Field(max_length=100)
    size_bytes: int = Field(gt=0, le=52428800)  # 50 MB max
    patient_id: Optional[UUID] = None
    encounter_id: Optional[UUID] = None

    @field_validator("patient_id", "encounter_id")
    @classmethod
    def validate_entity_link(cls, v, info):
        """Au moins patient_id ou encounter_id doit être fourni"""
        if info.field_name == "encounter_id":
            patient_id = info.data.get("patient_id")
            if not v and not patient_id:
                raise ValueError("patient_id ou encounter_id doit être fourni")
        return v


class AttachmentOut(BaseSchema):
    id: UUID
    filename: str
    mime_type: str
    size_bytes: int
    uploaded: bool
    uploaded_at: Optional[datetime] = None
    created_at: datetime


class AttachmentUploadResponse(BaseModel):
    attachment_id: UUID
    upload_url: str
    expires_at: datetime


class AttachmentDownloadResponse(BaseModel):
    attachment: AttachmentOut
    download_url: str
    expires_at: datetime


# ===========================================================================
# SYNC SCHEMAS
# ===========================================================================

class SyncChange(BaseModel):
    """Changement à synchroniser"""
    entity: EntityType
    operation: SyncOperationType
    id: UUID
    data: Optional[dict] = None
    version: str  # timestamp ou version number


class SyncChangesResponse(BaseModel):
    changes: List[SyncChange]
    next_cursor: str
    has_more: bool


class SyncBatchOperation(BaseModel):
    """Une opération dans un batch de sync"""
    operation: SyncOperationType
    entity: EntityType
    idempotency_key: UUID
    client_id: Optional[UUID] = None
    payload: dict


class SyncBatchRequest(BaseModel):
    operations: List[SyncBatchOperation] = Field(max_length=100)


class SyncBatchResult(BaseModel):
    idempotency_key: UUID
    client_id: Optional[UUID] = None
    server_id: Optional[UUID] = None
    status: str  # created, updated, deleted, skipped


class SyncBatchResponse(BaseModel):
    synced: List[SyncBatchResult]
    conflicts: List[dict]
    errors: List[dict]


# ===========================================================================
# REPORT SCHEMAS
# ===========================================================================

class ReportPeriod(BaseModel):
    from_date: date = Field(alias="from")
    to_date: date = Field(alias="to")

    model_config = ConfigDict(populate_by_name=True)


class TopDiagnostic(BaseModel):
    code: Optional[str]
    libelle: str
    count: int


class ReferenceStats(BaseModel):
    total: int
    confirmes: int
    completes: int
    en_attente: int


class ReportOverview(BaseModel):
    period: ReportPeriod
    total_consultations: int
    total_patients: int
    nouveaux_patients: int
    consultations_moins_5_ans: int
    top_diagnostics: List[TopDiagnostic]
    references: ReferenceStats


# ===========================================================================
# DHIS2 SCHEMAS
# ===========================================================================

class DHIS2ExportRequest(BaseModel):
    period: str = Field(pattern=r"^\d{6}$", description="Format YYYYMM")
    site_id: UUID
    dry_run: bool = False


class DHIS2ExportResponse(BaseModel):
    job_id: UUID
    status: str
    message: str


class DHIS2ExportStatus(BaseModel):
    job_id: UUID
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    result: Optional[dict] = None
    error: Optional[str] = None


# ===========================================================================
# PAGINATION SCHEMAS
# ===========================================================================

class PaginationParams(BaseModel):
    cursor: Optional[str] = None
    limit: int = Field(default=50, ge=1, le=200)


class PaginationMeta(BaseModel):
    cursor: Optional[str] = None
    next_cursor: Optional[str] = None
    has_more: bool


class PaginatedResponse(BaseModel):
    data: List[Any]
    pagination: PaginationMeta


# ===========================================================================
# ERROR SCHEMAS
# ===========================================================================

class ErrorResponse(BaseModel):
    error: str
    message: str
    details: Optional[dict] = None


# ===========================================================================
# HEALTH CHECK
# ===========================================================================

class HealthCheck(BaseModel):
    status: str
    version: str
    database: str
    redis: str
    timestamp: datetime


# ===========================================================================
# Forward references resolution
# ===========================================================================
PatientDetails.model_rebuild()
EncounterDetails.model_rebuild()
TokenResponse.model_rebuild()
