#!/usr/bin/env python3
"""
Script CLI pour supprimer un utilisateur spécifique
USAGE: python scripts/delete_user.py <email>

Exemple:
    python scripts/delete_user.py djinb77@gmail.com
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.models.base_models import User
from app.config import settings


async def delete_user_by_email(email: str):
    """
    Supprime un utilisateur par son email
    """
    db_url = str(settings.DATABASE_URL)
    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        try:
            # Vérifier si l'utilisateur existe
            result = await db.execute(
                select(User).where(User.email == email)
            )
            user = result.scalar_one_or_none()

            if not user:
                print(f"❌ Aucun utilisateur trouvé avec l'email: {email}")
                return False

            print(f"\n📋 UTILISATEUR TROUVÉ:")
            print(f"   Email: {user.email}")
            print(f"   Nom: {user.prenom or ''} {user.nom}".strip())
            print(f"   Rôle: {user.role}")
            print(f"   ID: {user.id}")
            print(f"   Email vérifié: {user.email_verified}")

            # Demander confirmation
            confirmation = input(f"\n⚠️  Voulez-vous supprimer cet utilisateur? (oui/non): ")
            if confirmation.lower() not in ["oui", "yes", "o", "y"]:
                print("❌ Annulé par l'utilisateur")
                return False

            # Supprimer l'utilisateur
            await db.execute(delete(User).where(User.email == email))
            await db.commit()

            print(f"\n✅ Utilisateur '{email}' supprimé avec succès!")
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
        print("❌ USAGE: python scripts/delete_user.py <email>")
        print("\nEXEMPLE:")
        print("  python scripts/delete_user.py djinb77@gmail.com")
        sys.exit(1)

    email = sys.argv[1]

    print("=" * 70)
    print("🗑️  SUPPRESSION D'UN UTILISATEUR")
    print("=" * 70)
    print(f"\nEmail à supprimer: {email}")
    print("=" * 70)
    print("")

    success = asyncio.run(delete_user_by_email(email))
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
