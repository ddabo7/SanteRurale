#!/usr/bin/env python3
"""
Script pour insérer les données initiales dans la base de données
"""
import asyncio
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import District, Region, Site, User
from app.security import hash_password


async def seed_initial_data():
    """Insère les données initiales dans la base de données"""
    engine = create_async_engine(str(settings.DATABASE_URL), echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Vérifier si des régions existent déjà
        result = await session.execute(select(Region))
        existing_regions = result.scalars().all()

        if not existing_regions:
            print("📍 Insertion des données initiales...")

            # Créer région Koulikoro
            region = Region(
                id=uuid.uuid4(),
                nom="Koulikoro",
                code="KOU"
            )
            session.add(region)
            await session.flush()
            print(f"✓ Région créée : {region.nom}")

            # Créer district Koulikoro
            district = District(
                id=uuid.uuid4(),
                nom="Koulikoro",
                region_id=region.id,
                code="KOU-01"
            )
            session.add(district)
            await session.flush()
            print(f"✓ District créé : {district.nom}")

            # Créer site CSCOM Koulikoro
            site = Site(
                id=uuid.uuid4(),
                nom="CSCOM Koulikoro",
                district_id=district.id,
                type="cscom",
                actif=True
            )
            session.add(site)
            await session.flush()
            print(f"✓ Site créé : {site.nom}")

            # Créer les utilisateurs par défaut (tous avec email vérifié)
            users_data = [
                {
                    "nom": "DIARRA",
                    "prenom": "Mamadou",
                    "email": "admin@cscom-koulikoro.ml",
                    "password": "Admin2024!",
                    "role": "admin"
                },
                {
                    "nom": "TRAORÉ",
                    "prenom": "Amadou",
                    "email": "dr.traore@cscom-koulikoro.ml",
                    "password": "Medecin2024!",
                    "role": "medecin"
                },
                {
                    "nom": "KONÉ",
                    "prenom": "Fatimata",
                    "email": "major.kone@cscom-koulikoro.ml",
                    "password": "Major2024!",
                    "role": "major"
                },
                {
                    "nom": "COULIBALY",
                    "prenom": "Ibrahim",
                    "email": "soignant.coulibaly@cscom-koulikoro.ml",
                    "password": "Soignant2024!",
                    "role": "soignant"
                }
            ]

            for user_data in users_data:
                user = User(
                    id=uuid.uuid4(),
                    nom=user_data["nom"],
                    prenom=user_data["prenom"],
                    email=user_data["email"],
                    password_hash=hash_password(user_data["password"]),
                    role=user_data["role"],
                    site_id=site.id,
                    actif=True,
                    email_verified=True  # Les comptes par défaut sont déjà vérifiés
                )
                session.add(user)
                print(f"✓ Utilisateur créé : {user.email} ({user.role})")

            await session.commit()
            print("\n✅ Données initiales insérées avec succès !")
            print(f"   - 1 région : {region.nom}")
            print(f"   - 1 district : {district.nom}")
            print(f"   - 1 site : {site.nom}")
            print(f"   - 4 utilisateurs vérifiés")
        else:
            print("⚠️  Des données existent déjà, insertion ignorée")

    await engine.dispose()


if __name__ == "__main__":
    print("\n🌱 Insertion des données initiales...\n")
    asyncio.run(seed_initial_data())
    print("\n✅ Terminé!\n")
