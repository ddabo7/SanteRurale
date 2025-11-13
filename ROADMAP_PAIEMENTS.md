# 🚀 ROADMAP - Système de Paiement Complet

## ✅ Phase 1: Gestion des Abonnements (TERMINÉE)
- [x] Modèles de base (Tenant, Subscription, SubscriptionPlan)
- [x] Migrations Alembic
- [x] Endpoints API CRUD
- [x] Interface utilisateur (SubscriptionPage)
- [x] Vérification des limites d'abonnement
- [x] Système multi-tenancy

## 🔄 Phase 2: Intégration Paiement (À FAIRE)

### 2.1 Backend - Stripe Integration

#### Fichiers à créer/modifier:

**1. `api/app/config.py`** - Ajouter configuration Stripe
```python
class Settings(BaseSettings):
    # ... (existant)

    # Stripe Configuration
    STRIPE_SECRET_KEY: str = Field(..., env='STRIPE_SECRET_KEY')
    STRIPE_PUBLISHABLE_KEY: str = Field(..., env='STRIPE_PUBLISHABLE_KEY')
    STRIPE_WEBHOOK_SECRET: str = Field(..., env='STRIPE_WEBHOOK_SECRET')

    # Prix des plans (Price IDs Stripe)
    STRIPE_PRICE_BASIC_MONTHLY: str = Field(..., env='STRIPE_PRICE_BASIC_MONTHLY')
    STRIPE_PRICE_PRO_MONTHLY: str = Field(..., env='STRIPE_PRICE_PRO_MONTHLY')
    STRIPE_PRICE_ENTERPRISE_MONTHLY: str = Field(..., env='STRIPE_PRICE_ENTERPRISE_MONTHLY')
```

**2. `api/requirements.txt`** - Ajouter dépendances
```txt
stripe==8.0.0
```

**3. `api/app/services/stripe_service.py`** - Service Stripe (NOUVEAU)
```python
"""
Service pour gérer les paiements Stripe
"""
import stripe
from app.config import settings
from typing import Optional, Dict, Any

stripe.api_key = settings.STRIPE_SECRET_KEY

class StripeService:
    @staticmethod
    async def create_customer(email: str, name: str, tenant_id: str) -> Dict[str, Any]:
        """Créer un client Stripe"""
        customer = stripe.Customer.create(
            email=email,
            name=name,
            metadata={"tenant_id": str(tenant_id)}
        )
        return customer

    @staticmethod
    async def create_checkout_session(
        customer_id: str,
        price_id: str,
        success_url: str,
        cancel_url: str,
        tenant_id: str
    ) -> Dict[str, Any]:
        """Créer une session de paiement"""
        session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            mode='subscription',
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"tenant_id": str(tenant_id)},
        )
        return session

    @staticmethod
    async def get_subscription(subscription_id: str) -> Dict[str, Any]:
        """Récupérer un abonnement Stripe"""
        subscription = stripe.Subscription.retrieve(subscription_id)
        return subscription

    @staticmethod
    async def cancel_subscription(subscription_id: str) -> Dict[str, Any]:
        """Annuler un abonnement"""
        subscription = stripe.Subscription.delete(subscription_id)
        return subscription

    @staticmethod
    async def create_portal_session(
        customer_id: str,
        return_url: str
    ) -> Dict[str, Any]:
        """Créer une session du portail client Stripe"""
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )
        return session
```

