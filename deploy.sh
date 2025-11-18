#!/bin/bash
# ===========================================================================
# Script de déploiement automatisé avec validation
# ===========================================================================
# Usage:
#   ./deploy.sh dev    - Démarre l'environnement de développement
#   ./deploy.sh test   - Lance les tests avant déploiement
#   ./deploy.sh prod   - Déploie en production (après validation)
# ===========================================================================

set -e  # Arrêter en cas d'erreur

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ENV=$1

# ===========================================================================
# Fonctions d'affichage
# ===========================================================================
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# ===========================================================================
# Validation des prérequis
# ===========================================================================
check_prerequisites() {
    log_info "Vérification des prérequis..."

    # Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker n'est pas installé"
        exit 1
    fi
    log_success "Docker installé"

    # Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose n'est pas installé"
        exit 1
    fi
    log_success "Docker Compose installé"
}

# ===========================================================================
# Environnement DEV
# ===========================================================================
dev_start() {
    log_info "🚀 Démarrage de l'environnement de développement..."

    # Arrêter les containers existants
    docker-compose -f docker-compose.dev.yml down

    # Démarrer les services
    docker-compose -f docker-compose.dev.yml up -d

    log_success "Environnement de développement démarré"
    log_info "Frontend: http://localhost:5173"
    log_info "API: http://localhost:8000"
    log_info "API Docs: http://localhost:8000/docs"
    log_info "MinIO Console: http://localhost:9001 (minioadmin / minioadmin123)"

    log_info "\n📝 Pour voir les logs:"
    echo "  docker-compose -f docker-compose.dev.yml logs -f"
}

dev_stop() {
    log_info "🛑 Arrêt de l'environnement de développement..."
    docker-compose -f docker-compose.dev.yml down
    log_success "Environnement de développement arrêté"
}

