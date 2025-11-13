"""
Fonctions de sécurité : hachage de mot de passe, création de tokens JWT
"""
from datetime import datetime, timedelta
from typing import Any
import uuid

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

# Contexte de hachage de mot de passe avec bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """
    Hache un mot de passe en utilisant bcrypt
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Vérifie un mot de passe contre son hash
    """
    # Truncate password to 72 bytes for bcrypt compatibility
    if isinstance(plain_password, str):
        plain_password = plain_password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """
    Crée un token JWT d'accès
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict[str, Any]) -> str:
    """
    Crée un token JWT de rafraîchissement
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict[str, Any]:
    """
    Décode un token JWT
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


# ===========================================================================
# DEPENDENCIES FOR AUTHENTICATION
# ===========================================================================

security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
):
    """
    Récupère l'utilisateur actuellement authentifié à partir du token JWT
    Le token peut provenir soit d'un cookie HttpOnly, soit du header Authorization

    Note: Cette fonction doit être utilisée avec Depends(get_db) séparément
    dans les endpoints pour obtenir la session de base de données
    """
    from app.database import AsyncSessionLocal
    from app.models import User

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Essayer de récupérer le token depuis le cookie en premier
    token = request.cookies.get("access_token")

    # Si pas de cookie, essayer le header Authorization (pour rétrocompatibilité)
    if not token and credentials:
        token = credentials.credentials

    if not token:
        raise credentials_exception

    try:
        payload = decode_token(token)
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception

        user_id = uuid.UUID(user_id_str)

    except (JWTError, ValueError) as e:
        raise credentials_exception

    # Récupérer l'utilisateur depuis la base de données
    async with AsyncSessionLocal() as session:
        query = select(User).where(User.id == user_id, User.actif == True)
        result = await session.execute(query)
        user = result.scalar_one_or_none()

        if user is None:
            raise credentials_exception

        return user


async def get_current_admin_user(
    current_user = Depends(get_current_user),
):
    """
    Récupère l'utilisateur actuellement authentifié et vérifie qu'il est admin

    Raises:
        HTTPException: Si l'utilisateur n'est pas admin
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé aux administrateurs"
        )
    return current_user