**4. `api/app/routers/payments.py`** - Routes paiement (NOUVEAU)
```python
"""
Routes API pour les paiements Stripe
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import stripe

from app.database import get_db
from app.models.base_models import User, Tenant, Subscription
from app.security import get_current_user
from app.services.stripe_service import StripeService
from app.config import settings

router = APIRouter(prefix="/payments", tags=["Payments"])

class CreateCheckoutSessionRequest(BaseModel):
    plan_id: int  # ID du plan d'abonnement
    success_url: str
    cancel_url: str

class CheckoutSessionResponse(BaseModel):
    checkout_url: str
    session_id: str

@router.post("/create-checkout-session", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    request: CreateCheckoutSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Créer une session de paiement Stripe"""

    # Récupérer le tenant de l'utilisateur
    tenant = await db.get(Tenant, current_user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant non trouvé")

    # Mapper plan_id vers Stripe Price ID
    price_mapping = {
        1: settings.STRIPE_PRICE_BASIC_MONTHLY,
        2: settings.STRIPE_PRICE_PRO_MONTHLY,
        3: settings.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    }

    stripe_price_id = price_mapping.get(request.plan_id)
    if not stripe_price_id:
        raise HTTPException(status_code=400, detail="Plan invalide")

    # Créer ou récupérer le client Stripe
    if not tenant.stripe_customer_id:
        customer = await StripeService.create_customer(
            email=current_user.email,
            name=tenant.nom,
            tenant_id=str(tenant.id)
        )
        tenant.stripe_customer_id = customer["id"]
        await db.commit()

    # Créer la session de paiement
    session = await StripeService.create_checkout_session(
        customer_id=tenant.stripe_customer_id,
        price_id=stripe_price_id,
        success_url=request.success_url,
        cancel_url=request.cancel_url,
        tenant_id=str(tenant.id)
    )

    return CheckoutSessionResponse(
        checkout_url=session["url"],
        session_id=session["id"]
    )

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Webhook Stripe pour gérer les événements"""

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Payload invalide")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Signature invalide")

    # Gérer les événements
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        await handle_checkout_completed(session, db)

    elif event["type"] == "customer.subscription.updated":
        subscription = event["data"]["object"]
        await handle_subscription_updated(subscription, db)

    elif event["type"] == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        await handle_subscription_cancelled(subscription, db)

    return {"status": "success"}

async def handle_checkout_completed(session: dict, db: AsyncSession):
    """Gérer le paiement réussi"""
    tenant_id = session["metadata"]["tenant_id"]
    subscription_id = session["subscription"]

    # Récupérer les détails de l'abonnement Stripe
    stripe_sub = await StripeService.get_subscription(subscription_id)

    # Mettre à jour la base de données
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if tenant:
        # Créer ou mettre à jour l'abonnement
        subscription = Subscription(
            tenant_id=tenant.id,
            plan_id=get_plan_id_from_price(stripe_sub["items"]["data"][0]["price"]["id"]),
            stripe_subscription_id=subscription_id,
            status="active",
            current_period_start=stripe_sub["current_period_start"],
            current_period_end=stripe_sub["current_period_end"]
        )
        db.add(subscription)
        await db.commit()

def get_plan_id_from_price(price_id: str) -> int:
    """Mapper Stripe Price ID vers plan_id"""
    mapping = {
        settings.STRIPE_PRICE_BASIC_MONTHLY: 1,
        settings.STRIPE_PRICE_PRO_MONTHLY: 2,
        settings.STRIPE_PRICE_ENTERPRISE_MONTHLY: 3,
    }
    return mapping.get(price_id, 1)
```

**5. Ajouter à `api/app/main.py`**
```python
from app.routers import payments

app.include_router(payments.router, prefix=settings.API_V1_STR)
```

**6. `api/app/models/base_models.py`** - Ajouter champ Stripe
```python
class Tenant(Base):
    # ... (existant)
    stripe_customer_id = Column(String(255), nullable=True, unique=True)  # NOUVEAU
```

**7. Migration Alembic** - `api/alembic/versions/2025_11_14_add_stripe_customer_id.py`
```python
"""add stripe customer id

Revision ID: 2025_11_14_stripe
Revises: 2025_11_13_feedbacks
"""
from alembic import op
import sqlalchemy as sa

revision = '2025_11_14_stripe'
down_revision = '2025_11_13_feedbacks'

def upgrade() -> None:
    op.add_column('tenants', sa.Column('stripe_customer_id', sa.String(255), nullable=True))
    op.create_unique_constraint('uq_tenants_stripe_customer_id', 'tenants', ['stripe_customer_id'])

def downgrade() -> None:
    op.drop_constraint('uq_tenants_stripe_customer_id', 'tenants', type_='unique')
    op.drop_column('tenants', 'stripe_customer_id')
```

### 2.2 Frontend - Interface Paiement

**1. `pwa/src/pages/SubscriptionPage.tsx`** - Ajouter boutons paiement
```typescript
// Ajouter import
import { apiClient } from '../services/api'

// Dans le composant, ajouter fonction
const handleUpgrade = async (planId: number) => {
  try {
    setLoading(true)

    const response = await apiClient.post('/payments/create-checkout-session', {
      plan_id: planId,
      success_url: `${window.location.origin}/subscription?success=true`,
      cancel_url: `${window.location.origin}/subscription?cancelled=true`,
    })

    // Rediriger vers Stripe Checkout
    window.location.href = response.data.checkout_url
  } catch (error) {
    console.error('Erreur lors du paiement:', error)
    alert('Erreur lors de l\'initialisation du paiement')
  } finally {
    setLoading(false)
  }
}

// Ajouter bouton dans chaque plan
<button
  onClick={() => handleUpgrade(plan.id)}
  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl"
>
  {currentPlan?.id === plan.id ? 'Plan actuel' : 'Passer à ce plan'}
</button>
```

