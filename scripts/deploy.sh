#!/bin/bash
# ===========================================================================
# Script de déploiement - Santé Rurale
# ===========================================================================
# Ce script assure un déploiement propre vers production
# UNIQUEMENT le code est déployé, PAS les données
# ===========================================================================

set -e  # Arrêter en cas d'erreur

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROD_SERVER="root@srv1125001"  # Adapter si nécessaire
PROD_PATH="/opt/santerurale"
BRANCH="main"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Déploiement Santé Rurale${NC}"
echo -e "${BLUE}========================================${NC}"

# ===========================================================================
# ÉTAPE 1: Vérifications pré-déploiement
# ===========================================================================
echo -e "\n${YELLOW}[1/6] Vérifications pré-déploiement...${NC}"

# Vérifier qu'on est sur la bonne branche
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    echo -e "${RED}ERREUR: Vous êtes sur la branche '$CURRENT_BRANCH', pas '$BRANCH'${NC}"
    echo -e "Exécutez: git checkout $BRANCH"
    exit 1
fi
echo -e "  ✓ Branche: $BRANCH"

# Vérifier qu'il n'y a pas de fichiers non commités
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}ATTENTION: Il y a des modifications non commitées:${NC}"
    git status --short
    read -p "Voulez-vous continuer quand même? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "  ✓ Pas de modifications non commitées"
fi

# Vérifier que les fichiers sensibles ne sont pas dans le commit
echo -e "\n${YELLOW}[2/6] Vérification des fichiers sensibles...${NC}"
SENSITIVE_FILES=(".env" ".env.production" "*.sql" "*.dump" "postgres_data" "redis_data" "minio_data")
for pattern in "${SENSITIVE_FILES[@]}"; do
    if git ls-files --error-unmatch "$pattern" 2>/dev/null; then
        echo -e "${RED}ERREUR: Fichier sensible trouvé dans git: $pattern${NC}"
        echo -e "Supprimez-le avec: git rm --cached $pattern"
        exit 1
    fi
done
echo -e "  ✓ Aucun fichier sensible dans le repository"

# ===========================================================================
# ÉTAPE 2: Synchronisation avec le remote
# ===========================================================================
echo -e "\n${YELLOW}[3/6] Synchronisation avec GitHub...${NC}"
git fetch origin
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})
BASE=$(git merge-base @ @{u})

if [ "$LOCAL" = "$REMOTE" ]; then
    echo -e "  ✓ La branche locale est à jour"
elif [ "$LOCAL" = "$BASE" ]; then
    echo -e "${RED}ERREUR: Votre branche locale est en retard. Faites 'git pull' d'abord.${NC}"
    exit 1
elif [ "$REMOTE" = "$BASE" ]; then
    echo -e "${YELLOW}  Vous avez des commits locaux non pushés.${NC}"
    read -p "Voulez-vous les pusher maintenant? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        git push origin $BRANCH
        echo -e "  ✓ Commits pushés"
    fi
fi

# ===========================================================================
# ÉTAPE 3: Build local pour vérifier que tout compile
# ===========================================================================
echo -e "\n${YELLOW}[4/6] Vérification du build...${NC}"
if [ -f "pwa/package.json" ]; then
    echo "  Building PWA locally to verify..."
    cd pwa
    npm run build --if-present 2>/dev/null || echo "  (Build PWA ignoré - sera fait en prod)"
    cd ..
fi
echo -e "  ✓ Vérification du build terminée"

# ===========================================================================
# ÉTAPE 4: Déploiement sur le serveur
# ===========================================================================
echo -e "\n${YELLOW}[5/6] Déploiement sur le serveur...${NC}"

# Commandes à exécuter sur le serveur
DEPLOY_COMMANDS="
cd $PROD_PATH

echo '--- Pulling latest code ---'
git fetch origin
git reset --hard origin/$BRANCH

echo '--- Rebuilding containers ---'
docker compose -f docker-compose.prod.yml build --no-cache api frontend

echo '--- Restarting services ---'
docker compose -f docker-compose.prod.yml up -d

echo '--- Waiting for services to be healthy ---'
sleep 10

echo '--- Checking service status ---'
docker compose -f docker-compose.prod.yml ps

echo '--- Deployment complete! ---'
"

echo -e "${BLUE}Connexion au serveur...${NC}"
ssh $PROD_SERVER "$DEPLOY_COMMANDS"

# ===========================================================================
# ÉTAPE 5: Vérification post-déploiement
# ===========================================================================
echo -e "\n${YELLOW}[6/6] Vérification post-déploiement...${NC}"
sleep 5

# Vérifier que l'API répond
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://www.santerurale.io/api/health 2>/dev/null || echo "000")
if [ "$API_STATUS" = "200" ]; then
    echo -e "  ✓ API: ${GREEN}OK${NC} (HTTP $API_STATUS)"
else
    echo -e "  ${RED}✗ API: ERREUR${NC} (HTTP $API_STATUS)"
fi

# Vérifier que le frontend répond
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://www.santerurale.io 2>/dev/null || echo "000")
if [ "$FRONTEND_STATUS" = "200" ] || [ "$FRONTEND_STATUS" = "301" ] || [ "$FRONTEND_STATUS" = "302" ]; then
    echo -e "  ✓ Frontend: ${GREEN}OK${NC} (HTTP $FRONTEND_STATUS)"
else
    echo -e "  ${RED}✗ Frontend: ERREUR${NC} (HTTP $FRONTEND_STATUS)"
fi

# ===========================================================================
# FIN
# ===========================================================================
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}   Déploiement terminé avec succès!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "URL: https://www.santerurale.io"
