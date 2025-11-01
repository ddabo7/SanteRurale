# 🔄 Migration vers PostgreSQL - Guide Complet

## ✅ Modifications effectuées

### 1. Suppression complète de localStorage
- ❌ **SUPPRIMÉ** : Stockage des utilisateurs dans le navigateur
- ✅ **REMPLACÉ PAR** : Base de données PostgreSQL sécurisée

### 2. Nouveau système d'authentification
- ✅ Tous les comptes sont maintenant dans PostgreSQL
- ✅ Validation d'email obligatoire avant connexion
- ✅ Réinitialisation de mot de passe par email
- ✅ Tokens sécurisés avec expiration

### 3. Architecture mise à jour
```
Frontend (React) -----> API (FastAPI) -----> PostgreSQL
     ↓                      ↓                     ↓
  authService.ts      auth.py endpoints    Table users
```

---

## 🚀 Installation et Configuration

### Étape 1 : Configurer la base de données PostgreSQL

Vous avez déjà créé la base de données ! Voici un récapitulatif :

```sql
-- Base de données : sante_rurale
-- Utilisateur : sante
-- Mot de passe : sante_pwd
-- Host : localhost
-- Port : 5432
```

### Étape 2 : Installer les dépendances et créer les tables

```bash
cd "/Users/djibrildabo/Documents/Santé Rurale/api"

# Rendre le script exécutable
chmod +x setup_database.sh

# Lancer la configuration automatique
./setup_database.sh
```

Ce script va :
1. ✅ Créer l'environnement virtuel Python
2. ✅ Installer toutes les dépendances (FastAPI, SQLAlchemy, Alembic, etc.)
3. ✅ Exécuter les migrations pour créer les tables
4. ✅ Insérer les données initiales (1 région, 1 district, 1 site, 4 utilisateurs)

### Étape 3 : Démarrer le backend

```bash
# Dans le dossier api/
cd "/Users/djibrildabo/Documents/Santé Rurale/api"

# Activer l'environnement virtuel
source venv/bin/activate

# Lancer le serveur API
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Le backend sera accessible sur **http://localhost:8000**

### Étape 4 : Démarrer le frontend

Ouvrir un **nouveau terminal** :

```bash
cd "/Users/djibrildabo/Documents/Santé Rurale/pwa"

# Si pas déjà fait, installer les dépendances
npm install

# Lancer l'application
npm run dev
```

Le frontend sera accessible sur **http://localhost:5173**

---

## 📊 Structure de la base de données

### Tables créées

```
regions
├── id (UUID)
├── nom
├── code
└── created_at

districts
├── id (UUID)
├── nom
├── region_id (FK)
├── code
└── created_at

sites
├── id (UUID)
├── nom
├── district_id (FK)
├── type
├── actif
└── created_at

users (NOUVEAU !)
├── id (UUID)
├── nom
├── prenom (NOUVEAU)
├── email
├── password_hash
├── role
├── site_id (FK)
├── actif
├── email_verified (NOUVEAU)
├── verification_token (NOUVEAU)
├── verification_token_expires (NOUVEAU)
├── reset_token (NOUVEAU)
├── reset_token_expires (NOUVEAU)
└── created_at

patients
├── id (UUID)
├── nom
├── prenom
├── sexe
├── annee_naissance
├── telephone
├── village
├── site_id (FK)
└── ...
```

---

## 🔐 Comptes de test

Les comptes suivants ont été créés automatiquement et sont **déjà vérifiés** :

### 👑 Administrateur
- **Email** : `admin@cscom-koulikoro.ml`
- **Mot de passe** : `Admin2024!`
- **Rôle** : admin

### 👨‍⚕️ Médecin
- **Email** : `dr.traore@cscom-koulikoro.ml`
- **Mot de passe** : `Medecin2024!`
- **Rôle** : medecin

### 👩‍⚕️ Major
- **Email** : `major.kone@cscom-koulikoro.ml`
- **Mot de passe** : `Major2024!`
- **Rôle** : major

### 🩺 Soignant
- **Email** : `soignant.coulibaly@cscom-koulikoro.ml`
- **Mot de passe** : `Soignant2024!`
- **Rôle** : soignant

---

## 🎯 Fonctionnalités disponibles

### 1. Inscription d'un nouvel utilisateur

1. Aller sur http://localhost:5173/signup
2. Remplir le formulaire
3. Un email de vérification est envoyé automatiquement
4. Cliquer sur le lien dans l'email
5. Le compte est activé
6. Se connecter sur http://localhost:5173/login

### 2. Connexion

1. Aller sur http://localhost:5173/login
2. Entrer email et mot de passe
3. Si l'email n'est pas vérifié, un message d'erreur s'affiche
4. Si tout est OK, redirection vers /patients

### 3. Mot de passe oublié

1. Aller sur http://localhost:5173/forgot-password
2. Entrer votre email
3. Un email avec un lien de réinitialisation est envoyé
4. Cliquer sur le lien (valide 1h)
5. Créer un nouveau mot de passe
6. Se connecter avec le nouveau mot de passe

---

## 📱 Endpoints API disponibles

### Authentification

```
POST   /api/auth/signup                  - Inscription
POST   /api/auth/verify-email           - Vérification email
POST   /api/auth/login                  - Connexion
POST   /api/auth/forgot-password        - Mot de passe oublié
POST   /api/auth/reset-password         - Réinitialisation
POST   /api/auth/refresh                - Rafraîchir le token
POST   /api/auth/logout                 - Déconnexion
GET    /api/auth/me                     - Profil utilisateur
```

### Emails (internes)

```
POST   /api/auth/send-verification-email      - Envoyer email de vérification
POST   /api/auth/send-password-reset-email    - Envoyer email reset password
```

---

## 🔍 Visualiser les données

### Option 1 : Script Python rapide

```bash
cd "/Users/djibrildabo/Documents/Santé Rurale/api"
source venv/bin/activate
python view_data.py
```

Affiche les statistiques : nombre d'utilisateurs, patients, sites, etc.

### Option 2 : pgAdmin (Interface graphique)

1. Installer pgAdmin : https://www.pgadmin.org/download/
2. Créer une connexion :
   - Host : `localhost`
   - Port : `5432`
   - Database : `sante_rurale`
   - Username : `sante`
   - Password : `sante_pwd`

### Option 3 : DBeaver (Recommandé)

1. Installer DBeaver : https://dbeaver.io/download/
2. Nouvelle connexion PostgreSQL
3. Même configuration que pgAdmin

### Option 4 : psql (Ligne de commande)

```bash
psql -h localhost -U sante -d sante_rurale

