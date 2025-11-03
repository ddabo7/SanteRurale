# 📚 Documentation de Déploiement - Index

Bienvenue dans la documentation de déploiement de **Santé Rurale**.

## 🎯 Par Où Commencer ?

### Vous voulez déployer rapidement ?
👉 **[QUICK_START.md](QUICK_START.md)** - Déploiement en 5 minutes avec le script automatisé

### Vous voulez comprendre chaque étape ?
👉 **[README.md](README.md)** - Guide complet étape par étape avec explications détaillées

### Vous utilisez Hostinger VPS ?
👉 **[DEPLOIEMENT_HOSTINGER.md](../DEPLOIEMENT_HOSTINGER.md)** - Guide spécifique pour Hostinger

## 📁 Fichiers Disponibles

### Guides de Déploiement

| Fichier | Description | Niveau | Temps Estimé |
|---------|-------------|--------|--------------|
| **[QUICK_START.md](QUICK_START.md)** | Déploiement rapide automatisé | Débutant | 5-15 min |
| **[README.md](README.md)** | Guide complet avec explications | Intermédiaire | 30-60 min |
| **[DEPLOIEMENT_HOSTINGER.md](../DEPLOIEMENT_HOSTINGER.md)** | Guide spécifique Hostinger VPS | Tous niveaux | 45-90 min |

### Scripts et Configurations

| Fichier | Description | Usage |
|---------|-------------|-------|
| **[deploy.sh](deploy.sh)** | Script de déploiement automatisé | `sudo ./deploy.sh --full --domain exemple.com` |
| **[sante-rurale-api.service](sante-rurale-api.service)** | Service systemd pour le backend | Copier dans `/etc/systemd/system/` |
| **[nginx-sante-rurale.conf](nginx-sante-rurale.conf)** | Configuration Nginx complète | Copier dans `/etc/nginx/sites-available/` |

### Fichiers de Configuration

| Fichier | Description | Destination |
|---------|-------------|-------------|
| **[.env.production.example](.env.production.example)** | Variables d'environnement backend | `/var/www/sante-rurale/api/.env` |
| **[.env.frontend.production.example](.env.frontend.production.example)** | Variables d'environnement frontend | `/var/www/sante-rurale/pwa/.env.production` |

### Documentation Additionnelle

| Fichier | Description |
|---------|-------------|
| **[../HTTPS_SSL_GUIDE.md](../HTTPS_SSL_GUIDE.md)** | Configuration SSL/TLS avec Let's Encrypt |
| **[../MONITORING_GUIDE.md](../MONITORING_GUIDE.md)** | Sentry + Prometheus + Grafana |
| **[../PRODUCTION_READINESS_REPORT.md](../PRODUCTION_READINESS_REPORT.md)** | Rapport complet de préparation production |
| **[../VALIDATION_FINALE.md](../VALIDATION_FINALE.md)** | Validation et résultats des tests |

## 🚀 Scénarios de Déploiement

### Scénario 1 : Première Installation (Recommandé)

**Objectif** : Installer l'application complète sur un nouveau serveur

