# Guide de Déploiement - Santé Rurale

Guide complet pour déployer l'application en production dans n'importe quelle région.

## 📋 Table des Matières
1. [Prérequis](#prérequis)
2. [Architecture de Déploiement](#architecture-de-déploiement)
3. [Déploiement Backend](#déploiement-backend)
4. [Déploiement Frontend](#déploiement-frontend)
5. [Configuration Base de Données](#configuration-base-de-données)
6. [Services Tiers](#services-tiers)
7. [Sécurité](#sécurité)
8. [Monitoring](#monitoring)
9. [Backup & Restauration](#backup--restauration)
10. [Troubleshooting](#troubleshooting)

---

## Prérequis

### Serveur de Production
- **OS**: Ubuntu 22.04 LTS ou Debian 11+
- **CPU**: Minimum 2 cores (4 cores recommandé)
- **RAM**: Minimum 4 GB (8 GB recommandé)
- **Stockage**: Minimum 50 GB SSD
- **Réseau**: IP publique avec ports 80/443 ouverts

### Logiciels Requis
```bash
# Docker & Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Docker Compose
sudo apt install docker-compose-plugin

# Nginx (reverse proxy)
sudo apt install nginx certbot python3-certbot-nginx

# PostgreSQL Client (pour les backups)
sudo apt install postgresql-client
```

### Noms de Domaine
Exemples (à adapter selon votre déploiement) :
- API: `api.votre-domaine.com` (ex: `api.sante-rurale.health`)
- Frontend: `app.votre-domaine.com` ou `votre-domaine.com`
- MinIO (optionnel): `s3.votre-domaine.com`

---

## Architecture de Déploiement

```
Internet
   │
   ▼
┌─────────────────┐
│  Nginx (HTTPS)  │  ← Port 443 (SSL)
│  Reverse Proxy  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────┐   ┌─────────┐
│ PWA │   │ FastAPI │  ← Port 8000
│React│   │ Backend │
└─────┘   └────┬────┘
               │
      ┌────────┼────────┬────────┐
      │        │        │        │
      ▼        ▼        ▼        ▼
  ┌──────┐ ┌─────┐  ┌──────┐ ┌──────┐
  │ Postgres│ Redis│  │ MinIO│ │Celery│
  └──────┘ └─────┘  └──────┘ └──────┘
```

---

## Déploiement Backend

### 1. Préparation du Serveur

```bash
# Créer un utilisateur dédié
sudo useradd -m -s /bin/bash sante
sudo usermod -aG docker sante

# Créer les répertoires
sudo mkdir -p /opt/sante-rurale/{api,data,logs,backups}
sudo chown -R sante:sante /opt/sante-rurale
```

### 2. Cloner le Projet

```bash
su - sante
cd /opt/sante-rurale
git clone https://github.com/votre-org/sante-rurale.git app
cd app
```

### 3. Configuration des Secrets

```bash
# Créer le fichier de production
cp .env.example .env.production

# Éditer avec des valeurs sécurisées
nano .env.production
```

Exemple `.env.production`:
```bash
# Application
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO
SECRET_KEY=<générer-avec-secrets.token_urlsafe(64)>

# Base de données
DATABASE_URL=postgresql+asyncpg://sante_prod:STRONG_PASSWORD@db:5432/sante_rurale_prod

# Redis
REDIS_URL=redis://:REDIS_PASSWORD@redis:6379/0

# S3/MinIO
S3_ENDPOINT_URL=https://s3.sante-rurale.ml
AWS_ACCESS_KEY_ID=<access-key>
AWS_SECRET_ACCESS_KEY=<secret-key>

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@sante-rurale.ml
SMTP_PASSWORD=<smtp-password>

# Features
ENABLE_AUDIT_LOGS=true
ENABLE_OFFLINE_SYNC=true
```

### 4. Docker Compose Production

Créer `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    container_name: sante_db_prod
    restart: always
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - /opt/sante-rurale/data/postgres:/var/lib/postgresql/data
      - ./api/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
    networks:
      - sante_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 30s
      timeout: 10s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: sante_redis_prod
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - /opt/sante-rurale/data/redis:/data
    networks:
      - sante_network

  minio:
    image: minio/minio:latest
    container_name: sante_minio_prod
    restart: always
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - /opt/sante-rurale/data/minio:/data
    networks:
      - sante_network

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
      target: production
    container_name: sante_api_prod
    restart: always
    env_file:
      - .env.production
    volumes:
      - /opt/sante-rurale/logs/api:/app/logs
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - sante_network
    ports:
      - "127.0.0.1:8000:8000"

  celery:
    build:
      context: ./api
      dockerfile: Dockerfile
      target: production
    container_name: sante_celery_prod
    restart: always
    command: celery -A app.celery_app worker --loglevel=info
    env_file:
      - .env.production
    depends_on:
      - db
      - redis
    networks:
      - sante_network

networks:
  sante_network:
    driver: bridge
```

### 5. Lancement

```bash
# Build et démarrage
docker-compose -f docker-compose.prod.yml up -d

# Vérifier les logs
docker-compose -f docker-compose.prod.yml logs -f api

# Initialiser les données
docker exec sante_api_prod python scripts/seed_base_data.py
docker exec sante_api_prod python scripts/create_production_users.py
```

---

## Déploiement Frontend

### 1. Build de Production

```bash
cd pwa

# Installer les dépendances
npm ci --production=false

# Build
VITE_API_URL=https://api.sante-rurale.ml/v1 \
VITE_ENVIRONMENT=production \
npm run build

# Le build est dans dist/
```

### 2. Déploiement avec Nginx

```bash
# Copier les fichiers
sudo cp -r dist/* /var/www/sante-rurale/

# Configuration Nginx
sudo nano /etc/nginx/sites-available/sante-rurale
```

Configuration Nginx:
```nginx
# Frontend
server {
    listen 80;
    server_name sante-rurale.ml www.sante-rurale.ml;

    # Redirection HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name sante-rurale.ml www.sante-rurale.ml;

    # SSL
    ssl_certificate /etc/letsencrypt/live/sante-rurale.ml/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sante-rurale.ml/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /var/www/sante-rurale;
    index index.html;

    # PWA - Cache headers
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Service Worker
    location /sw.js {
        add_header Cache-Control "no-cache";
        proxy_cache_bypass $http_pragma;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}

# API Backend
server {
    listen 80;
    server_name api.sante-rurale.ml;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.sante-rurale.ml;

    ssl_certificate /etc/letsencrypt/live/api.sante-rurale.ml/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.sante-rurale.ml/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 3. SSL avec Let's Encrypt

```bash
# Obtenir les certificats
sudo certbot --nginx -d sante-rurale.ml -d www.sante-rurale.ml
sudo certbot --nginx -d api.sante-rurale.ml

# Renouvellement automatique (cron)
sudo crontab -e
# Ajouter:
0 12 * * * /usr/bin/certbot renew --quiet
```

### 4. Activation

```bash
sudo ln -s /etc/nginx/sites-available/sante-rurale /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Configuration Base de Données

### 1. Backups Automatiques

```bash
# Script de backup
sudo nano /opt/sante-rurale/scripts/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/sante-rurale/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="sante_rurale_prod"

# Backup
docker exec sante_db_prod pg_dump -U sante_prod $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Garder seulement les 30 derniers jours
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

```bash
chmod +x /opt/sante-rurale/scripts/backup-db.sh

# Cron quotidien à 2h du matin
crontab -e
0 2 * * * /opt/sante-rurale/scripts/backup-db.sh >> /opt/sante-rurale/logs/backup.log 2>&1
```

### 2. Monitoring PostgreSQL

```bash
# Connexions actives
docker exec sante_db_prod psql -U sante_prod -d sante_rurale_prod -c "SELECT count(*) FROM pg_stat_activity;"

# Taille de la base
docker exec sante_db_prod psql -U sante_prod -d sante_rurale_prod -c "SELECT pg_size_pretty(pg_database_size('sante_rurale_prod'));"
```

---

## Services Tiers

### Serveur SMTP (Exemple: Mailgun)

```bash
# Configuration dans .env.production
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@sante-rurale.ml
SMTP_PASSWORD=<mailgun-password>
SMTP_FROM_EMAIL=noreply@sante-rurale.ml
```

### Stockage S3 (Alternative à MinIO)

```bash
# AWS S3
S3_ENDPOINT_URL=  # Laisser vide pour AWS
S3_BUCKET_NAME=sante-rurale-prod
AWS_ACCESS_KEY_ID=<aws-access-key>
AWS_SECRET_ACCESS_KEY=<aws-secret-key>
AWS_REGION=eu-west-1
```

---

## Sécurité

### 1. Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. Fail2Ban

```bash
sudo apt install fail2ban

# Configuration
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true
```

### 3. Rotation des Logs

```bash
sudo nano /etc/logrotate.d/sante-rurale
```

```
/opt/sante-rurale/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 sante sante
    sharedscripts
    postrotate
        docker-compose -f /opt/sante-rurale/app/docker-compose.prod.yml restart api
    endscript
}
```

---

## Monitoring

### 1. Health Check Endpoints

```bash
# API Health
curl https://api.sante-rurale.ml/health

# Database connection
curl https://api.sante-rurale.ml/health/db
```

### 2. Uptime Monitoring

Services recommandés:
- UptimeRobot (gratuit)
- Pingdom
- StatusCake

### 3. Logs Centralisés

```bash
# Voir les logs en temps réel
docker-compose -f docker-compose.prod.yml logs -f

# Logs spécifiques
docker logs sante_api_prod --tail 100
docker logs sante_db_prod --tail 100
```

---

## Backup & Restauration

### Backup Complet

```bash
# Base de données
/opt/sante-rurale/scripts/backup-db.sh

# Fichiers MinIO/S3
docker exec sante_minio_prod mc mirror /data /backup/minio

# Configuration
tar -czf /opt/sante-rurale/backups/config_$(date +%Y%m%d).tar.gz \
    /opt/sante-rurale/app/.env.production \
    /etc/nginx/sites-available/sante-rurale
```

### Restauration

```bash
# Restaurer la base de données
gunzip < /opt/sante-rurale/backups/backup_YYYYMMDD_HHMMSS.sql.gz | \
docker exec -i sante_db_prod psql -U sante_prod sante_rurale_prod

# Redémarrer les services
docker-compose -f docker-compose.prod.yml restart
```

---

## Troubleshooting

### Problème: API ne répond pas

```bash
# Vérifier le statut
docker ps
docker-compose -f docker-compose.prod.yml ps

# Logs
docker logs sante_api_prod --tail 50

# Redémarrer
docker-compose -f docker-compose.prod.yml restart api
```

### Problème: Base de données pleine

```bash
# Vérifier l'espace disque
df -h

# Nettoyer les anciens backups
find /opt/sante-rurale/backups -mtime +30 -delete

# Vacuum PostgreSQL
docker exec sante_db_prod psql -U sante_prod -d sante_rurale_prod -c "VACUUM FULL ANALYZE;"
```

### Problème: Certificat SSL expiré

```bash
# Vérifier l'expiration
sudo certbot certificates

# Renouveler manuellement
sudo certbot renew

# Redémarrer Nginx
sudo systemctl reload nginx
```

---

## Checklist de Déploiement

- [ ] Serveur configuré avec Docker
- [ ] Noms de domaine configurés (DNS)
- [ ] Variables d'environnement sécurisées
- [ ] Certificats SSL installés
- [ ] Base de données initialisée
- [ ] Utilisateurs de production créés
- [ ] Backups automatiques configurés
- [ ] Firewall configuré
- [ ] Monitoring activé
- [ ] Logs rotationnés
- [ ] Documentation équipe fournie
- [ ] Tests de charge effectués

---

## Support et Maintenance

### Mises à Jour

```bash
# Pull dernières modifications
cd /opt/sante-rurale/app
git pull origin main

# Rebuild et redéployer
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Migrations de base de données (si nécessaire)
docker exec sante_api_prod alembic upgrade head
```

### Contacts

- Support technique: support@sante-rurale.ml
- Urgences: +223 XX XX XX XX
- Documentation: https://docs.sante-rurale.ml

---

**Dernière mise à jour**: 2 Novembre 2025
**Version**: 1.0.0
