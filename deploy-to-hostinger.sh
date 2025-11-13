#!/bin/bash
# ===========================================================================
# Script de déploiement automatisé - Santé Rurale sur Hostinger VPS
# ===========================================================================

set -e  # Arrêter en cas d'erreur

# Couleurs pour l'affichage
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration VPS
VPS_HOST="${VPS_HOST:-72.61.107.217}"
VPS_USER="${VPS_USER:-root}"
VPS_PORT="${VPS_PORT:-22}"
DOMAIN="${DOMAIN:-sante-rurale.io}"
EMAIL="${EMAIL:-djibril.dabo@sante-rurale.io}"

# Répertoire de déploiement sur le VPS
DEPLOY_DIR="/opt/sante-rurale"

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}  Déploiement Santé Rurale sur Hostinger${NC}"
echo -e "${BLUE}=======================================${NC}"
echo ""

# ===========================================================================
# Étape 1: Vérifications préliminaires
# ===========================================================================
echo -e "${YELLOW}[1/8] Vérifications préliminaires...${NC}"

# Vérifier que .env.production existe
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ Fichier .env.production introuvable!${NC}"
    echo "Créez-le d'abord avec: cp .env.production.example .env.production"
    exit 1
fi

# Vérifier que les mots de passe ont été changés
if grep -q "CHANGEZ_MOI" .env.production; then
    echo -e "${RED}❌ ATTENTION: Des mots de passe par défaut sont encore présents dans .env.production${NC}"
    echo "Modifiez tous les mots de passe avant de déployer!"
    read -p "Voulez-vous continuer quand même? (pas recommandé) [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}✓ Vérifications OK${NC}"

# ===========================================================================
# Étape 2: Build des images Docker localement
# ===========================================================================
echo -e "\n${YELLOW}[2/8] Build des images Docker...${NC}"

# Build frontend
echo "Building frontend..."
cd pwa && npm run build && cd ..

# Build API Docker image
echo "Building API..."
docker build -t sante-rurale-api:latest -f api/Dockerfile --target production api/

# Build Frontend Docker image
echo "Building PWA..."
docker build -t sante-rurale-pwa:latest -f pwa/Dockerfile --target production pwa/

echo -e "${GREEN}✓ Build terminé${NC}"

# ===========================================================================
# Étape 3: Sauvegarder les images Docker
# ===========================================================================
echo -e "\n${YELLOW}[3/8] Export des images Docker...${NC}"

mkdir -p ./docker-images
docker save sante-rurale-api:latest | gzip > ./docker-images/api.tar.gz
docker save sante-rurale-pwa:latest | gzip > ./docker-images/pwa.tar.gz

echo -e "${GREEN}✓ Images exportées${NC}"

# ===========================================================================
# Étape 4: Connexion au VPS et installation Docker
# ===========================================================================
echo -e "\n${YELLOW}[4/8] Configuration du VPS...${NC}"

ssh -p $VPS_PORT $VPS_USER@$VPS_HOST << 'ENDSSH'
# Installation de Docker si pas déjà installé
if ! command -v docker &> /dev/null; then
    echo "Installation de Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl start docker
    systemctl enable docker
fi

# Installation de Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "Installation de Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Créer le répertoire de déploiement
mkdir -p /opt/sante-rurale
mkdir -p /opt/sante-rurale/logs
mkdir -p /opt/sante-rurale/backups
mkdir -p /opt/sante-rurale/deployment/ssl

echo "✓ VPS configuré"
ENDSSH

echo -e "${GREEN}✓ VPS prêt${NC}"

# ===========================================================================
# Étape 5: Transfert des fichiers vers le VPS
# ===========================================================================
echo -e "\n${YELLOW}[5/8] Transfert des fichiers vers le VPS...${NC}"

# Créer une archive avec tous les fichiers nécessaires
tar -czf deployment-package.tar.gz \
    docker-compose.prod.yml \
    .env.production \
    deployment/nginx.conf \
    docker-images/

# Transférer vers le VPS
scp -P $VPS_PORT deployment-package.tar.gz $VPS_USER@$VPS_HOST:$DEPLOY_DIR/

# Décompresser sur le VPS
ssh -p $VPS_PORT $VPS_USER@$VPS_HOST << ENDSSH
cd $DEPLOY_DIR
tar -xzf deployment-package.tar.gz
rm deployment-package.tar.gz