**2. Variables d'environnement** - `.env.production`
```bash
# Stripe (Production)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Prix Stripe (créés dans le Dashboard Stripe)
STRIPE_PRICE_BASIC_MONTHLY=price_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_ENTERPRISE_MONTHLY=price_xxx
```

## 🎯 Phase 3: Portail Client (À FAIRE)

### Objectif
Permettre aux utilisateurs de gérer leur abonnement directement

### Fonctionnalités
- Voir l'historique des paiements
- Télécharger les factures
- Mettre à jour les informations de paiement
- Annuler l'abonnement
- Changer de plan

### Implémentation

**1. Endpoint Backend**
```python
@router.post("/create-portal-session")
async def create_portal_session(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Créer une session du portail client Stripe"""
    tenant = await db.get(Tenant, current_user.tenant_id)

    if not tenant.stripe_customer_id:
        raise HTTPException(status_code=400, detail="Aucun abonnement actif")

    session = await StripeService.create_portal_session(
        customer_id=tenant.stripe_customer_id,
        return_url=f"{settings.FRONTEND_URL}/subscription"
    )

    return {"portal_url": session["url"]}
```

**2. Bouton Frontend**
```typescript
const openCustomerPortal = async () => {
  const response = await apiClient.post('/payments/create-portal-session')
  window.location.href = response.data.portal_url
}

// Dans l'interface
<button onClick={openCustomerPortal}>
  Gérer mon abonnement
</button>
```

## 📋 Checklist d'implémentation

### Configuration Stripe
- [ ] Créer compte Stripe (https://dashboard.stripe.com)
- [ ] Activer mode Test
- [ ] Créer les 3 produits (Basic, Pro, Enterprise)
- [ ] Créer les prix mensuels pour chaque produit
- [ ] Copier les Price IDs
- [ ] Générer les clés API (Secret Key, Publishable Key)
- [ ] Configurer le webhook endpoint
- [ ] Copier le Webhook Secret

### Backend
- [ ] Installer stripe package
- [ ] Ajouter variables d'environnement
- [ ] Créer StripeService
- [ ] Créer routes /payments
- [ ] Ajouter stripe_customer_id à Tenant
- [ ] Créer migration Alembic
- [ ] Tester webhook localement (stripe CLI)
- [ ] Gérer les événements Stripe

### Frontend
- [ ] Ajouter boutons de paiement
- [ ] Gérer les redirections success/cancel
- [ ] Ajouter indicateur de chargement
- [ ] Afficher messages de succès/erreur
- [ ] Tester le flux complet

### Tests
- [ ] Test avec carte de test Stripe (4242 4242 4242 4242)
- [ ] Vérifier création d'abonnement
- [ ] Vérifier mise à jour du statut
- [ ] Tester annulation
- [ ] Tester changement de plan

### Production
- [ ] Passer en mode Live Stripe
- [ ] Mettre à jour les clés API
- [ ] Configurer webhook production
- [ ] Vérifier conformité PCI
- [ ] Activer authentification 3D Secure

## 🔗 Ressources utiles

- Documentation Stripe: https://stripe.com/docs
- Stripe CLI pour tester webhooks: https://stripe.com/docs/stripe-cli
- Cartes de test: https://stripe.com/docs/testing
- Dashboard Stripe: https://dashboard.stripe.com

## 💡 Notes importantes

1. **Sécurité**: Ne jamais exposer la Secret Key côté frontend
2. **Webhooks**: Toujours vérifier la signature Stripe
3. **Idempotence**: Utiliser des clés idempotentes pour éviter les doublons
4. **Logs**: Logger tous les événements de paiement
5. **Erreurs**: Gérer gracieusement les erreurs de paiement
6. **UX**: Toujours informer l'utilisateur du statut du paiement

## 📊 Métriques à surveiller

- Taux de conversion (visiteurs → payeurs)
- Taux de churn (annulations)
- Revenu mensuel récurrent (MRR)
- Valeur vie client (LTV)
- Échecs de paiement
