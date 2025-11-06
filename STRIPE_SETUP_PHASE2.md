# 💳 Configuration Stripe - Phase 2 (3-6 mois)

## Vue d'Ensemble

Ce guide vous accompagne dans la configuration de **Stripe** pour activer les abonnements payants (Phase 2) de votre application SaaS.

**Quand activer ?** Dans 3-6 mois, une fois que vos pilotes gratuits sont stables et fonctionnels.

---

## 📋 Prérequis

- ✅ Phase 1 complétée (5-10 tenants pilotes actifs)
- ✅ Feedback positif des pilotes
- ✅ Application stable (pas de bugs critiques)
- ✅ Entité juridique créée (SARL, EURL, etc.)
- ✅ Compte bancaire professionnel

---

## 🚀 Étape 1 : Créer un Compte Stripe

### 1.1 Inscription

1. Allez sur https://stripe.com
2. Cliquez sur "Start now" ou "S'inscrire"
3. Remplissez les informations :
   - Email professionnel
   - Nom de l'entreprise
   - Pays d'incorporation (Mali, Sénégal, etc.)

### 1.2 Vérification d'Identité

Stripe demandera :
- **Documents d'entreprise** :
  - RCCM (Registre du Commerce)
  - Statuts de l'entreprise
  - Pièce d'identité du représentant légal

- **Informations bancaires** :
  - RIB/IBAN
  - Nom du compte bancaire
  - Adresse de l'entreprise

**Délai de vérification** : 1-5 jours ouvrés

---

## 💰 Étape 2 : Créer les Produits et Prix

### 2.1 Créer les Produits dans Stripe Dashboard

1. Connectez-vous à https://dashboard.stripe.com
2. Allez dans **Produits** → **Ajouter un produit**

#### Produit 1 : Plan Starter

```
Nom : Plan Starter - Santé Rurale
Description : Pour les petits centres de santé (1-5 utilisateurs)

Prix mensuel :
- Montant : 50,00 EUR (ou 32 750 XOF)
- Récurrent : Tous les mois
- ID : starter_monthly

Prix annuel (optionnel) :
- Montant : 500,00 EUR (2 mois gratuits)
- Récurrent : Tous les ans
- ID : starter_yearly
```

#### Produit 2 : Plan Pro

```
Nom : Plan Pro - Santé Rurale
Description : Pour les districts et centres moyens (10-50 utilisateurs)

Prix mensuel :
- Montant : 150,00 EUR
- Récurrent : Tous les mois
- ID : pro_monthly

Prix annuel :
- Montant : 1500,00 EUR
- Récurrent : Tous les ans
- ID : pro_yearly
```

#### Produit 3 : Plan Enterprise

```
Nom : Plan Enterprise - Santé Rurale
Description : Pour les régions et grandes organisations (illimité)

Prix mensuel :
- Montant : 500,00 EUR
- Récurrent : Tous les mois
- ID : enterprise_monthly

Prix annuel :
- Montant : 5000,00 EUR
- Récurrent : Tous les ans
- ID : enterprise_yearly
```

### 2.2 Récupérer les Price IDs

Après création, notez les **Price IDs** (format : `price_1ABC...`) :

```bash
# Exemple
starter_monthly  = price_1ABC123XYZ...
starter_yearly   = price_1DEF456ABC...
pro_monthly      = price_1GHI789DEF...
pro_yearly       = price_1JKL012GHI...
enterprise_monthly = price_1MNO345JKL...
enterprise_yearly  = price_1PQR678MNO...
```

---

## ⚙️ Étape 3 : Configurer l'Application

### 3.1 Mettre à Jour les Plans en Base de Données

```sql
-- Mettre à jour le plan Starter
UPDATE plans
SET stripe_price_id = 'price_1ABC123XYZ...'
WHERE code = 'starter';

-- Mettre à jour le plan Pro
UPDATE plans
SET stripe_price_id = 'price_1GHI789DEF...'
WHERE code = 'pro';

-- Mettre à jour le plan Enterprise
UPDATE plans
SET stripe_price_id = 'price_1MNO345JKL...'
WHERE code = 'enterprise';
```

**OU** via un script Python :

