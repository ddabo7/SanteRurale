#!/bin/bash

###############################################################################
# Script de Déploiement Automatisé - Santé Rurale
# Pour VPS Hostinger Ubuntu 22.04
###############################################################################

set -e  # Arrêter en cas d'erreur

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction d'affichage
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Variables de configuration
APP_NAME="sante-rurale"
APP_DIR="/var/www/${APP_NAME}"
DEPLOY_USER="www-data"
DB_NAME="sante_rurale"
DB_USER="sante_rurale"
DOMAIN="" # À définir

# Vérifier les arguments
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "Usage: sudo ./deploy.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --full          Déploiement complet (première installation)"
    echo "  --update        Mise à jour de l'application existante"
    echo "  --backend       Déployer uniquement le backend"
    echo "  --frontend      Déployer uniquement le frontend"
    echo "  --domain DOMAIN Définir le nom de domaine"
    echo "  --help          Afficher cette aide"
    exit 0
fi

# Parser les arguments
FULL_DEPLOY=false
UPDATE_DEPLOY=false
BACKEND_ONLY=false
FRONTEND_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --full)
            FULL_DEPLOY=true
            shift
            ;;
        --update)
            UPDATE_DEPLOY=true
            shift
            ;;
        --backend)
            BACKEND_ONLY=true
            shift
            ;;
        --frontend)
            FRONTEND_ONLY=true
            shift
            ;;
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        *)
            print_error "Option inconnue: $1"
            exit 1
            ;;
    esac
done

# Vérifier que le script est exécuté en root
if [ "$EUID" -ne 0 ]; then
    print_error "Ce script doit être exécuté avec sudo"
    exit 1
fi

###############################################################################
# 1. PRÉPARATION DU SYSTÈME
###############################################################################

if [ "$FULL_DEPLOY" = true ]; then
    print_header "1. Préparation du Système"

    print_info "Mise à jour des paquets système..."
    apt update && apt upgrade -y
    print_success "Système mis à jour"

    print_info "Installation des dépendances de base..."
    apt install -y \
        software-properties-common \
        build-essential \
        git \
        curl \
        wget \
        ufw \
        fail2ban \
        certbot \
        python3-certbot-nginx \
        postgresql-14 \
        postgresql-contrib \
        nginx \
        supervisor
    print_success "Dépendances installées"

    # Python 3.12
    print_info "Installation de Python 3.12..."
    add-apt-repository -y ppa:deadsnakes/ppa
    apt update
    apt install -y python3.12 python3.12-venv python3.12-dev python3-pip
    print_success "Python 3.12 installé"

    # Node.js 20
    print_info "Installation de Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    print_success "Node.js $(node --version) installé"

    # Configuration du firewall
    print_info "Configuration du firewall UFW..."
    ufw allow OpenSSH
    ufw allow 'Nginx Full'
    ufw --force enable
    print_success "Firewall configuré"
fi

###############################################################################
# 2. CONFIGURATION BASE DE DONNÉES
###############################################################################

if [ "$FULL_DEPLOY" = true ]; then
    print_header "2. Configuration PostgreSQL"

    # Générer un mot de passe aléatoire
    DB_PASSWORD=$(openssl rand -base64 32)

    print_info "Création de la base de données et de l'utilisateur..."

    sudo -u postgres psql <<EOF
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
EOF

    print_success "Base de données créée"
    print_warning "Mot de passe DB: ${DB_PASSWORD}"
    print_warning "SAUVEGARDEZ CE MOT DE PASSE !"

    # Sauvegarder le mot de passe
    echo "${DB_PASSWORD}" > /root/.db_password_sante_rurale
    chmod 600 /root/.db_password_sante_rurale
fi

###############################################################################
# 3. DÉPLOIEMENT DU BACKEND
###############################################################################