# Voir les tables
\dt

# Voir les utilisateurs
SELECT id, nom, prenom, email, role, email_verified FROM users;

# Voir les patients
SELECT id, nom, prenom, sexe, village FROM patients LIMIT 10;

# Quitter
\q
```

---

## ⚠️ Dépannage

### Erreur : "No module named 'app'"

```bash
cd "/Users/djibrildabo/Documents/Santé Rurale/api"
source venv/bin/activate
pip install -r requirements.txt
```

### Erreur : "connection refused" sur PostgreSQL

```bash
# Vérifier que PostgreSQL est démarré
brew services list | grep postgresql

# Démarrer PostgreSQL
brew services start postgresql@16
```

### Erreur : "relation users does not exist"

Les tables n'ont pas été créées. Exécuter :

```bash
cd "/Users/djibrildabo/Documents/Santé Rurale/api"
./setup_database.sh
```

### Erreur : "CORS" dans le navigateur

Le backend doit être démarré sur le port 8000. Vérifier avec :

```bash
curl http://localhost:8000/api/auth/me
```

### Les emails ne sont pas envoyés

1. Vérifier que le backend est démarré
2. Vérifier les logs du backend pour voir les erreurs SMTP
3. Les emails sont envoyés via Gmail SMTP (crosssecmar@gmail.com)

---

## 📝 Fichiers modifiés

### Backend (API)

1. **`api/app/models.py`** - Ajout des champs email_verified, verification_token, reset_token
2. **`api/app/routers/auth.py`** - Nouveaux endpoints signup, verify-email, forgot-password, reset-password
3. **`api/alembic/versions/2025_10_28_add_email_verification_fields.py`** - Migration pour ajouter les champs
4. **`api/setup_database.sh`** - Script d'installation automatique

### Frontend (PWA)

1. **`pwa/src/services/authService.ts`** - NOUVEAU service utilisant l'API
2. **`pwa/src/contexts/AuthContext.tsx`** - Utilise authService au lieu de mockAuth
3. **`pwa/src/pages/SignupPage.tsx`** - Utilise authService
4. **`pwa/src/pages/EmailVerificationPage.tsx`** - Utilise authService
5. **`pwa/src/pages/ForgotPasswordPage.tsx`** - Utilise authService
6. **`pwa/src/pages/ResetPasswordPage.tsx`** - Utilise authService

### Fichiers obsolètes (peuvent être supprimés)

- ❌ `pwa/src/services/mockAuth.ts` - Plus utilisé, remplacé par authService.ts

---

## 🎉 Résumé

### Avant (localStorage)
```
❌ Données stockées dans le navigateur
❌ Pas de validation d'email
❌ Pas de réinitialisation de mot de passe
❌ Données perdues si cache supprimé
```

### Maintenant (PostgreSQL)
```
✅ Données dans une vraie base de données
✅ Validation d'email obligatoire
✅ Réinitialisation de mot de passe par email
✅ Données persistantes et sécurisées
✅ Accessible via pgAdmin/DBeaver
✅ Conforme aux standards de production
```

---

## 📞 Support

Si vous rencontrez un problème :

1. Vérifiez que PostgreSQL est démarré
2. Vérifiez que le backend (port 8000) est démarré
3. Vérifiez que le frontend (port 5173) est démarré
4. Consultez les logs du backend pour les erreurs
5. Consultez la console du navigateur pour les erreurs frontend

**Commandes utiles :**

```bash
# Statut PostgreSQL
brew services list | grep postgresql

# Logs backend (dans le terminal où uvicorn tourne)

# Logs frontend (dans le terminal où npm run dev tourne)

# Se connecter à PostgreSQL
psql -h localhost -U sante -d sante_rurale
```
