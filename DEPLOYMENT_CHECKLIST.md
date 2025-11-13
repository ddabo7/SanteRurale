# ✅ Checklist de Déploiement Production

## 📋 Avant le Déploiement

### VPS Hostinger
- [ ] VPS provisionné (Ubuntu 22.04, 4GB RAM min)
- [ ] Accès SSH root configuré
- [ ] IP statique obtenue

### Domaine
- [ ] Nom de domaine acheté
- [ ] DNS A record configuré: `votre-domaine.com` → IP VPS
- [ ] DNS A record configuré: `www.votre-domaine.com` → IP VPS
- [ ] Propagation DNS vérifiée (dig/nslookup)

### Code Source
- [ ] Code pushé sur Git (GitHub/GitLab)
- [ ] Branch `main` à jour
- [ ] Tests passent en local

---

## 🔧 Configuration Serveur

### Installation Système
- [ ] Connexion SSH réussie
- [ ] Système à jour: `apt update && apt upgrade`
- [ ] Firewall configuré (ufw): ports 22, 80, 443
- [ ] Utilisateur non-root créé: `deployer`
- [ ] Docker installé
- [ ] Docker Compose installé
- [ ] Utilisateur ajouté au groupe docker
- [ ] Fail2ban installé (optionnel)

### Sécurité
- [ ] Clé SSH générée
- [ ] Auth par mot de passe SSH désactivée
- [ ] Fail2ban configuré

---

## 🔐 Configuration Application

### Fichiers de Configuration
- [ ] `.env.production` copié vers `.env`
- [ ] `deployment/nginx.conf` édité (domaine remplacé)

### Variables d'Environnement (.env)
- [ ] `DOMAIN` = votre-domaine.com
- [ ] `VITE_API_URL` = https://votre-domaine.com/v1
- [ ] `ALLOWED_ORIGINS` = https://votre-domaine.com
- [ ] `SECRET_KEY` généré (openssl rand -hex 32)
- [ ] `POSTGRES_PASSWORD` généré (openssl rand -base64 32)
- [ ] `REDIS_PASSWORD` généré (openssl rand -base64 32)
- [ ] `MINIO_ROOT_USER` défini
- [ ] `MINIO_ROOT_PASSWORD` généré (openssl rand -base64 32)

### Nginx
- [ ] `server_name` modifié dans nginx.conf (3 occurrences)
- [ ] Chemins SSL mis à jour avec votre domaine

---

## 🚀 Déploiement

### Build et Lancement
- [ ] Code cloné sur le serveur: `git clone`
- [ ] Images Docker buildées: `./deploy.sh build`
- [ ] Services démarrés: `./deploy.sh start`
- [ ] Logs vérifiés: `./deploy.sh logs`

### SSL/TLS
- [ ] Nginx démarré
- [ ] Certificat Let's Encrypt obtenu: `./deploy.sh ssl`
- [ ] Nginx redémarré
- [ ] HTTPS accessible
- [ ] HTTP redirige vers HTTPS

### Tests Post-Déploiement
- [ ] API Health check: `curl https://votre-domaine.com/health`
- [ ] Frontend accessible: `https://votre-domaine.com`
- [ ] Login fonctionne
- [ ] Création de patient fonctionne
- [ ] Upload de fichiers fonctionne
- [ ] Mode offline fonctionne
- [ ] Rapports accessibles

---

## 🔄 Automatisation

### Cron Jobs
- [ ] Backup DB quotidien configuré (2h du matin)
- [ ] Renouvellement SSL automatique (3h du matin)

```bash
crontab -e
# Ajouter:
0 2 * * * cd /home/deployer/sante-rurale && ./deploy.sh backup
0 3 * * * cd /home/deployer/sante-rurale && ./deploy.sh ssl-renew
```

---

## 📊 Monitoring

### Health Checks
- [ ] API `/health` endpoint répond
- [ ] Tous les services Docker running
- [ ] Logs accessibles et sans erreurs critiques

### Performance
- [ ] Temps de réponse API < 500ms
- [ ] Frontend chargé en < 3s
- [ ] Utilisation CPU < 50%
- [ ] Utilisation RAM < 80%
- [ ] Utilisation disque < 70%

### Monitoring (Optionnel)
- [ ] Sentry configuré pour le monitoring d'erreurs
- [ ] Uptime monitor configuré (UptimeRobot, etc.)
- [ ] Alertes configurées

---

## 🔒 Sécurité Post-Déploiement

### Vérifications
- [ ] Ports non-essentiels fermés
- [ ] Headers de sécurité présents (HSTS, CSP, etc.)
- [ ] Certificat SSL valide (Grade A sur SSLLabs)
- [ ] Rate limiting actif
- [ ] Logs d'accès configurés

### Tests de Sécurité
- [ ] Test SSL: https://www.ssllabs.com/ssltest/
- [ ] Test Headers: https://securityheaders.com/
- [ ] Scan de vulnérabilités (optionnel)

---

## 📚 Documentation

### Documents à Conserver
- [ ] Credentials sécurisés (gestionnaire de mots de passe)
- [ ] IP du serveur notée
- [ ] Nom d'utilisateur SSH noté
- [ ] Emplacement backup noté
- [ ] Procédure de restauration documentée

### Formation Équipe
- [ ] Accès fournis aux membres de l'équipe
- [ ] Formation sur le monitoring
- [ ] Procédure de mise à jour expliquée

---

## 🎉 Go Live!

### Annonce
- [ ] Utilisateurs informés de la nouvelle URL
- [ ] Documentation utilisateur mise à jour
- [ ] Support disponible pour les premières 24h

### Surveillance J+1
- [ ] Logs surveillés pendant 24h
- [ ] Aucune erreur critique
- [ ] Performances stables
- [ ] Utilisateurs satisfaits

---

## 📞 Contacts Urgence

**Hébergeur**: Hostinger Support
**Domaine**: Registrar Support
**Développeur**: [Votre contact]

---

## 🆘 Rollback d'Urgence

En cas de problème critique:

```bash
# Arrêter les services
./deploy.sh stop

# Revenir à la version précédente
git checkout <commit-precedent>

# Rebuild et restart
./deploy.sh build
./deploy.sh start

# Restaurer le backup DB si nécessaire
./deploy.sh restore backups/backup_TIMESTAMP.sql.gz
```

---

**Date de déploiement**: _____________

**Validé par**: _____________

**Signature**: _____________
