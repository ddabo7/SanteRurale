#!/bin/bash
#########################################
# Script de déploiement automatique
# Santé Rurale - Production
# Ubuntu 24.04 LTS
#########################################

set -e  # Arrêter en cas d'erreur

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables de configuration
DOMAIN="santerurale.io"
EMAIL="no-reply@santerurale.io"
APP_DIR="/opt/sante-rurale"
REPO_URL="https://github.com/votre-username/sante-rurale.git"  # À MODIFIER

# Fonction pour afficher les messages
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérifier que le script est exécuté en tant que root
if [[ $EUID -ne 0 ]]; then
   log_error "Ce script doit être exécuté en tant que root (sudo)"
   exit 1
fi

clear
echo "========================================="
echo "  Déploiement Santé Rurale - Production"
echo "========================================="
echo ""
log_info "Domaine: $DOMAIN"
log_info "Email: $EMAIL"
echo ""
read -p "Appuyez sur Entrée pour continuer..."

#########################################
# ÉTAPE 1 : Mise à jour du système
#########################################
log_info "Étape 1/10 : Mise à jour du système..."
apt update && apt upgrade -y
apt install -y curl wget git vim ufw fail2ban
log_success "Système mis à jour"

#########################################
# ÉTAPE 2 : Installation Docker
#########################################
log_info "Étape 2/10 : Installation de Docker..."

# Désinstaller anciennes versions
apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Installation des dépendances
apt install -y ca-certificates curl gnupg lsb-release

# Ajout de la clé GPG Docker
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Ajout du dépôt Docker
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Installation Docker
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Démarrage Docker
systemctl enable docker
systemctl start docker

log_success "Docker installé : $(docker --version)"

#########################################
# ÉTAPE 3 : Configuration du Firewall
#########################################
log_info "Étape 3/10 : Configuration du firewall UFW..."

# Réinitialiser UFW
ufw --force reset

# Règles par défaut
ufw default deny incoming
ufw default allow outgoing

# Autoriser SSH (IMPORTANT!)
ufw allow 22/tcp

# Autoriser HTTP et HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Activer UFW
ufw --force enable

log_success "Firewall configuré"

#########################################
# ÉTAPE 4 : Configuration Fail2Ban
#########################################
log_info "Étape 4/10 : Configuration Fail2Ban..."

cat > /etc/fail2ban/jail.local <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
logpath = /var/log/auth.log
EOF

systemctl enable fail2ban
systemctl restart fail2ban

log_success "Fail2Ban configuré"

#########################################
# ÉTAPE 5 : Création des répertoires
#########################################
log_info "Étape 5/10 : Création des répertoires..."

mkdir -p $APP_DIR
mkdir -p $APP_DIR/data/postgres
mkdir -p $APP_DIR/data/redis
mkdir -p $APP_DIR/data/minio
mkdir -p $APP_DIR/data/uploads
mkdir -p $APP_DIR/logs
mkdir -p $APP_DIR/backups
mkdir -p $APP_DIR/nginx/conf.d
mkdir -p $APP_DIR/certbot/conf
mkdir -p $APP_DIR/certbot/www

log_success "Répertoires créés"

#########################################
# ÉTAPE 6 : Génération des mots de passe
#########################################
log_info "Étape 6/10 : Génération des mots de passe sécurisés..."

DB_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
MINIO_ROOT_USER="admin"
MINIO_ROOT_PASSWORD=$(openssl rand -base64 32)
SECRET_KEY=$(openssl rand -base64 64)

log_success "Mots de passe générés"

#########################################
# ÉTAPE 7 : Création du fichier .env
#########################################
log_info "Étape 7/10 : Création du fichier .env de production..."

cat > $APP_DIR/.env <<EOF
# Configuration Santé Rurale - Production
# Généré automatiquement le $(date)

# Environnement
ENVIRONMENT=production
DEBUG=false

# Base de données PostgreSQL
DATABASE_URL=postgresql+asyncpg://sante:${DB_PASSWORD}@postgres:5432/sante_rurale
DB_USER=sante
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=sante_rurale

# Redis
REDIS_PASSWORD=${REDIS_PASSWORD}
CELERY_BROKER_URL=redis://:${REDIS_PASSWORD}@redis:6379/1
CELERY_RESULT_BACKEND=redis://:${REDIS_PASSWORD}@redis:6379/2

# MinIO (Stockage)
MINIO_ROOT_USER=${MINIO_ROOT_USER}
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
MINIO_ENDPOINT=minio:9000
MINIO_BUCKET=sante-rurale

# JWT
SECRET_KEY=${SECRET_KEY}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Application
APP_NAME=Santé Rurale API
API_V1_STR=/api
FRONTEND_URL=https://${DOMAIN}

# CORS
CORS_ORIGINS=["https://${DOMAIN}","https://www.${DOMAIN}","https://api.${DOMAIN}"]

# Email (Hostinger SMTP)
EMAIL_HOST=smtp.hostinger.com
EMAIL_PORT=465
EMAIL_HOST_USER=${EMAIL}
EMAIL_HOST_PASSWORD=VOTRE_MOT_DE_PASSE_EMAIL_ICI
EMAIL_FROM=${EMAIL}
EMAIL_FROM_NAME=Santé Rurale

# Stripe (optionnel - Phase 2)
STRIPE_ENABLED=false
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
EOF

chmod 600 $APP_DIR/.env

log_warning "IMPORTANT: Éditez $APP_DIR/.env et remplacez 'VOTRE_MOT_DE_PASSE_EMAIL_ICI'"
log_success "Fichier .env créé"

#########################################
# ÉTAPE 8 : Création docker-compose.yml
#########################################
log_info "Étape 8/10 : Création du fichier docker-compose.yml..."

