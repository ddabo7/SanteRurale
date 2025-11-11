#!/bin/bash
# ===========================================================================
# Script de backup automatique PostgreSQL - Santé Rurale
# ===========================================================================
# Ce script effectue un backup chiffré de la base de données PostgreSQL
# et l'envoie vers un stockage S3 (MinIO ou AWS S3)
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
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="sante_rurale_backup_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# Logs
LOG_FILE="${BACKUP_DIR}/backup.log"
mkdir -p "${BACKUP_DIR}"

# ===========================================================================
# FONCTIONS
# ===========================================================================

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

error() {
    log "❌ ERREUR: $1"
    exit 1
}

# ===========================================================================
# VÉRIFICATIONS PRÉ-BACKUP
# ===========================================================================

log "🚀 Démarrage du backup PostgreSQL..."

# Vérifier que pg_dump est disponible
if ! command -v pg_dump &> /dev/null; then
    error "pg_dump n'est pas installé. Installez postgresql-client."
fi

# Vérifier les variables d'environnement critiques
if [ -z "${POSTGRES_USER:-}" ] || [ -z "${POSTGRES_PASSWORD:-}" ] || [ -z "${POSTGRES_DB:-}" ]; then
    error "Variables PostgreSQL manquantes (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB)"
fi

# ===========================================================================
# BACKUP DE LA BASE DE DONNÉES
# ===========================================================================

log "📦 Création du dump PostgreSQL..."

# Définir le mot de passe pour pg_dump
export PGPASSWORD="${POSTGRES_PASSWORD}"

# Exécuter le dump
if pg_dump \
    --host="${POSTGRES_HOST:-localhost}" \
    --port="${POSTGRES_PORT:-5432}" \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --format=plain \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    | gzip > "${BACKUP_PATH}"; then
    log "✅ Dump créé avec succès: ${BACKUP_FILE}"
else
    error "Échec de la création du dump PostgreSQL"
fi

# Nettoyer la variable d'environnement
unset PGPASSWORD

# Vérifier que le fichier existe et n'est pas vide
if [ ! -s "${BACKUP_PATH}" ]; then
    error "Le fichier de backup est vide ou n'existe pas"
fi

# Afficher la taille du backup
BACKUP_SIZE=$(du -h "${BACKUP_PATH}" | cut -f1)
log "📊 Taille du backup: ${BACKUP_SIZE}"

# ===========================================================================
# CHIFFREMENT DU BACKUP (optionnel)
# ===========================================================================

if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ] && [ "${BACKUP_ENCRYPTION_KEY}" != "GÉNÉRER_UNE_CLÉ_SÉPARÉE" ]; then
    log "🔐 Chiffrement du backup..."

    if ! command -v openssl &> /dev/null; then
        log "⚠️  OpenSSL non disponible, backup non chiffré"
    else
        ENCRYPTED_FILE="${BACKUP_PATH}.enc"

        if openssl enc -aes-256-cbc \
            -salt \
            -in "${BACKUP_PATH}" \
            -out "${ENCRYPTED_FILE}" \
            -k "${BACKUP_ENCRYPTION_KEY}"; then

            # Remplacer le fichier non chiffré par le fichier chiffré
            rm "${BACKUP_PATH}"
            mv "${ENCRYPTED_FILE}" "${BACKUP_PATH}"
            log "✅ Backup chiffré avec succès"
        else
            log "⚠️  Échec du chiffrement, backup conservé non chiffré"
        fi
    fi
fi

# ===========================================================================
# UPLOAD VERS S3 / MinIO (optionnel)
# ===========================================================================

if command -v aws &> /dev/null && [ -n "${BACKUP_S3_BUCKET:-}" ]; then
    log "☁️  Upload vers S3..."

    # Configuration pour MinIO (si utilisé)
    if [ -n "${MINIO_ENDPOINT:-}" ]; then
        export AWS_ACCESS_KEY_ID="${MINIO_ROOT_USER}"
        export AWS_SECRET_ACCESS_KEY="${MINIO_ROOT_PASSWORD}"
        S3_ENDPOINT_URL="--endpoint-url http://${MINIO_ENDPOINT}"
    else
        S3_ENDPOINT_URL=""
    fi

    if aws s3 cp \
        "${BACKUP_PATH}" \
        "s3://${BACKUP_S3_BUCKET}/backups/${BACKUP_FILE}" \
        ${S3_ENDPOINT_URL}; then
        log "✅ Backup uploadé vers S3: ${BACKUP_S3_BUCKET}/backups/${BACKUP_FILE}"
    else
        log "⚠️  Échec de l'upload S3, backup conservé localement"
    fi
else
    log "ℹ️  Pas de configuration S3, backup conservé localement uniquement"
fi

# ===========================================================================
# NETTOYAGE DES ANCIENS BACKUPS
# ===========================================================================

log "🧹 Nettoyage des backups de plus de ${RETENTION_DAYS} jours..."

# Nettoyer les backups locaux
find "${BACKUP_DIR}" -name "sante_rurale_backup_*.sql.gz*" -type f -mtime +${RETENTION_DAYS} -delete
DELETED_COUNT=$(find "${BACKUP_DIR}" -name "sante_rurale_backup_*.sql.gz*" -type f -mtime +${RETENTION_DAYS} | wc -l)

if [ "${DELETED_COUNT}" -gt 0 ]; then
    log "🗑️  ${DELETED_COUNT} ancien(s) backup(s) local(aux) supprimé(s)"
fi

# Nettoyer les backups S3 (si configuré)
if command -v aws &> /dev/null && [ -n "${BACKUP_S3_BUCKET:-}" ]; then
    # Liste les fichiers de plus de RETENTION_DAYS jours
    OLD_DATE=$(date -d "${RETENTION_DAYS} days ago" +%Y%m%d 2>/dev/null || date -v -${RETENTION_DAYS}d +%Y%m%d)

    aws s3 ls "s3://${BACKUP_S3_BUCKET}/backups/" ${S3_ENDPOINT_URL} | \
    awk '{print $4}' | \
    grep "sante_rurale_backup_" | \
    while read -r file; do
        file_date=$(echo "$file" | grep -oP '\d{8}' | head -1)
        if [ "${file_date}" -lt "${OLD_DATE}" ]; then
            aws s3 rm "s3://${BACKUP_S3_BUCKET}/backups/${file}" ${S3_ENDPOINT_URL}
            log "🗑️  Backup S3 supprimé: ${file}"
        fi
    done
fi

# ===========================================================================
# VÉRIFICATION D'INTÉGRITÉ
# ===========================================================================

log "🔍 Vérification de l'intégrité du backup..."

# Vérifier que le fichier gzip est valide
if gzip -t "${BACKUP_PATH}" 2>/dev/null; then
    log "✅ Intégrité du backup vérifiée"
else
    error "Le backup est corrompu !"
fi

# ===========================================================================
# RÉSUMÉ
# ===========================================================================

log "✅ Backup terminé avec succès !"
log "📁 Fichier: ${BACKUP_FILE}"
log "📊 Taille: ${BACKUP_SIZE}"

# Afficher le nombre de backups conservés
BACKUP_COUNT=$(find "${BACKUP_DIR}" -name "sante_rurale_backup_*.sql.gz*" -type f | wc -l)
log "💾 Nombre de backups conservés localement: ${BACKUP_COUNT}"

exit 0
