# Variables d'Environnement - Santé Rurale

Guide complet des variables d'environnement pour le déploiement en production.

## 📋 Table des Matières
1. [Backend (API FastAPI)](#backend-api-fastapi)
2. [Frontend (PWA React)](#frontend-pwa-react)
3. [Base de Données PostgreSQL](#base-de-données-postgresql)
4. [Services Externes](#services-externes)

---

## Backend (API FastAPI)

### Application

| Variable | Description | Valeur Dev | Valeur Prod | Requis |
|----------|-------------|------------|-------------|---------|
| `ENVIRONMENT` | Environnement d'exécution | `development` | `production` | ✅ |
| `DEBUG` | Mode debug | `true` | `false` | ✅ |
| `LOG_LEVEL` | Niveau de log | `DEBUG` | `INFO` ou `WARNING` | ✅ |
| `SECRET_KEY` | Clé secrète pour JWT | `dev_secret_key...` | **Générer une clé forte** | ✅ |
| `JWT_ALGORITHM` | Algorithme JWT | `HS256` | `RS256` (recommandé) | ✅ |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Durée token d'accès | `60` | `15` ou `30` | ❌ |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Durée refresh token | `7` | `7` ou `30` | ❌ |

### Base de Données

| Variable | Description | Valeur Dev | Valeur Prod | Requis |
|----------|-------------|------------|-------------|---------|
| `DATABASE_URL` | URL de connexion PostgreSQL | `postgresql+asyncpg://sante:sante_pwd@db:5432/sante_rurale` | **URL sécurisée en production** | ✅ |
| `DB_POOL_SIZE` | Taille du pool de connexions | `5` | `20` | ❌ |
| `DB_MAX_OVERFLOW` | Connexions supplémentaires | `10` | `40` | ❌ |

### Redis (Cache & Celery)

| Variable | Description | Valeur Dev | Valeur Prod | Requis |
|----------|-------------|------------|-------------|---------|
| `REDIS_URL` | URL Redis pour cache | `redis://:redis_pwd@redis:6379/0` | **URL sécurisée** | ✅ |
| `CELERY_BROKER_URL` | Broker Celery | `redis://:redis_pwd@redis:6379/1` | **URL sécurisée** | ✅ |
| `CELERY_RESULT_BACKEND` | Backend résultats Celery | `redis://:redis_pwd@redis:6379/2` | **URL sécurisée** | ✅ |

### Stockage S3/MinIO

| Variable | Description | Valeur Dev | Valeur Prod | Requis |
|----------|-------------|------------|-------------|---------|
| `S3_ENDPOINT_URL` | URL endpoint S3 | `http://minio:9000` | URL S3 AWS ou MinIO | ✅ |
| `S3_BUCKET_NAME` | Nom du bucket | `sante-rurale-mali` | `sante-rurale-mali-prod` | ✅ |
| `AWS_ACCESS_KEY_ID` | Clé d'accès AWS/MinIO | `minioadmin` | **Clé sécurisée** | ✅ |
| `AWS_SECRET_ACCESS_KEY` | Clé secrète AWS/MinIO | `minioadmin123` | **Secret sécurisé** | ✅ |
| `AWS_REGION` | Région AWS | - | `eu-west-1` (si AWS) | ❌ |

### Email (SMTP)

| Variable | Description | Valeur Dev | Valeur Prod | Requis |
|----------|-------------|------------|-------------|---------|
| `SMTP_HOST` | Serveur SMTP | `mailhog` | `smtp.example.com` | ✅ |
| `SMTP_PORT` | Port SMTP | `1025` | `587` ou `465` | ✅ |
| `SMTP_USER` | Utilisateur SMTP | - | `noreply@sante-rurale.ml` | ✅ |
| `SMTP_PASSWORD` | Mot de passe SMTP | - | **Password sécurisé** | ✅ |
| `SMTP_FROM_EMAIL` | Email expéditeur | `noreply@local.dev` | `noreply@sante-rurale.ml` | ✅ |
| `SMTP_FROM_NAME` | Nom expéditeur | `Santé Rurale Dev` | `Santé Rurale` | ❌ |

### Fonctionnalités

| Variable | Description | Valeur Dev | Valeur Prod | Requis |
|----------|-------------|------------|-------------|---------|
| `ENABLE_AUDIT_LOGS` | Activer les logs d'audit | `true` | `true` | ❌ |
| `ENABLE_OFFLINE_SYNC` | Activer la sync offline | `true` | `true` | ❌ |
| `ENABLE_DHIS2_EXPORT` | Activer export DHIS2 | `false` | `true` | ❌ |

### DHIS2 (Export données)

| Variable | Description | Valeur Dev | Valeur Prod | Requis |
|----------|-------------|------------|-------------|---------|
| `DHIS2_BASE_URL` | URL instance DHIS2 | `https://play.dhis2.org/2.39.1` | **URL production** | ⚠️ |
| `DHIS2_USERNAME` | Utilisateur DHIS2 | `admin` | **Utilisateur prod** | ⚠️ |
| `DHIS2_PASSWORD` | Mot de passe DHIS2 | `district` | **Password sécurisé** | ⚠️ |

⚠️ = Requis uniquement si `ENABLE_DHIS2_EXPORT=true`

---

## Frontend (PWA React)

### Application

| Variable | Description | Valeur Dev | Valeur Prod | Requis |
|----------|-------------|------------|-------------|---------|
| `VITE_API_URL` | URL de l'API backend | `http://localhost:8000/v1` | `https://api.sante-rurale.ml/v1` | ✅ |
| `VITE_ENVIRONMENT` | Environnement | `development` | `production` | ✅ |
| `VITE_APP_NAME` | Nom de l'application | `Santé Rurale Dev` | `Santé Rurale` | ❌ |
| `VITE_APP_VERSION` | Version de l'app | `1.0.0-dev` | `1.0.0` | ❌ |

### PWA

| Variable | Description | Valeur Dev | Valeur Prod | Requis |
|----------|-------------|------------|-------------|---------|
| `VITE_PWA_ENABLED` | Activer PWA | `true` | `true` | ❌ |
| `VITE_OFFLINE_ENABLED` | Activer mode offline | `true` | `true` | ❌ |

### Analytics (Optionnel)

| Variable | Description | Valeur Dev | Valeur Prod | Requis |
|----------|-------------|------------|-------------|---------|
| `VITE_GA_ID` | Google Analytics ID | - | `G-XXXXXXXXXX` | ❌ |
| `VITE_SENTRY_DSN` | Sentry DSN pour erreurs | - | `https://...@sentry.io/...` | ❌ |

---

## Base de Données PostgreSQL

### Configuration Serveur

| Variable | Description | Valeur Dev | Valeur Prod | Requis |
|----------|-------------|------------|-------------|---------|
| `POSTGRES_DB` | Nom de la base | `sante_rurale` | `sante_rurale` | ✅ |
| `POSTGRES_USER` | Utilisateur | `sante` | **Utilisateur prod** | ✅ |
| `POSTGRES_PASSWORD` | Mot de passe | `sante_pwd` | **Password fort** | ✅ |
| `POSTGRES_INITDB_ARGS` | Args d'initialisation | `--encoding=UTF8 --locale=fr_FR.UTF-8` | Identique | ❌ |

---

## Services Externes

### MinIO (S3-compatible)

| Variable | Description | Valeur Dev | Valeur Prod | Requis |
|----------|-------------|------------|-------------|---------|
| `MINIO_ROOT_USER` | Utilisateur admin MinIO | `minioadmin` | **User sécurisé** | ✅ |
| `MINIO_ROOT_PASSWORD` | Mot de passe admin | `minioadmin123` | **Password fort (min 8 car)** | ✅ |

### Redis

| Variable | Description | Valeur Dev | Valeur Prod | Requis |
|----------|-------------|------------|-------------|---------|
| `REDIS_PASSWORD` | Mot de passe Redis | `redis_pwd` | **Password fort** | ✅ |

---

## 🔐 Génération de Secrets Sécurisés

### Secret Key JWT (Python)
```python
import secrets
print(secrets.token_urlsafe(64))
```

### Password Sécurisé
```bash
openssl rand -base64 32
```

### Clés RSA pour JWT (Production)
```bash
# Génération de clés RSA
openssl genrsa -out private_key.pem 2048
openssl rsa -in private_key.pem -pubout -out public_key.pem
```

---

## 📝 Fichiers de Configuration

### Développement
- `docker-compose.dev.yml` - Contient toutes les variables de dev
- `.env.local` (frontend) - Variables Vite pour dev local

### Production
- `.env.production` (backend) - **À créer, ne pas committer**
- `.env.production` (frontend) - **À créer, ne pas committer**
- Utiliser des secrets Kubernetes/Docker Swarm en production

---

## ⚠️ Sécurité

### À NE JAMAIS faire:
- ❌ Committer les fichiers `.env` avec des secrets
- ❌ Utiliser les mots de passe par défaut en production
- ❌ Exposer les services internes (Redis, PostgreSQL) sur Internet
- ❌ Désactiver HTTPS en production

### À TOUJOURS faire:
- ✅ Utiliser des gestionnaires de secrets (AWS Secrets Manager, Vault, etc.)
- ✅ Changer tous les mots de passe par défaut
- ✅ Activer SSL/TLS pour toutes les connexions
- ✅ Limiter les accès réseau avec des firewalls
- ✅ Effectuer des backups réguliers de la base de données

---

## 📚 Ressources

- [FastAPI Settings Management](https://fastapi.tiangolo.com/advanced/settings/)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html)
- [OWASP Security Practices](https://owasp.org/www-project-top-ten/)

---

**Dernière mise à jour**: 2 Novembre 2025