# ===========================================================================
# Tests automatisés
# ===========================================================================
run_tests() {
    log_info "🧪 Lancement des tests automatisés..."

    local TESTS_PASSED=true

    # 1. Vérifier la syntaxe Python
    log_info "Test 1/5: Vérification syntaxe Python..."
    if docker-compose -f docker-compose.dev.yml run --rm api_dev python -m py_compile app/*.py 2>/dev/null; then
        log_success "Syntaxe Python valide"
    else
        log_error "Erreurs de syntaxe Python"
        TESTS_PASSED=false
    fi

    # 2. Vérifier le build frontend
    log_info "Test 2/5: Build frontend..."
    if docker-compose -f docker-compose.dev.yml run --rm frontend_dev npm run build; then
        log_success "Build frontend réussi"
    else
        log_error "Erreur lors du build frontend"
        TESTS_PASSED=false
    fi

    # 3. Vérifier les variables d'environnement critiques
    log_info "Test 3/5: Variables d'environnement..."
    if grep -q "SECRET_KEY" .env && grep -q "POSTGRES_PASSWORD" .env; then
        log_success "Variables d'environnement présentes"
    else
        log_error "Variables d'environnement manquantes"
        TESTS_PASSED=false
    fi

    # 4. Vérifier que les containers démarrent
    log_info "Test 4/5: Démarrage des containers..."
    docker-compose -f docker-compose.dev.yml up -d
    sleep 10  # Attendre que les services démarrent

    if docker-compose -f docker-compose.dev.yml ps | grep -q "Up"; then
        log_success "Containers démarrés"
    else
        log_error "Erreur de démarrage des containers"
        TESTS_PASSED=false
    fi

    # 5. Health check API
    log_info "Test 5/5: Health check API..."
    if curl -s http://localhost:8000/health | grep -q "ok"; then
        log_success "API répond correctement"
    else
        log_error "API ne répond pas"
        TESTS_PASSED=false
    fi

    # Arrêter l'environnement de test
    docker-compose -f docker-compose.dev.yml down

    if [ "$TESTS_PASSED" = false ]; then
        log_error "\n❌ TESTS ÉCHOUÉS - Déploiement bloqué"
        exit 1
    fi

    log_success "\n✅ TOUS LES TESTS PASSÉS"
}

# ===========================================================================
# Git push automatique
# ===========================================================================
git_push() {
    log_info "📤 Push vers GitHub..."

    # Vérifier s'il y a des changements non commités
    if [[ -n $(git status -s) ]]; then
        log_warning "Il y a des changements non commités"
        read -p "Voulez-vous les commiter maintenant? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git add .
            read -p "Message du commit: " commit_msg
            git commit -m "$commit_msg"
        else
            log_info "Push annulé"
            return 0
        fi
    fi

    # Push vers GitHub
    if git push origin main; then
        log_success "Code pushé vers GitHub"
    else
        log_error "Erreur lors du push"
        return 1
    fi
}

# ===========================================================================
# Déploiement PROD DISTANT (sur VPS Hostinger)
# ===========================================================================
prod_deploy_remote() {
    log_info "🚀 Déploiement en PRODUCTION sur VPS..."

    # Configuration serveur
    local SERVER_IP="72.61.107.217"
    local SERVER_USER="root"
    local PROJECT_DIR="/opt/santerurale"

    # 1. Validation pré-déploiement
    log_warning "⚠️  ATTENTION: Vous allez déployer en PRODUCTION sur $SERVER_IP"
    read -p "Continuer? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Déploiement annulé"
        exit 0
    fi

    # 2. Lancer les tests locaux
    log_info "Validation des tests locaux..."
    run_tests

    # 3. Push vers GitHub
    git_push

    # 4. Déploiement sur le serveur
    log_info "Connexion au serveur $SERVER_IP..."

    ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
        set -e
        cd /opt/santerurale || exit 1

        echo "📥 Pull du code depuis GitHub..."
        git pull origin main

        echo "🚀 Déploiement avec docker compose..."
        docker compose -f docker-compose.prod.yml up -d --build

        echo "⏳ Attente du démarrage (15s)..."
        sleep 15

        echo "✅ Vérification des services..."
        docker compose -f docker-compose.prod.yml ps

        echo "🎉 Déploiement terminé !"
ENDSSH

    if [ $? -eq 0 ]; then
        log_success "\n✅ DÉPLOIEMENT RÉUSSI sur $SERVER_IP"
        log_info "Site web: https://santerurale.io"
    else
        log_error "\n❌ ERREUR lors du déploiement"
        exit 1
    fi
}

# ===========================================================================
# Déploiement PROD LOCAL (Docker local)
# ===========================================================================
prod_deploy() {
    log_info "🚀 Déploiement en PRODUCTION LOCAL..."

    # 1. Validation pré-déploiement
    log_warning "⚠️  ATTENTION: Vous allez déployer en PRODUCTION"
    read -p "Continuer? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Déploiement annulé"
        exit 0
    fi

    # 2. Lancer les tests
    log_info "Validation des tests..."
    run_tests

    # 2.5. Push vers GitHub
    git_push

    # 3. Backup de la base de données
    log_info "Backup de la base de données..."
    BACKUP_FILE="./backups/backup-$(date +%Y%m%d-%H%M%S).sql"
    mkdir -p ./backups

    if docker exec sante_db_prod pg_dump -U $POSTGRES_USER -d $POSTGRES_DB > "$BACKUP_FILE" 2>/dev/null; then
        log_success "Backup créé: $BACKUP_FILE"
    else
        log_warning "Impossible de créer le backup (base peut-être vide)"
    fi

    # 4. Build et déploiement
    log_info "Build des images Docker..."
    docker-compose -f docker-compose.prod.yml build --no-cache

    log_info "Démarrage des nouveaux containers..."
    docker-compose -f docker-compose.prod.yml up -d

    # 5. Vérification post-déploiement
    sleep 15  # Attendre que les services démarrent

    log_info "Vérification des services..."
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        log_success "Services démarrés avec succès"
    else
        log_error "Erreur lors du démarrage"
        log_warning "Restauration du backup..."
        # TODO: Implémenter rollback automatique
        exit 1
    fi

    # 6. Mise à jour de la base de données (si nécessaire)
    if [ -f "api/update_free_plan.sql" ]; then
        log_info "Application des migrations SQL..."
        docker exec -i sante_db_prod psql -U $POSTGRES_USER -d $POSTGRES_DB < api/update_free_plan.sql
        log_success "Migrations appliquées"
    fi

    # 7. Nettoyer les anciennes images
    log_info "Nettoyage des anciennes images..."
    docker image prune -f

    log_success "\n✅ DÉPLOIEMENT EN PRODUCTION RÉUSSI"
    log_info "Frontend: https://santerurale.io (ou votre domaine)"
    log_info "API: https://santerurale.io/api"
}

# ===========================================================================
# Afficher les logs
# ===========================================================================
show_logs() {
    local ENV_FILE=$1
    log_info "📋 Affichage des logs ($ENV_FILE)..."
    docker-compose -f "docker-compose.$ENV_FILE.yml" logs -f
}

# ===========================================================================
# Menu principal
# ===========================================================================
case "$ENV" in
    dev)
        check_prerequisites
        dev_start
        ;;
    dev-stop)
        dev_stop
        ;;
    test)
        check_prerequisites
        run_tests
        ;;
    prod)
        check_prerequisites
        prod_deploy
        ;;
    prod-remote)
        check_prerequisites
        prod_deploy_remote
        ;;
    push)
        check_prerequisites
        git_push
        ;;
    logs-dev)
        show_logs "dev"
        ;;
    logs-prod)
        show_logs "prod"
        ;;
    *)
        echo "Usage: $0 {dev|dev-stop|test|prod|prod-remote|push|logs-dev|logs-prod}"
        echo ""
        echo "Commandes:"
        echo "  dev         - Démarre l'environnement de développement"
        echo "  dev-stop    - Arrête l'environnement de développement"
        echo "  test        - Lance les tests automatisés"
        echo "  prod        - Déploie en production LOCAL (Docker local)"
        echo "  prod-remote - Déploie sur le VPS Hostinger (72.61.107.217)"
        echo "  push        - Commit et push vers GitHub"
        echo "  logs-dev    - Affiche les logs de développement"
        echo "  logs-prod   - Affiche les logs de production"
        exit 1
        ;;
esac
