# 📦 Fichiers de Déploiement Production

Voici tous les fichiers nécessaires pour déployer **Santé Rurale** sur Hostinger VPS.

## 📁 Fichiers créés

### 1. **docker-compose.prod.yml**
Configuration Docker Compose optimisée pour la production avec:
- PostgreSQL 16
- Redis 7
- MinIO (S3)
- API FastAPI (avec Gunicorn)
- Celery Worker
- Frontend PWA (build production)
- Nginx (reverse proxy)
- Certbot (SSL/TLS)
- Limits de ressources
- Health checks
- Logging structuré
- Auto-restart

### 2. **deployment/nginx.conf**
Configuration Nginx complète avec:
- Reverse proxy pour API et Frontend
- SSL/TLS avec Let's Encrypt
- HTTP/2 enabled
- Compression gzip
- Rate limiting (API et login)
- Security headers (HSTS, CSP, etc.)
- Caching pour assets statiques
- Logs JSON structurés

### 3. **.env.production**
Template de variables d'environnement pour production.
**⚠️ À configurer avant le déploiement**

### 4. **deploy.sh**
Script bash interactif pour faciliter le déploiement.
Rend exécutable avec: `chmod +x deploy.sh`

### 5. **DEPLOYMENT_GUIDE.md**
Guide complet étape par étape pour déployer sur VPS Hostinger.

---

## 🚀 Déploiement Rapide

### Prérequis
- VPS Hostinger (Ubuntu 22.04, 4GB RAM min)
- Nom de domaine configuré
- Accès SSH root

### Étapes

```bash
# 1. Sur le VPS, installer Docker
curl -fsSL https://get.docker.com | sh

# 2. Cloner le projet
git clone <votre-repo>
cd sante-rurale

# 3. Configurer les variables d'environnement
cp .env.production .env
nano .env  # Éditer avec vos valeurs

# 4. Générer des secrets forts
./deploy.sh secrets

# 5. Build et lancer
./deploy.sh build
./deploy.sh start

# 6. Obtenir le certificat SSL
./deploy.sh ssl votre-domaine.com email@example.com

# 7. Vérifier que tout fonctionne
./deploy.sh status
./deploy.sh logs
```

Votre application est maintenant disponible sur **https://votre-domaine.com** 🎉

---

## 📋 Commandes du Script deploy.sh

```bash
./deploy.sh check         # Vérifier les prérequis
./deploy.sh secrets       # Générer des secrets
./deploy.sh build         # Build les images
./deploy.sh start         # Démarrer
./deploy.sh stop          # Arrêter
./deploy.sh restart       # Redémarrer
./deploy.sh logs [svc]    # Voir les logs
./deploy.sh status        # Statut des services
./deploy.sh backup        # Sauvegarder la DB
./deploy.sh ssl <dom> <@> # Obtenir certificat SSL
./deploy.sh update        # Mise à jour
./deploy.sh clean         # Nettoyer Docker
```

---

## 🔐 Sécurité

### Variables à changer ABSOLUMENT
Dans `.env`:
- `DOMAIN` → votre nom de domaine
- `SECRET_KEY` → générer avec `openssl rand -hex 32`
- `POSTGRES_PASSWORD` → générer avec `openssl rand -base64 32`
- `REDIS_PASSWORD` → générer avec `openssl rand -base64 32`
- `MINIO_ROOT_PASSWORD` → générer avec `openssl rand -base64 32`

### Nginx
Dans `deployment/nginx.conf`:
- Remplacer `votre-domaine.com` par votre vrai domaine (3 occurrences)

---

## 📊 Monitoring

### Health Checks
```bash
# API
curl https://votre-domaine.com/health

# Statut Docker
docker compose -f docker-compose.prod.yml ps
```

### Logs
```bash
# Tous les logs
docker compose -f docker-compose.prod.yml logs -f

# Un service spécifique
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f nginx
```

### Ressources
```bash
docker stats
```

---

## 🔄 Sauvegarde Automatique

Ajouter au crontab:
```bash
crontab -e

# Backup DB tous les jours à 2h
0 2 * * * cd /chemin/sante-rurale && ./deploy.sh backup

# Renouvellement SSL tous les jours à 3h
0 3 * * * cd /chemin/sante-rurale && ./deploy.sh ssl-renew
```

---

## 🆘 En cas de problème

### Logs d'erreur
```bash
./deploy.sh logs          # Voir tous les logs
./deploy.sh logs api      # Logs API seulement
./deploy.sh logs nginx    # Logs Nginx seulement
```

### Redémarrer un service
```bash
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml restart nginx
```

### Rebuild complet
```bash
./deploy.sh stop
./deploy.sh build
./deploy.sh start
```

### Nettoyer et recommencer
```bash
docker compose -f docker-compose.prod.yml down -v  # ⚠️ Supprime tout
./deploy.sh build
./deploy.sh start
```

---

## 📞 Support

Pour toute question, consultez:
- **DEPLOYMENT_GUIDE.md** - Guide détaillé
- **docker-compose.prod.yml** - Configuration Docker
- **deployment/nginx.conf** - Configuration Nginx

Bon déploiement! 🚀
