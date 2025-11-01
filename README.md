<<<<<<< HEAD
# SanteRurale
=======
# Santé Rurale Mali - PWA Offline-First

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11+-green.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-teal.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)

> PWA offline-first pour la gestion des dossiers patients en zones rurales du Mali avec synchronisation opportuniste, exports DHIS2 et interopérabilité FHIR R4.

---

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Architecture](#architecture)
- [Fonctionnalités](#fonctionnalités)
- [Prérequis](#prérequis)
- [Installation locale](#installation-locale)
- [Déploiement production](#déploiement-production)
- [Documentation](#documentation)
- [Tests](#tests)
- [Contribution](#contribution)
- [Licence](#licence)

---

## 🎯 Vue d'ensemble

**Santé Rurale Mali** est une Progressive Web App (PWA) conçue pour permettre aux soignants en zones rurales du Mali de gérer les dossiers patients même en l'absence de connexion internet.

### Problématique

- **Connectivité 2G/3G intermittente** : zones rurales avec coupures réseau fréquentes
- **Rapportage DHIS2 obligatoire** : export mensuel vers le système national
- **Continuité des soins** : nécessité de maintenir un historique patient complet
- **Matériel limité** : smartphones Android bas/moyen de gamme

### Solution

- ✅ **Offline-first** : fonctionne 100% hors-ligne avec synchronisation automatique
- ✅ **Dossier patient minimal** : nom, sexe, âge, village, téléphone
- ✅ **Consultations complètes** : signes vitaux, diagnostics CIM-10, ordonnances, actes
- ✅ **Synchronisation robuste** : gestion de conflits, retry automatique, idempotence
- ✅ **Exports DHIS2** : agrégation mensuelle et envoi automatisé
- ✅ **Interopérabilité FHIR R4** : Patient, Encounter, Condition, MedicationRequest

---

## 🏗️ Architecture

### Stack technique

**Frontend (PWA)**:
- React 18 + TypeScript
- Vite (build)
- Workbox (Service Worker / offline)
- Dexie.js (IndexedDB)
- TailwindCSS (UI)

**Backend (API)**:
- FastAPI (Python 3.11+)
- PostgreSQL 16
- Redis (cache + queue Celery)
- S3/MinIO (attachments)

**Infrastructure**:
- Docker / Docker Compose (dev)
- AWS ECS Fargate (prod)
- RDS PostgreSQL Multi-AZ
- ElastiCache Redis
- Terraform (IaC)

**Observabilité**:
- Prometheus + Grafana
- Sentry
- CloudWatch Logs

### Diagramme d'architecture

Voir [docs/architecture.md](docs/architecture.md) pour les diagrammes détaillés.

---

## ✨ Fonctionnalités

### MVP (Version 1.0)

- [x] **Patients** : Créer, modifier, rechercher (offline)
- [x] **Consultations** : Enregistrer avec signes vitaux, diagnostics, ordonnances, actes
- [x] **Synchronisation** : Queue locale (outbox), sync auto, gestion de conflits
- [x] **Références** : Transférer vers hôpital avec notification SMS (non-clinique)
- [x] **Rapports** : Statistiques site, top diagnostics, export CSV
- [x] **DHIS2** : Export mensuel automatisé avec validation
- [x] **Authentification** : JWT (RS256), refresh tokens, RBAC
- [x] **Audit** : Logs complets (qui, quand, quoi)

### Post-MVP (V2)

- [ ] Gestion de stock pharmacie
- [ ] Télésanté (store-and-forward photos)
- [ ] Courbes de croissance
- [ ] Suivi prénatal
- [ ] Carnet de vaccination
- [ ] Support multilingue (Bambara)

---

## 📦 Prérequis

### Développement local

- **Docker** : 20.10+
- **Docker Compose** : 2.0+
- **Node.js** : 18+ (si dev frontend sans Docker)
- **Python** : 3.11+ (si dev backend sans Docker)

### Production

- Compte **AWS** (ou infrastructure équivalente)
- **Terraform** : 1.6+
- Nom de domaine configuré
- Certificat SSL (Let's Encrypt ou ACM)

---

## 🚀 Installation locale

### Option 1 : Script automatique (recommandé)

```bash
# 1. Cloner le repo
git clone https://github.com/your-org/sante-rurale-mali.git
cd sante-rurale-mali

# 2. Lancer le script de configuration (tout automatique)
./setup.sh
```

Le script `setup.sh` va automatiquement :
- ✅ Créer le fichier `.env` avec les bonnes valeurs de développement
- ✅ Générer les clés JWT RSA
- ✅ Démarrer tous les services Docker
- ✅ Initialiser la base de données
- ✅ Vérifier que tout fonctionne

**Accès** :
- API: http://localhost:8000
- Docs API: http://localhost:8000/docs
- PWA: http://localhost:5173
- MinIO Console: http://localhost:9001
- Adminer (DB): http://localhost:8080

### Option 2 : Manuel

```bash
# Si vous préférez tout faire à la main

# 1. Créer le .env
cat > .env << 'EOF'
# (Copier le contenu depuis setup.sh)
EOF

# 2. Générer les clés JWT
mkdir -p api/keys
openssl genrsa -out api/keys/jwt-private.pem 4096
openssl rsa -in api/keys/jwt-private.pem -pubout -out api/keys/jwt-public.pem

# 3. Lancer Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# 4. Initialiser la base
docker-compose -f docker-compose.dev.yml exec api alembic upgrade head
```

### Option 3 : Sans Docker (développement backend/frontend séparé)

<details>
<summary>Cliquer pour voir les instructions détaillées</summary>

#### Backend

```bash
cd api/

# Créer un environnement virtuel
python3.11 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Installer les dépendances
pip install -r requirements.txt

# Lancer PostgreSQL et Redis localement (ou via Docker)
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=sante_pwd postgres:16
docker run -d -p 6379:6379 redis:7-alpine

# Le fichier .env est déjà configuré
# Éditer DATABASE_URL, REDIS_URL, etc. si nécessaire

# Lancer les migrations
alembic upgrade head

# Lancer le serveur de dev
uvicorn app.main:app --reload
```

#### Frontend

```bash
cd pwa/

# Installer les dépendances
npm install

# Lancer le dev server
npm run dev

# Accéder à http://localhost:5173
```

</details>

---

## 🌍 Déploiement production

### Préparation

```bash
# 1. Créer un backend S3 pour Terraform state
aws s3 mb s3://sante-rurale-terraform-state --region eu-west-1
aws dynamodb create-table \
    --table-name terraform-lock \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST

# 2. Configurer Terraform backend
cd terraform/
# Décommenter le bloc backend "s3" dans main.tf

terraform init
```

### Déploiement infrastructure

```bash
cd terraform/

# Planifier
terraform plan -var="environment=production"

# Appliquer
terraform apply -var="environment=production"

# Noter les outputs (RDS endpoint, Redis endpoint, etc.)
```

### Déploiement application

```bash
# 1. Build et push des images Docker
cd api/
docker build -t sante-rurale-api:latest --target production .
docker tag sante-rurale-api:latest <YOUR_ECR>/sante-rurale-api:latest
docker push <YOUR_ECR>/sante-rurale-api:latest

cd ../pwa/
docker build -t sante-rurale-pwa:latest .
docker tag sante-rurale-pwa:latest <YOUR_ECR>/sante-rurale-pwa:latest
docker push <YOUR_ECR>/sante-rurale-pwa:latest

# 2. Déployer sur ECS (via Terraform ou AWS CLI)
# Voir docs/operations-runbooks.md pour les détails

# 3. Configurer le DNS (Route53)
# Pointer api.sante-rurale.ml vers l'ALB
```

### Post-déploiement

```bash
# 1. Vérifier la santé de l'API
curl https://api.sante-rurale.ml/health

# 2. Créer le premier utilisateur admin
# (via script ou interface admin)

# 3. Configurer les alertes Prometheus/Grafana

# 4. Activer les sauvegardes automatiques RDS

# 5. Planifier le premier test de restauration
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | Diagrammes d'architecture, stack technique, modèle de données |
| [OpenAPI Spec](api/openapi.yaml) | Spécification complète de l'API REST |
| [Schéma SQL](api/schema.sql) | Schéma PostgreSQL avec indexes et contraintes |
| [FHIR & DHIS2](docs/fhir-dhis2-interoperability.md) | Mapping FHIR R4 et exports DHIS2 |
| [Operations & Runbooks](docs/operations-runbooks.md) | Procédures opérationnelles, SLO/SLA, incidents |
| [Backlog MVP](docs/backlog-mvp.md) | User stories détaillées avec DoR/DoD |
| [Déploiement & Formation](docs/deployment-training-plan.md) | Plan de déploiement pilote et formation |

---

## 🧪 Tests

### Tests unitaires (Backend)

```bash
cd api/
pytest tests/ -v --cov=app --cov-report=html
```

### Tests E2E (Frontend)

```bash
cd pwa/
npm run test:e2e

# Ou pour lancer Playwright UI
npx playwright test --ui
```

### Tests d'intégration

```bash
# Lancer avec Docker Compose
docker-compose -f docker-compose.dev.yml up -d
cd tests/integration/
pytest test_api_integration.py -v
```

### Test de charge (k6)

```bash
k6 run tests/load/consultation_workflow.js
```

---

## 🤝 Contribution

### Workflow

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Commit vos changements (`git commit -m 'Add amazing feature'`)
4. Push vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

### Standards de code

- **Python** : Black (formatage), Ruff (linting), mypy (types)
- **TypeScript** : ESLint, Prettier
- **Commits** : Conventional Commits (`feat:`, `fix:`, `docs:`, etc.)

### Revue de code

- Toute PR doit avoir au moins 1 approbation
- Les tests doivent passer (CI/CD)
- La couverture de tests ne doit pas diminuer

---

## 📧 Support

- **Email** : support@sante-rurale.ml
- **WhatsApp** : +223 XX XX XX XX (heures ouvrables)
- **Issues GitHub** : [github.com/your-org/sante-rurale-mali/issues](https://github.com/your-org/sante-rurale-mali/issues)

---

## 📄 Licence

Ce projet est sous licence **MIT**. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

## 🙏 Remerciements

- **Ministère de la Santé du Mali** pour le soutien institutionnel
- **DHIS2 Community** pour les ressources et l'expertise
- **Tous les soignants** en zones rurales qui testent et utilisent l'application au quotidien

---

## 📊 Statistiques du projet

![GitHub stars](https://img.shields.io/github/stars/your-org/sante-rurale-mali?style=social)
![GitHub forks](https://img.shields.io/github/forks/your-org/sante-rurale-mali?style=social)
![GitHub issues](https://img.shields.io/github/issues/your-org/sante-rurale-mali)
![GitHub pull requests](https://img.shields.io/github/issues-pr/your-org/sante-rurale-mali)

---

**Fait avec ❤️ pour la santé rurale au Mali**
>>>>>>> eb71c8c (Initial commit)
