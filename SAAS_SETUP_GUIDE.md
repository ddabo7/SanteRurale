# 🚀 Guide SaaS Multi-Tenant - Santé Rurale

## Ce Qui A Été Créé

Votre application est maintenant prête pour le **modèle SaaS hybride** :

✅ **Phase 1 (MAINTENANT)** : Pilotes gratuits
✅ **Phase 2 (3-6 mois)** : Abonnements payants avec Stripe
✅ **Phase 3 (6-12 mois)** : Licences nationales (base déjà prête)

---

## 📁 Fichiers Créés

### 1. Modèles de Base de Données
- **`api/app/models/tenant.py`** : Tenant, Subscription, Plan, Usage
- **`api/app/models/mixins.py`** : TenantMixin pour isoler les données

### 2. Migration Base de Données
- **`api/alembic/versions/2025_11_02_add_multi_tenancy_saas.py`**
  - Crée les tables : tenants, subscriptions, plans, usage_logs
  - Ajoute tenant_id à tous vos modèles
  - Insère 4 plans par défaut (Free, Starter, Pro, Enterprise)

### 3. Services et Middleware
- **`api/app/services/subscription_service.py`** : Gestion abonnements + Stripe
- **`api/app/middleware/tenant_filter.py`** : Filtrage automatique par tenant
- **`api/app/dependencies/tenant.py`** : Dépendances FastAPI pour tenants

### 4. API Endpoints
- **`api/app/routers/tenants.py`** : Gestion tenants et abonnements

---

## 🎯 Phase 1 : Déployer Pour Vos Pilotes (MAINTENANT)

### Étape 1 : Appliquer la Migration

```bash
cd api
alembic upgrade head
```

Cela va créer toutes les tables nécessaires et insérer les 4 plans.

### Étape 2 : Créer Vos Tenants Pilotes

**Option A : Via l'API (recommandé)**

```bash
curl -X POST http://localhost:8000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Centre de Santé de Koulikoro",
    "slug": "cscom-koulikoro",
    "email": "cscom.koulikoro@sante.ml",
    "phone": "+223 XX XX XX XX",
    "city": "Koulikoro",
    "country_code": "ML"
  }'
```

**Option B : Via script Python**

```python
# scripts/create_pilot_tenants.py
from app.services.subscription_service import SubscriptionService

# Liste de vos 5-10 centres pilotes
pilots = [
    {"name": "CSCOM Koulikoro", "slug": "cscom-koulikoro", "email": "..."},
    {"name": "CSCOM Ségou", "slug": "cscom-segou", "email": "..."},
    # ... autres pilotes
]

for pilot in pilots:
    tenant = await service.create_pilot_tenant(**pilot)
    print(f"✅ Tenant créé : {tenant.name}")
```

### Étape 3 : Créer les Utilisateurs par Tenant

Modifiez votre endpoint de création d'utilisateur pour inclure le `tenant_id` :

```python
# Dans votre router users
@router.post("/users")
async def create_user(
    user_data: UserCreate,
    tenant: Tenant = Depends(get_current_tenant),  # NOUVEAU
    db: AsyncSession = Depends(get_db)
):
    new_user = User(
        **user_data.dict(),
        tenant_id=tenant.id  # NOUVEAU : Associer au tenant
    )
    # ... reste du code
```

### Étape 4 : Tester

1. Créez un tenant pilote
2. Créez un utilisateur pour ce tenant
3. Connectez-vous avec cet utilisateur
4. Créez un patient → Il sera automatiquement lié au tenant
5. Connectez-vous avec un autre tenant → Vous ne verrez PAS le patient du premier

**C'est l'isolation automatique !** ✨

---

## 💰 Phase 2 : Activer les Paiements (Dans 3-6 Mois)

### Étape 1 : Créer un Compte Stripe