if [ "$FULL_DEPLOY" = true ] || [ "$UPDATE_DEPLOY" = true ] || [ "$BACKEND_ONLY" = true ]; then
    print_header "3. Déploiement du Backend FastAPI"

    if [ "$FULL_DEPLOY" = true ]; then
        print_info "Création du répertoire d'application..."
        mkdir -p ${APP_DIR}/{api,pwa,uploads,logs,backups}
        chown -R ${DEPLOY_USER}:${DEPLOY_USER} ${APP_DIR}
    fi

    print_info "Copie des fichiers du backend..."
    # Note: Adapter selon votre méthode de déploiement (git, scp, etc.)
    # Exemple avec le répertoire local:
    if [ -d "./api" ]; then
        cp -r ./api/* ${APP_DIR}/api/
        chown -R ${DEPLOY_USER}:${DEPLOY_USER} ${APP_DIR}/api
        print_success "Fichiers backend copiés"
    else
        print_warning "Répertoire ./api non trouvé - copie manuelle nécessaire"
    fi

    print_info "Création de l'environnement virtuel Python..."
    cd ${APP_DIR}/api
    sudo -u ${DEPLOY_USER} python3.12 -m venv venv
    print_success "Environnement virtuel créé"

    print_info "Installation des dépendances Python..."
    sudo -u ${DEPLOY_USER} ${APP_DIR}/api/venv/bin/pip install --upgrade pip
    sudo -u ${DEPLOY_USER} ${APP_DIR}/api/venv/bin/pip install -r requirements.txt
    print_success "Dépendances installées"

    if [ "$FULL_DEPLOY" = true ]; then
        print_info "Configuration du fichier .env..."
        DB_PASSWORD=$(cat /root/.db_password_sante_rurale)
        SECRET_KEY=$(openssl rand -hex 32)

        cat > ${APP_DIR}/api/.env <<EOF
ENVIRONMENT=production
DATABASE_URL=postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}
SECRET_KEY=${SECRET_KEY}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
RATE_LIMIT_ENABLED=true
LOG_LEVEL=INFO
EOF
        chown ${DEPLOY_USER}:${DEPLOY_USER} ${APP_DIR}/api/.env
        chmod 600 ${APP_DIR}/api/.env
        print_success "Fichier .env créé"
    fi

    print_info "Exécution des migrations de base de données..."
    cd ${APP_DIR}/api
    sudo -u ${DEPLOY_USER} ${APP_DIR}/api/venv/bin/alembic upgrade head || print_warning "Migrations échouées - vérifiez manuellement"
    print_success "Migrations exécutées"

    print_info "Configuration du service systemd..."
    cat > /etc/systemd/system/${APP_NAME}-api.service <<EOF
[Unit]
Description=Santé Rurale API
After=network.target postgresql.service

[Service]
Type=notify
User=${DEPLOY_USER}
Group=${DEPLOY_USER}
WorkingDirectory=${APP_DIR}/api
Environment="PATH=${APP_DIR}/api/venv/bin"
ExecStart=${APP_DIR}/api/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
ExecReload=/bin/kill -HUP \$MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable ${APP_NAME}-api.service
    systemctl restart ${APP_NAME}-api.service
    print_success "Service backend démarré"

    # Vérifier le service
    sleep 3
    if systemctl is-active --quiet ${APP_NAME}-api.service; then
        print_success "Backend opérationnel ✓"
    else
        print_error "Erreur de démarrage du backend"
        journalctl -u ${APP_NAME}-api.service -n 50
    fi
fi

###############################################################################
# 4. DÉPLOIEMENT DU FRONTEND
###############################################################################

if [ "$FULL_DEPLOY" = true ] || [ "$UPDATE_DEPLOY" = true ] || [ "$FRONTEND_ONLY" = true ]; then
    print_header "4. Déploiement du Frontend React PWA"

    print_info "Copie des fichiers du frontend..."
    if [ -d "./pwa" ]; then
        cp -r ./pwa/* ${APP_DIR}/pwa/
        chown -R ${DEPLOY_USER}:${DEPLOY_USER} ${APP_DIR}/pwa
        print_success "Fichiers frontend copiés"
    else
        print_warning "Répertoire ./pwa non trouvé - copie manuelle nécessaire"
    fi

    print_info "Installation des dépendances Node.js..."
    cd ${APP_DIR}/pwa
    sudo -u ${DEPLOY_USER} npm install
    print_success "Dépendances installées"

    print_info "Build de production du frontend..."
    sudo -u ${DEPLOY_USER} npm run build
    print_success "Build terminé"
fi

###############################################################################
# 5. CONFIGURATION NGINX
###############################################################################

if [ "$FULL_DEPLOY" = true ] || [ "$UPDATE_DEPLOY" = true ]; then
    print_header "5. Configuration Nginx"

    if [ -z "$DOMAIN" ]; then
        read -p "Entrez votre nom de domaine (ex: sante-rurale.com): " DOMAIN
    fi

    print_info "Création de la configuration Nginx..."
    cat > /etc/nginx/sites-available/${APP_NAME} <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};

    root ${APP_DIR}/pwa/dist;
    index index.html;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # API Proxy
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        access_log off;
    }

    location /metrics {
        proxy_pass http://127.0.0.1:8000/metrics;
    }

    # Frontend SPA
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache des assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    access_log /var/log/nginx/${APP_NAME}-access.log;
    error_log /var/log/nginx/${APP_NAME}-error.log;
}
EOF

    ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default

    print_info "Test de la configuration Nginx..."
    nginx -t
    systemctl reload nginx
    print_success "Nginx configuré et rechargé"
fi

###############################################################################
# 6. CONFIGURATION SSL/HTTPS
###############################################################################

if [ "$FULL_DEPLOY" = true ]; then
    print_header "6. Configuration SSL avec Let's Encrypt"

    if [ -n "$DOMAIN" ]; then
        read -p "Configurer SSL maintenant ? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Obtention du certificat SSL..."
            certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN}
            print_success "SSL configuré avec succès"
        else
            print_warning "SSL non configuré - exécutez manuellement: certbot --nginx -d ${DOMAIN}"
        fi
    fi
fi

###############################################################################
# 7. CONFIGURATION DES LOGS ET BACKUPS
###############################################################################

if [ "$FULL_DEPLOY" = true ]; then
    print_header "7. Configuration des Logs et Backups"

    print_info "Configuration de la rotation des logs..."
    cat > /etc/logrotate.d/${APP_NAME} <<EOF
${APP_DIR}/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 ${DEPLOY_USER} ${DEPLOY_USER}
    sharedscripts
    postrotate
        systemctl reload ${APP_NAME}-api > /dev/null 2>&1 || true
    endscript
}
EOF
    print_success "Rotation des logs configurée"

    print_info "Configuration des backups automatiques..."
    cat > /usr/local/bin/backup-${APP_NAME}.sh <<'EOF'
#!/bin/bash
BACKUP_DIR=/var/backups/sante-rurale
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p ${BACKUP_DIR}

# Backup de la base de données
sudo -u postgres pg_dump sante_rurale | gzip > ${BACKUP_DIR}/db_${DATE}.sql.gz

# Backup des uploads
tar -czf ${BACKUP_DIR}/uploads_${DATE}.tar.gz /var/www/sante-rurale/uploads

# Nettoyage (garder 30 jours)
find ${BACKUP_DIR} -type f -mtime +30 -delete

echo "Backup terminé: ${DATE}"
EOF

    chmod +x /usr/local/bin/backup-${APP_NAME}.sh

    # Cron pour backup quotidien à 2h du matin
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-${APP_NAME}.sh >> /var/log/backup-${APP_NAME}.log 2>&1") | crontab -
    print_success "Backups automatiques configurés (2h du matin)"
fi

###############################################################################
# 8. VÉRIFICATIONS FINALES
###############################################################################

print_header "8. Vérifications Finales"

print_info "Vérification du service backend..."
if systemctl is-active --quiet ${APP_NAME}-api.service; then
    print_success "Backend: OPÉRATIONNEL"
else
    print_error "Backend: ERREUR"
fi

print_info "Vérification de Nginx..."
if systemctl is-active --quiet nginx; then
    print_success "Nginx: OPÉRATIONNEL"
else
    print_error "Nginx: ERREUR"
fi

print_info "Test de l'API..."
if curl -s http://localhost:8000/health > /dev/null; then
    print_success "API répond correctement"
else
    print_warning "API ne répond pas - vérifiez les logs"
fi

###############################################################################
# RÉSUMÉ
###############################################################################

print_header "Déploiement Terminé !"

echo -e "${GREEN}"
echo "═══════════════════════════════════════════════════════"
echo "  Santé Rurale - Déploiement Réussi"
echo "═══════════════════════════════════════════════════════"
echo -e "${NC}"

if [ "$FULL_DEPLOY" = true ]; then
    echo "Informations importantes:"
    echo ""
    echo "Base de données:"
    echo "  Nom: ${DB_NAME}"
    echo "  Utilisateur: ${DB_USER}"
    echo "  Mot de passe: voir /root/.db_password_sante_rurale"
    echo ""
fi

if [ -n "$DOMAIN" ]; then
    echo "URLs:"
    echo "  Frontend: https://${DOMAIN}"
    echo "  API: https://${DOMAIN}/api"
    echo "  Health: https://${DOMAIN}/health"
    echo ""
fi

echo "Services:"
echo "  Backend: systemctl status ${APP_NAME}-api"
echo "  Nginx: systemctl status nginx"
echo ""

echo "Logs:"
echo "  Backend: journalctl -u ${APP_NAME}-api -f"
echo "  Nginx Access: tail -f /var/log/nginx/${APP_NAME}-access.log"
echo "  Nginx Error: tail -f /var/log/nginx/${APP_NAME}-error.log"
echo ""

echo "Commandes utiles:"
echo "  Redémarrer backend: systemctl restart ${APP_NAME}-api"
echo "  Recharger Nginx: systemctl reload nginx"
echo "  Voir les logs: journalctl -u ${APP_NAME}-api -f"
echo "  Backup manuel: /usr/local/bin/backup-${APP_NAME}.sh"
echo ""

print_success "Déploiement terminé avec succès ! 🎉"
