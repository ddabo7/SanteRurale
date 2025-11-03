# Guide de Déploiement sur Hostinger - Santé Rurale

Guide complet pour déployer l'application **Santé Rurale** (FastAPI + React PWA) sur **Hostinger VPS**.

## 📋 Table des Matières

- [Prérequis](#prérequis)
- [Architecture de Déploiement](#architecture-de-déploiement)
- [Étape 1: Préparer le VPS Hostinger](#étape-1-préparer-le-vps-hostinger)
- [Étape 2: Installer les Dépendances](#étape-2-installer-les-dépendances)
- [Étape 3: Configurer PostgreSQL](#étape-3-configurer-postgresql)
- [Étape 4: Déployer le Backend (FastAPI)](#étape-4-déployer-le-backend-fastapi)
- [Étape 5: Déployer le Frontend (React PWA)](#étape-5-déployer-le-frontend-react-pwa)
- [Étape 6: Configurer Nginx](#étape-6-configurer-nginx)
- [Étape 7: Configurer SSL/HTTPS](#étape-7-configurer-sslhttps)
- [Étape 8: Configuration Production](#étape-8-configuration-production)
- [Maintenance et Monitoring](#maintenance-et-monitoring)

---

## 🎯 Prérequis

### Côté Hostinger

1. **VPS Hostinger** (recommandé: VPS 2 ou supérieur)
   - 2+ vCPU
   - 4+ GB RAM
   - 50+ GB SSD
   - Ubuntu 22.04 LTS

2. **Nom de domaine** configuré
   - Exemple: `sante-rurale.health`
   - DNS pointant vers l'IP du VPS

### Côté Local

1. Accès SSH au VPS
2. Code de l'application sur votre machine
3. Git installé

---

## 🏗️ Architecture de Déploiement

```
Internet
    ↓
Hostinger VPS (IP: xxx.xxx.xxx.xxx)
    ↓
Nginx (Port 80/443)
    ↓
┌─────────────────┬──────────────────┐
│   Frontend PWA  │   Backend API    │
│   (Static)      │   (Uvicorn)      │
│   /var/www/pwa  │   Port 8000      │
└─────────────────┴──────────────────┘
         ↓
    PostgreSQL
    (Port 5432)
```

---

## 📝 Étape 1: Préparer le VPS Hostinger

### 1.1 Accéder au VPS

```bash
# Depuis votre terminal local
ssh root@votre-ip-vps

# Ou avec le nom de domaine
ssh root@sante-rurale.health
```

### 1.2 Mettre à jour le système

```bash
# Mise à jour des paquets
apt update && apt upgrade -y

# Installer les outils de base
apt install -y curl wget git vim htop ufw build-essential
```

### 1.3 Créer un utilisateur non-root

```bash
# Créer l'utilisateur
adduser sante
usermod -aG sudo sante

# Configurer SSH pour cet utilisateur
mkdir -p /home/sante/.ssh
cp ~/.ssh/authorized_keys /home/sante/.ssh/
chown -R sante:sante /home/sante/.ssh
chmod 700 /home/sante/.ssh
chmod 600 /home/sante/.ssh/authorized_keys

# Se connecter avec le nouvel utilisateur
su - sante
```

### 1.4 Configurer le Firewall

```bash
# Activer UFW
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Vérifier
sudo ufw status
```

---

## 🔧 Étape 2: Installer les Dépendances

### 2.1 Installer Python 3.12

```bash
# Ajouter le PPA deadsnakes
sudo apt install -y software-properties-common
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update

# Installer Python 3.12
sudo apt install -y python3.12 python3.12-venv python3.12-dev
sudo apt install -y python3-pip

# Vérifier
python3.12 --version
```

### 2.2 Installer Node.js et npm

```bash
# Installer Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Vérifier
node --version  # v20.x.x
npm --version   # 10.x.x
```

### 2.3 Installer PostgreSQL

```bash
# Installer PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Démarrer le service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Vérifier
sudo systemctl status postgresql
```

### 2.4 Installer Nginx

```bash
# Installer Nginx
sudo apt install -y nginx

# Démarrer et activer
sudo systemctl start nginx
sudo systemctl enable nginx

# Vérifier
sudo systemctl status nginx
```

---

## 🗄️ Étape 3: Configurer PostgreSQL

### 3.1 Créer la base de données

```bash
# Se connecter à PostgreSQL
sudo -u postgres psql

# Dans psql:
CREATE DATABASE sante_rurale;
CREATE USER sante_user WITH PASSWORD 'VotreMotDePasseSécurisé123!';
GRANT ALL PRIVILEGES ON DATABASE sante_rurale TO sante_user;

# PostgreSQL 15+ : Grant additional permissions
\c sante_rurale
GRANT ALL ON SCHEMA public TO sante_user;
ALTER DATABASE sante_rurale OWNER TO sante_user;

# Quitter
\q
```

### 3.2 Configurer l'accès distant (optionnel)

```bash
# Éditer pg_hba.conf
sudo vim /etc/postgresql/15/main/pg_hba.conf

# Ajouter cette ligne (pour localhost seulement)
# local   all             sante_user                              scram-sha-256

# Redémarrer PostgreSQL
sudo systemctl restart postgresql
```

### 3.3 Tester la connexion

```bash
psql -U sante_user -d sante_rurale -h localhost
# Entrer le mot de passe
# Si ça marche, taper \q pour quitter
```

---

## 🚀 Étape 4: Déployer le Backend (FastAPI)

### 4.1 Cloner le code

```bash
# Créer le répertoire de l'application
sudo mkdir -p /var/www/sante-rurale
sudo chown -R sante:sante /var/www/sante-rurale

# Cloner depuis votre machine locale
# Option 1: Via Git (si vous avez un repo)
cd /var/www/sante-rurale
git clone https://votre-repo.git .

# Option 2: Via SCP depuis votre machine locale
# Sur votre machine locale:
# scp -r "/Users/djibrildabo/Documents/Santé Rurale" sante@votre-ip:/var/www/sante-rurale

# Se placer dans le répertoire
cd /var/www/sante-rurale
```

### 4.2 Configurer l'environnement Python

```bash
# Créer l'environnement virtuel
cd /var/www/sante-rurale/api
python3.12 -m venv venv

# Activer l'environnement
source venv/bin/activate

# Installer les dépendances
pip install --upgrade pip
pip install -r requirements.txt
```

### 4.3 Configurer les variables d'environnement

```bash
# Créer le fichier .env
cd /var/www/sante-rurale/api
vim .env
```

Contenu du fichier `.env`:

```bash
# Environnement
ENVIRONMENT=production

# Base de données
DATABASE_URL=postgresql+asyncpg://sante_user:VotreMotDePasseSécurisé123!@localhost:5432/sante_rurale

# JWT
SECRET_KEY=$(openssl rand -hex 32)
ALGORITHM=RS256

# Email (configurer avec votre service)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=votre-email@gmail.com
SMTP_PASSWORD=votre-app-password
EMAIL_FROM=noreply@sante-rurale.health

# URLs
API_URL=https://api.sante-rurale.health
FRONTEND_URL=https://sante-rurale.health

# Monitoring (optionnel)
SENTRY_DSN=
SENTRY_ENVIRONMENT=production

# CORS
CORS_ORIGINS=https://sante-rurale.health,https://www.sante-rurale.health
```

### 4.4 Générer les clés JWT

```bash
# Créer le répertoire des clés
mkdir -p /var/www/sante-rurale/api/keys

# Générer les clés RS256
cd /var/www/sante-rurale/api/keys

# Clé privée
openssl genrsa -out jwt-private.pem 2048

# Clé publique
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem

# Sécuriser les permissions
chmod 600 jwt-private.pem
chmod 644 jwt-public.pem
```

### 4.5 Initialiser la base de données

```bash
# Activer l'environnement virtuel
cd /var/www/sante-rurale/api
source venv/bin/activate

# Exécuter les migrations Alembic
alembic upgrade head

# Créer les données de base (optionnel)
python scripts/seed_base_data.py
```

### 4.6 Créer le service systemd

```bash
# Créer le fichier service
sudo vim /etc/systemd/system/sante-rurale-api.service
```

Contenu:

```ini
[Unit]
Description=Santé Rurale API (FastAPI)
After=network.target postgresql.service

[Service]
Type=notify
User=sante
Group=sante
WorkingDirectory=/var/www/sante-rurale/api
Environment="PATH=/var/www/sante-rurale/api/venv/bin"
ExecStart=/var/www/sante-rurale/api/venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 4 \
    --log-level info \
    --access-log

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 4.7 Démarrer le service

```bash
# Recharger systemd
sudo systemctl daemon-reload

# Démarrer le service
sudo systemctl start sante-rurale-api

# Activer au démarrage
sudo systemctl enable sante-rurale-api

# Vérifier le statut
sudo systemctl status sante-rurale-api

# Voir les logs
sudo journalctl -u sante-rurale-api -f
```

### 4.8 Tester l'API

```bash
# Tester en local
curl http://127.0.0.1:8000/health

# Devrait retourner:
# {"status":"healthy","environment":"production","version":"1.0.0"}
```

---

## 💻 Étape 5: Déployer le Frontend (React PWA)

### 5.1 Builder le frontend

```bash
# Sur votre machine locale
cd "/Users/djibrildabo/Documents/Santé Rurale/pwa"

# Configurer l'URL de l'API
cat > .env.production << EOF
VITE_API_URL=https://api.sante-rurale.health
VITE_ENVIRONMENT=production
VITE_SENTRY_DSN=
EOF

# Builder
npm install
npm run build

# Le résultat est dans le dossier dist/
```

### 5.2 Transférer vers le serveur

```bash
# Depuis votre machine locale
cd "/Users/djibrildabo/Documents/Santé Rurale/pwa"

# Transférer le build
scp -r dist/* sante@votre-ip:/tmp/pwa-build/

# Sur le serveur
ssh sante@votre-ip

# Créer le répertoire web
sudo mkdir -p /var/www/sante-rurale/pwa
sudo chown -R sante:sante /var/www/sante-rurale/pwa

# Déplacer les fichiers
mv /tmp/pwa-build/* /var/www/sante-rurale/pwa/

# Définir les permissions
sudo chown -R www-data:www-data /var/www/sante-rurale/pwa
sudo chmod -R 755 /var/www/sante-rurale/pwa
```

---

## 🌐 Étape 6: Configurer Nginx

### 6.1 Créer la configuration Nginx

```bash
sudo vim /etc/nginx/sites-available/sante-rurale
```

Contenu:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name sante-rurale.health www.sante-rurale.health api.sante-rurale.health;

    # Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# Frontend PWA
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name sante-rurale.health www.sante-rurale.health;

    # SSL Configuration (sera complétée après Let's Encrypt)
    # ssl_certificate /etc/letsencrypt/live/sante-rurale.health/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/sante-rurale.health/privkey.pem;

    # Root directory
    root /var/www/sante-rurale/pwa;
    index index.html;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # PWA - Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # PWA - Service Worker
    location /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires 0;
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}

# Backend API
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.sante-rurale.health;

    # SSL Configuration
    # ssl_certificate /etc/letsencrypt/live/sante-rurale.health/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/sante-rurale.health/privkey.pem;

    # Logs
    access_log /var/log/nginx/api.sante-rurale.access.log;
    error_log /var/log/nginx/api.sante-rurale.error.log;

    # Proxy to FastAPI
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffers
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        access_log off;
    }

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

### 6.2 Activer la configuration

```bash
# Créer le lien symbolique
sudo ln -s /etc/nginx/sites-available/sante-rurale /etc/nginx/sites-enabled/

# Supprimer la config par défaut
sudo rm /etc/nginx/sites-enabled/default

# Tester la configuration
sudo nginx -t

# Si OK, recharger Nginx
sudo systemctl reload nginx
```

---

## 🔒 Étape 7: Configurer SSL/HTTPS

### 7.1 Installer Certbot

```bash
# Installer Certbot
sudo apt install -y certbot python3-certbot-nginx
```

### 7.2 Obtenir le certificat Let's Encrypt

```bash
# Obtenir le certificat pour tous les domaines
sudo certbot --nginx -d sante-rurale.health -d www.sante-rurale.health -d api.sante-rurale.health

# Suivre les instructions:
# - Entrer votre email
# - Accepter les termes
# - Choisir de rediriger HTTP vers HTTPS (recommandé)
```

### 7.3 Vérifier le renouvellement automatique

```bash
# Tester le renouvellement
sudo certbot renew --dry-run

# Si OK, un cronjob est automatiquement créé
sudo systemctl status certbot.timer
```

### 7.4 Mettre à jour la configuration Nginx

```bash
# Éditer la configuration
sudo vim /etc/nginx/sites-available/sante-rurale

# Décommenter les lignes SSL:
# ssl_certificate /etc/letsencrypt/live/sante-rurale.health/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/sante-rurale.health/privkey.pem;

# Tester et recharger
sudo nginx -t && sudo systemctl reload nginx
```

---

## ⚙️ Étape 8: Configuration Production

### 8.1 Configurer les logs

```bash
# Créer le répertoire des logs
sudo mkdir -p /var/log/sante-rurale
sudo chown sante:sante /var/log/sante-rurale

# Configurer la rotation des logs
sudo vim /etc/logrotate.d/sante-rurale
```

Contenu:

```
/var/log/nginx/api.sante-rurale.*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        systemctl reload nginx
    endscript
}
```

### 8.2 Configurer le monitoring (optionnel)

```bash
# Installer Prometheus Node Exporter
wget https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz
tar xvfz node_exporter-1.7.0.linux-amd64.tar.gz
sudo mv node_exporter-1.7.0.linux-amd64/node_exporter /usr/local/bin/
rm -rf node_exporter-1.7.0.linux-amd64*

# Créer le service
sudo vim /etc/systemd/system/node_exporter.service
```

### 8.3 Sauvegardes automatiques

```bash
# Créer le script de backup
sudo vim /usr/local/bin/backup-sante-rurale.sh
```

Contenu:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/sante-rurale"
DATE=$(date +%Y%m%d_%H%M%S)

# Créer le répertoire
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
pg_dump -U sante_user -h localhost sante_rurale | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup fichiers uploadés (si applicable)
# tar czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/sante-rurale/uploads

# Garder seulement les 7 derniers jours
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

```bash
# Rendre exécutable
sudo chmod +x /usr/local/bin/backup-sante-rurale.sh

# Ajouter au crontab (tous les jours à 2h du matin)
sudo crontab -e
# Ajouter:
0 2 * * * /usr/local/bin/backup-sante-rurale.sh >> /var/log/sante-rurale/backup.log 2>&1
```

---

## 🔄 Maintenance et Monitoring

### Commandes Utiles

```bash
# Redémarrer l'API
sudo systemctl restart sante-rurale-api

# Voir les logs de l'API
sudo journalctl -u sante-rurale-api -f

# Voir les logs Nginx
sudo tail -f /var/log/nginx/api.sante-rurale.access.log
sudo tail -f /var/log/nginx/api.sante-rurale.error.log

# Vérifier l'utilisation des ressources
htop
df -h
free -m

# Vérifier la base de données
psql -U sante_user -d sante_rurale -c "SELECT COUNT(*) FROM users;"

# Tester l'API
curl https://api.sante-rurale.health/health

# Tester le frontend
curl https://sante-rurale.health
```

### Mise à jour de l'application

```bash
# Backend
cd /var/www/sante-rurale/api
git pull  # ou transférer les nouveaux fichiers
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
sudo systemctl restart sante-rurale-api

# Frontend
# Builder localement puis transférer
scp -r dist/* sante@votre-ip:/var/www/sante-rurale/pwa/
```

### Monitoring des performances

```bash
# Vérifier les connexions PostgreSQL
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Vérifier les processus Uvicorn
ps aux | grep uvicorn

# Vérifier l'utilisation du disque
du -sh /var/www/sante-rurale/*
```

---

## 📞 Support et Dépannage

### Problèmes Courants

#### 1. L'API ne démarre pas

```bash
# Vérifier les logs
sudo journalctl -u sante-rurale-api -n 50

# Vérifier les permissions
ls -la /var/www/sante-rurale/api

# Vérifier la connexion DB
psql -U sante_user -d sante_rurale -h localhost
```

#### 2. Erreur 502 Bad Gateway

```bash
# L'API est-elle démarrée ?
sudo systemctl status sante-rurale-api

# Nginx peut-il se connecter ?
curl http://127.0.0.1:8000/health
```

#### 3. Certificat SSL expiré

```bash
# Renouveler manuellement
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```

---

## ✅ Checklist Post-Déploiement

- [ ] ✅ API accessible via https://api.sante-rurale.health/health
- [ ] ✅ Frontend accessible via https://sante-rurale.health
- [ ] ✅ Certificat SSL valide (vérifier sur ssllabs.com)
- [ ] ✅ Redirection HTTP → HTTPS fonctionnelle
- [ ] ✅ Tests de connexion/déconnexion
- [ ] ✅ Tests de création patient/consultation
- [ ] ✅ Tests de synchronisation offline
- [ ] ✅ Sauvegardes automatiques configurées
- [ ] ✅ Monitoring en place (optionnel)

---

**Félicitations !** Votre application Santé Rurale est maintenant déployée sur Hostinger ! 🎉

**Auteur**: Claude (Assistant IA)
**Date**: 2 Novembre 2025
**Version**: 1.0.0 - Hostinger Edition