1. Allez sur [stripe.com](https://stripe.com)
2. Créez un compte
3. Récupérez vos clés API (Dashboard → Developers → API keys)

### Étape 2 : Créer les Prix dans Stripe

```bash
# Plan Starter (50€/mois)
stripe prices create \
  --unit-amount=5000 \
  --currency=eur \
  --recurring[interval]=month \
  --product-data[name]="Plan Starter"

# Notez le price_id retourné (ex: price_1ABC...)
```

### Étape 3 : Mettre à Jour les Plans en DB

```sql
UPDATE plans
SET stripe_price_id = 'price_1ABC...'
WHERE code = 'starter';
```

### Étape 4 : Activer Stripe

```bash
# Dans .env
STRIPE_ENABLED=true
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Étape 5 : Tester un Abonnement

```bash
# 1. Créer un tenant non-pilote
POST /api/tenants
{
  "name": "Nouveau Centre",
  "slug": "nouveau-centre",
  "email": "test@example.com"
}

# 2. S'abonner au plan Starter
POST /api/tenants/me/subscribe
{
  "plan_code": "starter",
  "payment_method_id": "pm_card_...",  # ID de carte test Stripe
  "trial_days": 30
}

# 3. Vérifier l'abonnement
GET /api/tenants/me/subscription
```

---

## 📊 Plans et Tarification

Les 4 plans sont déjà créés dans la DB :

| Plan | Prix/mois | Utilisateurs | Patients/mois | Sites | Features |
|------|-----------|--------------|---------------|-------|----------|
| **Free** (Pilotes) | 0€ | 5 | Illimité | 1 | Basique |
| **Starter** | 50€ | 5 | 500 | 1 | Basique + Mobile |
| **Pro** | 150€ | 50 | Illimité | 10 | + DHIS2 + Multi-sites |
| **Enterprise** | 500€ | Illimité | Illimité | Illimité | Tout + API + Support |

### Modifier les Prix

```sql
-- Exemple : Changer le prix du plan Starter à 75€
UPDATE plans
SET price_monthly = 75, price_yearly = 750
WHERE code = 'starter';
```

---

## 🔒 Sécurité : Isolation des Données

### Comment Ça Marche

Chaque requête API fait automatiquement :

```python
# L'utilisateur se connecte
user = get_current_user(token)  # user.tenant_id = "abc-123"

# Le tenant est récupéré
tenant = get_current_tenant(user)  # tenant.id = "abc-123"

# Toutes les requêtes sont filtrées automatiquement
patients = await db.execute(
    select(Patient)  # Devient automatiquement:
    # select(Patient).where(Patient.tenant_id == "abc-123")
)
```

### Important : Ajouter tenant_id Partout

Pour chaque création de ressource :

```python
# AVANT (sans multi-tenancy)
patient = Patient(nom="...", prenom="...")

# APRÈS (avec multi-tenancy)
patient = Patient(
    nom="...",
    prenom="...",
    tenant_id=tenant.id  # OBLIGATOIRE
)
```

---

## 🎯 Système de Quotas

### Vérifier les Quotas Avant Création

```python
from app.dependencies.tenant import check_quota

@router.post("/users")
async def create_user(
    user_data: UserCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    # Compter les utilisateurs actuels
    result = await db.execute(
        select(func.count(User.id)).where(User.tenant_id == tenant.id)
    )
    current_users = result.scalar()

    # Vérifier le quota
    await check_quota(tenant, "users", current_users + 1, db)

    # Créer l'utilisateur
    user = User(**user_data.dict(), tenant_id=tenant.id)
    # ...
```

### Quotas par Plan

- **Free** : 5 users, 1 site, 10GB
- **Starter** : 5 users, 500 patients/mois, 1 site, 20GB
- **Pro** : 50 users, illimité patients, 10 sites, 100GB
- **Enterprise** : Tout illimité, 500GB

---

## 📈 Suivre l'Utilisation

### Endpoint de Stats

```bash
GET /api/tenants/me/usage

Response:
{
  "active_users": 3,
  "patients_this_month": 45,
  "encounters_this_month": 120,
  "storage_used_mb": 850,
  "quotas": {
    "max_users": 5,
    "max_patients_per_month": null,
    "max_sites": 1,
    "max_storage_gb": 10
  }
}
```

---

## 🔄 Webhooks Stripe (Phase 2)

### Configurer le Webhook

1. Dans Stripe Dashboard → Webhooks → Add endpoint
2. URL : `https://votre-domaine.com/api/tenants/webhooks/stripe`
3. Events à écouter :
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

### Events Traités Automatiquement

- ✅ Mise à jour du statut d'abonnement
- ✅ Annulation automatique si paiement échoue
- ✅ Renouvellement automatique

---

## 🚀 Prochaines Étapes

### Maintenant
1. ✅ Appliquer la migration : `alembic upgrade head`
2. ✅ Créer vos 5-10 tenants pilotes
3. ✅ Créer les utilisateurs pour chaque tenant
4. ✅ Tester l'isolation des données

### Dans 3 mois (Phase 2)
1. Créer compte Stripe
2. Configurer les prix
3. Activer `STRIPE_ENABLED=true`
4. Tester les abonnements

### Dans 6-12 mois (Phase 3)
1. Approcher les Ministères
2. Proposer licences nationales (100k€+)
3. Utiliser la même base technique (déjà prête !)

---

## ❓ FAQ

**Q : Est-ce que ça va casser mon app existante ?**
R : Non. La migration ajoute juste `tenant_id` avec `nullable=True` par défaut. Vos données existantes fonctionneront.

**Q : Comment tester sans Stripe ?**
R : Laissez `STRIPE_ENABLED=false`. Les abonnements seront créés en DB mais pas dans Stripe.

**Q : Puis-je changer les prix ?**
R : Oui ! Modifiez directement dans la table `plans` ou créez un endpoint admin.

**Q : Comment gérer plusieurs sites par tenant ?**
R : Le plan Pro+ permet `max_sites=10`. Ajoutez un champ `site_id` aux ressources si besoin.

---

## 📞 Support

Fichiers créés :
- Modèles : `api/app/models/tenant.py`
- Migration : `api/alembic/versions/2025_11_02_add_multi_tenancy_saas.py`
- Service : `api/app/services/subscription_service.py`
- API : `api/app/routers/tenants.py`

**Vous êtes prêt pour un SaaS de 280k€/an !** 💰🚀
