#!/usr/bin/env python3
"""
Script pour assigner un tenant à un compte admin existant

USAGE: python scripts/assign_admin_tenant.py <admin_email>

Ce script transforme un admin global (tenant_id=NULL) en admin de tenant,
lui permettant d'accéder à la fois au dashboard admin ET à l'interface patient/consultation.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.models.base_models import User
from app.models.tenant import Tenant
from app.config import settings


async def assign_tenant_to_admin(admin_email: str):
    """
    Assigne le premier tenant disponible à un admin
    """
    db_url = str(settings.DATABASE_URL)
    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        try:
            # Récupérer l'admin
            result = await db.execute(
                select(User).where(User.email == admin_email)
            )
            admin = result.scalar_one_or_none()

            if not admin:
                print(f"❌ ERREUR: Aucun utilisateur avec l'email '{admin_email}'")
                return False

            if admin.role != "admin":
                print(f"❌ ERREUR: L'utilisateur '{admin_email}' n'est pas admin (rôle: {admin.role})")
                return False

            # Récupérer le premier tenant
            result = await db.execute(select(Tenant).limit(1))
            tenant = result.scalar_one_or_none()

            if not tenant:
                print("❌ ERREUR: Aucun tenant disponible dans la base de données")
                print("   Vous devez créer un tenant d'abord")
                return False

            print(f"\n📋 ADMIN TROUVÉ:")
            print(f"   Email: {admin.email}")
            print(f"   Nom: {admin.prenom or ''} {admin.nom}".strip())
            print(f"   Tenant actuel: {admin.tenant_id or 'Aucun (admin global)'}")
            print(f"\n📋 TENANT À ASSIGNER:")
            print(f"   ID: {tenant.id}")
            print(f"   Nom: {tenant.name}")
            print(f"   Slug: {tenant.slug}")

            if admin.tenant_id:
                print(f"\n⚠️  ATTENTION: Cet admin a déjà un tenant assigné!")
                confirmation = input("\nVoulez-vous le remplacer? (oui/non): ")
                if confirmation.lower() not in ["oui", "yes", "o", "y"]:
                    print("❌ Annulé")
                    return False

            # Assigner le tenant
            admin.tenant_id = tenant.id
            await db.commit()
            await db.refresh(admin)

            print(f"\n✅ Tenant assigné avec succès!")
            print(f"   Admin: {admin.email}")
            print(f"   Tenant: {tenant.name} ({tenant.id})")
            print(f"\n📝 Prochaines étapes:")
            print(f"   1. Déconnectez-vous de l'application")
            print(f"   2. Reconnectez-vous pour obtenir un nouveau JWT avec le tenant_id")
            print(f"   3. Videz le cache IndexedDB du navigateur (F12 > Application > Storage > Clear storage)")
            print(f"   4. Vous pourrez maintenant accéder à la page abonnement")

            return True

        except Exception as e:
            print(f"❌ ERREUR: {e}")
            import traceback
            traceback.print_exc()
            return False

        finally:
            await engine.dispose()


def main():
    if len(sys.argv) < 2:
        print("❌ USAGE: python scripts/assign_admin_tenant.py <admin_email>")
        print("\nEXEMPLE:")
        print("  python scripts/assign_admin_tenant.py djibril.dabo@santerurale.io")
        sys.exit(1)

    admin_email = sys.argv[1]

    print("=" * 70)
    print("🔧 ASSIGNATION DE TENANT À UN ADMIN")
    print("=" * 70)
    print(f"\nCe script va assigner un tenant à l'admin: {admin_email}")
    print("Cela permettra à l'admin d'accéder à la page abonnement.")
    print("=" * 70)

    proceed = input("\nContinuer? (oui/non): ")
    if proceed.lower() not in ["oui", "yes", "o", "y"]:
        print("❌ Annulé")
        sys.exit(0)

    success = asyncio.run(assign_tenant_to_admin(admin_email))
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
