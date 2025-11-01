#!/usr/bin/env python3
"""
Script pour tester le login
"""
import asyncio
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import User
from app.security import create_access_token, verify_password


async def test_login():
    """Teste le login"""
    engine = create_async_engine(str(settings.DATABASE_URL), echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    email = "admin@cscom-koulikoro.ml"
    password = "Admin2024!"

    async with async_session() as session:
        # Récupérer l'utilisateur
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user:
            print(f"❌ Utilisateur {email} non trouvé")
            sys.exit(1)

        print(f"✓ Utilisateur trouvé : {user.email}")
        print(f"  - Nom : {user.prenom} {user.nom}")
        print(f"  - Rôle : {user.role}")
        print(f"  - Email vérifié : {user.email_verified}")

        # Vérifier le mot de passe
        if verify_password(password, user.password_hash):
            print(f"✓ Mot de passe correct")
        else:
            print(f"❌ Mot de passe incorrect")
            sys.exit(1)

        # Créer un token
        token_data = {"sub": str(user.id), "email": user.email, "role": user.role}
        access_token = create_access_token(token_data)
        print(f"✓ Token créé : {access_token[:50]}...")

        print(f"\n✅ Login fonctionne correctement!")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(test_login())
