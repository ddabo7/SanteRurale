#!/bin/bash
# ===========================================================================
# Script de test de restauration de backup PostgreSQL - Santé Rurale
# ===========================================================================
# Ce script teste la restauration d'un backup dans une base de données de test
# IMPORTANT: N'affecte PAS la base de données de production
# ===========================================================================

set -euo pipefail  # Arrêter en cas d'erreur

# ===========================================================================
# CONFIGURATION
# ===========================================================================

# Charger les variables d'environnement
if [ -f .env.production ]; then
    export $(grep -v '^#' .env.production | xargs)
elif [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo "❌ Fichier .env introuvable"
    exit 1
fi

# Configuration
BACKUP_DIR="/var/backups/sante-rurale"
TEST_DB="sante_rurale_restore_test"
LOG_FILE="${BACKUP_DIR}/restore_test.log"

# ===========================================================================
# FONCTIONS
# ===========================================================================

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

error() {
    log "❌ ERREUR: $1"
    cleanup
    exit 1
}

cleanup() {
    log "🧹 Nettoyage de la base de test..."

    export PGPASSWORD="${POSTGRES_PASSWORD}"

    # Déconnecter tous les utilisateurs de la base de test
    psql \
        --host="${POSTGRES_HOST:-localhost}" \
        --port="${POSTGRES_PORT:-5432}" \
        --username="${POSTGRES_USER}" \
        --dbname="postgres" \
        -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${TEST_DB}';" \
        2>/dev/null || true

    # Supprimer la base de test
    dropdb \
        --host="${POSTGRES_HOST:-localhost}" \
        --port="${POSTGRES_PORT:-5432}" \
        --username="${POSTGRES_USER}" \
        --if-exists \
        "${TEST_DB}" \
        2>/dev/null || true

    unset PGPASSWORD
    log "✅ Nettoyage terminé"
}

# ===========================================================================
# VÉRIFICATIONS PRÉ-RESTAURATION
# ===========================================================================

log "🚀 Démarrage du test de restauration..."

# Vérifier que psql et createdb sont disponibles
if ! command -v psql &> /dev/null || ! command -v createdb &> /dev/null; then
    error "psql ou createdb n'est pas installé. Installez postgresql-client."
fi

# Vérifier les variables d'environnement
if [ -z "${POSTGRES_USER:-}" ] || [ -z "${POSTGRES_PASSWORD:-}" ]; then
    error "Variables PostgreSQL manquantes"
fi

# ===========================================================================
# SÉLECTION DU BACKUP À TESTER
# ===========================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 BACKUPS DISPONIBLES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Lister les backups disponibles
BACKUPS=($(find "${BACKUP_DIR}" -name "sante_rurale_backup_*.sql.gz*" -type f | sort -r))

if [ ${#BACKUPS[@]} -eq 0 ]; then
    error "Aucun backup trouvé dans ${BACKUP_DIR}"
fi

# Afficher les backups avec leurs détails
for i in "${!BACKUPS[@]}"; do
    backup="${BACKUPS[$i]}"
    filename=$(basename "$backup")
    size=$(du -h "$backup" | cut -f1)
    date=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$backup" 2>/dev/null || stat -c "%y" "$backup" 2>/dev/null | cut -d' ' -f1,2)

    echo "$((i+1)). ${filename}"
    echo "   📊 Taille: ${size}"
    echo "   📅 Date: ${date}"
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Demander à l'utilisateur de choisir un backup
read -p "Sélectionnez le numéro du backup à tester (1-${#BACKUPS[@]}) ou 'q' pour quitter: " choice

if [[ "$choice" == "q" ]] || [[ "$choice" == "Q" ]]; then
    log "Test de restauration annulé"
    exit 0
fi

# Valider le choix
if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt ${#BACKUPS[@]} ]; then
    error "Choix invalide"
fi

BACKUP_FILE="${BACKUPS[$((choice-1))]}"
log "✅ Backup sélectionné: $(basename ${BACKUP_FILE})"

# ===========================================================================
# DÉCHIFFREMENT (si nécessaire)
# ===========================================================================

BACKUP_TO_RESTORE="${BACKUP_FILE}"

if [[ "${BACKUP_FILE}" == *.enc ]]; then
    log "🔓 Déchiffrement du backup..."

    if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ] || [ "${BACKUP_ENCRYPTION_KEY}" == "GÉNÉRER_UNE_CLÉ_SÉPARÉE" ]; then
        error "Clé de déchiffrement non configurée (BACKUP_ENCRYPTION_KEY)"
    fi

    if ! command -v openssl &> /dev/null; then
        error "OpenSSL non disponible pour le déchiffrement"
    fi

    DECRYPTED_FILE="${BACKUP_DIR}/temp_decrypted_$(date +%s).sql.gz"

    if openssl enc -aes-256-cbc \
        -d \
        -in "${BACKUP_FILE}" \
        -out "${DECRYPTED_FILE}" \
        -k "${BACKUP_ENCRYPTION_KEY}"; then
        log "✅ Backup déchiffré avec succès"
        BACKUP_TO_RESTORE="${DECRYPTED_FILE}"
    else
        error "Échec du déchiffrement du backup"
    fi
fi

# ===========================================================================
# CRÉATION DE LA BASE DE TEST
# ===========================================================================

log "🗄️  Création de la base de données de test: ${TEST_DB}"

export PGPASSWORD="${POSTGRES_PASSWORD}"

# Nettoyer d'abord au cas où
cleanup

# Créer la nouvelle base de test
if createdb \
    --host="${POSTGRES_HOST:-localhost}" \
    --port="${POSTGRES_PORT:-5432}" \
    --username="${POSTGRES_USER}" \
    --owner="${POSTGRES_USER}" \
    "${TEST_DB}"; then
    log "✅ Base de test créée: ${TEST_DB}"
else
    error "Échec de la création de la base de test"
fi

# ===========================================================================
# RESTAURATION DU BACKUP
# ===========================================================================

log "📥 Restauration du backup dans la base de test..."

if gunzip -c "${BACKUP_TO_RESTORE}" | \
    psql \
        --host="${POSTGRES_HOST:-localhost}" \
        --port="${POSTGRES_PORT:-5432}" \
        --username="${POSTGRES_USER}" \
        --dbname="${TEST_DB}" \
        --quiet \
        2>&1 | tee -a "${LOG_FILE}"; then
    log "✅ Restauration terminée"
else
    error "Échec de la restauration"
fi

# Nettoyer le fichier déchiffré temporaire
if [[ "${BACKUP_TO_RESTORE}" != "${BACKUP_FILE}" ]]; then
    rm -f "${BACKUP_TO_RESTORE}"
fi

# ===========================================================================
# VÉRIFICATIONS POST-RESTAURATION
# ===========================================================================

log "🔍 Vérification de l'intégrité des données restaurées..."

# Compter les tables
TABLE_COUNT=$(psql \
    --host="${POSTGRES_HOST:-localhost}" \
    --port="${POSTGRES_PORT:-5432}" \
    --username="${POSTGRES_USER}" \
    --dbname="${TEST_DB}" \
    -t \
    -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" \
    2>/dev/null | xargs)

log "📊 Nombre de tables restaurées: ${TABLE_COUNT}"

# Vérifier quelques tables critiques
CRITICAL_TABLES=("users" "patients" "encounters" "tenants" "subscriptions")

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 VÉRIFICATION DES TABLES CRITIQUES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ALL_TABLES_OK=true

for table in "${CRITICAL_TABLES[@]}"; do
    # Vérifier si la table existe
    EXISTS=$(psql \
        --host="${POSTGRES_HOST:-localhost}" \
        --port="${POSTGRES_PORT:-5432}" \
        --username="${POSTGRES_USER}" \
        --dbname="${TEST_DB}" \
        -t \
        -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${table}');" \
        2>/dev/null | xargs)

    if [ "$EXISTS" == "t" ]; then
        # Compter les lignes
        ROW_COUNT=$(psql \
            --host="${POSTGRES_HOST:-localhost}" \
            --port="${POSTGRES_PORT:-5432}" \
            --username="${POSTGRES_USER}" \
            --dbname="${TEST_DB}" \
            -t \
            -c "SELECT COUNT(*) FROM ${table};" \
            2>/dev/null | xargs)

        echo "✅ ${table}: ${ROW_COUNT} ligne(s)"
    else
        echo "❌ ${table}: TABLE MANQUANTE"
        ALL_TABLES_OK=false
    fi
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

unset PGPASSWORD

# ===========================================================================
# NETTOYAGE
# ===========================================================================

echo ""
read -p "Voulez-vous supprimer la base de test ${TEST_DB} ? (y/n): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    cleanup
else
    log "ℹ️  Base de test conservée: ${TEST_DB}"
    log "   Pour la supprimer manuellement: dropdb -U ${POSTGRES_USER} ${TEST_DB}"
fi

# ===========================================================================
# RÉSUMÉ
# ===========================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RÉSUMÉ DU TEST DE RESTAURATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 Backup testé: $(basename ${BACKUP_FILE})"
echo "📊 Tables restaurées: ${TABLE_COUNT}"

if [ "$ALL_TABLES_OK" = true ]; then
    echo "✅ Statut: SUCCÈS - Toutes les tables critiques sont présentes"
    log "✅ Test de restauration réussi"
    exit 0
else
    echo "⚠️  Statut: AVERTISSEMENT - Certaines tables critiques sont manquantes"
    log "⚠️  Test de restauration terminé avec des avertissements"
    exit 1
fi
