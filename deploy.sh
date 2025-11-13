#!/bin/bash
# ===========================================================================
# Script de déploiement automatique - Santé Rurale
# ===========================================================================
# Ce script facilite le déploiement sur VPS Hostinger
# Usage: ./deploy.sh [commande]
# ===========================================================================

set -e  # Arrêter en cas d'erreur

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"

# ===========================================================================
# Fonctions helper
# ===========================================================================

print_header() {
    echo -e "${BLUE}===================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===================================================================${NC}"
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

# ===========================================================================
# Vérifications préalables
# ===========================================================================

check_requirements() {
    print_header "Vérification des prérequis"

    # Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker n'est pas installé"
        echo "Installer avec: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
    print_success "Docker installé: $(docker --version)"

    # Docker Compose
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose n'est pas installé"
        exit 1
    fi
    print_success "Docker Compose installé: $(docker compose version)"

    # Fichier .env
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Fichier .env manquant"
        echo "Copier .env.production vers .env et configurer"
        exit 1
    fi
    print_success "Fichier .env trouvé"

    echo ""
}

# ===========================================================================
# Génération des secrets
# ===========================================================================

generate_secrets() {
    print_header "Génération des secrets"

    echo "SECRET_KEY=$(openssl rand -hex 32)"
    echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
    echo "REDIS_PASSWORD=$(openssl rand -base64 32)"
    echo "MINIO_ROOT_PASSWORD=$(openssl rand -base64 32)"

    print_warning "Copiez ces valeurs dans votre fichier .env"
    echo ""
}

# ===========================================================================
# Build et démarrage
# ===========================================================================

build() {
    print_header "Build des images Docker"
    docker compose -f $COMPOSE_FILE build --no-cache
    print_success "Build terminé"
}

start() {
    print_header "Démarrage des services"
    docker compose -f $COMPOSE_FILE up -d
    print_success "Services démarrés"

    echo ""
    print_warning "Vérifiez les logs avec: docker compose -f $COMPOSE_FILE logs -f"
}

stop() {
    print_header "Arrêt des services"
    docker compose -f $COMPOSE_FILE down
    print_success "Services arrêtés"
}

restart() {
    print_header "Redémarrage des services"
    docker compose -f $COMPOSE_FILE restart
    print_success "Services redémarrés"
}

# ===========================================================================
# Logs et monitoring
# ===========================================================================

logs() {
    SERVICE=${1:-}
    if [ -z "$SERVICE" ]; then
        docker compose -f $COMPOSE_FILE logs -f
    else
        docker compose -f $COMPOSE_FILE logs -f $SERVICE
    fi
}

status() {
    print_header "Statut des services"
    docker compose -f $COMPOSE_FILE ps
    echo ""
    print_header "Utilisation des ressources"
    docker stats --no-stream
}

# ===========================================================================
# Backup et restauration
# ===========================================================================

backup() {
    print_header "Sauvegarde de la base de données"

    BACKUP_DIR="./backups"
    mkdir -p $BACKUP_DIR

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

    docker compose -f $COMPOSE_FILE exec -T db \
        pg_dump -U sante_prod sante_rurale_prod | gzip > $BACKUP_FILE

    print_success "Backup créé: $BACKUP_FILE"

    # Garder seulement les 30 derniers backups
    find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
}

restore() {
    BACKUP_FILE=$1

    if [ -z "$BACKUP_FILE" ]; then
        print_error "Usage: ./deploy.sh restore <fichier_backup>"
        exit 1
    fi

    if [ ! -f "$BACKUP_FILE" ]; then
        print_error "Fichier de backup non trouvé: $BACKUP_FILE"
        exit 1
    fi

    print_header "Restauration de la base de données"
    print_warning "Cette opération va ÉCRASER la base de données actuelle!"
    read -p "Continuer? (y/N) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        gunzip < $BACKUP_FILE | docker compose -f $COMPOSE_FILE exec -T db \
            psql -U sante_prod sante_rurale_prod
        print_success "Restauration terminée"
    else
        print_warning "Restauration annulée"
    fi
}

# ===========================================================================
# SSL / Certbot
# ===========================================================================

ssl() {
    DOMAIN=$1
    EMAIL=$2

    if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
        print_error "Usage: ./deploy.sh ssl <domaine> <email>"
        exit 1
    fi

    print_header "Obtention du certificat SSL pour $DOMAIN"

    docker compose -f $COMPOSE_FILE run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN \
        -d www.$DOMAIN

    print_success "Certificat SSL obtenu"
    print_warning "Redémarrez nginx avec: ./deploy.sh restart nginx"
}

ssl_renew() {
    print_header "Renouvellement des certificats SSL"
    docker compose -f $COMPOSE_FILE run --rm certbot renew
    docker compose -f $COMPOSE_FILE restart nginx
    print_success "Certificats renouvelés"
}

# ===========================================================================
# Mise à jour
# ===========================================================================

update() {
    print_header "Mise à jour de l'application"

    # Git pull
    print_warning "Pull depuis Git..."
    git pull origin main

    # Rebuild
    build

    # Redémarrage
    restart

    print_success "Mise à jour terminée"
}

# ===========================================================================
# Nettoyage
# ===========================================================================

clean() {
    print_header "Nettoyage des ressources Docker"

    print_warning "Suppression des images non utilisées..."
    docker image prune -a -f

    print_warning "Suppression des volumes orphelins..."
    docker volume prune -f

    print_warning "Suppression des réseaux non utilisés..."
    docker network prune -f

    print_success "Nettoyage terminé"
}

# ===========================================================================
# Aide
# ===========================================================================

show_help() {
    cat << EOF
Usage: ./deploy.sh [commande] [options]

Commandes disponibles:

  check                 Vérifier les prérequis
  secrets               Générer des secrets sécurisés

  build                 Build les images Docker
  start                 Démarrer tous les services
  stop                  Arrêter tous les services
  restart [service]     Redémarrer les services (ou un service spécifique)

  logs [service]        Afficher les logs (tous ou un service spécifique)
  status                Afficher le statut des services

  backup                Créer une sauvegarde de la base de données
  restore <fichier>     Restaurer une sauvegarde

  ssl <domaine> <email> Obtenir un certificat SSL
  ssl-renew             Renouveler les certificats SSL

  update                Mettre à jour l'application (git pull + rebuild)
  clean                 Nettoyer les ressources Docker non utilisées

Exemples:
  ./deploy.sh check
  ./deploy.sh build
  ./deploy.sh start
  ./deploy.sh logs api
  ./deploy.sh backup
  ./deploy.sh ssl mondomaine.com email@example.com
  ./deploy.sh update

EOF
}

# ===========================================================================
# Main
# ===========================================================================

case "${1:-help}" in
    check)
        check_requirements
        ;;
    secrets)
        generate_secrets
        ;;
    build)
        build
        ;;
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs ${2:-}
        ;;
    status)
        status
        ;;
    backup)
        backup
        ;;
    restore)
        restore ${2:-}
        ;;
    ssl)
        ssl ${2:-} ${3:-}
        ;;
    ssl-renew)
        ssl_renew
        ;;
    update)
        update
        ;;
    clean)
        clean
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Commande inconnue: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
