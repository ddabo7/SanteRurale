"""
Routes d'authentification
"""
import secrets
import uuid as uuid_module
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Site, User
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.services.email import send_password_reset_email, send_verification_email

router = APIRouter(prefix="/auth", tags=["Authentication"])


# Schémas Pydantic
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    nom: str
    prenom: str | None = None
    telephone: str | None = None
    role: str = "soignant"  # admin, medecin, major, soignant
    site_id: uuid_module.UUID | None = None  # Si None, on prend le premier site
    tenant_id: uuid_module.UUID | None = None  # ID du tenant (pour multi-tenancy)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class VerifyEmailRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class UserResponse(BaseModel):
    id: str
    email: str
    nom: str
    prenom: str | None
    role: str
    site_id: str
    actif: bool
    email_verified: bool


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


# Endpoints
@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(signup_data: SignupRequest, db: AsyncSession = Depends(get_db)):
    """
    Inscription d'un nouvel utilisateur
    """
    # Vérifier si l'email existe déjà
    result = await db.execute(select(User).where(User.email == signup_data.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cet email est déjà utilisé"
        )

    # Valider le mot de passe (au moins 8 caractères, 1 majuscule, 1 chiffre, 1 spécial)
    password = signup_data.password
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe doit contenir au moins 8 caractères"
        )
    if not any(c.isupper() for c in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe doit contenir au moins une majuscule"
        )
    if not any(c.isdigit() for c in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe doit contenir au moins un chiffre"
        )
    if not any(c in "!@#$%^&*" for c in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*)"
        )

    # Récupérer le site (fourni ou le premier disponible)
    if signup_data.site_id:
        result = await db.execute(select(Site).where(Site.id == signup_data.site_id))
        site = result.scalar_one_or_none()
        if not site:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Site invalide."
            )
    else:
        result = await db.execute(select(Site).limit(1))
        site = result.scalar_one_or_none()
        if not site:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Aucun site disponible. Contactez l'administrateur."
            )

    # Générer le token de vérification
    verification_token = secrets.token_urlsafe(32)
    verification_expires = datetime.now(timezone.utc) + timedelta(hours=24)

    # Créer l'utilisateur
    new_user = User(
        id=uuid_module.uuid4(),
        nom=signup_data.nom,
        prenom=signup_data.prenom,
        email=signup_data.email,
        password_hash=hash_password(signup_data.password),
        telephone=signup_data.telephone,
        role=signup_data.role,
        site_id=site.id,
        tenant_id=signup_data.tenant_id,  # Associer au tenant
        email_verified=False,
        verification_token=verification_token,
        verification_token_expires=verification_expires,
        actif=True,
    )

    db.add(new_user)
    await db.flush()

    # Envoyer l'email de vérification
    user_name = f"{new_user.prenom or ''} {new_user.nom}".strip()
    try:
        send_verification_email(new_user.email, verification_token, user_name)
    except Exception as e:
        print(f"Erreur lors de l'envoi de l'email : {e}")
        # On continue même si l'email échoue

    await db.commit()

    return {
        "success": True,
        "message": "Compte créé ! Vérifiez votre email pour activer votre compte.",
        "email": new_user.email,
    }


@router.post("/verify-email")
async def verify_email(request: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    """
    Vérifie l'adresse email d'un utilisateur
    """
    # Trouver l'utilisateur avec ce token
    result = await db.execute(
        select(User).where(User.verification_token == request.token)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token de vérification invalide"
        )

    # Vérifier que le token n'a pas expiré
    if user.verification_token_expires and user.verification_token_expires < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le token de vérification a expiré"
        )

    # Marquer l'email comme vérifié
    user.email_verified = True
    user.verification_token = None
    user.verification_token_expires = None

    await db.commit()

    return {
        "success": True,
        "message": "Email vérifié avec succès ! Vous pouvez maintenant vous connecter."
    }


@router.post("/login", response_model=LoginResponse)
async def login(login_data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Connexion d'un utilisateur
    """
    # Trouver l'utilisateur par email
    result = await db.execute(select(User).where(User.email == login_data.email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )

    # Vérifier le mot de passe
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect"
        )

    # Vérifier que l'email est vérifié
    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Veuillez vérifier votre email avant de vous connecter"
        )

    # Vérifier que le compte est actif
    if not user.actif:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Votre compte a été désactivé. Contactez l'administrateur."
        )

    # Créer les tokens
    token_data = {"sub": str(user.id), "email": user.email, "role": user.role}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # Retourner la réponse
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            nom=user.nom,
            prenom=user.prenom,
            role=user.role,
            site_id=str(user.site_id),
            actif=user.actif,
            email_verified=user.email_verified,
        ),
    )


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Demande de réinitialisation de mot de passe
    """
    # Trouver l'utilisateur
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    # On retourne toujours succès pour des raisons de sécurité (ne pas révéler si l'email existe)
    if not user:
        return {
            "success": True,
            "message": "Si cet email existe, un lien de réinitialisation a été envoyé."
        }

    # Générer le token de réinitialisation
    reset_token = secrets.token_urlsafe(32)
    reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)

    user.reset_token = reset_token
    user.reset_token_expires = reset_expires

    await db.commit()

    # Envoyer l'email
    user_name = f"{user.prenom or ''} {user.nom}".strip()
    try:
        send_password_reset_email(user.email, reset_token, user_name)
    except Exception as e:
        print(f"Erreur lors de l'envoi de l'email : {e}")

    return {
        "success": True,
        "message": "Si cet email existe, un lien de réinitialisation a été envoyé."
    }


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Réinitialise le mot de passe avec un token
    """
    # Trouver l'utilisateur avec ce token
    result = await db.execute(
        select(User).where(User.reset_token == request.token)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token de réinitialisation invalide"
        )

    # Vérifier que le token n'a pas expiré
    if user.reset_token_expires and user.reset_token_expires < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le token de réinitialisation a expiré"
        )

    # Valider le nouveau mot de passe
    password = request.new_password
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe doit contenir au moins 8 caractères"
        )
    if not any(c.isupper() for c in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe doit contenir au moins une majuscule"
        )
    if not any(c.isdigit() for c in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe doit contenir au moins un chiffre"
        )
    if not any(c in "!@#$%^&*" for c in password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*)"
        )

    # Mettre à jour le mot de passe
    user.password_hash = hash_password(request.new_password)
    user.reset_token = None
    user.reset_token_expires = None

    await db.commit()

    return {
        "success": True,
        "message": "Mot de passe réinitialisé avec succès !"
    }


@router.get("/me", response_model=UserResponse)
async def get_current_user(db: AsyncSession = Depends(get_db)):
    """
    Récupère les informations de l'utilisateur connecté
    (à implémenter avec l'authentification par token)
    """
    # TODO: Implémenter l'extraction du user_id depuis le token JWT
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Endpoint non implémenté"
    )