**Étapes** :
1. Lisez [QUICK_START.md](QUICK_START.md)
2. Exécutez `sudo ./deploy.sh --full --domain votre-domaine.com`
3. Suivez les vérifications dans [README.md](README.md#vérifications-post-déploiement)

**Prérequis** :
- VPS Ubuntu 22.04
- Nom de domaine configuré
- Accès SSH root

**Temps** : 15-20 minutes

---

### Scénario 2 : Déploiement Manuel (Pour apprendre)

**Objectif** : Comprendre chaque étape du déploiement

**Étapes** :
1. Lisez [README.md](README.md) section "Déploiement Manuel"
2. Suivez chaque étape une par une
3. Consultez [DEPLOIEMENT_HOSTINGER.md](../DEPLOIEMENT_HOSTINGER.md) pour plus de détails

**Prérequis** :
- Connaissances Linux de base
- Compréhension de systemd, nginx, postgresql

**Temps** : 1-2 heures

---

### Scénario 3 : Mise à Jour d'une Installation Existante

**Objectif** : Mettre à jour une application déjà déployée

**Étapes** :
1. Sauvegardez : `/usr/local/bin/backup-sante-rurale.sh`
2. Exécutez `sudo ./deploy.sh --update`
3. Vérifiez les services

**Temps** : 5-10 minutes

---

### Scénario 4 : Déploiement Backend Uniquement

**Objectif** : Mettre à jour uniquement l'API backend

**Commande** :
```bash
sudo ./deploy.sh --backend
```

**Cas d'usage** :
- Correction de bugs backend
- Nouvelles routes API
- Modifications de modèles de données

---

### Scénario 5 : Déploiement Frontend Uniquement

**Objectif** : Mettre à jour uniquement l'interface utilisateur

**Commande** :
```bash
sudo ./deploy.sh --frontend
```

**Cas d'usage** :
- Modifications de l'UI
- Corrections de bugs frontend
- Nouvelles fonctionnalités PWA

## 🔧 Configuration Requise

### Serveur (Minimum)

- **OS** : Ubuntu 22.04 LTS
- **CPU** : 2 cœurs
- **RAM** : 4 GB
- **Disque** : 40 GB SSD
- **Bande passante** : Illimitée recommandée

### Serveur (Recommandé pour Production)

- **OS** : Ubuntu 22.04 LTS
- **CPU** : 4 cœurs
- **RAM** : 8 GB
- **Disque** : 80 GB SSD
- **Bande passante** : Illimitée

### Logiciels Installés Automatiquement

- Python 3.12
- Node.js 20 LTS
- PostgreSQL 14
- Nginx
- Certbot (Let's Encrypt)
- UFW (Firewall)
- Fail2Ban (Sécurité)

## 📋 Checklist de Pré-Déploiement

Avant de commencer, assurez-vous d'avoir :

- [ ] VPS actif avec Ubuntu 22.04
- [ ] Accès SSH root configuré
- [ ] Nom de domaine acheté
- [ ] DNS configuré (A record pointant vers l'IP du VPS)
- [ ] Fichiers du projet disponibles (via git ou scp)
- [ ] Compte Sentry créé (optionnel mais recommandé)
- [ ] Backups de données existantes (si mise à jour)

## 🛠️ Utilisation des Scripts

### Script Principal : deploy.sh

```bash
# Aide
./deploy.sh --help

# Déploiement complet (première fois)
sudo ./deploy.sh --full --domain exemple.com

# Mise à jour
sudo ./deploy.sh --update

# Backend uniquement
sudo ./deploy.sh --backend

# Frontend uniquement
sudo ./deploy.sh --frontend

# Avec un domaine spécifique
sudo ./deploy.sh --full --domain monsite.com
```

### Fichiers de Configuration

#### Backend (.env)

```bash
# 1. Copier l'exemple
cp deployment/.env.production.example /var/www/sante-rurale/api/.env

# 2. Éditer avec vos valeurs
nano /var/www/sante-rurale/api/.env

# 3. Sécuriser
chmod 600 /var/www/sante-rurale/api/.env
chown www-data:www-data /var/www/sante-rurale/api/.env
```

#### Frontend (.env.production)

```bash
# 1. Copier l'exemple
cp deployment/.env.frontend.production.example /var/www/sante-rurale/pwa/.env.production

# 2. Éditer avec vos valeurs
nano /var/www/sante-rurale/pwa/.env.production

# 3. Rebuild
cd /var/www/sante-rurale/pwa
npm run build
```

## 📊 Architecture de Déploiement

```
┌─────────────────────────────────────────────────────────┐
│                    Internet                              │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                 Nginx (Port 80/443)                      │
│              - SSL/TLS (Let's Encrypt)                   │
│              - Reverse Proxy                             │
│              - Static Files (Frontend)                   │
└────────────┬─────────────────────────┬──────────────────┘
             │                         │
    Frontend │                         │ API /api
             ▼                         ▼
┌────────────────────┐    ┌────────────────────────────┐
│  React PWA (dist)  │    │  FastAPI (Port 8000)       │
│  - Service Worker  │    │  - Uvicorn (4 workers)     │
│  - IndexedDB       │    │  - systemd service         │
│  - Offline Mode    │    │  - Python 3.12 venv        │
└────────────────────┘    └──────────┬─────────────────┘
                                     │
                                     ▼
                          ┌────────────────────┐
                          │  PostgreSQL 14     │
                          │  - Database        │
                          │  - User/Password   │
                          └────────────────────┘
```

## 🔐 Sécurité

### Pratiques de Sécurité Implémentées

✅ **HTTPS/SSL** - Certificat Let's Encrypt automatique
✅ **Firewall UFW** - Ports 22, 80, 443 uniquement
✅ **Fail2Ban** - Protection contre brute force
✅ **Security Headers** - HSTS, CSP, X-Frame-Options
✅ **Rate Limiting** - Protection API contre abus
✅ **Secrets Management** - Variables d'environnement sécurisées
✅ **Permissions** - Utilisateur www-data non-privilégié
✅ **Backups** - Automatiques quotidiens

### Recommandations Additionnelles

- Changez le port SSH par défaut (22)
- Utilisez des clés SSH au lieu de mots de passe
- Activez 2FA pour les comptes critiques
- Surveillez les logs régulièrement
- Mettez à jour le système régulièrement

## 📞 Obtenir de l'Aide

### En Cas de Problème

1. **Consultez les logs** :
   ```bash
   journalctl -u sante-rurale-api -n 100
   tail -f /var/log/nginx/sante-rurale-error.log
   ```

2. **Section Dépannage** :
   - [README.md - Dépannage](README.md#dépannage)
   - [DEPLOIEMENT_HOSTINGER.md - Troubleshooting](../DEPLOIEMENT_HOSTINGER.md)

3. **Vérifications Basiques** :
   ```bash
   systemctl status sante-rurale-api nginx postgresql
   ss -tunlp | grep :8000
   nginx -t
   ```

### Documentation Complète

- 📖 [Guide de Production](../PRODUCTION_READINESS_REPORT.md)
- 🔒 [Guide SSL/HTTPS](../HTTPS_SSL_GUIDE.md)
- 📊 [Guide Monitoring](../MONITORING_GUIDE.md)
- ✅ [Rapport de Validation](../VALIDATION_FINALE.md)

## 🎉 Après le Déploiement

Une fois déployé avec succès :

1. ✅ Testez toutes les fonctionnalités principales
2. ✅ Configurez Sentry pour le monitoring d'erreurs
3. ✅ Vérifiez que les backups fonctionnent
4. ✅ Testez la synchronisation offline
5. ✅ Vérifiez la performance (temps de chargement)
6. ✅ Testez sur différents appareils (mobile, tablette)
7. ✅ Configurez les alertes (optionnel)

## 📈 Prochaines Étapes

- **Monitoring** : Configurez Prometheus + Grafana ([MONITORING_GUIDE.md](../MONITORING_GUIDE.md))
- **CI/CD** : Automatisez les déploiements avec GitHub Actions
- **Tests** : Exécutez les tests automatisés régulièrement
- **Optimisation** : Analysez les performances et optimisez
- **Documentation** : Formez les utilisateurs finaux

---

**Bonne chance avec votre déploiement ! 🚀**

Pour toute question, consultez la documentation ou les logs du système.