```python
# scripts/update_stripe_price_ids.py
from app.database import SessionLocal
from app.models.tenant import Plan
from sqlalchemy import select

async def update_prices():
    async with SessionLocal() as db:
        # Starter
        result = await db.execute(select(Plan).where(Plan.code == 'starter'))
        plan = result.scalar_one()
        plan.stripe_price_id = 'price_1ABC123XYZ...'

        # Pro
        result = await db.execute(select(Plan).where(Plan.code == 'pro'))
        plan = result.scalar_one()
        plan.stripe_price_id = 'price_1GHI789DEF...'

        # Enterprise
        result = await db.execute(select(Plan).where(Plan.code == 'enterprise'))
        plan = result.scalar_one()
        plan.stripe_price_id = 'price_1MNO345JKL...'

        await db.commit()
        print("✅ Price IDs mis à jour")
```

### 3.2 Variables d'Environnement

Mettez à jour `.env.production` :

```bash
# Stripe Configuration
STRIPE_ENABLED=true
STRIPE_SECRET_KEY=sk_live_ABC123...  # ⚠️ Clé secrète LIVE
STRIPE_PUBLISHABLE_KEY=pk_live_XYZ789...
STRIPE_WEBHOOK_SECRET=whsec_DEF456...  # Obtenu à l'étape 4
```

**⚠️ IMPORTANT** :
- Ne commitez JAMAIS les clés dans Git
- Utilisez des secrets management (GitHub Secrets, AWS Secrets Manager, etc.)
- En développement, utilisez les clés `sk_test_...` et `pk_test_...`

---

## 🔗 Étape 4 : Configurer les Webhooks

### 4.1 Créer l'Endpoint Webhook

Dans Stripe Dashboard :

1. Allez dans **Développeurs** → **Webhooks**
2. Cliquez sur **Ajouter un endpoint**
3. URL de l'endpoint : `https://votre-domaine.com/api/tenants/webhooks/stripe`
4. Sélectionnez les événements :
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`
   - ✅ `customer.subscription.trial_will_end`

5. Cliquez sur **Ajouter l'endpoint**

### 4.2 Récupérer le Signing Secret

Après création, cliquez sur l'endpoint puis **Révéler** le signing secret.

**Format** : `whsec_ABC123...`

Ajoutez-le dans `.env.production` :

```bash
STRIPE_WEBHOOK_SECRET=whsec_ABC123...
```

### 4.3 Tester le Webhook

```bash
# Installer Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forwarder les événements vers votre local
stripe listen --forward-to localhost:8000/api/tenants/webhooks/stripe

# Déclencher un événement de test
stripe trigger customer.subscription.created
```

**Résultat attendu** : Logs dans l'API montrant la réception de l'événement.

---

## 🧪 Étape 5 : Tests en Mode Test

Avant de passer en production, testez avec les clés de test :

### 5.1 Configuration Test

```bash
# .env.development
STRIPE_ENABLED=true
STRIPE_SECRET_KEY=sk_test_ABC123...  # Clé TEST
STRIPE_PUBLISHABLE_KEY=pk_test_XYZ789...
```

### 5.2 Cartes de Test Stripe

| Numéro de Carte | Comportement |
|----------------|--------------|
| `4242 4242 4242 4242` | Paiement réussi |
| `4000 0000 0000 9995` | Carte refusée |
| `4000 0000 0000 3220` | Authentification 3D Secure requise |

**Expiration** : N'importe quelle date future (ex: 12/25)
**CVC** : N'importe quel 3 chiffres (ex: 123)

### 5.3 Scénarios de Test

#### Test 1 : Créer un Abonnement

```bash
curl -X POST "http://localhost:8000/api/tenants/me/subscribe" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plan_code": "starter",
    "payment_method_id": "pm_card_visa",
    "trial_days": 30
  }'
```

**Résultat attendu** :
```json
{
  "id": "...",
  "status": "trialing",
  "trial_end": "2025-12-06T...",
  "plan": {
    "code": "starter",
    "name": "Plan Starter"
  }
}
```

#### Test 2 : Upgrade de Plan

```bash
curl -X POST "http://localhost:8000/api/tenants/me/subscription/upgrade" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "new_plan_code": "pro"
  }'
```

#### Test 3 : Annulation

```bash
curl -X POST "http://localhost:8000/api/tenants/me/subscription/cancel" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d 'immediate=false'
```

---

## 🚀 Étape 6 : Passage en Production

### 6.1 Checklist Pré-Production

- [ ] Compte Stripe vérifié (KYC complété)
- [ ] Produits et prix créés en mode LIVE
- [ ] Price IDs mis à jour en DB
- [ ] Variables d'environnement configurées avec clés LIVE
- [ ] Webhook configuré et testé
- [ ] Tests de bout en bout effectués
- [ ] CGV et politique de remboursement rédigées
- [ ] Support client prêt

### 6.2 Activer Stripe

```bash
# .env.production
STRIPE_ENABLED=true  # ⚠️ Active les paiements réels
```

### 6.3 Communiquer avec les Pilotes

**Email type** :

```
Objet : 🚀 Santé Rurale passe en Phase 2 - Abonnements disponibles

