#!/usr/bin/env python3
"""
Script de création d'un utilisateur admin avec tenant et site
"""
import asyncio
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, engine
from app.models import User, Tenant, Site, Base
from app.security import hash_password


async def create_admin():
    """Crée un utilisateur admin avec tenant et site"""
    # D'abord créer toutes les tables manquantes
    print("🔧 Création des tables manquantes...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Tables créées\n")

    async with AsyncSessionLocal() as session:
        async with session.begin():
            # Vérifier si un tenant existe déjà
            result = await session.execute(select(Tenant))
            tenant = result.scalar_one_or_none()

            if not tenant:
                # Créer un tenant par défaut
                tenant = Tenant(
                    id=uuid.uuid4(),
                    nom="Santé Rurale",
                    slug="santerurale",
                    actif=True,
                    plan="gratuit",
                    limite_patients=100,
                    limite_sites=1,
                    limite_users=5,
                )
                session.add(tenant)
                print(f"✅ Tenant créé: {tenant.nom} (ID: {tenant.id})")
            else:
                print(f"✅ Tenant existant: {tenant.nom} (ID: {tenant.id})")

            # Vérifier si un site existe déjà
            result = await session.execute(select(Site).where(Site.tenant_id == tenant.id))
            site = result.scalar_one_or_none()

            if not site:
                # Créer un site par défaut
                site = Site(
                    id=uuid.uuid4(),
                    nom="Site Principal",
                    code="PRINCIPAL",
                    tenant_id=tenant.id,
                    actif=True,
                )
                session.add(site)
                print(f"✅ Site créé: {site.nom} (ID: {site.id})")
            else:
                print(f"✅ Site existant: {site.nom} (ID: {site.id})")

            # Vérifier si l'admin existe déjà 
            result = await session.execute(
                select(User).where(User.email == "admin@santerurale.io")
            )
            existing_user = result.scalar_one_or_none()

            if existing_user:
                print(f"⚠️  L'utilisateur admin@santerurale.io existe déjà (ID: {existing_user.id})")
                print(f"   Role: {existing_user.role}")
                print(f"   Actif: {existing_user.actif}")
                return

            # Créer l'utilisateur admin 
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

            print("\n🎉 Utilisateur admin créé avec succès !")
            print(f"   Email: admin@santerurale.io")
            print(f"   Mot de passe: Admin@2024")
            print(f"   Role: admin")
            print(f"   ID: {admin_user.id}")
            print(f"   Tenant: {tenant.nom}")
            print(f"   Site: {site.nom}")
            print("\n⚠️  N'oubliez pas de changer le mot de passe après la première connexion !")


if __name__ == "__main__":
    asyncio.run(create_admin())
