#!/bin/bash
# ===========================================================================
# Script de Nettoyage Automatique - Suppression des références "Mali"
# ===========================================================================

set -e

echo "🧹 Nettoyage automatique des références 'Mali'"
echo "=============================================="
echo ""

# Fonction de remplacement sécurisée
safe_replace() {
    local file="$1"
    local old="$2"
    local new="$3"

    if [ -f "$file" ]; then
        # Backup
        cp "$file" "$file.bak"

        # Remplacer
        sed -i.tmp "s/$old/$new/g" "$file"
        rm "$file.tmp"

        echo "✓ $file"
    fi
}

echo "📝 Remplacement dans les fichiers de documentation..."

# Documentation générale
safe_replace "./SETUP.md" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./COMPTES_TEST.md" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./SECURITY.md" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./ENVIRONMENT_VARIABLES.md" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./ENVIRONMENT_VARIABLES.md" "zones rurales au Mali" "zones rurales"

# Documentation technique
safe_replace "./docs/architecture.md" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./docs/architecture.md" "zones rurales au Mali" "zones rurales"
safe_replace "./docs/architecture.md" "Zone Rurale Mali" "Zone Rurale"
safe_replace "./docs/operations-runbooks.md" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./docs/deployment-training-plan.md" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./docs/deployment-training-plan.md" "Malitel" "opérateur local"
safe_replace "./docs/backlog-mvp.md" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./docs/fhir-dhis2-interoperability.md" "Santé Rurale Mali" "Santé Rurale"

echo ""
echo "📱 Remplacement dans les fichiers PWA..."

safe_replace "./pwa/public/test.html" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./pwa/UTILISATEURS.md" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./pwa/src/db/index.ts" "SanteRuraleMali" "SanteRurale"

echo ""
echo "🔧 Remplacement dans les fichiers API..."

safe_replace "./api/app/config.py" "Santé Rurale Mali API" "Santé Rurale API"
safe_replace "./api/app/config.py" "Santé Rurale Mali\"" "Santé Rurale\""
safe_replace "./api/app/__init__.py" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./api/app/main.py" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./api/app/main.py" "au Mali" "en zones rurales"
safe_replace "./api/app/models.py" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./api/app/models.py" "régions du Mali" "régions"
safe_replace "./api/app/services/email.py" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./api/view_data.py" "Santé Rurale Mali" "Santé Rurale"

echo ""
echo "📚 Remplacement dans la documentation API..."

safe_replace "./api/README.md" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./api/README.md" "au Mali" "en zones rurales"
safe_replace "./api/README.md" "Régions du Mali" "Régions"
safe_replace "./api/alembic/README.md" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./api/openapi.yaml" "Santé Rurale Mali API" "Santé Rurale API"
safe_replace "./api/openapi.yaml" "du Mali" "rurales"
safe_replace "./api/INSTALLATION_COMPLETE.md" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./api/INSTALLATION_COMPLETE.md" "Régions du Mali" "Régions"

echo ""
echo "🛠️  Remplacement dans les scripts..."

safe_replace "./api/install_python312.sh" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./api/setup_postgresql.sh" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./api/setup_database.sh" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./api/start.sh" "Santé Rurale Mali" "Santé Rurale"
safe_replace "./api/scripts/seed_base_data.py" "pour le Mali" "de base"

echo ""
echo "📄 Nettoyage du README.md..."
safe_replace "./README.md" "Mali (pilote)" "déploiement pilote"

echo ""
echo "=============================================="
echo "✅ Nettoyage terminé!"
echo ""
echo "📊 Suppression des backups..."
find . -name "*.bak" -delete 2>/dev/null || true

echo ""
echo "🔍 Vérification finale..."
./verify_no_mali.sh
