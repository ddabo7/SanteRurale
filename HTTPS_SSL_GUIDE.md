# Guide de Configuration HTTPS et SSL

Guide complet pour configurer HTTPS avec certificats SSL/TLS pour l'application Santé Rurale en production.

## 📋 Table des Matières

- [Prérequis](#prérequis)
- [Option 1: Let's Encrypt (Recommandé)](#option-1-lets-encrypt-recommandé)
- [Option 2: Certificat Commercial](#option-2-certificat-commercial)
- [Option 3: Certificat Auto-Signé (Dev/Test uniquement)](#option-3-certificat-auto-signé-devtest-uniquement)
- [Configuration Nginx](#configuration-nginx)
- [Renouvellement Automatique](#renouvellement-automatique)
- [Tests et Validation](#tests-et-validation)
- [Troubleshooting](#troubleshooting)

---

## 🔧 Prérequis

- Serveur Ubuntu/Debian avec accès root
- Nom de domaine configuré (ex: `sante-rurale.health`)
- DNS pointant vers votre serveur
- Ports 80 et 443 ouverts dans le firewall

```bash
# Vérifier que les ports sont ouverts
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## ✅ Option 1: Let's Encrypt (Recommandé)

Let's Encrypt fournit des certificats SSL/TLS **gratuits** et **automatiques**.

### Étape 1: Installer Certbot

```bash
# Mettre à jour les paquets
sudo apt update

# Installer Certbot et le plugin Nginx
sudo apt install certbot python3-certbot-nginx -y
```

### Étape 2: Obtenir un Certificat

```bash
# Remplacer par votre domaine
DOMAIN="sante-rurale.health"
API_DOMAIN="api.sante-rurale.health"

# Obtenir le certificat
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN -d $API_DOMAIN
```

**Questions interactives:**
1. Email: `admin@sante-rurale.health`
2. Terms of Service: `Agree`
3. Share email: `No`
4. Redirect HTTP to HTTPS: `Yes` (Recommandé)

### Étape 3: Vérifier l'Installation

```bash
# Vérifier les certificats
sudo certbot certificates

# Tester le renouvellement
sudo certbot renew --dry-run
```

### Étape 4: Configuration Automatique

Certbot configure automatiquement Nginx, mais voici ce qui est ajouté :

```nginx
# /etc/nginx/sites-available/sante-rurale

server {
    listen 443 ssl http2;
    server_name sante-rurale.health www.sante-rurale.health;

    # Certificats Let's Encrypt
    ssl_certificate /etc/letsencrypt/live/sante-rurale.health/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sante-rurale.health/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/sante-rurale.health/chain.pem;

    # Configuration SSL moderne
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;

    # Session SSL
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Headers de sécurité
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # PWA Frontend
    location / {
        root /var/www/sante-rurale/pwa/dist;
        try_files $uri $uri/ /index.html;
    }
}

# Redirection HTTP vers HTTPS
server {
    listen 80;
    server_name sante-rurale.health www.sante-rurale.health;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}
```

---

## 💼 Option 2: Certificat Commercial

Pour les organisations qui préfèrent un certificat payant (ex: DigiCert, Comodo).

### Étape 1: Générer une CSR (Certificate Signing Request)

```bash
# Créer un répertoire pour les certificats
sudo mkdir -p /etc/ssl/sante-rurale

# Générer la clé privée
sudo openssl genrsa -out /etc/ssl/sante-rurale/private.key 2048

# Générer la CSR
sudo openssl req -new -key /etc/ssl/sante-rurale/private.key \
  -out /etc/ssl/sante-rurale/request.csr \
  -subj "/C=FR/ST=Ile-de-France/L=Paris/O=Sante Rurale/CN=sante-rurale.health"
```

### Étape 2: Soumettre la CSR à l'Autorité de Certification

1. Copier le contenu de `request.csr`
2. Soumettre à votre CA (DigiCert, Sectigo, etc.)
3. Vérification du domaine (email, DNS, ou fichier)
4. Télécharger les certificats

### Étape 3: Installer les Certificats

```bash
# Copier les certificats reçus
sudo cp certificate.crt /etc/ssl/sante-rurale/certificate.crt
sudo cp intermediate.crt /etc/ssl/sante-rurale/intermediate.crt
sudo cp rootca.crt /etc/ssl/sante-rurale/rootca.crt

# Créer la chaîne complète
sudo cat /etc/ssl/sante-rurale/certificate.crt \
        /etc/ssl/sante-rurale/intermediate.crt \
        /etc/ssl/sante-rurale/rootca.crt > \
        /etc/ssl/sante-rurale/fullchain.crt

# Sécuriser les permissions
sudo chmod 600 /etc/ssl/sante-rurale/private.key
sudo chmod 644 /etc/ssl/sante-rurale/*.crt
```

### Étape 4: Configurer Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name sante-rurale.health;

    ssl_certificate /etc/ssl/sante-rurale/fullchain.crt;
    ssl_certificate_key /etc/ssl/sante-rurale/private.key;

    # ... reste de la configuration
}
```

---

## 🧪 Option 3: Certificat Auto-Signé (Dev/Test uniquement)

**⚠️ NE PAS UTILISER EN PRODUCTION**

Pour le développement local uniquement.

### Générer un Certificat Auto-Signé

```bash
# Créer le répertoire
mkdir -p ~/ssl-dev

# Générer le certificat
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ~/ssl-dev/selfsigned.key \
  -out ~/ssl-dev/selfsigned.crt \
  -subj "/C=FR/ST=Dev/L=Dev/O=Dev/CN=localhost"

# Configuration Nginx pour dev
server {
    listen 443 ssl;
    server_name localhost;

    ssl_certificate ~/ssl-dev/selfsigned.crt;
    ssl_certificate_key ~/ssl-dev/selfsigned.key;

    # ... reste de la configuration
}
```

---

## 🔧 Configuration Nginx Complète

### Configuration API Backend

```nginx
# /etc/nginx/sites-available/api.sante-rurale

server {
    listen 443 ssl http2;
    server_name api.sante-rurale.health;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/sante-rurale.health/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sante-rurale.health/privkey.pem;

    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Logging
    access_log /var/log/nginx/api.sante-rurale.access.log;
    error_log /var/log/nginx/api.sante-rurale.error.log;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy vers FastAPI
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
    }

    # Health check sans auth
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        access_log off;
    }
}

# Redirection HTTP vers HTTPS
server {
    listen 80;
    server_name api.sante-rurale.health;
    return 301 https://$server_name$request_uri;
}
```

### Activer la Configuration

```bash
# Tester la configuration
sudo nginx -t

# Activer le site
sudo ln -s /etc/nginx/sites-available/api.sante-rurale \
           /etc/nginx/sites-enabled/

# Recharger Nginx
sudo systemctl reload nginx
```

---

## 🔄 Renouvellement Automatique

### Let's Encrypt (Automatique)

```bash
# Vérifier le timer systemd
sudo systemctl status certbot.timer

# Le renouvellement se fait automatiquement tous les jours
# Si le certificat expire dans moins de 30 jours, il est renouvelé

# Tester manuellement
sudo certbot renew --dry-run
```

### Certificat Commercial (Manuel)

```bash
# Créer un rappel 30 jours avant expiration
# Ajouter à crontab pour vérification mensuelle

# Créer un script de vérification
cat > /usr/local/bin/check-ssl-expiry.sh << 'EOF'
#!/bin/bash
DOMAIN="sante-rurale.health"
EXPIRY=$(echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
EXPIRY_SECONDS=$(date -d "$EXPIRY" +%s)
NOW_SECONDS=$(date +%s)
DAYS_LEFT=$(( ($EXPIRY_SECONDS - $NOW_SECONDS) / 86400 ))

if [ $DAYS_LEFT -lt 30 ]; then
    echo "⚠️  SSL Certificate expires in $DAYS_LEFT days!"
    # Envoyer une alerte email
    echo "Certificate for $DOMAIN expires in $DAYS_LEFT days" | \
        mail -s "SSL Certificate Expiry Warning" admin@sante-rurale.health
fi
EOF

sudo chmod +x /usr/local/bin/check-ssl-expiry.sh

# Ajouter au crontab (vérification hebdomadaire)
(crontab -l 2>/dev/null; echo "0 0 * * 0 /usr/local/bin/check-ssl-expiry.sh") | crontab -
```

---

## ✅ Tests et Validation

### 1. Tester Localement

```bash
# Test connexion SSL
openssl s_client -connect sante-rurale.health:443 -servername sante-rurale.health

# Vérifier la chaîne de certificats
openssl s_client -showcerts -connect sante-rurale.health:443

# Vérifier la date d'expiration
echo | openssl s_client -servername sante-rurale.health -connect sante-rurale.health:443 2>/dev/null | openssl x509 -noout -dates
```

### 2. Tests en Ligne

- **SSL Labs**: https://www.ssllabs.com/ssltest/
  - Objectif: Note A ou A+

- **Security Headers**: https://securityheaders.com/
  - Vérifier tous les headers de sécurité

- **HTTP Observatory**: https://observatory.mozilla.org/

### 3. Tests de Redirection

```bash
# Test redirection HTTP vers HTTPS
curl -I http://sante-rurale.health
# Devrait retourner 301 vers https://

# Test HSTS header
curl -I https://sante-rurale.health | grep -i strict
```

---

## 🐛 Troubleshooting

### Problème: Certificat non reconnu

```bash
# Vérifier la chaîne de certificats
openssl verify -CAfile /etc/ssl/sante-rurale/rootca.crt \
               -untrusted /etc/ssl/sante-rurale/intermediate.crt \
               /etc/ssl/sante-rurale/certificate.crt
```

### Problème: Mixed Content

```bash
# Vérifier les ressources HTTP dans une page HTTPS
# Ouvrir les DevTools du navigateur → Console
# Rechercher les warnings "Mixed Content"

# Forcer HTTPS dans Nginx
add_header Content-Security-Policy "upgrade-insecure-requests" always;
```

### Problème: Certificat expiré

```bash
# Renouveler manuellement
sudo certbot renew --force-renewal

# Recharger Nginx
sudo systemctl reload nginx
```

### Problème: Port 443 déjà utilisé

```bash
# Vérifier les processus
sudo lsof -i :443

# Arrêter le processus conflictuel
sudo systemctl stop apache2  # Si Apache est installé
```

---

## 📚 Ressources Supplémentaires

- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Nginx SSL Best Practices](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [OWASP TLS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html)

---

## 🔐 Checklist de Sécurité SSL

- [ ] Certificat SSL/TLS valide installé
- [ ] Redirection HTTP vers HTTPS active
- [ ] HSTS header configuré (min 6 mois)
- [ ] TLS 1.2 et 1.3 uniquement (pas de TLS 1.0/1.1)
- [ ] Ciphers sécurisés configurés
- [ ] OCSP Stapling activé
- [ ] Perfect Forward Secrecy (PFS) activé
- [ ] Renouvellement automatique configuré
- [ ] Monitoring de l'expiration en place
- [ ] Note A+ sur SSL Labs
- [ ] Headers de sécurité configurés

---

**Auteur**: Équipe Santé Rurale
**Version**: 1.0.0
**Dernière mise à jour**: 2 Novembre 2025
