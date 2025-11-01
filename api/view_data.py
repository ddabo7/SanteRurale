#!/usr/bin/env python3
"""
Script pour visualiser les données de la base de données
Usage: python view_data.py
"""
import asyncio
import sys
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Configuration de la base de données
DATABASE_URL = "postgresql+asyncpg://sante:sante_pwd@localhost:5432/sante_rurale"


async def view_database_stats():
    """Affiche les statistiques de la base de données"""

    # Créer le moteur de base de données
    engine = create_async_engine(DATABASE_URL, echo=False)

    # Créer une session
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )

    try:
        async with async_session() as session:
            print("\n" + "="*60)
            print("📊 STATISTIQUES DE LA BASE DE DONNÉES - Santé Rurale Mali")
            print("="*60 + "\n")

            # Importer les modèles
            from app.models import User, Patient, Site, Region, District

            # Compter les utilisateurs
            result = await session.execute(select(func.count(User.id)))
            user_count = result.scalar()
            print(f"👥 Utilisateurs : {user_count}")

            # Compter les patients
            result = await session.execute(select(func.count(Patient.id)))
            patient_count = result.scalar()
            print(f"🏥 Patients : {patient_count}")

            # Compter les sites
            result = await session.execute(select(func.count(Site.id)))
            site_count = result.scalar()
            print(f"📍 Sites : {site_count}")

            # Compter les régions
            result = await session.execute(select(func.count(Region.id)))
            region_count = result.scalar()
            print(f"🗺️  Régions : {region_count}")

            # Compter les districts
            result = await session.execute(select(func.count(District.id)))
            district_count = result.scalar()
            print(f"📌 Districts : {district_count}")

            print("\n" + "="*60)
            print("\n💡 Pour voir les données en détail, utilisez pgAdmin ou DBeaver")
            print("   - Host: localhost")
            print("   - Port: 5432")
            print("   - Database: sante_rurale")
            print("   - User: sante")
            print("   - Password: sante_pwd")
            print("\n" + "="*60 + "\n")

    except Exception as e:
        print(f"\n❌ Erreur lors de la connexion à la base de données:")
        print(f"   {str(e)}")
        print("\n💡 Assurez-vous que:")
        print("   1. PostgreSQL est démarré")
        print("   2. La base de données 'sante_rurale' existe")
        print("   3. L'utilisateur 'sante' a accès à la base")
        sys.exit(1)

    finally:
        await engine.dispose()


if __name__ == "__main__":
    print("\n🔍 Chargement des données...")
    asyncio.run(view_database_stats())
