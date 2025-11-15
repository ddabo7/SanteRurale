#!/usr/bin/env python3
"""
Script d'initialisation complète pour la production
- Crée toutes les tables
- Crée les plans d'abonnement
- Crée le tenant, région, district, site
- Crée l'utilisateur admin
- Crée la subscription
"""
import asyncio
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy import select

from app.database import AsyncSessionLocal, engine
from app.models import User, Tenant, Site, District, Region, Base, Subscription, Plan
from app.security import hash_password


async def init_production():
    """Initialise la base de données pour la production"""

    # 1. Créer toutes les tables
    print("=" * 70)
    print("🔧 ÉTAPE 1: Création des tables manquantes...")
    print("=" * 70)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Tables créées avec succès\n")

    async with AsyncSessionLocal() as session:
        async with session.begin():

            # 2. Créer les plans d'abonnement
            print("=" * 70)
            print("📋 ÉTAPE 2: Création des plans d'abonnement...")
            print("=" * 70)

            result = await session.execute(select(Plan))
            existing_plans = result.scalars().all()

            if existing_plans:
                print(f"Plans existants: {len(existing_plans)}")
                for p in existing_plans:
                    print(f"  ✓ {p.name} ({p.code})")
            else:
                plans_data = [
                    {
                        "code": "free",
                        "name": "Plan Gratuit",
                        "description": "Phase pilote - Gratuit et illimité",
                        "price_monthly": Decimal("0.00"),
                        "max_users": 5,
                        "max_patients_total": 100,
                        "max_sites": 1,
                        "max_storage_gb": 5,
                        "features": ["basic_features"],
                    },
                    {
                        "code": "starter",
                        "name": "Plan Starter",
                        "description": "Pour petites structures de santé",
                        "price_monthly": Decimal("50.00"),
                        "max_users": 5,
                        "max_patients_total": 500,
                        "max_sites": 1,
                        "max_storage_gb": 10,
                        "features": ["basic_features", "reports"],
                    },
                    {
                        "code": "pro",
                        "name": "Plan Pro",
                        "description": "Pour centres de santé importants",
                        "price_monthly": Decimal("150.00"),
                        "max_users": 50,
                        "max_patients_total": None,
                        "max_sites": 5,
                        "max_storage_gb": 50,
                        "features": ["basic_features", "reports", "multi_sites", "advanced_stats"],
                    },
                    {
                        "code": "enterprise",
                        "name": "Plan Enterprise",
                        "description": "Pour réseaux de santé régionaux",
                        "price_monthly": Decimal("500.00"),
                        "max_users": None,
                        "max_patients_total": None,
                        "max_sites": None,
                        "max_storage_gb": 200,
                        "features": ["basic_features", "reports", "multi_sites", "advanced_stats", "dhis2_export", "custom_support"],
                    },
                ]

                for plan_data in plans_data:
                    plan = Plan(**plan_data)
                    session.add(plan)
                    print(f"  + {plan.name} créé")

                await session.flush()
                print("✅ Plans créés avec succès\n")

            # 3. Créer le tenant
            print("=" * 70)
            print("🏢 ÉTAPE 3: Création du tenant...")
            print("=" * 70)

            result = await session.execute(select(Tenant))
            tenant = result.scalar_one_or_none()

            if not tenant:
                tenant = Tenant(
                    id=uuid.uuid4(),
                    name="Santé Rurale",
                    slug="santerurale",
                    email="contact@santerurale.io",
                    is_active=True,
                    is_pilot=True,
                )
                session.add(tenant)
                await session.flush()
                print(f"✅ Tenant créé: {tenant.name} (ID: {tenant.id})\n")
            else:
                print(f"✅ Tenant existant: {tenant.name} (ID: {tenant.id})\n")

            # 4. Créer la hiérarchie géographique
            print("=" * 70)
            print("🗺️  ÉTAPE 4: Création de la hiérarchie géographique...")
            print("=" * 70)

            # Région
            result = await session.execute(select(Region))
            region = result.scalar_one_or_none()

            if not region:
                region = Region(
                    id=uuid.uuid4(),
                    nom="Région Principale",
                    code="REG001",
                )
                session.add(region)
                await session.flush()
                print(f"  ✓ Région créée: {region.nom}")
            else:
                print(f"  ✓ Région existante: {region.nom}")

            # District
            result = await session.execute(select(District).where(District.region_id == region.id))
            district = result.scalar_one_or_none()

            if not district:
                district = District(
                    id=uuid.uuid4(),
                    nom="District Principal",
                    code="DIST001",
                    region_id=region.id,
                )
                session.add(district)
                await session.flush()
                print(f"  ✓ District créé: {district.nom}")
            else:
                print(f"  ✓ District existant: {district.nom}")

            # Site
            result = await session.execute(select(Site).where(Site.district_id == district.id))
            site = result.scalar_one_or_none()

            if not site:
                site = Site(
                    id=uuid.uuid4(),
                    nom="Site Principal",
                    type="cscom",
                    district_id=district.id,
                    actif=True,
                )
                session.add(site)
                await session.flush()
                print(f"  ✓ Site créé: {site.nom}")
            else:
                print(f"  ✓ Site existant: {site.nom}")

            print("✅ Hiérarchie géographique créée\n")

            # 5. Créer la subscription
            print("=" * 70)
            print("💳 ÉTAPE 5: Création de la subscription...")
            print("=" * 70)

            result = await session.execute(select(Plan).where(Plan.code == "free"))
            free_plan = result.scalar_one()

            result = await session.execute(
                select(Subscription).where(Subscription.tenant_id == tenant.id)
            )
            existing_sub = result.scalar_one_or_none()

            if existing_sub:
                print(f"✅ Subscription existante (Plan: {free_plan.name}, Status: {existing_sub.status})\n")
            else:
                subscription = Subscription(
                    tenant_id=tenant.id,
                    plan_id=free_plan.id,
                    status="active",
                    current_period_start=datetime.utcnow(),
                    current_period_end=datetime.utcnow() + timedelta(days=365),
                    current_usage={},
                )
                session.add(subscription)
                await session.flush()
                print(f"✅ Subscription créée (Plan: {free_plan.name}, Status: active)\n")

            # 6. Créer l'utilisateur admin
            print("=" * 70)
            print("👤 ÉTAPE 6: Création de l'utilisateur admin...")
            print("=" * 70)

            result = await session.execute(
                select(User).where(User.email == "admin@santerurale.io")
            )
            existing_user = result.scalar_one_or_none()

            if existing_user:
                print(f"✅ Utilisateur admin existant:")
                print(f"   Email: {existing_user.email}")
                print(f"   Role: {existing_user.role}")
                print(f"   Actif: {existing_user.actif}")
            else:
                admin_user = User(
                    id=uuid.uuid4(),
                    email="admin@santerurale.io",
                    password_hash=hash_password("Admin@2024"),
                    nom="Administrateur",
                    prenom="Système",
                    role="admin",
                    site_id=site.id,
                    tenant_id=tenant.id,
                    actif=True,
                    email_verified=True,
                )
                session.add(admin_user)
                await session.flush()

                print("✅ Utilisateur admin créé avec succès!")
                print(f"   Email: admin@santerurale.io")
                print(f"   Mot de passe: Admin@2024")
                print(f"   Role: admin")
                print(f"   ID: {admin_user.id}")

    # 7. Résumé final
    print("\n" + "=" * 70)
    print("🎉 INITIALISATION TERMINÉE AVEC SUCCÈS!")
    print("=" * 70)
    print("\n📝 Informations de connexion:")
    print("   URL: https://santerurale.io")
    print("   Email: admin@santerurale.io")
    print("   Mot de passe: Admin@2024")
    print("\n⚠️  N'oubliez pas de changer le mot de passe après la première connexion!")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    asyncio.run(init_production())
