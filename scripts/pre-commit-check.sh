#!/bin/bash
# ===========================================================================
# Pre-commit check - Santé Rurale
# ===========================================================================
# Ce script vérifie qu'aucune donnée sensible n'est commitée
# À installer comme hook git: cp scripts/pre-commit-check.sh .git/hooks/pre-commit
# ===========================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Vérification pré-commit...${NC}"

# Liste des patterns de fichiers interdits
FORBIDDEN_PATTERNS=(
    "\.env$"
    "\.env\.production$"
    "\.env\.local$"
    "\.sql$"
    "\.dump$"
    "\.db$"
    "\.sqlite$"
    "passwords\.txt$"
    "credentials\.json$"
    "service-account.*\.json$"
)

# Vérifier les fichiers en staging
FILES_TO_CHECK=$(git diff --cached --name-only --diff-filter=ACM)
ERRORS=0

for file in $FILES_TO_CHECK; do
    for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
        if echo "$file" | grep -qE "$pattern"; then
            echo -e "${RED}BLOQUÉ: $file correspond au pattern interdit: $pattern${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    done
done

# Vérifier les secrets dans le contenu des fichiers
for file in $FILES_TO_CHECK; do
    # Ignorer les fichiers binaires
    if file "$file" | grep -q "text"; then
        # Chercher des patterns de secrets
        if grep -qE "(password|secret|api_key|apikey|token).*=.*['\"][^'\"]{8,}['\"]" "$file" 2>/dev/null; then
            echo -e "${YELLOW}ATTENTION: $file semble contenir un secret hardcodé${NC}"
        fi
    fi
done

if [ $ERRORS -gt 0 ]; then
    echo -e "\n${RED}Commit bloqué! $ERRORS fichier(s) interdit(s) détecté(s).${NC}"
    echo -e "Retirez ces fichiers du staging avec: git reset HEAD <fichier>"
    exit 1
fi

echo -e "${GREEN}✓ Aucun fichier sensible détecté${NC}"
exit 0
