#!/usr/bin/env python3
"""
Script CLI pour supprimer TOUS les utilisateurs de la base de données
⚠️ ATTENTION: Ce script est DESTRUCTIF et IRRÉVERSIBLE!

USAGE: python scripts/delete_all_users.py

SÉCURITÉ: Ce script doit UNIQUEMENT être exécuté par l'administrateur système.
Il supprime TOUS les utilisateurs de la base de données sans exception.

Utilisez ce script UNIQUEMENT pour:
- Nettoyer une base de données de test
- Réinitialiser complètement le système
- Supprimer les comptes créés pendant le développement
"""
import asyncio
import sys
from pathlib import Path

# Ajouter le répertoire parent au PYTHONPATH
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, delete, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.models.base_models import User
from app.config import settings


async def delete_all_users():
    """
    Supprime TOUS les utilisateurs de la base de données
    """
    # Créer la connexion à la base de données
    # Convertir PostgresDsn en string
    db_url = str(settings.DATABASE_URL)
    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        try:
            # Compter le nombre d'utilisateurs avant suppression
            result = await db.execute(select(User))
            users = result.scalars().all()
            user_count = len(users)

            if user_count == 0:
                print("✅ Aucun utilisateur à supprimer. La base de données est déjà vide.")
                return True

            print(f"\n📋 UTILISATEURS TROUVÉS ({user_count}):")
            print("=" * 80)
            for i, user in enumerate(users, 1):
                print(f"{i}. {user.email} - Rôle: {user.role} - ID: {user.id}")
            print("=" * 80)

            # Demander confirmation
            print(f"\n⚠️  ATTENTION: Vous allez supprimer {user_count} utilisateur(s)")
            print("Cette opération est IRRÉVERSIBLE!")
            confirmation = input("\nTapez 'SUPPRIMER TOUT' pour confirmer: ")

            if confirmation != "SUPPRIMER TOUT":
                print("❌ Annulé par l'utilisateur")
                return False

            print("\n🗑️  Suppression en cours...")
            print("   Étape 1/5: Suppression des données liées aux utilisateurs...")

            # Supprimer toutes les données qui référencent les users
            # ATTENTION: Ceci supprime TOUTES les données de TOUTES les tables!
            tables_to_truncate = [
                'encounters',
                'conditions',
                'medications',
                'procedures',
                'attachments',
                'patients',
                'audit_logs',
                'feedback',
            ]

            for table in tables_to_truncate:
                try:
                    await db.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
                    await db.commit()  # Commit après chaque table
                    print(f"   ✓ Table '{table}' vidée")
                except Exception as e:
                    await db.rollback()  # Rollback en cas d'erreur pour continuer
                    print(f"   ⚠️  Table '{table}' n'existe pas ou erreur (ignorée)")

            print("   Étape 2/5: Suppression des utilisateurs...")
            # Maintenant supprimer les utilisateurs
            await db.execute(delete(User))

            print("   Étape 3/5: Commit des changements...")
            await db.commit()

            print(f"\n✅ {user_count} utilisateur(s) supprimé(s) avec succès!")
            print("\n📝 Prochaines étapes:")
            print("1. Créez votre compte admin avec: python scripts/create_admin.py")
            print("2. Vérifiez que la base de données est vide avec une requête SQL")

            return True

        except Exception as e:
            print(f"❌ ERREUR lors de la suppression des utilisateurs: {e}")
            import traceback
            traceback.print_exc()
            return False

        finally:
            await engine.dispose()


def main():
    """Point d'entrée du script"""
    print("=" * 80)
    print("⚠️  SUPPRESSION COMPLÈTE DE TOUTES LES DONNÉES")
    print("=" * 80)
    print("\n🔴 ATTENTION: Cette opération est DESTRUCTIVE et IRRÉVERSIBLE!")
    print("\n📋 Ce script va supprimer:")
    print("   ❌ Tous les utilisateurs (admins, médecins, soignants)")
    print("   ❌ Tous les patients")
    print("   ❌ Toutes les consultations (encounters)")
    print("   ❌ Tous les diagnostics (conditions)")
    print("   ❌ Tous les médicaments (medications)")
    print("   ❌ Toutes les procédures (procedures)")
    print("   ❌ Tous les fichiers attachés (attachments)")
    print("   ❌ Tous les logs d'audit (audit_logs)")
    print("   ❌ Tous les feedbacks")
    print("\n💡 Utilisez ce script UNIQUEMENT pour:")
    print("   - Nettoyer une base de données de test/développement")
    print("   - Réinitialiser complètement le système")
    print("   - Repartir sur une base de données 100% propre")
    print("\n" + "=" * 80)

    # Première confirmation
    proceed = input("\nVoulez-vous continuer? (oui/non): ")
    if proceed.lower() not in ["oui", "yes", "o", "y"]:
        print("❌ Annulé par l'utilisateur")
        sys.exit(0)

    print("\nChargement des utilisateurs...")
    success = asyncio.run(delete_all_users())

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
