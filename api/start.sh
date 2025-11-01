#!/bin/bash

# Script de démarrage rapide pour le backend Santé Rurale Mali
# Usage: ./start.sh

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "======================================================================"
echo -e "${BLUE}🏥 Démarrage du Backend Santé Rurale Mali${NC}"
echo "======================================================================"
echo ""

# Vérifier que l'environnement virtuel existe
if [ ! -d "venv" ]; then
    echo -e "${RED}❌ L'environnement virtuel n'existe pas${NC}"
    echo -e "${YELLOW}Veuillez exécuter ./install_python312.sh d'abord${NC}"
    exit 1
fi

# Vérifier que PostgreSQL est démarré
echo -e "${BLUE}🔍 Vérification de PostgreSQL...${NC}"
if ! brew services list | grep postgresql | grep started > /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL n'est pas démarré. Démarrage en cours...${NC}"
    brew services start postgresql@16
    sleep 2
fi
echo -e "${GREEN}✓ PostgreSQL est démarré${NC}"

# Activer l'environnement virtuel
echo -e "${BLUE}🐍 Activation de l'environnement virtuel...${NC}"
source venv/bin/activate

# Vérifier la connexion à la base de données
echo -e "${BLUE}🗄️  Vérification de la base de données...${NC}"
if ! psql -h localhost -U sante -d sante_rurale -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${RED}❌ Impossible de se connecter à la base de données${NC}"
    echo -e "${YELLOW}Vérifiez que PostgreSQL est correctement configuré${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Base de données accessible${NC}"

# Vérifier que les tables existent
echo -e "${BLUE}📊 Vérification des tables...${NC}"
TABLE_COUNT=$(psql -h localhost -U sante -d sante_rurale -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users', 'sites', 'regions', 'districts', 'patients');" 2>/dev/null)

if [ "$TABLE_COUNT" -lt 5 ]; then
    echo -e "${YELLOW}⚠️  Les tables sont manquantes. Exécution des migrations...${NC}"
    alembic upgrade head
    python3 seed_data.py
fi
echo -e "${GREEN}✓ Tables présentes${NC}"

# Démarrer le serveur
echo ""
echo "======================================================================"
echo -e "${GREEN}🚀 Démarrage du serveur sur http://localhost:8000${NC}"
echo "======================================================================"
echo ""
echo -e "${BLUE}📚 Documentation API : http://localhost:8000/docs${NC}"
echo -e "${BLUE}🔍 Health check : http://localhost:8000/health${NC}"
echo ""
echo -e "${YELLOW}Appuyez sur Ctrl+C pour arrêter le serveur${NC}"
echo ""

# Démarrer uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
