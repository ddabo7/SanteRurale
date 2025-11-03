# Santé Rurale - PWA Offline-First

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11+-green.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-teal.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)

> Solution de gestion de santé pour zones rurales à connectivité limitée. PWA offline-first avec synchronisation automatique, exports DHIS2 et interopérabilité FHIR R4.

---

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Démarrage rapide](#démarrage-rapide)
- [Architecture](#architecture)
- [Fonctionnalités](#fonctionnalités)
- [Synchronisation Offline-First](#synchronisation-offline-first)
- [Documentation](#documentation)
- [Utilisateurs de production](#utilisateurs-de-production)
- [Tests](#tests)
- [Contribution](#contribution)
- [Licence](#licence)

---

## 🎯 Vue d'ensemble

**Santé Rurale** est une Progressive Web App (PWA) conçue pour permettre aux soignants en zones rurales de gérer les dossiers patients même en l'absence de connexion internet.

### Problématique

Les zones rurales à travers le monde partagent des défis similaires :
- **Connectivité 2G/3G intermittente** : coupures réseau fréquentes
- **Rapportage obligatoire** : exports vers systèmes nationaux (DHIS2, etc.)
- **Continuité des soins** : nécessité de maintenir un historique patient complet
- **Matériel limité** : smartphones Android bas/moyen de gamme

### Cas d'usage
- Centres de santé en zones rurales (Afrique, Amérique latine, Asie)
- Cliniques mobiles et missions humanitaires
- Camps de réfugiés
- Zones à infrastructure limitée

### Solution

- ✅ **Offline-first** : fonctionne 100% hors-ligne avec synchronisation automatique bidirectionnelle
- ✅ **Dossier patient minimal** : nom, sexe, âge, village, téléphone
- ✅ **Consultations complètes** : signes vitaux, diagnostics CIM-10, ordonnances, actes
- ✅ **Synchronisation robuste** : outbox pattern, gestion de conflits, retry automatique, idempotence
- ✅ **Exports DHIS2** : agrégation mensuelle et envoi automatisé
- ✅ **Interopérabilité FHIR R4** : Patient, Encounter, Condition, MedicationRequest

---

## 🚀 Démarrage rapide

```bash
# 1. Cloner le repo
git clone https://github.com/your-org/sante-rurale.git
cd sante-rurale

# 2. Démarrer avec Docker Compose
docker-compose up -d

# 3. Initialiser la base de données
docker exec sante_api alembic upgrade head

# 4. Créer les données de base (régions, districts, sites)
docker exec -e DATABASE_URL="postgresql+asyncpg://sante:sante_pwd@db:5432/sante_rurale" sante_api python scripts/seed_base_data.py

# 5. Créer les utilisateurs de production
docker exec -e DATABASE_URL="postgresql+asyncpg://sante:sante_pwd@db:5432/sante_rurale" sante_api python scripts/create_production_users.py
```

**Accès** :
- 🌐 **API**: http://localhost:8000
- 📖 **Docs API**: http://localhost:8000/docs
- 💻 **PWA**: http://localhost:5173
- 🗄️ **Base de données** (Adminer): http://localhost:8080

---

## 🏗️ Architecture

### Stack technique

**Frontend (PWA)**:
- React 18 + TypeScript
- Vite (build & dev server)
- **Dexie.js** (IndexedDB pour stockage offline)
- **Service Workers** (cache & offline)
- TailwindCSS (UI)
- React Router (navigation)

**Backend (API)**:
- FastAPI (Python 3.11+)
- PostgreSQL 16
- SQLAlchemy 2.0 (ORM async)
- Alembic (migrations)
- JWT Authentication (RS256)

**Infrastructure**:
- Docker / Docker Compose (dev & prod)
- Nginx (reverse proxy)
- MinIO (stockage S3-compatible)

### Architecture Offline-First

```
┌─────────────────────────────────────────────────────┐
│                   Application PWA                    │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────┐           ┌──────────────┐        │
│  │   UI/Pages  │────────▶│  API Service  │        │
│  └─────────────┘           └──────┬───────┘        │
│                                    │                 │
│                           ┌────────▼────────┐       │
│                           │  Sync Service   │       │
│                           └────────┬────────┘       │
│                                    │                 │
│                    ┌───────────────┼────────┐       │
│                    │               │        │       │
│            ┌───────▼──────┐ ┌─────▼────┐  │       │
│            │  IndexedDB   │ │  Outbox  │  │       │
│            │   (Dexie)    │ │  Queue   │  │       │
│            └──────────────┘ └──────────┘  │       │
│                                            │       │
└────────────────────────────────────────────┼───────┘
                                             │
                                    ┌────────▼────────┐
                                    │  FastAPI Backend│
                                    │   PostgreSQL    │
                                    └─────────────────┘
```

**Voir [OFFLINE_SYNC_GUIDE.md](OFFLINE_SYNC_GUIDE.md) pour la documentation complète.**

---

## ✨ Fonctionnalités

### Implémenté ✅

- [x] **Authentification** : JWT (RS256), refresh tokens, RBAC (admin, medecin, major, soignant)
- [x] **Patients** : Création, modification, recherche (offline-first avec IndexedDB)
- [x] **Consultations** : Enregistrement avec signes vitaux, diagnostics, ordonnances, actes
- [x] **Synchronisation bidirectionnelle** :
  - Push local → serveur (outbox pattern)
  - Pull serveur → local
  - Détection automatique de connectivité
  - Sync toutes les 2 minutes + au retour en ligne
  - Indicateur visuel de statut
- [x] **Références** : Transferts vers hôpital
- [x] **Rapports** : Statistiques par site
- [x] **Gestion des sites** : Régions, districts, centres de santé

### Post-MVP (V2)

- [ ] Gestion de stock pharmacie
- [ ] Télésanté (store-and-forward photos)
- [ ] Courbes de croissance
- [ ] Suivi prénatal
- [ ] Carnet de vaccination
- [ ] Support multilingue (Bambara)
- [ ] Exports DHIS2

---

## 🔄 Synchronisation Offline-First

### Stratégie

L'application utilise une approche **offline-first** complète :

1. **Écriture locale immédiate** (Optimistic UI)
   - Toutes les créations/modifications sont sauvegardées localement d'abord
   - L'interface se met à jour instantanément
   - Meilleure expérience utilisateur

2. **Outbox Pattern**
   - Les opérations sont ajoutées à une queue locale
   - Chaque opération a une clé d'idempotence
   - Garantit qu'une opération n'est exécutée qu'une seule fois

3. **Synchronisation bidirectionnelle**
   - **Push** : Envoi des modifications locales vers le serveur
   - **Pull** : Récupération des données du serveur
   - Automatique en arrière-plan

4. **Gestion des conflits**
   - Utilisation de numéros de version
   - Le serveur fait autorité en cas de conflit

### Composants

- **[pwa/src/services/syncService.ts](pwa/src/services/syncService.ts)** : Service principal de synchronisation
- **[pwa/src/contexts/SyncContext.tsx](pwa/src/contexts/SyncContext.tsx)** : Contexte React global
- **[pwa/src/hooks/useSync.ts](pwa/src/hooks/useSync.ts)** : Hooks React pour la sync
- **[pwa/src/components/SyncIndicator.tsx](pwa/src/components/SyncIndicator.tsx)** : Indicateur visuel
- **[pwa/src/db/index.ts](pwa/src/db/index.ts)** : Base de données locale (IndexedDB)

**Documentation complète** : Voir [OFFLINE_SYNC_GUIDE.md](OFFLINE_SYNC_GUIDE.md)

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[OFFLINE_SYNC_GUIDE.md](OFFLINE_SYNC_GUIDE.md)** | **Guide complet de la synchronisation offline-first** |
| **[MULTI_COUNTRY_SETUP.md](MULTI_COUNTRY_SETUP.md)** | **Configuration multi-pays et adaptation régionale** |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | Guide de déploiement en production |
| [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) | Variables d'environnement (dev & prod) |
| [PRODUCTION_CREDENTIALS.md](PRODUCTION_CREDENTIALS.md) | Identifiants des utilisateurs de production |
| [API Documentation](http://localhost:8000/docs) | Documentation interactive de l'API (Swagger) |

---

## 👥 Utilisateurs de démonstration

Des utilisateurs de démonstration peuvent être créés automatiquement lors de l'initialisation :

| Rôle | Email | Mot de passe | Site |
|------|-------|--------------|------|
| Admin | admin@sante-rurale.health | `AdminSecure2025!` | Centre de santé de démonstration |
| Médecin | medecin@sante-rurale.health | `MedecinDemo2025!` | Centre de santé de démonstration |
| Major | major@sante-rurale.health | `MajorDemo2025!` | Centre de santé de démonstration |
| Soignant | soignant@sante-rurale.health | `SoignantDemo2025!` | Centre de santé de démonstration |

⚠️ **IMPORTANT** : Changer tous les mots de passe après la première connexion !

**Voir [PRODUCTION_CREDENTIALS.md](PRODUCTION_CREDENTIALS.md) pour plus de détails.**

---

## 🧪 Tests

### Test de synchronisation offline

1. Ouvrir l'application en ligne
2. Ouvrir DevTools → Network → **Offline**
3. Créer un nouveau patient
4. Créer une consultation
5. Vérifier que tout fonctionne localement
6. Revenir **Online**
7. Attendre la synchronisation automatique (ou cliquer sur l'indicateur)
8. Vérifier que les données sont sur le serveur

### Commandes de debug

```javascript
// Dans la console du navigateur

// Voir les données locales
await db.patients.toArray()
await db.encounters.toArray()

// Voir l'outbox
await db.outbox.where('processed').equals(0).toArray()

// Voir les éléments non synchronisés
await db.getUnsyncedCount()

// Forcer une synchronisation
await syncService.forceSync()

// Statut de synchronisation
await syncService.getStatus()
```

---

## 🌍 Déploiement Production

### 🚀 Déploiement sur Hostinger VPS (Recommandé)

**Nouveau** : Déploiement automatisé en 15 minutes !

```bash
# 1. Connectez-vous au serveur
ssh root@votre-ip-serveur

# 2. Téléchargez le projet
git clone https://github.com/your-org/sante-rurale.git
cd sante-rurale/deployment

# 3. Lancez le script de déploiement
chmod +x deploy.sh
sudo ./deploy.sh --full --domain votre-domaine.com
```

**C'est tout !** Le script installe et configure automatiquement :
- ✅ Python 3.12, Node.js 20, PostgreSQL 14, Nginx
- ✅ Backend FastAPI avec systemd
- ✅ Frontend React PWA (build de production)
- ✅ SSL/HTTPS avec Let's Encrypt
- ✅ Backups automatiques quotidiens
- ✅ Monitoring et logs

### 📚 Documentation de Déploiement

| Guide | Description | Temps Estimé |
|-------|-------------|--------------|
| **[deployment/QUICK_START.md](deployment/QUICK_START.md)** | 🚀 Déploiement rapide (automatisé) | 5-15 min |
| **[deployment/README.md](deployment/README.md)** | 📘 Guide complet étape par étape | 30-60 min |
| **[deployment/INDEX.md](deployment/INDEX.md)** | 📖 Index et navigation de la documentation | - |
| **[deployment/CHECKLIST_DEPLOIEMENT.md](deployment/CHECKLIST_DEPLOIEMENT.md)** | ✅ Checklist complète de déploiement | - |
| **[DEPLOIEMENT_HOSTINGER.md](DEPLOIEMENT_HOSTINGER.md)** | 🌐 Guide détaillé Hostinger VPS | 45-90 min |
| **[HTTPS_SSL_GUIDE.md](HTTPS_SSL_GUIDE.md)** | 🔒 Configuration SSL/TLS | 15-30 min |
| **[MONITORING_GUIDE.md](MONITORING_GUIDE.md)** | 📊 Sentry + Prometheus + Grafana | 30-45 min |
| **[PRODUCTION_READINESS_REPORT.md](PRODUCTION_READINESS_REPORT.md)** | ✅ Rapport complet de préparation production | - |
| **[RESUME_FINAL_DEPLOIEMENT.md](RESUME_FINAL_DEPLOIEMENT.md)** | 📋 Résumé final et fichiers créés | - |

### 🛠️ Fichiers de Configuration

Tous les fichiers nécessaires sont dans le dossier `deployment/` :

- **deploy.sh** - Script de déploiement automatisé
- **sante-rurale-api.service** - Service systemd pour le backend
- **nginx-sante-rurale.conf** - Configuration Nginx complète
- **.env.production.example** - Variables d'environnement backend
- **.env.frontend.production.example** - Variables d'environnement frontend

### ⚡ Déploiement Docker (Alternative)

```bash
# 1. Configurer les variables d'environnement
cp .env.example .env.production
# Éditer .env.production avec les valeurs de production

# 2. Générer les clés JWT
mkdir -p api/keys
openssl genrsa -out api/keys/jwt-private.pem 4096
openssl rsa -in api/keys/jwt-private.pem -pubout -out api/keys/jwt-public.pem

# 3. Build et déploiement
docker-compose -f docker-compose.prod.yml up -d

# 4. Initialiser la base de données
docker exec sante_api alembic upgrade head
docker exec sante_api python scripts/seed_base_data.py
docker exec sante_api python scripts/create_production_users.py
```

### 📊 Production Ready

✅ **Tests** : 70+ tests backend (pytest), 15+ tests frontend (vitest), 25+ tests E2E (Playwright)
✅ **Sécurité** : Rate limiting, Security headers, HTTPS/SSL, CORS
✅ **Monitoring** : Sentry (erreurs), Prometheus (métriques), Grafana (dashboards)
✅ **Documentation** : 3,600+ lignes de documentation complète

---

## 🤝 Contribution

### Workflow

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Commit vos changements (`git commit -m 'feat: add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

### Standards de code

- **Python** : Black (formatage), Ruff (linting), mypy (types)
- **TypeScript** : ESLint, Prettier
- **Commits** : Conventional Commits (`feat:`, `fix:`, `docs:`, etc.)

---

## 📄 Licence

Ce projet est sous licence **MIT**. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

## 🙏 Remerciements

- **DHIS2 Community** pour les ressources et l'expertise
- **Tous les soignants** en zones rurales à travers le monde qui testent et utilisent l'application
- **Ministères de la Santé** des pays pilotes pour leur soutien institutionnel

---

**Fait avec ❤️ pour la santé rurale mondiale**

**Version** : 1.0.0
**Dernière mise à jour** : 2 Novembre 2025
**Déploiements** : déploiement pilote, autres pays à venir
