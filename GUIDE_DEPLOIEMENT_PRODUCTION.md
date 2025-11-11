# Guide de Déploiement Production - Santé Rurale

## Table des matières
1. [Prérequis](#prérequis)
2. [Préparation du serveur](#préparation-du-serveur)
3. [Configuration des secrets](#configuration-des-secrets)
4. [Déploiement de l'application](#déploiement-de-lapplication)
5. [Configuration HTTPS](#configuration-https)
6. [Backups automatiques](#backups-automatiques)
7. [Monitoring et logs](#monitoring-et-logs)
8. [Post-déploiement](#post-déploiement)

---

## Prérequis

### Serveur
- **OS**: Ubuntu 22.04 LTS ou Debian 11+
- **RAM**: Minimum 4 GB (8 GB recommandé)
- **CPU**: 2 vCPU minimum (4 vCPU recommandé)
- **Stockage**: 50 GB minimum (100 GB recommandé)
- **Accès**: SSH avec clé publique (pas de mot de passe)

### Domaines
- Domaine principal pour l'API: `api.votre-domaine.com`
- Domaine pour le frontend: `app.votre-domaine.com`
- DNS configurés pointant vers l'IP du serveur

### Outils locaux
```bash
# Votre machine locale doit avoir:
- Git
- SSH client
- Docker (pour build local si nécessaire)
```

---

## Préparation du serveur

### 1. Connexion initiale et sécurisation

```bash
# Se connecter au serveur
ssh root@votre-serveur-ip

# Créer un utilisateur non-root
adduser deployer
usermod -aG sudo deployer

# Configurer SSH pour l'utilisateur
mkdir -p /home/deployer/.ssh
cp ~/.ssh/authorized_keys /home/deployer/.ssh/
chown -R deployer:deployer /home/deployer/.ssh
chmod 700 /home/deployer/.ssh
chmod 600 /home/deployer/.ssh/authorized_keys

# Désactiver login root via SSH
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd

# Se reconnecter avec le nouvel utilisateur
exit
ssh deployer@votre-serveur-ip
```

### 2. Mise à jour du système

```bash
sudo apt update
sudo apt upgrade -y
sudo apt autoremove -y
```

### 3. Installation des dépendances

```bash
# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Nginx (reverse proxy)
sudo apt install -y nginx

# Certbot (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx

# PostgreSQL client (pour backups)
sudo apt install -y postgresql-client

# Utilitaires
sudo apt install -y git curl wget htop ufw fail2ban
```

### 4. Configuration du pare-feu

```bash
# Autoriser SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

### 5. Configuration de Fail2Ban

```bash
# Protéger SSH contre les attaques brute-force
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## Configuration des secrets

### 1. Copier le fichier .env.production sur le serveur

**Sur votre machine locale:**
```bash
# Vérifier que .env.production existe
ls -la .env.production

# Copier vers le serveur
scp .env.production deployer@votre-serveur-ip:~/
```

**Sur le serveur:**
```bash
# Créer le répertoire de l'application
mkdir -p ~/sante-rurale
mv ~/env.production ~/sante-rurale/.env.production

# Protéger le fichier
chmod 600 ~/sante-rurale/.env.production
```

### 2. Modifier les variables pour la production

```bash
cd ~/sante-rurale
nano .env.production
```

**Modifier les valeurs suivantes:**
```bash
# Domaines
API_DOMAIN=api.votre-domaine.com
FRONTEND_URL=https://app.votre-domaine.com
CORS_ORIGINS=https://app.votre-domaine.com

# Cookie (activer HTTPS)
COOKIE_SECURE=true
COOKIE_DOMAIN=.votre-domaine.com

# MinIO SSL (si derrière reverse proxy HTTPS)
MINIO_USE_SSL=true

# Email SMTP (configurer avec votre service)
SMTP_HOST=smtp.gmail.com  # ou autre service
SMTP_PORT=587
SMTP_USER=noreply@votre-domaine.com
SMTP_PASSWORD=VOTRE_MOT_DE_PASSE_SMTP_FORT
SMTP_FROM_EMAIL=noreply@votre-domaine.com
```

### 3. Générer une clé de chiffrement pour les backups

```bash
# Générer une clé forte
python3 -c "import secrets; print(secrets.token_urlsafe(64))"

# Ajouter dans .env.production
nano .env.production
# Remplacer BACKUP_ENCRYPTION_KEY=GÉNÉRER_UNE_CLÉ_SÉPARÉE
# par la clé générée ci-dessus
```

---

## Déploiement de l'application

### 1. Cloner le repository

```bash
cd ~/sante-rurale
git clone https://github.com/votre-username/sante-rurale.git .

# Ou si vous utilisez une clé de déploiement
ssh-keygen -t ed25519 -C "deployer@sante-rurale"
cat ~/.ssh/id_ed25519.pub
# Ajouter cette clé aux deploy keys sur GitHub
```

### 2. Créer docker-compose.prod.yml

```bash
nano docker-compose.prod.yml
```

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: sante_rurale_postgres
    restart: always
    env_file: .env.production
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $POSTGRES_USER"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: sante_rurale_redis
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    container_name: sante_rurale_minio
    restart: always
    env_file: .env.production
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3

  api:
    build:
      context: ./api
      dockerfile: Dockerfile.prod
    container_name: sante_rurale_api
    restart: always
    env_file: .env.production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      minio:
        condition: service_healthy
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./pwa
      dockerfile: Dockerfile.prod
      args:
        VITE_API_URL: https://api.votre-domaine.com/api
    container_name: sante_rurale_frontend
    restart: always
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    container_name: sante_rurale_nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /var/www/certbot:/var/www/certbot:ro
    depends_on:
      - api
      - frontend
    networks:
      - app-network

volumes:
  postgres_data:
  redis_data:
  minio_data:

networks:
  app-network:
    driver: bridge
```

### 3. Créer les Dockerfiles de production

**api/Dockerfile.prod:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Installer les dépendances système
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copier les requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code
COPY . .

# Créer un utilisateur non-root
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app
USER appuser

# Exposer le port
EXPOSE 8000

# Commande de démarrage avec Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

**pwa/Dockerfile.prod:**
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copier package.json
COPY package*.json ./
RUN npm ci

# Copier le code source
COPY . .

# Build argument pour l'API URL
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Build de production
RUN npm run build

# Stage 2: Nginx pour servir le frontend
FROM nginx:alpine

# Copier le build
COPY --from=builder /app/dist /usr/share/nginx/html

# Copier la configuration nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### 4. Configuration Nginx

```bash
mkdir -p nginx/conf.d
nano nginx/conf.d/sante-rurale.conf
```

```nginx
# API
server {
    listen 80;
    server_name api.votre-domaine.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name api.votre-domaine.com;

    ssl_certificate /etc/letsencrypt/live/api.votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.votre-domaine.com/privkey.pem;

    # SSL moderne
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Frontend
server {
    listen 80;
    server_name app.votre-domaine.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name app.votre-domaine.com;

    ssl_certificate /etc/letsencrypt/live/app.votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.votre-domaine.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5. Déployer l'application

```bash
# Build et démarrage
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Vérifier les logs
docker-compose -f docker-compose.prod.yml logs -f

# Vérifier le statut
docker-compose -f docker-compose.prod.yml ps
```

---

## Configuration HTTPS

### 1. Obtenir les certificats SSL avec Let's Encrypt

```bash
# Arrêter nginx temporairement
sudo systemctl stop nginx

# Obtenir les certificats pour l'API
sudo certbot certonly --standalone -d api.votre-domaine.com

# Obtenir les certificats pour le frontend
sudo certbot certonly --standalone -d app.votre-domaine.com

# Redémarrer nginx
sudo systemctl start nginx
```

### 2. Renouvellement automatique

```bash
# Tester le renouvellement
sudo certbot renew --dry-run

# Ajouter un cron job pour le renouvellement automatique
sudo crontab -e

# Ajouter cette ligne (renouvelle tous les jours à 3h du matin)
0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

### 3. Redémarrer avec HTTPS

```bash
# Redémarrer nginx dans Docker
docker-compose -f docker-compose.prod.yml restart nginx

# Tester l'accès HTTPS
curl https://api.votre-domaine.com/health
curl https://app.votre-domaine.com
```

---

## Backups automatiques

### 1. Copier les scripts de backup

```bash
cd ~/sante-rurale

# Vérifier que les scripts existent
ls -la scripts/backup-database.sh
ls -la scripts/test-restore.sh
ls -la scripts/setup-backup-cron.sh

# Créer le répertoire de backup
sudo mkdir -p /var/backups/sante-rurale
sudo chown -R deployer:deployer /var/backups/sante-rurale
```

### 2. Configurer le cron job

```bash
# Exécuter le script de configuration
cd ~/sante-rurale
./scripts/setup-backup-cron.sh
```

### 3. Tester le backup manuellement

```bash
# Exécuter un backup de test
./scripts/backup-database.sh

# Vérifier que le backup existe
ls -lh /var/backups/sante-rurale/

# Tester la restauration
./scripts/test-restore.sh
```

### 4. Configuration S3 pour backups externes (optionnel)

```bash
# Installer AWS CLI
sudo apt install -y awscli

# Configurer pour MinIO ou AWS S3
aws configure
# Entrer:
# AWS Access Key ID: votre MINIO_ROOT_USER
# AWS Secret Access Key: votre MINIO_ROOT_PASSWORD
# Default region name: us-east-1
# Default output format: json

# Créer le bucket de backup
aws --endpoint-url http://localhost:9000 s3 mb s3://sante-rurale-backups
```

---

## Monitoring et logs

### 1. Logs centralisés

```bash
# Voir les logs de tous les services
docker-compose -f docker-compose.prod.yml logs -f

# Logs d'un service spécifique
docker-compose -f docker-compose.prod.yml logs -f api

# Filtrer les logs par date
docker-compose -f docker-compose.prod.yml logs --since 2024-01-01 api
```

### 2. Monitoring des ressources

```bash
# Installer htop pour monitorer les ressources
sudo apt install -y htop

# Lancer htop
htop

# Voir l'utilisation Docker
docker stats
```

### 3. Configuration de la rotation des logs

```bash
sudo nano /etc/docker/daemon.json
```

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
sudo systemctl restart docker
```

### 4. Health checks

```bash
# Vérifier la santé de l'API
curl https://api.votre-domaine.com/health

# Vérifier les services Docker
docker-compose -f docker-compose.prod.yml ps
```

---

## Post-déploiement

### 1. Créer le premier utilisateur admin

```bash
# Se connecter au container API
docker exec -it sante_rurale_api bash

# Exécuter le script de création admin
python scripts/create_admin.py

# Ou via l'API
curl -X POST https://api.votre-domaine.com/api/admin/setup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@votre-domaine.com",
    "password": "MotDePasseTresFort123!",
    "nom": "Admin",
    "prenom": "Système"
  }'
```

### 2. Vérifier les migrations de base de données

```bash
docker exec -it sante_rurale_api bash
alembic current
alembic upgrade head
exit
```

### 3. Tester l'application

- [ ] Connexion à https://app.votre-domaine.com
- [ ] Création d'un compte
- [ ] Ajout d'un patient
- [ ] Création d'une consultation
- [ ] Upload d'une pièce jointe
- [ ] Génération d'un rapport
- [ ] Test de sync offline
- [ ] Vérification des emails

### 4. Configuration du monitoring (optionnel)

**Sentry pour le suivi des erreurs:**
```bash
# Ajouter dans .env.production
SENTRY_DSN=https://votre-dsn@sentry.io/projet-id

# Redémarrer les services
docker-compose -f docker-compose.prod.yml restart api frontend
```

---

## Checklist finale

### Sécurité
- [ ] `.env.production` non commité dans Git
- [ ] Pare-feu configuré (UFW)
- [ ] Fail2Ban actif
- [ ] Certificats SSL installés
- [ ] HTTPS forcé (redirect HTTP → HTTPS)
- [ ] Headers de sécurité configurés
- [ ] Mots de passe forts pour tous les services

### Backups
- [ ] Script de backup testé
- [ ] Cron job configuré
- [ ] Test de restauration réussi
- [ ] Backups stockés hors serveur (S3)

### Performance
- [ ] Docker logs rotation activée
- [ ] Monitoring en place
- [ ] Health checks fonctionnels

### Fonctionnel
- [ ] Application accessible via HTTPS
- [ ] Admin créé et fonctionnel
- [ ] Toutes les fonctionnalités testées
- [ ] Emails envoyés correctement

---

## Commandes utiles

```bash
# Redémarrer tous les services
docker-compose -f docker-compose.prod.yml restart

# Voir les logs en temps réel
docker-compose -f docker-compose.prod.yml logs -f --tail=100

# Mise à jour de l'application
cd ~/sante-rurale
git pull
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Backup manuel
./scripts/backup-database.sh

# Restaurer un backup
./scripts/test-restore.sh

# Arrêter tous les services
docker-compose -f docker-compose.prod.yml down

# Nettoyer Docker
docker system prune -a
```

---

## Support et dépannage

### Logs d'erreur

```bash
# Voir les erreurs de l'API
docker-compose -f docker-compose.prod.yml logs api | grep ERROR

# Voir les erreurs PostgreSQL
docker-compose -f docker-compose.prod.yml logs postgres | grep ERROR
```

### Problèmes courants

**1. Erreur de connexion à la base de données**
```bash
# Vérifier que PostgreSQL est en cours d'exécution
docker-compose -f docker-compose.prod.yml ps postgres

# Vérifier les logs PostgreSQL
docker-compose -f docker-compose.prod.yml logs postgres
```

**2. Certificat SSL expiré**
```bash
# Renouveler manuellement
sudo certbot renew
docker-compose -f docker-compose.prod.yml restart nginx
```

**3. Espace disque plein**
```bash
# Vérifier l'espace disque
df -h

# Nettoyer Docker
docker system prune -a

# Nettoyer les anciens backups
find /var/backups/sante-rurale -name "*.sql.gz" -mtime +30 -delete
```

---

**Document maintenu par l'équipe Santé Rurale**
Dernière mise à jour: 2025-01-11
