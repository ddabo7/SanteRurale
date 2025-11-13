# 🚀 Guide de Déploiement Production - Hostinger VPS

Guide complet pour déployer **Santé Rurale** sur un VPS Hostinger avec Docker, Nginx et SSL.

---

## 📋 Prérequis

### VPS Hostinger
- **OS**: Ubuntu 22.04 LTS ou Debian 12
- **RAM**: Minimum 4 GB (recommandé 8 GB)
- **Stockage**: Minimum 40 GB SSD
- **CPU**: 2 vCPUs minimum
- **Accès SSH root**

### Domaine
- Un nom de domaine configuré (ex: `santérurale.com`)
- DNS pointant vers l'IP du VPS:
  - `A` record: `votre-domaine.com` → IP du VPS
  - `A` record: `www.votre-domaine.com` → IP du VPS

---

## 🔧 Étape 1: Configuration Initiale du VPS

### 1.1 Connexion SSH
```bash
ssh root@VOTRE_IP_VPS
```

### 1.2 Mise à jour du système
```bash
apt update && apt upgrade -y
apt install -y curl wget git vim ufw fail2ban
```

### 1.3 Configuration du Firewall
```bash
# Autoriser SSH, HTTP et HTTPS
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

### 1.4 Créer un utilisateur non-root
```bash
adduser deployer
usermod -aG sudo deployer
su - deployer
```

---

## 🐳 Étape 2: Installation de Docker

```bash
# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Ajouter l'utilisateur au groupe docker
sudo usermod -aG docker $USER
newgrp docker

# Vérifier l'installation
docker --version
docker compose version
```

---

## 📦 Étape 3: Déploiement de l'Application

### 3.1 Cloner le projet
```bash
cd /home/deployer
git clone https://github.com/VOTRE_USERNAME/sante-rurale.git
cd sante-rurale
```

### 3.2 Configurer les variables d'environnement
```bash
# Copier le template
cp .env.production .env

# Éditer avec vos valeurs
nano .env
```

**Variables CRITIQUES à changer:**
- `DOMAIN=votre-domaine.com`
- `SECRET_KEY=` (générer avec `openssl rand -hex 32`)
- `POSTGRES_PASSWORD=` (générer avec `openssl rand -base64 32`)
- `REDIS_PASSWORD=` (générer avec `openssl rand -base64 32`)
- `MINIO_ROOT_PASSWORD=` (générer avec `openssl rand -base64 32`)

---

## 🔐 Étape 4: Configuration SSL avec Let's Encrypt

```bash
# Créer les dossiers
mkdir -p deployment/ssl

# Éditer nginx.conf et remplacer votre-domaine.com
nano deployment/nginx.conf

# Lancer nginx
docker compose -f docker-compose.prod.yml up -d nginx

# Obtenir le certificat
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email votre-email@example.com \
  --agree-tos \
  -d votre-domaine.com \
  -d www.votre-domaine.com

# Redémarrer nginx
docker compose -f docker-compose.prod.yml restart nginx
```

---

## 🚀 Étape 5: Lancer l'Application

```bash
# Build et démarrage
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

# Vérifier les logs
docker compose -f docker-compose.prod.yml logs -f
```

Accédez à: **https://votre-domaine.com**

---

## 🔄 Mise à jour

```bash
cd /home/deployer/sante-rurale
git pull origin main
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

---

## 📊 Commandes Utiles

```bash
# Logs en temps réel
docker compose -f docker-compose.prod.yml logs -f

# Redémarrer un service
docker compose -f docker-compose.prod.yml restart api

# Voir l'utilisation
docker stats

# Sauvegarder la DB
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U sante_prod sante_rurale_prod > backup.sql
```
