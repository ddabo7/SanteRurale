#!/bin/bash

# Script de configuration de la base de données PostgreSQL
# pour Santé Rurale Mali

set -e

echo "======================================================================"
echo "🏥 Configuration de la base de données - Santé Rurale Mali"
echo "======================================================================"
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 1. Créer l'environnement virtuel Python
echo -e "${BLUE}📦 Étape 1/4 : Création de l'environnement virtuel Python...${NC}"
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✓ Environnement virtuel créé${NC}"
else
    echo -e "${YELLOW}⚠ Environnement virtuel existe déjà${NC}"
fi
echo ""

# 2. Activer l'environnement virtuel et installer les dépendances
echo -e "${BLUE}📚 Étape 2/4 : Installation des dépendances Python...${NC}"
source venv/bin/activate
pip install --upgrade pip > /dev/null 2>&1
pip install -r requirements.txt
echo -e "${GREEN}✓ Dépendances installées${NC}"
echo ""

# 3. Créer les tables avec Alembic
echo -e "${BLUE}🗄️  Étape 3/4 : Création des tables dans PostgreSQL...${NC}"
alembic upgrade head
echo -e "${GREEN}✓ Tables créées${NC}"
echo ""

# 4. Insérer les données initiales
echo -e "${BLUE}🌱 Étape 4/4 : Insertion des données initiales...${NC}"
python3 << 'PYTHON_SCRIPT'
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models import Region, District, Site, User
from app.security import hash_password
from app.config import settings
import uuid

async def seed_initial_data():
    """Insère les données initiales dans la base de données"""
    engine = create_async_engine(str(settings.DATABASE_URL), echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Vérifier si des régions existent déjà
        result = await session.execute(select(Region))
        existing_regions = result.scalars().all()

        if not existing_regions:
            # Créer région Koulikoro
            region = Region(
                id=uuid.uuid4(),
                nom="Koulikoro",
                code="KOU"
            )
            session.add(region)
            await session.flush()

            # Créer district Koulikoro
            district = District(
                id=uuid.uuid4(),
                nom="Koulikoro",
                region_id=region.id,
                code="KOU-01"
            )
            session.add(district)
            await session.flush()

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

            # Créer les utilisateurs par défaut
            users_data = [
                {
                    "nom": "DIARRA",
                    "email": "admin@cscom-koulikoro.ml",
                    "password": "Admin2024!",
                    "role": "admin"
                },
                {
                    "nom": "TRAORÉ Amadou",
                    "email": "dr.traore@cscom-koulikoro.ml",
                    "password": "Medecin2024!",
                    "role": "medecin"
                },
                {
                    "nom": "KONÉ Fatimata",
                    "email": "major.kone@cscom-koulikoro.ml",
                    "password": "Major2024!",
                    "role": "major"
                },
                {
                    "nom": "COULIBALY Ibrahim",
                    "email": "soignant.coulibaly@cscom-koulikoro.ml",
                    "password": "Soignant2024!",
                    "role": "soignant"
                }
            ]

            for user_data in users_data:
                user = User(
                    id=uuid.uuid4(),
                    nom=user_data["nom"],
                    email=user_data["email"],
                    password_hash=hash_password(user_data["password"]),
                    role=user_data["role"],
                    site_id=site.id,
                    actif=True
                )
                session.add(user)

            await session.commit()
            print("✓ Données initiales insérées : 1 région, 1 district, 1 site, 4 utilisateurs")
        else:
            print("⚠ Des données existent déjà, insertion ignorée")

    await engine.dispose()

asyncio.run(seed_initial_data())
PYTHON_SCRIPT

echo -e "${GREEN}✓ Données initiales insérées${NC}"
echo ""

# Résumé
echo "======================================================================"
echo -e "${GREEN}✅ Configuration terminée avec succès !${NC}"
echo "======================================================================"
echo ""
echo "📊 Prochaines étapes :"
echo "  1. Démarrer le backend : uvicorn app.main:app --reload"
echo "  2. Démarrer le frontend : cd ../pwa && npm run dev"
echo "  3. Accéder à l'application : http://localhost:5173"
echo ""
echo "🔐 Comptes de test créés :"
echo "  • admin@cscom-koulikoro.ml / Admin2024!"
echo "  • dr.traore@cscom-koulikoro.ml / Medecin2024!"
echo "  • major.kone@cscom-koulikoro.ml / Major2024!"
echo "  • soignant.coulibaly@cscom-koulikoro.ml / Soignant2024!"
echo ""
echo "======================================================================"
