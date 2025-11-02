#!/usr/bin/env python3
"""
Script pour initialiser les données de base (régions, districts, sites)
Usage: python scripts/seed_base_data.py
"""
import asyncio
import sys
import os
from pathlib import Path

# Ajouter le répertoire parent au PYTHONPATH
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import uuid

from app.models import Region, District, Site

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://sante:sante_pwd@localhost:5432/sante_rurale")

# Données de base de base (exemple avec quelques régions/districts)
BASE_DATA = {
    "regions": [
        {"nom": "Koulikoro", "code": "KL"},
        {"nom": "Kayes", "code": "KY"},
        {"nom": "Sikasso", "code": "SK"},
    ],
    "districts": {
        "Koulikoro": [
            {"nom": "Kati", "code": "KL-KT"},
            {"nom": "Koulikoro", "code": "KL-KK"},
        ],
        "Kayes": [
            {"nom": "Kayes", "code": "KY-KY"},
            {"nom": "Kita", "code": "KY-KI"},
        ],
        "Sikasso": [
            {"nom": "Sikasso", "code": "SK-SK"},
            {"nom": "Koutiala", "code": "SK-KT"},
        ],
    },
    "sites": {
        "Kati": [
            {"nom": "CSCOM Siby", "type": "cscom", "village": "Siby", "telephone": "+22376100000"},
            {"nom": "CSCOM Kati", "type": "cscom", "village": "Kati", "telephone": "+22376100001"},
        ],
        "Koulikoro": [
            {"nom": "CSCOM Koulikoro", "type": "cscom", "village": "Koulikoro", "telephone": "+22376100002"},
        ],
        "Kayes": [
            {"nom": "CSCOM Kayes", "type": "cscom", "village": "Kayes", "telephone": "+22376100003"},
        ],
        "Kita": [
            {"nom": "CSCOM Kita", "type": "cscom", "village": "Kita", "telephone": "+22376100004"},
        ],
        "Sikasso": [
            {"nom": "CSCOM Sikasso", "type": "cscom", "village": "Sikasso", "telephone": "+22376100005"},
        ],
        "Koutiala": [
            {"nom": "CSCOM Koutiala", "type": "cscom", "village": "Koutiala", "telephone": "+22376100006"},
        ],
    }
}


async def seed_data():
    """Initialise les données de base"""
    engine = create_async_engine(DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        try:
            print("\n" + "=" * 80)
            print("INITIALISATION DES DONNÉES DE BASE")
            print("=" * 80)

            # 1. Créer les régions
            print("\n1. Création des régions...")
            regions_map = {}
            for region_data in BASE_DATA["regions"]:
                result = await session.execute(
                    select(Region).where(Region.code == region_data["code"])
                )
                existing_region = result.scalar_one_or_none()

                if existing_region:
                    print(f"  ⚠️  Région {region_data['nom']} existe déjà")
                    regions_map[region_data["nom"]] = existing_region
                else:
                    region = Region(
                        id=uuid.uuid4(),
                        nom=region_data["nom"],
                        code=region_data["code"]
                    )
                    session.add(region)
                    regions_map[region_data["nom"]] = region
                    print(f"  ✓ Région créée: {region_data['nom']} ({region_data['code']})")

            await session.flush()

            # 2. Créer les districts
            print("\n2. Création des districts...")
            districts_map = {}
            for region_name, districts in BASE_DATA["districts"].items():
                region = regions_map[region_name]
                for district_data in districts:
                    result = await session.execute(
                        select(District).where(District.code == district_data["code"])
                    )
                    existing_district = result.scalar_one_or_none()

                    if existing_district:
                        print(f"  ⚠️  District {district_data['nom']} existe déjà")
                        districts_map[district_data["nom"]] = existing_district
                    else:
                        district = District(
                            id=uuid.uuid4(),
                            nom=district_data["nom"],
                            code=district_data["code"],
                            region_id=region.id
                        )
                        session.add(district)
                        districts_map[district_data["nom"]] = district
                        print(f"  ✓ District créé: {district_data['nom']} ({district_data['code']})")

            await session.flush()

            # 3. Créer les sites
            print("\n3. Création des sites...")
            sites_created = 0
            for district_name, sites in BASE_DATA["sites"].items():
                district = districts_map[district_name]
                for site_data in sites:
                    result = await session.execute(
                        select(Site).where(Site.nom == site_data["nom"])
                    )
                    existing_site = result.scalar_one_or_none()

                    if existing_site:
                        print(f"  ⚠️  Site {site_data['nom']} existe déjà")
                    else:
                        site = Site(
                            id=uuid.uuid4(),
                            nom=site_data["nom"],
                            type=site_data["type"],
                            district_id=district.id,
                            telephone=site_data.get("telephone"),
                            actif=True
                        )
                        session.add(site)
                        sites_created += 1
                        print(f"  ✓ Site créé: {site_data['nom']} - {site_data['village']}")

            await session.commit()

            print("\n" + "=" * 80)
            print("RÉSUMÉ")
            print("=" * 80)
            print(f"Régions: {len(regions_map)}")
            print(f"Districts: {len(districts_map)}")
            print(f"Sites créés: {sites_created}")
            print("=" * 80)

        except Exception as e:
            print(f"\n❌ Erreur: {e}")
            await session.rollback()
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    print("Initialisation des données de base...")
    asyncio.run(seed_data())
