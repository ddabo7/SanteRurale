# ✅ Checklist de Déploiement - Santé Rurale

Suivez cette checklist étape par étape pour un déploiement réussi.

---

## 📋 Phase 1 : Préparation (Avant le Déploiement)

### 1.1 Serveur VPS

- [ ] VPS Hostinger commandé
- [ ] OS installé : Ubuntu 22.04 LTS
- [ ] Spécifications vérifiées :
  - [ ] Minimum 2 CPU (4 recommandé)
  - [ ] Minimum 4 GB RAM (8 GB recommandé)
  - [ ] Minimum 40 GB disque (80 GB recommandé)
- [ ] IP publique notée : `___________________`
- [ ] Accès SSH root testé : `ssh root@IP_SERVEUR`

### 1.2 Nom de Domaine

- [ ] Nom de domaine acheté : `___________________`
- [ ] Enregistrement DNS A configuré :
  - [ ] `votre-domaine.com` → IP du serveur
  - [ ] `www.votre-domaine.com` → IP du serveur
- [ ] DNS propagé (vérifier : `nslookup votre-domaine.com`)
  - ⏰ Attendre 24-48h si nécessaire

### 1.3 Fichiers du Projet

- [ ] Code source disponible localement
- [ ] Méthode de transfert choisie :
  - [ ] Git (recommandé)
  - [ ] SCP
  - [ ] SFTP
- [ ] Fichiers transférés sur le serveur

### 1.4 Comptes Externes (Optionnel)

