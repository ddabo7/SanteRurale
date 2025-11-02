#!/bin/bash
# ===========================================================================
# Script de Vérification - Aucune référence "Mali" dans l'application
# ===========================================================================

set -e

echo "🔍 Vérification des références 'Mali' dans le code"
echo "=================================================="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
FOUND=0
IGNORED=0

# Fichiers à ignorer (qui contiennent légitimement "Mali" comme exemple)
IGNORE_FILES=(
    "CHANGELOG_GENERIQUE.md"
    "MULTI_COUNTRY_SETUP.md"
    "RAPPORT_NETTOYAGE_MALI.md"
    "pwa/src/config/regions.ts"
    "verify_no_mali.sh"
    "clean_mali_references.sh"
)

echo "📁 Recherche dans les fichiers..."
echo ""

# Fonction pour vérifier si un fichier doit être ignoré
should_ignore() {
    local file="$1"
    for ignore in "${IGNORE_FILES[@]}"; do
        if [[ "$file" == *"$ignore"* ]]; then
            return 0
        fi
    done
    return 1
}

# Recherche dans tous les fichiers pertinents
while IFS= read -r file; do
    # Skip si doit être ignoré
    if should_ignore "$file"; then
        ((IGNORED++))
        continue
    fi

    # Chercher "Mali" dans le fichier
    if grep -q "Mali" "$file" 2>/dev/null; then
        ((FOUND++))
        echo -e "${RED}❌ TROUVÉ:${NC} $file"
        grep -n "Mali" "$file" | head -3
        echo ""
    fi
done < <(find . -type f \
    \( -name "*.md" \
    -o -name "*.py" \
    -o -name "*.ts" \
    -o -name "*.tsx" \
    -o -name "*.json" \
    -o -name "*.yaml" \
    -o -name "*.yml" \
    -o -name "*.sh" \
    -o -name "*.html" \
    -o -name "LICENSE" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/.git/*" \
    ! -path "*/venv/*" \
    ! -path "*/__pycache__/*" \
    ! -path "*/dist/*" \
    ! -path "*/build/*")

echo "=================================================="
echo ""

if [ $FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ SUCCÈS!${NC} Aucune référence 'Mali' trouvée (hors fichiers d'exemple)"
    echo -e "${YELLOW}ℹ️  Fichiers ignorés (exemples légitimes): $IGNORED${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}⚠️  ATTENTION!${NC} $FOUND fichier(s) contiennent encore 'Mali'"
    echo -e "${YELLOW}ℹ️  Fichiers ignorés (exemples légitimes): $IGNORED${NC}"
    echo ""
    echo "Veuillez corriger ces fichiers avant de valider."
    exit 1
fi
