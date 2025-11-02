# 🏥 Santé Rurale - Backend API

API REST pour le système de gestion des soins de santé ruraux en zones rurales.

## 🚀 Installation Rapide

### Prérequis

- macOS (testé sur macOS)
- Homebrew installé
- PostgreSQL installé (`brew install postgresql@16`)
- Git

### Installation Automatique

```bash
# Se placer dans le dossier api
cd "/Users/djibrildabo/Documents/Santé Rurale/api"

# Rendre le script exécutable
chmod +x install_python312.sh

# Lancer l'installation
./install_python312.sh
```

Ce script va :
1. ✅ Installer Python 3.12 via pyenv
2. ✅ Créer l'environnement virtuel
3. ✅ Installer toutes les dépendances
4. ✅ Créer les tables PostgreSQL
5. ✅ Insérer les données initiales
6. ✅ Tester le système

## 🏗️ Architecture

```
api/
├── app/
│   ├── main.py              # Application FastAPI principale
│   ├── config.py            # Configuration (DB, JWT, Email, CORS)
│   ├── database.py          # Connexion PostgreSQL async
│   ├── models.py            # Modèles SQLAlchemy
│   ├── security.py          # Hachage bcrypt + tokens JWT
│   ├── routers/
│   │   └── auth.py          # Endpoints d'authentification
│   └── services/
│       └── email.py         # Service d'envoi d'emails
├── alembic/                 # Migrations de base de données
├── requirements.txt         # Dépendances Python
├── install_python312.sh     # Script d'installation
├── seed_data.py             # Script d'insertion des données initiales
└── test_login.py            # Script de test

```

## 📊 Base de Données

### Tables

- **regions** - Régions
- **districts** - Districts
- **sites** - Sites de santé (CSCOM, centres de référence, etc.)
- **users** - Utilisateurs (personnel de santé)
- **patients** - Patients

### Configuration

```
Database: sante_rurale
User: sante
Password: sante_pwd
Host: localhost
Port: 5432
```

## 🔐 Comptes de Test

Tous les comptes ont l'email déjà vérifié :

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| admin@cscom-koulikoro.ml | Admin2024! | admin |
| dr.traore@cscom-koulikoro.ml | Medecin2024! | medecin |
| major.kone@cscom-koulikoro.ml | Major2024! | major |
| soignant.coulibaly@cscom-koulikoro.ml | Soignant2024! | soignant |

## 🎯 Démarrage

```bash
# Activer l'environnement virtuel
source venv/bin/activate

# Démarrer le serveur en mode développement
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Le serveur sera accessible sur :
- API : http://localhost:8000
- Documentation Swagger : http://localhost:8000/docs
- Documentation ReDoc : http://localhost:8000/redoc

## 📱 Endpoints API

### Authentification

```
POST   /api/auth/signup                - Inscription nouvel utilisateur
POST   /api/auth/verify-email          - Vérification email
POST   /api/auth/login                 - Connexion
POST   /api/auth/forgot-password       - Demande réinitialisation mot de passe
POST   /api/auth/reset-password        - Réinitialisation mot de passe
GET    /api/auth/me                    - Profil utilisateur (TODO)
```

### Santé

```
GET    /                               - Page d'accueil API
GET    /health                         - Vérification santé du serveur
```

## 🧪 Tests

### Test de login

```bash
source venv/bin/activate
python test_login.py
```

### Test via curl

```bash
# Health check
curl http://localhost:8000/health

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cscom-koulikoro.ml","password":"Admin2024!"}'
```

## 🔧 Configuration

La configuration se fait via le fichier `.env` (copiez `.env.example`) ou directement dans `app/config.py`.

Variables importantes :
- `DATABASE_URL` - URL de connexion PostgreSQL
- `SECRET_KEY` - Clé secrète JWT (à changer en production!)
- `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` - Configuration email
- `CORS_ORIGINS` - URLs du frontend autorisées

## 📦 Dépendances Principales

- **FastAPI** - Framework web moderne et rapide
- **SQLAlchemy** - ORM pour PostgreSQL
- **Alembic** - Migrations de base de données
- **Pydantic** - Validation des données
- **python-jose** - Gestion des tokens JWT
- **passlib[bcrypt]** - Hachage sécurisé des mots de passe
- **asyncpg** - Driver PostgreSQL asynchrone

## 🗄️ Migrations Alembic

### Créer une nouvelle migration

```bash
alembic revision --autogenerate -m "description_changement"
```

### Appliquer les migrations

```bash
alembic upgrade head
```

### Revenir en arrière

```bash
alembic downgrade -1
```

## 🌱 Données Initiales

Pour réinsérer les données initiales :

```bash
source venv/bin/activate
python seed_data.py
```

## 🐛 Dépannage

### PostgreSQL ne démarre pas

```bash
brew services list | grep postgresql
brew services start postgresql@16
```

### Port 8000 déjà utilisé

```bash
# Utiliser un autre port
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### Erreur "No module named 'app'"

```bash
# Vérifier que vous êtes dans le bon dossier
pwd  # Doit afficher .../api

# Réinstaller les dépendances
source venv/bin/activate
pip install -r requirements.txt
```

### Warning bcrypt

Le warning suivant est normal et peut être ignoré :
```
(trapped) error reading bcrypt version
```

C'est un problème de compatibilité mineur entre passlib et bcrypt 4.x.

## 📝 Scripts Utiles

### Voir les données

```bash
# Via psql
psql -h localhost -U sante -d sante_rurale

# Compter les utilisateurs
psql -h localhost -U sante -d sante_rurale -c "SELECT COUNT(*) FROM users;"

# Voir les utilisateurs
psql -h localhost -U sante -d sante_rurale -c "SELECT email, role, email_verified FROM users;"
```

### Réinitialiser la base de données

```bash
# Supprimer toutes les tables
psql -h localhost -U sante -d sante_rurale -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Recréer les tables
alembic upgrade head

# Réinsérer les données
python seed_data.py
```

## 🔒 Sécurité

### En Développement

- ✅ Validation des mots de passe (8 caractères min, majuscule, chiffre, spécial)
- ✅ Hachage bcrypt des mots de passe
- ✅ Tokens JWT avec expiration
- ✅ Vérification d'email obligatoire
- ✅ CORS configuré

### En Production (À FAIRE)

- ⚠️ Changer la `SECRET_KEY` dans `.env`
- ⚠️ Désactiver `DEBUG=False`
- ⚠️ Utiliser HTTPS
- ⚠️ Configurer un serveur SMTP professionnel
- ⚠️ Limiter les requêtes (rate limiting)
- ⚠️ Configurer des logs appropriés
- ⚠️ Utiliser des secrets stockés de manière sécurisée

## 📚 Documentation

- [Installation Complète](INSTALLATION_COMPLETE.md) - Guide détaillé d'installation
- [Migration PostgreSQL](../MIGRATION_POSTGRESQL.md) - Guide de migration
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)

## 🤝 Contribution

1. Créer une branche pour votre fonctionnalité
2. Faire vos modifications
3. Tester avec `python test_login.py`
4. Créer une pull request

## 📄 Licence

Projet interne - Santé Rurale

## 👥 Équipe

Développé pour améliorer l'accès aux soins de santé dans les zones rurales à travers le monde.