Bonjour,

Grâce à votre participation à notre programme pilote, nous sommes ravis de vous annoncer le lancement de la Phase 2 de Santé Rurale !

🎁 OFFRE SPÉCIALE PILOTES :
- 50% de réduction à vie sur votre plan
- 3 mois gratuits supplémentaires
- Support prioritaire

💰 TARIFS :
- Plan Starter : 25€/mois (au lieu de 50€)
- Plan Pro : 75€/mois (au lieu de 150€)

➡️ Pour profiter de cette offre, connectez-vous et allez dans "Mon Abonnement"

Merci de votre confiance,
L'équipe Santé Rurale
```

---

## 📊 Étape 7 : Monitoring et Suivi

### 7.1 Dashboard Stripe

Surveillez quotidiennement :
- **Revenus** (MRR - Monthly Recurring Revenue)
- **Taux de churn** (clients qui annulent)
- **Échecs de paiement**
- **Nouvelles souscriptions**

### 7.2 Alertes Importantes

Configurez des alertes pour :
- ❌ Paiement échoué → Contacter le client
- 📉 MRR en baisse → Analyser les raisons
- 🎉 Nouveau client → Envoyer email de bienvenue

### 7.3 Métriques Clés

| Métrique | Formule | Objectif |
|----------|---------|----------|
| **MRR** | Somme des abonnements mensuels | +10% par mois |
| **ARR** | MRR × 12 | 90 000€ (Phase 2) |
| **Churn** | Annulations / Total clients | < 5% |
| **LTV** | Revenu moyen × Durée moyenne | > 1000€ |

---

## 🔒 Sécurité et Conformité

### PCI DSS

✅ **Stripe gère la conformité PCI** : Vous n'avez pas besoin de certification si vous :
- Utilisez Stripe Elements ou Checkout
- Ne stockez JAMAIS les cartes bancaires sur vos serveurs

### RGPD

- ✅ Stripe est conforme RGPD
- ✅ Ajoutez dans vos CGV : "Les paiements sont traités par Stripe"
- ✅ Politique de conservation des données : 7 ans (obligations comptables)

---

## ❓ FAQ

**Q : Stripe est-il disponible au Mali/Sénégal ?**
R : Pas directement. Solutions :
1. Créer une société en France/UE et facturer depuis l'UE
2. Utiliser un service tiers (Flutterwave, Paystack) pour l'Afrique
3. Combiner : Stripe pour l'international, Flutterwave pour l'Afrique

**Q : Quels sont les frais Stripe ?**
R : 1,4% + 0,25€ par transaction (cartes européennes)

**Q : Peut-on facturer en XOF (Francs CFA) ?**
R : Non directement. Facturez en EUR et convertissez au taux du jour.

**Q : Que se passe-t-il si un paiement échoue ?**
R : Stripe réessaie automatiquement pendant 3 semaines. Si échec final :
- Abonnement passe en status `past_due`
- Votre webhook reçoit l'événement
- Vous désactivez l'accès au tenant

---

## 📚 Ressources

- **Documentation Stripe** : https://stripe.com/docs
- **API Python** : https://github.com/stripe/stripe-python
- **Dashboard** : https://dashboard.stripe.com
- **Support Stripe** : https://support.stripe.com

---

## ✅ Checklist Finale

Phase 2 est prête quand :

- [ ] Compte Stripe vérifié et activé
- [ ] Produits et prix créés (Starter, Pro, Enterprise)
- [ ] Price IDs configurés en DB
- [ ] Variables d'environnement STRIPE_* configurées
- [ ] Webhook Stripe configuré et testé
- [ ] Tests de bout en bout effectués (création, upgrade, annulation)
- [ ] CGV rédigées et accessibles
- [ ] Support client en place
- [ ] Monitoring actif (Dashboard Stripe + vos métriques)
- [ ] Communication aux pilotes envoyée

**Date cible** : 3-6 mois après le lancement de la Phase 1
**Objectif** : 50 clients payants → 90 000€ ARR

---

**Vous êtes prêt à monétiser votre SaaS !** 💰🚀