cat > $APP_DIR/docker-compose.yml <<'COMPOSE_EOF'
version: '3.8'

services:
  # Base de données PostgreSQL
  postgres:
    image: postgres:16-alpine
    container_name: sante_db
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_INITDB_ARGS: "-E UTF8 --locale=fr_FR.UTF-8"
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - sante-network

  # Redis
  redis:
    image: redis:7-alpine
    container_name: sante_redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - ./data/redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - sante-network

  # MinIO (Stockage S3-compatible)
  minio:
    image: minio/minio:latest
    container_name: sante_minio
    restart: always
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    command: server /data --console-address ":9001"
    volumes:
      - ./data/minio:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
    networks:
      - sante-network

  # API Backend (FastAPI)
  backend:
    build:
      context: ./api
      dockerfile: Dockerfile.prod
    container_name: sante_api
    restart: always
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    volumes:
      - ./data/uploads:/app/uploads
      - ./logs:/app/logs
    networks:
      - sante-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Celery Worker
  celery_worker:
    build:
      context: ./api
      dockerfile: Dockerfile.prod
    container_name: sante_celery
    restart: always
    command: celery -A app.celery_app worker --loglevel=info
    env_file:
      - .env
    depends_on:
      - redis
      - postgres
    volumes:
      - ./data/uploads:/app/uploads
      - ./logs:/app/logs
    networks:
      - sante-network

  # Frontend (React)
  frontend:
    build:
      context: ./pwa
      dockerfile: Dockerfile.prod
      args:
        VITE_API_URL: https://api.${DOMAIN}/api
    container_name: sante_pwa
    restart: always
    networks:
      - sante-network

  # Nginx (Reverse Proxy)
  nginx:
    image: nginx:alpine
    container_name: sante_nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    depends_on:
      - backend
      - frontend
    networks:
      - sante-network
    command: "/bin/sh -c 'while :; do sleep 6h & wait $${!}; nginx -s reload; done & nginx -g \"daemon off;\"'"

  # Certbot (SSL)
  certbot:
    image: certbot/certbot
    container_name: sante_certbot
    restart: unless-stopped
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

networks:
  sante-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  minio_data:
COMPOSE_EOF

log_success "docker-compose.yml créé"

#########################################
# ÉTAPE 9 : Configuration Nginx
#########################################
log_info "Étape 9/10 : Configuration Nginx..."

# Configuration initiale (HTTP uniquement)
cat > $APP_DIR/nginx/conf.d/default.conf <<EOF
# Redirection HTTP vers HTTPS (sera activé après SSL)
# server {
#     listen 80;
#     server_name ${DOMAIN} www.${DOMAIN} api.${DOMAIN};
#     location / {
#         return 301 https://\$host\$request_uri;
#     }
# }

# Configuration temporaire HTTP (avant SSL)
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    # Certbot challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://frontend:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

server {
    listen 80;
    server_name api.${DOMAIN};

    # Certbot challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # CORS
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;

        if (\$request_method = 'OPTIONS') {
            return 204;
        }
    }
}
EOF

log_success "Nginx configuré"

#########################################
# ÉTAPE 10 : Affichage des instructions
#########################################
log_info "Étape 10/10 : Instructions finales..."

clear
echo ""
echo "========================================="
echo "  ✅ Installation terminée avec succès!"
echo "========================================="
echo ""
log_success "Prochaines étapes :"
echo ""
echo "1️⃣  Cloner votre code dans $APP_DIR :"
echo "    cd $APP_DIR"
echo "    git clone $REPO_URL ."
echo ""
echo "2️⃣  Éditer le fichier .env :"
echo "    nano $APP_DIR/.env"
echo "    → Modifiez EMAIL_HOST_PASSWORD avec votre vrai mot de passe email"
echo ""
echo "3️⃣  Créer les Dockerfiles de production (api/Dockerfile.prod et pwa/Dockerfile.prod)"
echo ""
echo "4️⃣  Lancer l'application :"
echo "    cd $APP_DIR"
echo "    docker compose up -d"
echo ""
echo "5️⃣  Obtenir le certificat SSL :"
echo "    docker compose run --rm certbot certonly --webroot"
echo "      --webroot-path=/var/www/certbot"
echo "      -d ${DOMAIN} -d www.${DOMAIN} -d api.${DOMAIN}"
echo "      --email ${EMAIL} --agree-tos --no-eff-email"
echo ""
echo "6️⃣  Activer HTTPS dans nginx (décommenter les lignes dans nginx/conf.d/default.conf)"
echo ""
echo "========================================="
echo "  📊 Informations importantes"
echo "========================================="
echo ""
echo "📁 Répertoire application : $APP_DIR"
echo "🔐 Mots de passe sauvegardés dans : $APP_DIR/.env"
echo "📝 Logs : $APP_DIR/logs/"
echo "💾 Sauvegardes : $APP_DIR/backups/"
echo ""
log_warning "⚠️  Sauvegardez le fichier .env dans un endroit sûr!"
echo ""

# Sauvegarder les informations sensibles
cat > $APP_DIR/CREDENTIALS.txt <<EOF
===========================================
Santé Rurale - Identifiants de production
Généré le $(date)
===========================================

Base de données PostgreSQL:
  User: sante
  Password: ${DB_PASSWORD}
  Database: sante_rurale

Redis:
  Password: ${REDIS_PASSWORD}

MinIO:
  User: ${MINIO_ROOT_USER}
  Password: ${MINIO_ROOT_PASSWORD}

JWT Secret: ${SECRET_KEY}

⚠️  GARDEZ CE FICHIER EN SÉCURITÉ!
===========================================
EOF

chmod 600 $APP_DIR/CREDENTIALS.txt

log_success "Script terminé! Credentials sauvegardés dans $APP_DIR/CREDENTIALS.txt"
