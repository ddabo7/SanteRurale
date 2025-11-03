# Guide de Déploiement - Santé Rurale

## 📋 Prérequis

Avant de commencer le déploiement, assurez-vous d'avoir :

- ✅ Un VPS Hostinger avec Ubuntu 22.04 (minimum 2 CPU, 4GB RAM)
- ✅ Accès SSH root au serveur
- ✅ Un nom de domaine pointant vers l'IP du serveur
- ✅ Les fichiers du projet (backend + frontend)

## 🚀 Déploiement Rapide (Automatisé)

### Option 1 : Déploiement Complet (Recommandé pour première installation)

```bash
# 1. Connectez-vous au serveur
ssh root@votre-serveur-ip

# 2. Téléchargez les fichiers du projet
# (via git, scp, ou autre méthode)

# 3. Naviguez vers le dossier deployment
cd /chemin/vers/projet/deployment

# 4. Lancez le déploiement complet
sudo ./deploy.sh --full --domain votre-domaine.com
```

Le script va automatiquement :
- ✅ Installer toutes les dépendances (Python 3.12, Node.js 20, PostgreSQL, Nginx)
- ✅ Configurer la base de données
- ✅ Déployer le backend FastAPI
- ✅ Déployer le frontend React PWA
- ✅ Configurer Nginx avec HTTPS (Let's Encrypt)
- ✅ Mettre en place les backups automatiques
- ✅ Configurer les logs

**Durée estimée** : 10-15 minutes

### Option 2 : Mise à Jour d'une Installation Existante

```bash
# Pour mettre à jour l'application
sudo ./deploy.sh --update
```

### Option 3 : Déploiement Partiel

```bash
# Backend uniquement
sudo ./deploy.sh --backend

# Frontend uniquement
sudo ./deploy.sh --frontend
```

## 📖 Déploiement Manuel (Étape par Étape)

Si vous préférez comprendre chaque étape ou personnaliser l'installation :

### Étape 1 : Préparation du Serveur

```bash
# Mise à jour du système
apt update && apt upgrade -y

# Installation des outils de base
apt install -y software-properties-common build-essential git curl wget ufw

# Configuration du firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

### Étape 2 : Installation de Python 3.12

```bash
# Ajouter le PPA deadsnakes
add-apt-repository ppa:deadsnakes/ppa
apt update

# Installer Python 3.12
apt install -y python3.12 python3.12-venv python3.12-dev python3-pip
```

### Étape 3 : Installation de Node.js 20

```bash
# Installer Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Vérifier l'installation
node --version  # Devrait afficher v20.x.x
npm --version
```

### Étape 4 : Installation et Configuration de PostgreSQL

```bash
# Installer PostgreSQL 14
apt install -y postgresql-14 postgresql-contrib

# Créer la base de données et l'utilisateur
sudo -u postgres psql <<EOF
CREATE USER sante_rurale WITH PASSWORD 'VOTRE_MOT_DE_PASSE_SECURISE';
CREATE DATABASE sante_rurale OWNER sante_rurale;
GRANT ALL PRIVILEGES ON DATABASE sante_rurale TO sante_rurale;
\c sante_rurale
GRANT ALL ON SCHEMA public TO sante_rurale;
EOF
```

### Étape 5 : Installation de Nginx

```bash
apt install -y nginx

# Démarrer et activer Nginx
systemctl start nginx
systemctl enable nginx
```

### Étape 6 : Déploiement du Backend

```bash
# Créer la structure de répertoires
mkdir -p /var/www/sante-rurale/{api,pwa,uploads,logs,backups}
chown -R www-data:www-data /var/www/sante-rurale

# Copier les fichiers du backend
cp -r /chemin/source/api/* /var/www/sante-rurale/api/

# Créer l'environnement virtuel
cd /var/www/sante-rurale/api
python3.12 -m venv venv

# Installer les dépendances
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

# Configurer le fichier .env (voir .env.production.example)
nano .env

# Exécuter les migrations
./venv/bin/alembic upgrade head

# Configurer le service systemd
cp /chemin/deployment/sante-rurale-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable sante-rurale-api
systemctl start sante-rurale-api

# Vérifier le service
systemctl status sante-rurale-api
```

### Étape 7 : Déploiement du Frontend

```bash
# Copier les fichiers du frontend
cp -r /chemin/source/pwa/* /var/www/sante-rurale/pwa/

# Installer les dépendances
cd /var/www/sante-rurale/pwa
npm install

# Build de production
npm run build
```

### Étape 8 : Configuration de Nginx

```bash
# Copier la configuration Nginx
cp /chemin/deployment/nginx-sante-rurale.conf /etc/nginx/sites-available/sante-rurale

# Éditer la configuration pour votre domaine
nano /etc/nginx/sites-available/sante-rurale

# Activer le site
ln -s /etc/nginx/sites-available/sante-rurale /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Tester la configuration
nginx -t

# Recharger Nginx
systemctl reload nginx
```

### Étape 9 : Configuration SSL avec Let's Encrypt

```bash
# Installer Certbot
apt install -y certbot python3-certbot-nginx

# Obtenir le certificat SSL
certbot --nginx -d votre-domaine.com -d www.votre-domaine.com

# Renouvellement automatique (déjà configuré par défaut)
systemctl status certbot.timer
```

## 🔧 Configuration des Fichiers

### Fichier .env (Backend)

Créez le fichier `/var/www/sante-rurale/api/.env` :

```bash
ENVIRONMENT=production
DATABASE_URL=postgresql+asyncpg://sante_rurale:VOTRE_PASSWORD@localhost:5432/sante_rurale
SECRET_KEY=votre-cle-secrete-tres-longue-et-aleatoire-minimum-32-caracteres
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
ALLOWED_ORIGINS=https://votre-domaine.com,https://www.votre-domaine.com
RATE_LIMIT_ENABLED=true
SENTRY_DSN=https://votre-sentry-dsn@sentry.io/projet
LOG_LEVEL=INFO
```

**Important** : Générez une clé secrète sécurisée :
```bash
openssl rand -hex 32
```

### Fichier .env (Frontend - Optionnel)

Créez le fichier `/var/www/sante-rurale/pwa/.env.production` :

```bash
VITE_API_URL=https://votre-domaine.com/api
VITE_ENVIRONMENT=production
```

## 📊 Vérifications Post-Déploiement

### 1. Vérifier les Services

```bash
# Backend API
systemctl status sante-rurale-api
curl http://localhost:8000/health

# Nginx
systemctl status nginx

# PostgreSQL
systemctl status postgresql
```

### 2. Tester l'Application

```bash
# Health check
curl https://votre-domaine.com/health

# API endpoint
curl https://votre-domaine.com/api/docs

# Frontend
curl -I https://votre-domaine.com
```

### 3. Vérifier les Logs

```bash
# Logs du backend
journalctl -u sante-rurale-api -f

# Logs Nginx
tail -f /var/log/nginx/sante-rurale-access.log
tail -f /var/log/nginx/sante-rurale-error.log

# Logs PostgreSQL
tail -f /var/log/postgresql/postgresql-14-main.log
```

## 🔒 Sécurité Post-Déploiement

### 1. Configurer Fail2Ban

```bash
# Installer Fail2Ban
apt install -y fail2ban

# Créer une configuration pour l'API
cat > /etc/fail2ban/jail.local <<EOF
[sante-rurale-api]
enabled = true
port = http,https
filter = sante-rurale-api
logpath = /var/log/nginx/sante-rurale-access.log
maxretry = 5
bantime = 3600
EOF

systemctl restart fail2ban
```

### 2. Mettre à Jour les Permissions

```bash
# Restreindre l'accès au fichier .env
chmod 600 /var/www/sante-rurale/api/.env
chown www-data:www-data /var/www/sante-rurale/api/.env

# Restreindre l'accès aux répertoires sensibles
chmod 750 /var/www/sante-rurale/api
chmod 755 /var/www/sante-rurale/pwa/dist
```

### 3. Configurer les Backups Automatiques

Le script de déploiement configure automatiquement les backups, mais vous pouvez les vérifier :

```bash
# Vérifier la tâche cron
crontab -l

# Tester le backup manuellement
/usr/local/bin/backup-sante-rurale.sh

# Vérifier les backups
ls -lh /var/backups/sante-rurale/
```

## 🔄 Maintenance

### Mise à Jour de l'Application

```bash
# 1. Sauvegarder l'état actuel
/usr/local/bin/backup-sante-rurale.sh

# 2. Récupérer les nouvelles versions
cd /chemin/vers/nouveau/code

# 3. Backend
cp -r api/* /var/www/sante-rurale/api/
cd /var/www/sante-rurale/api
./venv/bin/pip install -r requirements.txt
./venv/bin/alembic upgrade head
systemctl restart sante-rurale-api

# 4. Frontend
cp -r pwa/* /var/www/sante-rurale/pwa/
cd /var/www/sante-rurale/pwa
npm install
npm run build

# 5. Recharger Nginx
systemctl reload nginx
```

### Restauration depuis un Backup

```bash
# 1. Arrêter les services
systemctl stop sante-rurale-api

# 2. Restaurer la base de données
cd /var/backups/sante-rurale
gunzip -c db_YYYYMMDD_HHMMSS.sql.gz | sudo -u postgres psql sante_rurale

# 3. Restaurer les uploads
tar -xzf uploads_YYYYMMDD_HHMMSS.tar.gz -C /

# 4. Redémarrer les services
systemctl start sante-rurale-api
```

### Surveiller les Performances

```bash
# Utilisation CPU et mémoire
htop

# Espace disque
df -h

# Connexions actives
ss -tunlp | grep :8000

# Logs en temps réel
journalctl -u sante-rurale-api -f
```

## 📈 Monitoring (Optionnel mais Recommandé)

### Configurer Sentry

1. Créez un compte sur [sentry.io](https://sentry.io)
2. Créez un nouveau projet FastAPI
3. Copiez le DSN dans le fichier `.env` :
   ```
   SENTRY_DSN=https://votre-cle@sentry.io/projet-id
   ```
4. Redémarrez l'API : `systemctl restart sante-rurale-api`

### Configurer Prometheus + Grafana

Voir le guide complet : [MONITORING_GUIDE.md](../MONITORING_GUIDE.md)

## ❗ Dépannage

### Le backend ne démarre pas

```bash
# Vérifier les logs
journalctl -u sante-rurale-api -n 100

# Vérifier la connexion DB
sudo -u postgres psql -c "\l" | grep sante_rurale

# Tester manuellement
cd /var/www/sante-rurale/api
./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Erreur 502 Bad Gateway

```bash
# Vérifier que l'API écoute sur le port 8000
ss -tunlp | grep :8000

# Vérifier la configuration Nginx
nginx -t

# Vérifier les logs Nginx
tail -f /var/log/nginx/sante-rurale-error.log
```

### Base de données inaccessible

```bash
# Vérifier PostgreSQL
systemctl status postgresql

# Tester la connexion
sudo -u postgres psql -d sante_rurale -c "SELECT version();"

# Vérifier les permissions
sudo -u postgres psql -c "\du" | grep sante_rurale
```

### SSL ne fonctionne pas

```bash
# Renouveler le certificat
certbot renew --dry-run

# Vérifier la configuration SSL
openssl s_client -connect votre-domaine.com:443

# Vérifier Nginx
nginx -t
systemctl reload nginx
```

## 📞 Support

### Ressources Additionnelles

- **Documentation Complète** : Voir [DEPLOIEMENT_HOSTINGER.md](../DEPLOIEMENT_HOSTINGER.md)
- **Guide HTTPS/SSL** : Voir [HTTPS_SSL_GUIDE.md](../HTTPS_SSL_GUIDE.md)
- **Guide Monitoring** : Voir [MONITORING_GUIDE.md](../MONITORING_GUIDE.md)
- **Production Readiness** : Voir [PRODUCTION_READINESS_REPORT.md](../PRODUCTION_READINESS_REPORT.md)

### Logs Importants

| Service | Chemin du Log |
|---------|---------------|
| Backend API | `journalctl -u sante-rurale-api` |
| Nginx Access | `/var/log/nginx/sante-rurale-access.log` |
| Nginx Error | `/var/log/nginx/sante-rurale-error.log` |
| PostgreSQL | `/var/log/postgresql/postgresql-14-main.log` |
| System | `journalctl -xe` |

### Commandes Utiles

```bash
# Redémarrer tous les services
systemctl restart sante-rurale-api nginx postgresql

# Voir l'état de tous les services
systemctl status sante-rurale-api nginx postgresql

# Suivre tous les logs en temps réel
journalctl -f

# Backup manuel
/usr/local/bin/backup-sante-rurale.sh

# Nettoyer les vieux logs
journalctl --vacuum-time=7d
```

## ✅ Checklist de Déploiement

- [ ] Serveur VPS configuré (Ubuntu 22.04)
- [ ] Nom de domaine configuré (DNS pointant vers le serveur)
- [ ] Dépendances installées (Python, Node.js, PostgreSQL, Nginx)
- [ ] Base de données créée et configurée
- [ ] Backend déployé et service actif
- [ ] Frontend buildé et servi par Nginx
- [ ] Nginx configuré correctement
- [ ] SSL/HTTPS configuré avec Let's Encrypt
- [ ] Fichier .env configuré avec les bonnes valeurs
- [ ] Backups automatiques configurés
- [ ] Logs rotatifs configurés
- [ ] Firewall (UFW) activé
- [ ] Tests de l'API réussis (`/health`, `/api/docs`)
- [ ] Tests du frontend réussis
- [ ] Monitoring configuré (Sentry optionnel)
- [ ] Documentation de production lue

## 🎉 Félicitations !

Si tous les points de la checklist sont cochés, votre application Santé Rurale est maintenant déployée en production ! 🚀

L'application est accessible à l'adresse : **https://votre-domaine.com**
