#!/bin/bash
# ===========================================================================
# Configuration du cron job pour les backups automatiques
# ===========================================================================
# Ce script configure un cron job pour exécuter les backups quotidiens
# ===========================================================================

set -euo pipefail

echo "🔧 Configuration du cron job pour les backups automatiques..."

# Obtenir le chemin absolu du script de backup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup-database.sh"

# Vérifier que le script de backup existe
if [ ! -f "${BACKUP_SCRIPT}" ]; then
    echo "❌ Script de backup introuvable: ${BACKUP_SCRIPT}"
    exit 1
fi

# Vérifier que le script est exécutable
if [ ! -x "${BACKUP_SCRIPT}" ]; then
    echo "🔧 Rendre le script exécutable..."
    chmod +x "${BACKUP_SCRIPT}"
fi

# Créer la ligne cron
# Exécution tous les jours à 2h du matin
CRON_LINE="0 2 * * * ${BACKUP_SCRIPT} >> /var/log/sante-rurale-backup.log 2>&1"

echo ""
echo "📋 Ligne cron à ajouter:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "${CRON_LINE}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Proposer d'ajouter automatiquement
read -p "Voulez-vous ajouter ce cron job automatiquement ? (y/n): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Vérifier si le cron job existe déjà
    if crontab -l 2>/dev/null | grep -q "${BACKUP_SCRIPT}"; then
        echo "⚠️  Un cron job pour ce script existe déjà"
        read -p "Voulez-vous le remplacer ? (y/n): " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Supprimer l'ancien et ajouter le nouveau
            (crontab -l 2>/dev/null | grep -v "${BACKUP_SCRIPT}"; echo "${CRON_LINE}") | crontab -
            echo "✅ Cron job mis à jour avec succès"
        else
            echo "ℹ️  Cron job conservé tel quel"
        fi
    else
        # Ajouter le nouveau cron job
        (crontab -l 2>/dev/null; echo "${CRON_LINE}") | crontab -
        echo "✅ Cron job ajouté avec succès"
    fi

    echo ""
    echo "📋 Cron jobs actuels:"
    crontab -l
else
    echo "ℹ️  Pour ajouter manuellement le cron job, exécutez:"
    echo "   crontab -e"
    echo "   Puis ajoutez la ligne ci-dessus"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 AUTRES OPTIONS DE PLANIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Toutes les heures:"
echo "0 * * * * ${BACKUP_SCRIPT}"
echo ""
echo "Toutes les 6 heures:"
echo "0 */6 * * * ${BACKUP_SCRIPT}"
echo ""
echo "Tous les jours à 2h du matin:"
echo "0 2 * * * ${BACKUP_SCRIPT}"
echo ""
echo "Tous les dimanches à 3h du matin:"
echo "0 3 * * 0 ${BACKUP_SCRIPT}"
echo ""
echo "Le 1er de chaque mois à 1h du matin:"
echo "0 1 1 * * ${BACKUP_SCRIPT}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit 0
