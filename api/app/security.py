"""
Fonctions de sécurité : hachage de mot de passe, création de tokens JWT
"""
from datetime import datetime, timedelta
from typing import Any
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Récupère l'utilisateur actuellement authentifié à partir du token JWT

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

    # Vérifier que les credentials sont présents
    if not credentials:
        print("DEBUG: No credentials provided")
        raise credentials_exception

    token = credentials.credentials
    print(f"DEBUG: Token received (first 20 chars): {token[:20]}...")

    try:
        payload = decode_token(token)
        print(f"DEBUG: Token payload decoded successfully: {payload.keys()}")
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            print(f"DEBUG: No 'sub' in token payload: {payload}")
            raise credentials_exception

        user_id = uuid.UUID(user_id_str)
        print(f"DEBUG: User ID from token: {user_id}")

    except (JWTError, ValueError) as e:
        print(f"DEBUG: Token decode error: {type(e).__name__}: {e}")
        raise credentials_exception

    # Récupérer l'utilisateur depuis la base de données
    async with AsyncSessionLocal() as session:
        query = select(User).where(User.id == user_id, User.actif == True)
        result = await session.execute(query)
        user = result.scalar_one_or_none()

        if user is None:
            print(f"DEBUG: No user found for ID {user_id}")
            raise credentials_exception

        print(f"DEBUG: User found: {user.email}")
        return user