# Charger les images Docker
docker load < docker-images/api.tar.gz
docker load < docker-images/pwa.tar.gz

# Nettoyer
rm -rf docker-images/
ENDSSH

# Nettoyer localement
rm -rf ./docker-images deployment-package.tar.gz

echo -e "${GREEN}✓ Fichiers transférés${NC}"

# ===========================================================================
# Étape 6: Configurer SSL avec Let's Encrypt
# ===========================================================================
echo -e "\n${YELLOW}[6/8] Configuration SSL (Let's Encrypt)...${NC}"

ssh -p $VPS_PORT $VPS_USER@$VPS_HOST << ENDSSH
cd $DEPLOY_DIR

# Installer certbot si pas déjà installé
if ! command -v certbot &> /dev/null; then
    apt-get update
    apt-get install -y certbot
fi

# Obtenir les certificats SSL
certbot certonly --standalone --non-interactive --agree-tos \
    -d $DOMAIN \
    -d www.$DOMAIN \
    -d app.$DOMAIN \
    -d api.$DOMAIN \
    --email $EMAIL

# Copier les certificats pour Nginx
mkdir -p deployment/ssl/live/$DOMAIN
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem deployment/ssl/live/$DOMAIN/
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem deployment/ssl/live/$DOMAIN/

# Configurer le renouvellement automatique
echo "0 0 * * * certbot renew --quiet && docker exec sante_nginx_prod nginx -s reload" | crontab -
ENDSSH

echo -e "${GREEN}✓ SSL configuré${NC}"

# ===========================================================================
# Étape 7: Démarrer l'application
# ===========================================================================
echo -e "\n${YELLOW}[7/8] Démarrage de l'application...${NC}"

ssh -p $VPS_PORT $VPS_USER@$VPS_HOST << ENDSSH
cd $DEPLOY_DIR

# Arrêter les conteneurs existants si présents
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# Démarrer en mode production
docker-compose -f docker-compose.prod.yml up -d

# Attendre que les services démarrent
echo "Attente du démarrage des services..."
sleep 30

# Exécuter les migrations de base de données
docker exec sante_api_prod alembic upgrade head

# Vérifier le statut
docker-compose -f docker-compose.prod.yml ps
ENDSSH

echo -e "${GREEN}✓ Application démarrée${NC}"

# ===========================================================================
# Étape 8: Tests de santé
# ===========================================================================
echo -e "\n${YELLOW}[8/8] Vérification de l'application...${NC}"

sleep 10

# Test API
echo "Test API..."
if curl -f https://api.$DOMAIN/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API fonctionnelle${NC}"
else
    echo -e "${RED}❌ API non accessible${NC}"
fi

# Test Frontend
echo "Test Frontend..."
if curl -f https://$DOMAIN > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend fonctionnel${NC}"
else
    echo -e "${RED}❌ Frontend non accessible${NC}"
fi

# ===========================================================================
# Résumé
# ===========================================================================
echo ""
echo -e "${BLUE}=======================================${NC}"
echo -e "${GREEN}✅ Déploiement terminé avec succès!${NC}"
echo -e "${BLUE}=======================================${NC}"
echo ""
echo -e "🌐 URL Frontend:  ${GREEN}https://$DOMAIN${NC}"
echo -e "🔌 URL API:       ${GREEN}https://api.$DOMAIN${NC}"
echo -e "📚 Documentation: ${GREEN}https://api.$DOMAIN/docs${NC}"
echo ""
echo -e "Commandes utiles:"
echo -e "  - Voir les logs:    ssh $VPS_USER@$VPS_HOST 'cd $DEPLOY_DIR && docker-compose -f docker-compose.prod.yml logs -f'"
echo -e "  - Redémarrer:       ssh $VPS_USER@$VPS_HOST 'cd $DEPLOY_DIR && docker-compose -f docker-compose.prod.yml restart'"
echo -e "  - Arrêter:          ssh $VPS_USER@$VPS_HOST 'cd $DEPLOY_DIR && docker-compose -f docker-compose.prod.yml down'"
echo ""
echo -e "${YELLOW}⚠️  N'oubliez pas de:${NC}"
echo "  1. Configurer vos DNS pour pointer vers $VPS_HOST"
echo "  2. Créer le premier compte admin via l'API"
echo "  3. Configurer les sauvegardes automatiques"
echo ""
