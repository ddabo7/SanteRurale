#!/bin/bash

# Script pour installer Python 3.12 et configurer le projet Santé Rurale
# Usage: chmod +x install_python312.sh && ./install_python312.sh

set -e

echo "======================================================================"
echo "🐍 Installation de Python 3.12 pour Santé Rurale"
echo "======================================================================"
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Vérifier si pyenv est installé
if ! command -v pyenv &> /dev/null; then
    echo -e "${YELLOW}⚠️  pyenv n'est pas installé. Installation en cours...${NC}"
    brew install pyenv

    # Ajouter pyenv au shell
    echo -e "${BLUE}📝 Configuration de pyenv dans votre shell...${NC}"
    if [ -f ~/.zshrc ]; then
        echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.zshrc
        echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.zshrc
        echo 'eval "$(pyenv init -)"' >> ~/.zshrc
    fi

    if [ -f ~/.bash_profile ]; then
        echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bash_profile
        echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bash_profile
        echo 'eval "$(pyenv init -)"' >> ~/.bash_profile
    fi

    # Recharger le shell
    export PYENV_ROOT="$HOME/.pyenv"
    export PATH="$PYENV_ROOT/bin:$PATH"
    eval "$(pyenv init -)"

    echo -e "${GREEN}✓ pyenv installé${NC}"
fi

# Vérifier si Python 3.12 est installé
if ! pyenv versions | grep -q "3.12"; then
    echo -e "${BLUE}📦 Installation de Python 3.12...${NC}"
    pyenv install 3.12.0
    echo -e "${GREEN}✓ Python 3.12 installé${NC}"
else
    echo -e "${GREEN}✓ Python 3.12 déjà installé${NC}"
fi

# Définir Python 3.12 pour ce projet
echo -e "${BLUE}🔧 Configuration de Python 3.12 pour ce projet...${NC}"
pyenv local 3.12.0

# Vérifier la version
PYTHON_VERSION=$(python3 --version)
echo -e "${GREEN}✓ Version Python active : $PYTHON_VERSION${NC}"

# Supprimer l'ancien environnement virtuel si il existe
if [ -d "venv" ]; then
    echo -e "${YELLOW}🗑️  Suppression de l'ancien environnement virtuel...${NC}"
    rm -rf venv
fi

# Créer un nouvel environnement virtuel avec Python 3.12
echo -e "${BLUE}📦 Création de l'environnement virtuel avec Python 3.12...${NC}"
python3 -m venv venv
echo -e "${GREEN}✓ Environnement virtuel créé${NC}"

# Activer l'environnement virtuel
source venv/bin/activate

# Mettre à jour pip
echo -e "${BLUE}📚 Mise à jour de pip...${NC}"
pip install --upgrade pip

# Installer les dépendances
echo -e "${BLUE}📚 Installation des dépendances Python...${NC}"
pip install -r requirements.txt

# Installer la bonne version de bcrypt
echo -e "${BLUE}🔧 Installation de bcrypt compatible...${NC}"
pip uninstall -y bcrypt
pip install "bcrypt<4.2.0"

echo -e "${GREEN}✓ Dépendances installées${NC}"

# Vérifier que PostgreSQL est démarré
echo -e "${BLUE}🔍 Vérification de PostgreSQL...${NC}"
if ! brew services list | grep postgresql | grep started > /dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL n'est pas démarré. Démarrage en cours...${NC}"
    brew services start postgresql@16
    sleep 2
fi
echo -e "${GREEN}✓ PostgreSQL est démarré${NC}"

# Créer les tables avec Alembic
echo -e "${BLUE}🗄️  Création des tables dans PostgreSQL...${NC}"
alembic upgrade head
echo -e "${GREEN}✓ Tables créées${NC}"

# Insérer les données initiales
echo -e "${BLUE}🌱 Insertion des données initiales...${NC}"
python3 seed_data.py
echo -e "${GREEN}✓ Données initiales insérées${NC}"

# Tester le login
echo -e "${BLUE}🧪 Test du système de login...${NC}"
python3 test_login.py

# Résumé
echo ""
echo "======================================================================"
echo -e "${GREEN}✅ Configuration terminée avec succès !${NC}"
echo "======================================================================"
echo ""
echo "📊 Prochaines étapes :"
echo "  1. Activer l'environnement virtuel : source venv/bin/activate"
echo "  2. Démarrer le backend : uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo "  3. Dans un autre terminal, démarrer le frontend :"
echo "     cd ../pwa && npm run dev"
echo "  4. Accéder à l'application : http://localhost:5173"
echo "  5. Documentation API : http://localhost:8000/docs"
echo ""
echo "🔐 Comptes de test créés :"
echo "  • admin@cscom-koulikoro.ml / Admin2024!"
echo "  • dr.traore@cscom-koulikoro.ml / Medecin2024!"
echo "  • major.kone@cscom-koulikoro.ml / Major2024!"
echo "  • soignant.coulibaly@cscom-koulikoro.ml / Soignant2024!"
echo ""
echo "📄 Documentation complète : INSTALLATION_COMPLETE.md"
echo "======================================================================"