- [ ] Compte Sentry créé sur [sentry.io](https://sentry.io)
- [ ] Projet Sentry pour backend créé
- [ ] Projet Sentry pour frontend créé
- [ ] DSN Sentry notés :
  - Backend : `___________________`
  - Frontend : `___________________`

---

## 🚀 Phase 2 : Déploiement Automatique

### 2.1 Connexion au Serveur

```bash
ssh root@VOTRE_IP_SERVEUR
```

- [ ] Connexion SSH réussie
- [ ] Utilisateur actuel : `root`

### 2.2 Préparation du Script

```bash
# Naviguer vers les fichiers du projet
cd /chemin/vers/projet/deployment

# Rendre le script exécutable
chmod +x deploy.sh

# Vérifier le contenu
ls -la
```

- [ ] Script `deploy.sh` présent
- [ ] Script exécutable (permissions)

### 2.3 Lancement du Déploiement

```bash
sudo ./deploy.sh --full --domain votre-domaine.com
```

- [ ] Script démarré
- [ ] Installation des dépendances en cours...

**⏰ Attendez 10-15 minutes**

### 2.4 Surveillance du Déploiement

Observer les étapes suivantes affichées par le script :

- [ ] ✅ Mise à jour du système
- [ ] ✅ Installation Python 3.12
- [ ] ✅ Installation Node.js 20
- [ ] ✅ Installation PostgreSQL 14
- [ ] ✅ Installation Nginx
- [ ] ✅ Configuration du firewall UFW
- [ ] ✅ Création de la base de données
- [ ] ✅ Déploiement du backend
- [ ] ✅ Déploiement du frontend
- [ ] ✅ Configuration Nginx
- [ ] ✅ Configuration SSL/TLS
- [ ] ✅ Configuration des backups

### 2.5 Récupération des Informations

À la fin du script, noter les informations affichées :

- [ ] Mot de passe DB : `___________________`
  ```bash
  # Sauvegarder aussi depuis :
  cat /root/.db_password_sante_rurale
  ```
- [ ] Secret Key : (dans `/var/www/sante-rurale/api/.env`)
- [ ] URLs de l'application :
  - Frontend : `https://votre-domaine.com`
  - API : `https://votre-domaine.com/api`
  - Health : `https://votre-domaine.com/health`

---

## 🔧 Phase 3 : Configuration Post-Déploiement

### 3.1 Configuration Backend (.env)

```bash
nano /var/www/sante-rurale/api/.env
```

Vérifier/Modifier :

- [ ] `ENVIRONMENT=production`
- [ ] `DATABASE_URL` correct
- [ ] `SECRET_KEY` présent (généré automatiquement)
- [ ] `ALLOWED_ORIGINS` avec votre domaine
- [ ] `SENTRY_DSN` configuré (optionnel)

**Sauvegarder** : `Ctrl+O`, `Enter`, `Ctrl+X`

### 3.2 Configuration Frontend (.env.production)

```bash
nano /var/www/sante-rurale/pwa/.env.production
```

Configurer :

- [ ] `VITE_API_URL=https://votre-domaine.com/api`
- [ ] `VITE_ENVIRONMENT=production`
- [ ] `VITE_SENTRY_DSN` (optionnel)
- [ ] `VITE_DEBUG_MODE=false`

**Rebuild si modifié** :
```bash
cd /var/www/sante-rurale/pwa
npm run build
```

- [ ] Build terminé sans erreur

### 3.3 Redémarrage des Services

```bash
systemctl restart sante-rurale-api
systemctl reload nginx
```

- [ ] Backend redémarré : `systemctl status sante-rurale-api`
- [ ] Nginx rechargé : `systemctl status nginx`

---

## ✅ Phase 4 : Vérifications

### 4.1 Vérification des Services

```bash
# Backend
systemctl status sante-rurale-api
```
- [ ] ✅ Active (running)

```bash
# Nginx
systemctl status nginx
```
- [ ] ✅ Active (running)

```bash
# PostgreSQL
systemctl status postgresql
```
- [ ] ✅ Active (running)

### 4.2 Tests des Endpoints

```bash
# Health check (depuis le serveur)
curl http://localhost:8000/health
```
- [ ] ✅ Réponse : `{"status":"healthy"}`

```bash
# Health check HTTPS (depuis votre navigateur)
https://votre-domaine.com/health
```
- [ ] ✅ Certificat SSL valide (cadenas vert)
- [ ] ✅ Réponse JSON affichée

```bash
# Frontend (depuis votre navigateur)
https://votre-domaine.com
```
- [ ] ✅ Page de login affichée
- [ ] ✅ Pas d'erreurs dans la console (F12)

```bash
# API Documentation (depuis votre navigateur)
https://votre-domaine.com/api/docs
```
- [ ] ⚠️ Devrait être désactivé en production (normal)
- [ ] Ou accessible si configuré

### 4.3 Test de Connexion

- [ ] Créer un utilisateur test (via script ou DB)
- [ ] Se connecter depuis le frontend
- [ ] ✅ Connexion réussie
- [ ] ✅ Dashboard affiché

### 4.4 Tests Fonctionnels

- [ ] Créer un patient
- [ ] Créer une consultation
- [ ] Tester la synchronisation offline :
  - [ ] Désactiver le réseau (mode avion)
  - [ ] Créer des données
  - [ ] Réactiver le réseau
  - [ ] ✅ Synchronisation automatique

### 4.5 Vérification des Logs

```bash
# Backend (dernières 50 lignes)
journalctl -u sante-rurale-api -n 50
```
- [ ] ✅ Pas d'erreurs critiques

```bash
# Nginx
tail -n 50 /var/log/nginx/sante-rurale-error.log
```
- [ ] ✅ Pas d'erreurs 500

```bash
# Logs en temps réel
journalctl -u sante-rurale-api -f
```
- [ ] ✅ Requêtes s'affichent correctement

### 4.6 Test SSL/TLS

Tester sur [SSL Labs](https://www.ssllabs.com/ssltest/) :

- [ ] Grade : A ou A+
- [ ] Certificat valide
- [ ] Pas de vulnérabilités

Ou en ligne de commande :
```bash
curl -I https://votre-domaine.com
```
- [ ] ✅ Header `Strict-Transport-Security` présent
- [ ] ✅ Header `X-Content-Type-Options` présent

---

## 🔒 Phase 5 : Sécurité

### 5.1 Firewall

```bash
ufw status
```
- [ ] ✅ Status: active
- [ ] ✅ Ports ouverts : 22 (SSH), 80 (HTTP), 443 (HTTPS)

### 5.2 Fail2Ban

```bash
systemctl status fail2ban
```
- [ ] ✅ Active (running)

### 5.3 Permissions des Fichiers

```bash
# Vérifier .env
ls -la /var/www/sante-rurale/api/.env
```
- [ ] ✅ Permissions : `-rw-------` (600)
- [ ] ✅ Propriétaire : `www-data:www-data`

### 5.4 Mots de Passe

- [ ] ✅ Mot de passe DB sauvegardé en lieu sûr
- [ ] ✅ Secret JWT sauvegardé en lieu sûr
- [ ] ✅ Mot de passe root serveur changé (si par défaut)

---

## 📊 Phase 6 : Monitoring (Optionnel)

### 6.1 Sentry

Si configuré :

```bash
# Vérifier le DSN dans .env
grep SENTRY_DSN /var/www/sante-rurale/api/.env
```

- [ ] DSN présent
- [ ] Tester une erreur volontaire
- [ ] ✅ Erreur visible sur sentry.io

### 6.2 Prometheus

```bash
curl http://localhost:8000/metrics
```
- [ ] ✅ Métriques affichées

Ou depuis le navigateur :
```
https://votre-domaine.com/metrics
```

### 6.3 Backups

```bash
# Test manuel
/usr/local/bin/backup-sante-rurale.sh
```
- [ ] ✅ Backup créé

```bash
# Vérifier les backups
ls -lh /var/backups/sante-rurale/
```
- [ ] ✅ Fichiers de backup présents

```bash
# Vérifier le cron
crontab -l
```
- [ ] ✅ Backup quotidien à 2h00 configuré

---

## 📝 Phase 7 : Documentation

### 7.1 Documenter l'Installation

Créer un fichier de notes personnelles :

```bash
nano ~/deploiement-notes.txt
```

Noter :
- [ ] Date de déploiement : `___________________`
- [ ] Version déployée : `___________________`
- [ ] IP du serveur : `___________________`
- [ ] Domaine : `___________________`
- [ ] Emplacement du mot de passe DB : `___________________`
- [ ] Compte Sentry : `___________________`
- [ ] Problèmes rencontrés : `___________________`

### 7.2 Créer un Accès Admin

- [ ] Créer le premier utilisateur admin
- [ ] Tester la connexion admin
- [ ] Documenter les identifiants (en lieu sûr)

---

## 🎉 Phase 8 : Mise en Production

### 8.1 Tests Utilisateurs

- [ ] Inviter 2-3 utilisateurs pilotes
- [ ] Tester sur différents appareils :
  - [ ] Desktop (Chrome, Firefox, Safari)
  - [ ] Mobile (Android, iOS)
  - [ ] Tablette
- [ ] Tester en conditions réelles (zone rurale si possible)

### 8.2 Formation

- [ ] Former les utilisateurs
- [ ] Créer des guides utilisateurs
- [ ] Préparer le support technique

### 8.3 Communication

- [ ] Annoncer le déploiement
- [ ] Communiquer les URLs d'accès
- [ ] Fournir les contacts support

---

## 🔄 Phase 9 : Maintenance Continue

### 9.1 Hebdomadaire

- [ ] Vérifier les logs d'erreurs
- [ ] Vérifier l'espace disque : `df -h`
- [ ] Vérifier les backups : `ls /var/backups/sante-rurale/`
- [ ] Surveiller Sentry (si configuré)

### 9.2 Mensuel

- [ ] Mettre à jour le système : `apt update && apt upgrade`
- [ ] Vérifier les certificats SSL
- [ ] Analyser les performances
- [ ] Nettoyer les vieux logs/backups

### 9.3 En Cas de Problème

Voir :
- **[deployment/README.md - Dépannage](README.md#dépannage)**
- **[DEPLOIEMENT_HOSTINGER.md](../DEPLOIEMENT_HOSTINGER.md)**

---

## 📞 Support

### Commandes Rapides

```bash
# Redémarrer tout
systemctl restart sante-rurale-api nginx

# Voir les logs
journalctl -u sante-rurale-api -f

# Backup manuel
/usr/local/bin/backup-sante-rurale.sh

# Status de tous les services
systemctl status sante-rurale-api nginx postgresql
```

### Documentation

- 📖 [deployment/INDEX.md](INDEX.md)
- 🚀 [deployment/QUICK_START.md](QUICK_START.md)
- 📘 [deployment/README.md](README.md)

---

## ✅ Résumé Final

Cochez toutes les cases ci-dessous avant de considérer le déploiement comme réussi :

### Critique
- [ ] ✅ Serveur accessible via SSH
- [ ] ✅ Services actifs (backend, nginx, postgresql)
- [ ] ✅ SSL/HTTPS fonctionnel
- [ ] ✅ Frontend accessible : `https://votre-domaine.com`
- [ ] ✅ API répond : `https://votre-domaine.com/health`
- [ ] ✅ Connexion utilisateur fonctionne
- [ ] ✅ Création de données fonctionne
- [ ] ✅ Synchronisation offline fonctionne

### Important
- [ ] ✅ Backups configurés
- [ ] ✅ Logs accessibles et sans erreurs
- [ ] ✅ Firewall activé
- [ ] ✅ Mots de passe sauvegardés
- [ ] ✅ Documentation à jour

### Recommandé
- [ ] ⚪ Sentry configuré
- [ ] ⚪ Tests utilisateurs effectués
- [ ] ⚪ Formation réalisée
- [ ] ⚪ Grade SSL A ou A+

---

**🎉 Félicitations ! Votre application est en production !**

Date de déploiement : `___________________`
Signature : `___________________`
