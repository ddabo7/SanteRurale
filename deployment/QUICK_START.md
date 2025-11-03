# 🚀 Déploiement Rapide - 5 Minutes

Guide ultra-rapide pour déployer Santé Rurale sur Hostinger VPS.

## Prérequis

- VPS Hostinger Ubuntu 22.04 (2 CPU, 4GB RAM minimum)
- Accès SSH root
- Nom de domaine configuré

## Étapes

### 1️⃣ Connexion au Serveur

```bash
ssh root@votre-ip-serveur
```

### 2️⃣ Téléchargement des Fichiers

```bash
# Option A : Via Git (si votre projet est sur GitHub)
git clone https://github.com/votre-repo/sante-rurale.git
cd sante-rurale

# Option B : Via SCP depuis votre machine locale
# (exécuter depuis votre machine locale, pas le serveur)
scp -r /chemin/local/sante-rurale root@votre-ip:/root/
```

### 3️⃣ Lancement du Script de Déploiement

```bash
cd deployment
chmod +x deploy.sh
sudo ./deploy.sh --full --domain votre-domaine.com
```

**C'est tout !** ✨

Le script va automatiquement :
- ✅ Installer toutes les dépendances
- ✅ Configurer PostgreSQL
- ✅ Déployer le backend
- ✅ Déployer le frontend
- ✅ Configurer Nginx + SSL
- ✅ Mettre en place les backups

### 4️⃣ Accéder à l'Application

Après 10-15 minutes, votre application sera accessible à :

- **Frontend** : https://votre-domaine.com
- **API** : https://votre-domaine.com/api
- **Docs API** : https://votre-domaine.com/api/docs (désactivé en production)
- **Health Check** : https://votre-domaine.com/health

## Configuration Post-Déploiement

### Récupérer le Mot de Passe de la Base de Données

```bash
cat /root/.db_password_sante_rurale
```

**⚠️ IMPORTANT** : Sauvegardez ce mot de passe dans un endroit sécurisé !

### Créer le Premier Utilisateur Admin

```bash
# Se connecter à la base de données
sudo -u postgres psql sante_rurale

# Créer un utilisateur admin (à adapter selon votre schéma)
# Les mots de passe doivent être hashés avec bcrypt
```

Ou utilisez le script de seeding si vous en avez un :
```bash
cd /var/www/sante-rurale/api
./venv/bin/python scripts/create_admin.py
```

### Configurer Sentry (Monitoring d'Erreurs)

1. Créez un compte sur [sentry.io](https://sentry.io)
2. Créez un projet FastAPI
3. Copiez le DSN
4. Modifiez `/var/www/sante-rurale/api/.env` :
   ```bash
   SENTRY_DSN=https://votre-cle@sentry.io/projet-id
   ```
5. Redémarrez l'API :
   ```bash
   systemctl restart sante-rurale-api
   ```

## Vérifications

### Vérifier que Tout Fonctionne

```bash
# Backend
systemctl status sante-rurale-api
curl http://localhost:8000/health

# Nginx
systemctl status nginx
curl -I https://votre-domaine.com

# SSL
curl https://votre-domaine.com/health

# Base de données
sudo -u postgres psql -d sante_rurale -c "SELECT version();"
```

Toutes ces commandes doivent réussir ✅

### Voir les Logs en Temps Réel

```bash
# Backend
journalctl -u sante-rurale-api -f

# Nginx
tail -f /var/log/nginx/sante-rurale-access.log
```

## Commandes Utiles

```bash
# Redémarrer le backend
systemctl restart sante-rurale-api

# Recharger Nginx (après modif config)
systemctl reload nginx

# Voir tous les services
systemctl status sante-rurale-api nginx postgresql

# Backup manuel
/usr/local/bin/backup-sante-rurale.sh

# Voir les backups
ls -lh /var/backups/sante-rurale/
```

## Mises à Jour Futures

```bash
# 1. Récupérer le nouveau code
cd /chemin/vers/nouveau/code

# 2. Mettre à jour
sudo ./deployment/deploy.sh --update
```

## En Cas de Problème

### Backend ne démarre pas
```bash
journalctl -u sante-rurale-api -n 50
```

### Erreur 502 Bad Gateway
```bash
# Vérifier que l'API tourne
ss -tunlp | grep :8000

# Redémarrer
systemctl restart sante-rurale-api
```

### SSL ne fonctionne pas
```bash
certbot --nginx -d votre-domaine.com
systemctl reload nginx
```

## 📚 Documentation Complète

Pour plus de détails, consultez :

- **[README.md](README.md)** - Guide complet étape par étape
- **[DEPLOIEMENT_HOSTINGER.md](../DEPLOIEMENT_HOSTINGER.md)** - Guide détaillé Hostinger
- **[HTTPS_SSL_GUIDE.md](../HTTPS_SSL_GUIDE.md)** - Guide SSL/TLS
- **[MONITORING_GUIDE.md](../MONITORING_GUIDE.md)** - Guide Monitoring

## Support

Si vous rencontrez des problèmes :

1. Consultez la section Dépannage dans [README.md](README.md)
2. Vérifiez les logs (voir section Logs)
3. Consultez la documentation complète

---

**Temps total** : ~15 minutes
**Difficulté** : Facile (tout est automatisé)
**Résultat** : Application en production avec SSL, backups, et monitoring ✨
