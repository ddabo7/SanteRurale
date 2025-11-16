#!/usr/bin/env python3
"""
Script CLI pour créer un compte administrateur
USAGE: python scripts/create_admin.py <email> <password> <nom> [prenom]

SÉCURITÉ: Ce script doit UNIQUEMENT être exécuté par l'administrateur système
sur le serveur de production. Il n'est pas accessible via l'API.

Exemple:
    python scripts/create_admin.py admin@santerurale.io "MySecurePass123!" "Admin" "Système"
"""
import asyncio
import sys
import os
from pathlib import Path

# Ajouter le répertoire parent au PYTHONPATH pour importer les modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
import uuid

from app.models.base_models import User, Site
from app.security import hash_password
from app.config import settings


async def create_admin_user(
    email: str,
    password: str,
    nom: str,
    prenom: str = None,
    telephone: str = None
):
    """
    Crée un compte administrateur système

    Args:
        email: Email de l'administrateur
        password: Mot de passe (sera hashé)
        nom: Nom de famille
        prenom: Prénom (optionnel)
        telephone: Numéro de téléphone (optionnel)
    """
    # Créer la connexion à la base de données
    # Convertir PostgresDsn en string
    db_url = str(settings.DATABASE_URL)
    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        try:
            # Vérifier si l'email existe déjà
            result = await db.execute(
                select(User).where(User.email == email)
            )
            existing_user = result.scalar_one_or_none()

            if existing_user:
                print(f"❌ ERREUR: Un utilisateur avec l'email '{email}' existe déjà")
                print(f"   ID: {existing_user.id}")
                print(f"   Rôle: {existing_user.role}")
                print(f"   Actif: {existing_user.actif}")
                return False

            # Valider le mot de passe
            if len(password) < 8:
                print("❌ ERREUR: Le mot de passe doit contenir au moins 8 caractères")
                return False

            if not any(c.isupper() for c in password):
                print("❌ ERREUR: Le mot de passe doit contenir au moins une majuscule")
                return False

            if not any(c.isdigit() for c in password):
                print("❌ ERREUR: Le mot de passe doit contenir au moins un chiffre")
                return False

            if not any(c in "!@#$%^&*" for c in password):
                print("❌ ERREUR: Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*)")
                return False

            # Récupérer le premier site disponible (les admins n'ont pas besoin de site spécifique)
            result = await db.execute(select(Site).limit(1))
            site = result.scalar_one_or_none()

            if not site:
                print("❌ ERREUR: Aucun site disponible dans la base de données")
                print("   Créez d'abord un site avant de créer un admin")
                return False

            # Créer l'utilisateur admin
            admin_user = User(
                id=uuid.uuid4(),
                email=email,
                password_hash=hash_password(password),
                nom=nom,
                prenom=prenom,
                telephone=telephone,
                role="admin",
                site_id=site.id,
                tenant_id=None,  # Les admins globaux n'ont pas de tenant
                email_verified=True,  # Admin pré-vérifié
                actif=True,
                verification_token=None,
                verification_token_expires=None
            )

            db.add(admin_user)
            await db.commit()
            await db.refresh(admin_user)

            print("✅ Compte administrateur créé avec succès!")
            print(f"   ID: {admin_user.id}")
            print(f"   Email: {admin_user.email}")
            print(f"   Nom: {admin_user.prenom or ''} {admin_user.nom}".strip())
            print(f"   Rôle: {admin_user.role}")
            print(f"   Email vérifié: Oui")
            print(f"   Actif: Oui")
            print("")
            print("⚠️  IMPORTANT: Notez le mot de passe de manière sécurisée!")
            print("   Vous pouvez maintenant vous connecter avec ces identifiants.")

            return True

        except Exception as e:
            print(f"❌ ERREUR lors de la création de l'admin: {e}")
            import traceback
            traceback.print_exc()
            return False

        finally:
            await engine.dispose()


def main():
    """Point d'entrée du script"""
    if len(sys.argv) < 4:
        print("❌ USAGE: python scripts/create_admin.py <email> <password> <nom> [prenom] [telephone]")
        print("")
        print("EXEMPLES:")
        print("  python scripts/create_admin.py admin@santerurale.io 'MyPass123!' 'Dabo'")
        print("  python scripts/create_admin.py admin@santerurale.io 'MyPass123!' 'Dabo' 'Djibril'")
        print("  python scripts/create_admin.py admin@santerurale.io 'MyPass123!' 'Dabo' 'Djibril' '+33612345678'")
        print("")
        print("EXIGENCES MOT DE PASSE:")
        print("  - Au moins 8 caractères")
        print("  - Au moins 1 majuscule")
        print("  - Au moins 1 chiffre")
        print("  - Au moins 1 caractère spécial (!@#$%^&*)")
        sys.exit(1)

    email = sys.argv[1]
    password = sys.argv[2]
    nom = sys.argv[3]
    prenom = sys.argv[4] if len(sys.argv) > 4 else None
    telephone = sys.argv[5] if len(sys.argv) > 5 else None

    print("=" * 70)
    print("🔐 CRÉATION D'UN COMPTE ADMINISTRATEUR SYSTÈME")
    print("=" * 70)
    print(f"Email: {email}")
    print(f"Nom: {prenom or ''} {nom}".strip())
    if telephone:
        print(f"Téléphone: {telephone}")
    print("=" * 70)
    print("")

    # Confirmation
    confirmation = input("⚠️  Voulez-vous créer ce compte admin? (oui/non): ")
    if confirmation.lower() not in ["oui", "yes", "o", "y"]:
        print("❌ Annulé par l'utilisateur")
        sys.exit(0)

    print("")
    print("Création du compte en cours...")
    print("")

    # Exécuter la création
    success = asyncio.run(create_admin_user(email, password, nom, prenom, telephone))

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
