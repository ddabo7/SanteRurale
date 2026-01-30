#!/bin/bash
# ===========================================================================
# Setup Git Hooks - Santé Rurale
# ===========================================================================
# Ce script installe les hooks git pour protéger contre les commits accidentels
# ===========================================================================

echo "Installation des hooks git..."

# Créer le dossier hooks s'il n'existe pas
mkdir -p .git/hooks

# Copier le hook pre-commit
cp scripts/pre-commit-check.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

echo "✓ Hook pre-commit installé"
echo ""
echo "Les hooks git sont maintenant actifs."
echo "Ils empêcheront de commiter des fichiers sensibles (.env, .sql, etc.)"
