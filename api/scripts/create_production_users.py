#!/usr/bin/env python3
"""
Script pour créer des utilisateurs de production
Usage: python scripts/create_production_users.py
"""
import asyncio
import sys
import os
from pathlib import Path

# Ajouter le répertoire parent au PYTHONPATH
sys.path.insert(0, str(Path(__file__).parent.parent))

from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import uuid

from app.models import User, Site

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://sante:sante_pwd@localhost:5432/sante_rurale")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Utilisateurs à créer
PRODUCTION_USERS = [
    {
        "nom": "Administrateur",
        "prenom": "Système",
        "email": "admin@sante-rurale.ml",
        "password": "AdminSecure2025!",
        "role": "admin",
        "telephone": "+22376000000"
    },
    {
        "nom": "Konaté",
        "prenom": "Amadou",
        "email": "medecin.siby@sante-rurale.ml",
        "password": "MedecinSiby2025!",
        "role": "medecin",
        "telephone": "+22376111111"
    },
    {
        "nom": "Traoré",
        "prenom": "Fatoumata",
        "email": "major.siby@sante-rurale.ml",
        "password": "MajorSiby2025!",
        "role": "major",
        "telephone": "+22376222222"
    },
    {
        "nom": "Diarra",
        "prenom": "Seydou",
        "email": "soignant.siby@sante-rurale.ml",
        "password": "SoignantSiby2025!",
        "role": "soignant",
        "telephone": "+22376333333"
    },
]


async def get_first_site(session: AsyncSession):
    """Récupère le premier site disponible"""
    result = await session.execute(select(Site).limit(1))
    site = result.scalar_one_or_none()
    if not site:
        raise ValueError("Aucun site trouvé dans la base de données. Veuillez d'abord créer un site.")
    return site


async def create_users():
    """Crée les utilisateurs de production"""
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        try:
            # Récupérer le premier site
            site = await get_first_site(session)
            print(f"\n✓ Site trouvé: {site.nom} (ID: {site.id})")

            created_users = []
            for user_data in PRODUCTION_USERS:
                # Vérifier si l'utilisateur existe déjà
                result = await session.execute(
                    select(User).where(User.email == user_data["email"])
                )
                existing_user = result.scalar_one_or_none()

                if existing_user:
                    print(f"\n⚠️  Utilisateur {user_data['email']} existe déjà, ignoré.")
                    continue

                # Créer l'utilisateur
                password_hash = pwd_context.hash(user_data["password"])
                user = User(
                    id=uuid.uuid4(),
                    nom=user_data["nom"],
                    prenom=user_data["prenom"],
                    email=user_data["email"],
                    password_hash=password_hash,
                    role=user_data["role"],
                    telephone=user_data["telephone"],
                    site_id=site.id,
                    actif=True,
                    email_verified=True,  # Pré-vérifié pour la production
                )

                session.add(user)
                created_users.append(user_data)
                print(f"\n✓ Utilisateur créé: {user_data['nom']} {user_data['prenom']} ({user_data['role']})")
                print(f"  Email: {user_data['email']}")
                print(f"  Mot de passe temporaire: {user_data['password']}")

            await session.commit()

            print("\n" + "=" * 80)
            print("RÉSUMÉ DES UTILISATEURS CRÉÉS")
            print("=" * 80)
            for user_data in created_users:
                print(f"\nRôle: {user_data['role'].upper()}")
                print(f"  Nom: {user_data['nom']} {user_data['prenom']}")
                print(f"  Email: {user_data['email']}")
                print(f"  Mot de passe: {user_data['password']}")
                print(f"  Téléphone: {user_data['telephone']}")

            print("\n" + "=" * 80)
            print("⚠️  IMPORTANT: Changez ces mots de passe après la première connexion!")
            print("=" * 80)

        except Exception as e:
            print(f"\n❌ Erreur: {e}")
            await session.rollback()
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    print("Création des utilisateurs de production...")
    asyncio.run(create_users())
