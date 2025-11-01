#!/bin/bash

# Script de configuration PostgreSQL pour Santé Rurale Mali
# Usage: ./setup_postgresql.sh

set -e

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "======================================================================"
echo -e "${BLUE}🗄️  Configuration PostgreSQL - Santé Rurale Mali${NC}"
echo "======================================================================"
echo ""

# Vérifier que PostgreSQL est installé
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL n'est pas installé. Installation en cours...${NC}"
    brew install postgresql@16
fi

# Démarrer PostgreSQL
echo -e "${BLUE}🔍 Démarrage de PostgreSQL...${NC}"
brew services start postgresql@16
sleep 2
echo -e "${GREEN}✓ PostgreSQL démarré${NC}"

# Créer l'utilisateur sante s'il n'existe pas
echo -e "${BLUE}👤 Création de l'utilisateur PostgreSQL...${NC}"
if psql -h localhost -U "$USER" -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='sante'" | grep -q 1; then
    echo -e "${GREEN}✓ L'utilisateur 'sante' existe déjà${NC}"
else
    psql -h localhost -U "$USER" -d postgres -c "CREATE USER sante WITH PASSWORD 'sante_pwd';"
    echo -e "${GREEN}✓ Utilisateur 'sante' créé${NC}"
fi

# Créer la base de données s'il n'existe pas
echo -e "${BLUE}💾 Création de la base de données...${NC}"
if psql -h localhost -U "$USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='sante_rurale'" | grep -q 1; then
    echo -e "${GREEN}✓ La base de données 'sante_rurale' existe déjà${NC}"
else
    psql -h localhost -U "$USER" -d postgres -c "CREATE DATABASE sante_rurale OWNER sante;"
    echo -e "${GREEN}✓ Base de données 'sante_rurale' créée${NC}"
fi

# Accorder les privilèges
echo -e "${BLUE}🔐 Configuration des privilèges...${NC}"
psql -h localhost -U "$USER" -d sante_rurale -c "GRANT ALL ON SCHEMA public TO sante;" > /dev/null 2>&1
psql -h localhost -U "$USER" -d sante_rurale -c "GRANT ALL PRIVILEGES ON DATABASE sante_rurale TO sante;" > /dev/null 2>&1
psql -h localhost -U "$USER" -d sante_rurale -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO sante;" > /dev/null 2>&1
psql -h localhost -U "$USER" -d sante_rurale -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO sante;" > /dev/null 2>&1
echo -e "${GREEN}✓ Privilèges configurés${NC}"

# Tester la connexion
echo -e "${BLUE}🧪 Test de connexion...${NC}"
if psql -h localhost -U sante -d sante_rurale -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Connexion réussie${NC}"
else
    echo -e "${RED}❌ Erreur de connexion${NC}"
    exit 1
fi

# Résumé
echo ""
echo "======================================================================"
echo -e "${GREEN}✅ Configuration PostgreSQL terminée !${NC}"
echo "======================================================================"
echo ""
echo "📊 Informations de connexion :"
echo "  Database: sante_rurale"
echo "  User: sante"
echo "  Password: sante_pwd"
echo "  Host: localhost"
echo "  Port: 5432"
echo ""
echo "🔗 URL de connexion :"
echo "  postgresql://sante:sante_pwd@localhost:5432/sante_rurale"
echo ""
echo "📝 Commande pour se connecter :"
echo "  psql -h localhost -U sante -d sante_rurale"
echo ""
echo "======================================================================"
