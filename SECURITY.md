# Sécurité - Santé Rurale Mali

## 🔒 Vue d'ensemble

Ce document décrit les mesures de sécurité mises en place dans le projet et les bonnes pratiques à suivre.

---

## 📋 Checklist de sécurité

### ✅ Fichiers sensibles protégés

Le fichier `.gitignore` protège **tous les fichiers sensibles** :

| Catégorie | Fichiers protégés |
|-----------|-------------------|
| **Environnement** | `.env`, `.env.*`, `*.env` |
| **Clés & Certificats** | `*.pem`, `*.key`, `*.crt`, `*.p12` |
| **Secrets** | `secrets/`, `*.secret`, `*.credentials` |
| **AWS** | `.aws/`, `aws-credentials.json` |
| **Clés GCP** | `*-service-account.json` |
| **Base de données** | `*.sql`, `*.dump`, `*.db`, `*.backup` |
| **Terraform** | `*.tfstate`, `*.tfvars` |
| **Uploads** | `uploads/`, `media/`, `attachments/local/` |
| **Sessions** | `sessions/`, `*.cookie` |

### ✅ Authentification & Autorisation

- **JWT RS256** (clés RSA 4096 bits) en production
- **Access tokens** : 15 minutes d'expiration
- **Refresh tokens** : 7 jours, stockés hashés en base
- **RBAC** : Contrôle d'accès basé sur les rôles (soignant, major, médecin, admin)
- **ABAC** : Isolation par site (users ne voient que leur site)
- **Rate limiting** : 100 req/min par IP, 1000 req/h par user

### ✅ Chiffrement

| Couche | Méthode |
|--------|---------|
| **Transport** | TLS 1.3 (Let's Encrypt en prod) |
| **Base de données** | PostgreSQL TDE + EBS encryption |
| **S3 Attachments** | SSE-S3 (AES-256) |
| **Sauvegardes** | AWS KMS encryption |
| **Client (PWA)** | WebCrypto API (AES-256-GCM) pour cache local sensible |
| **Refresh tokens** | Bcrypt (hash en base) |

### ✅ Audit & Traçabilité

- **Audit logs** : Tous les accès/modifications patients (qui, quand, quoi)
- **Rétention** : 12 mois minimum
- **Partitionnement** : Par mois pour performance
- **Immuabilité** : Logs non modifiables

### ✅ Conformité RGPD / Protection données

- **Consentement** : Requis pour SMS/WhatsApp
- **Minimisation** : Seules les données nécessaires sont collectées
- **Anonymisation** : Pas de données cliniques dans les SMS
- **Droit à l'oubli** : Soft delete des patients (pas de suppression définitive)
- **Portabilité** : Export CSV/PDF des données

---

## 🚨 Que faire en cas de compromission

### 1. Secret compromis (clé API, mot de passe)

```bash
# 1. Révoquer immédiatement le secret
aws secretsmanager update-secret \
    --secret-id <secret-arn> \
    --secret-string "REVOKED"

# 2. Générer un nouveau secret
openssl rand -base64 32

# 3. Mettre à jour dans Secrets Manager
aws secretsmanager update-secret \
    --secret-id <secret-arn> \
    --secret-string "<new-secret>"

# 4. Redéployer l'application
aws ecs update-service --force-new-deployment ...

# 5. Audit : vérifier les logs d'accès suspects
```

### 2. Clé JWT compromise

Voir [docs/operations-runbooks.md](docs/operations-runbooks.md#rotation-des-clés--secrets)

### 3. Violation de données

1. **Contenir** : Isoler le système compromis
2. **Notifier** : Direction + Autorité de protection des données (sous 72h)
3. **Investiguer** : Logs d'audit, analyse forensique
4. **Communiquer** : Informer les utilisateurs affectés
5. **Corriger** : Patcher la faille
6. **Documenter** : Post-mortem complet

---

## 🔐 Bonnes pratiques développeurs

### Variables d'environnement

❌ **NE JAMAIS** :
```python
# MAUVAIS
DATABASE_PASSWORD = "my_super_secret_password"

# MAUVAIS
api_key = "sk-1234567890abcdef"
```

✅ **TOUJOURS** :
```python
# BON
from app.config import settings
DATABASE_PASSWORD = settings.DATABASE_PASSWORD

# BON
api_key = os.getenv("API_KEY")
if not api_key:
    raise ValueError("API_KEY must be set")
```

### Secrets dans Git

❌ **NE JAMAIS** commiter :
- Mots de passe
- Clés API
- Tokens
- Certificats
- Fichiers `.env` de production

✅ **Utiliser** :
- AWS Secrets Manager (production)
- `.env` généré par script (développement)
- `.gitignore` exhaustif

### Validation des entrées

✅ **TOUJOURS** valider avec Pydantic :
```python
from pydantic import BaseModel, validator

class PatientCreate(BaseModel):
    nom: str
    telephone: Optional[str] = None

    @validator("telephone")
    def validate_phone(cls, v):
        if v and not re.match(r"^\+223 \d{2} \d{2} \d{2} \d{2}$", v):
            raise ValueError("Format téléphone invalide")
        return v
```

### SQL Injection

✅ **TOUJOURS** utiliser SQLAlchemy ORM :
```python
# BON (SQLAlchemy protège automatiquement)
stmt = select(Patient).where(Patient.nom == user_input)

# MAUVAIS
query = f"SELECT * FROM patients WHERE nom = '{user_input}'"  # DANGER!
```

### XSS (Cross-Site Scripting)

✅ React échappe automatiquement, mais attention :
```tsx
// BON (React échappe)
<div>{patient.nom}</div>

// DANGER (dangerouslySetInnerHTML)
<div dangerouslySetInnerHTML={{ __html: patient.notes }} />  // NE JAMAIS UTILISER
```

---

## 🔍 Audit de sécurité

### Scan SAST (Static Application Security Testing)

```bash
# Python (Bandit)
pip install bandit
bandit -r api/app -f json -o security-report.json

# JavaScript (npm audit)
cd pwa/
npm audit --audit-level=moderate
```

### Scan de dépendances (vulnérabilités connues)

```bash
# Python (Safety)
pip install safety
safety check --json

# JavaScript (npm audit)
npm audit fix
```

### Scan de secrets accidentels

```bash
# TruffleHog
docker run --rm -v "$PWD:/proj" trufflesecurity/trufflehog:latest filesystem /proj

# GitLeaks
docker run -v "$PWD:/path" zricethezav/gitleaks:latest detect --source="/path" -v
```

### Pentest recommandés

| Fréquence | Test | Outil |
|-----------|------|-------|
| **Continu** | SAST | Bandit, ESLint |
| **Mensuel** | Scan dépendances | Safety, npm audit |
| **Trimestriel** | Scan secrets | TruffleHog |
| **Semestriel** | Pentest externe | Cabinet spécialisé |

---

## 📞 Contact sécurité

Pour signaler une vulnérabilité :

- **Email** : security@sante-rurale.ml
- **PGP Key** : [Clé publique PGP](https://keys.openpgp.org/...)
- **Bug Bounty** : Non disponible actuellement

**Délai de réponse** : 72 heures maximum

---

## 📚 Références

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [ANSSI Recommandations](https://www.ssi.gouv.fr/)
- [CNIL Protection données santé](https://www.cnil.fr/fr/la-protection-des-donnees-de-sante)
- [HDS (Hébergement Données de Santé)](https://esante.gouv.fr/labels-certifications/hds)

---

**Dernière mise à jour** : 26 octobre 2024
