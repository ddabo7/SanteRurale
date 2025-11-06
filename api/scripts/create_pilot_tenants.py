#!/usr/bin/env python3
"""
Script pour créer des tenants pilotes (Phase 1)

Usage:
    python scripts/create_pilot_tenants.py --interactive
    python scripts/create_pilot_tenants.py --from-csv pilots.csv
    python scripts/create_pilot_tenants.py --single "CSCOM Koulikoro" cscom-koulikoro test@koulikoro.ml
"""
import asyncio
import sys
import csv
from pathlib import Path
import argparse

# Ajouter le dossier parent au path pour pouvoir importer app
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import AsyncSessionLocal
from app.services.subscription_service import SubscriptionService


async def create_single_pilot(name: str, slug: str, email: str, phone: str = None, city: str = None, country_code: str = "ML"):
    """Créer un seul tenant pilote"""
    async with AsyncSessionLocal() as db:
        service = SubscriptionService(db)

        print(f"\n📝 Création du tenant pilote: {name}")
        print(f"   Slug: {slug}")
        print(f"   Email: {email}")

        try:
            tenant = await service.create_pilot_tenant(
                name=name,
                slug=slug,
                email=email,
                phone=phone,
                city=city,
                country_code=country_code
            )

            print(f"✅ Tenant créé avec succès!")
            print(f"   ID: {tenant.id}")
            print(f"   Nom: {tenant.name}")
            print(f"   Plan: Gratuit (pilote)")
            print(f"   Quotas: 5 utilisateurs, 1 site, 10GB")

            return tenant

        except Exception as e:
            print(f"❌ Erreur lors de la création: {e}")
            return None


async def create_pilots_from_csv(csv_file: str):
    """Créer plusieurs tenants depuis un fichier CSV"""
    if not Path(csv_file).exists():
        print(f"❌ Fichier non trouvé: {csv_file}")
        return

    created_count = 0
    failed_count = 0

    print(f"\n📂 Lecture du fichier: {csv_file}\n")

    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)

        for row in reader:
            tenant = await create_single_pilot(
                name=row['name'],
                slug=row['slug'],
                email=row['email'],
                phone=row.get('phone'),
                city=row.get('city'),
                country_code=row.get('country_code', 'ML')
            )

            if tenant:
                created_count += 1
            else:
                failed_count += 1

    print(f"\n📊 Résumé:")
    print(f"   ✅ Créés: {created_count}")
    print(f"   ❌ Échecs: {failed_count}")


async def interactive_mode():
    """Mode interactif pour créer des tenants"""
    print("\n🚀 Création de Tenants Pilotes - Mode Interactif")
    print("=" * 60)

    tenants_created = []

    while True:
        print("\n" + "=" * 60)
        print("Informations du tenant pilote:")
        print("=" * 60)

        name = input("Nom du centre (ex: CSCOM Koulikoro): ").strip()
        if not name:
            break

        # Générer un slug par défaut
        default_slug = name.lower().replace(" ", "-").replace("cscom", "cscom")
        slug = input(f"Slug (appuyez sur Entrée pour '{default_slug}'): ").strip() or default_slug

        email = input("Email de contact: ").strip()
        if not email:
            print("❌ Email obligatoire")
            continue

        phone = input("Téléphone (optionnel): ").strip() or None
        city = input("Ville (optionnel): ").strip() or None
        country_code = input("Code pays (ML par défaut): ").strip() or "ML"

        # Créer le tenant
        tenant = await create_single_pilot(name, slug, email, phone, city, country_code)

        if tenant:
            tenants_created.append(tenant)

        # Continuer ?
        continue_input = input("\n➕ Créer un autre tenant ? (o/N): ").strip().lower()
        if continue_input != 'o':
            break

    print(f"\n✅ {len(tenants_created)} tenant(s) pilote(s) créé(s) avec succès!")
    return tenants_created


async def list_all_tenants():
    """Lister tous les tenants existants"""
    from sqlalchemy import select
    from app.models.tenant import Tenant

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Tenant).order_by(Tenant.created_at.desc())
        )
        tenants = result.scalars().all()

        print("\n📋 Liste des Tenants Existants")
        print("=" * 80)

        if not tenants:
            print("Aucun tenant trouvé.")
            return

        for i, tenant in enumerate(tenants, 1):
            pilot_badge = "🆓 PILOTE" if tenant.is_pilot else "💰 PAYANT"
            status_badge = "✅ ACTIF" if tenant.is_active else "❌ INACTIF"

            print(f"\n{i}. {tenant.name}")
            print(f"   ID: {tenant.id}")
            print(f"   Slug: {tenant.slug}")
            print(f"   Email: {tenant.email}")
            print(f"   Type: {pilot_badge}  |  Status: {status_badge}")
            print(f"   Créé: {tenant.created_at.strftime('%d/%m/%Y %H:%M')}")


async def create_example_csv():
    """Créer un fichier CSV d'exemple"""
    csv_content = """name,slug,email,phone,city,country_code
CSCOM Koulikoro,cscom-koulikoro,cscom.koulikoro@sante.ml,+223 XX XX XX XX,Koulikoro,ML
CSCOM Ségou,cscom-segou,cscom.segou@sante.ml,+223 YY YY YY YY,Ségou,ML
CSCOM Kayes,cscom-kayes,cscom.kayes@sante.ml,+223 ZZ ZZ ZZ ZZ,Kayes,ML
CSCOM Sikasso,cscom-sikasso,cscom.sikasso@sante.ml,+223 AA AA AA AA,Sikasso,ML
CSCOM Mopti,cscom-mopti,cscom.mopti@sante.ml,+223 BB BB BB BB,Mopti,ML
"""

    filename = "pilot_tenants_example.csv"
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(csv_content)

    print(f"✅ Fichier exemple créé: {filename}")
    print(f"\nÉditez ce fichier avec vos données, puis exécutez:")
    print(f"   python scripts/create_pilot_tenants.py --from-csv {filename}")


def main():
    parser = argparse.ArgumentParser(description="Créer des tenants pilotes pour la Phase 1")

    parser.add_argument('--interactive', '-i', action='store_true',
                        help="Mode interactif")
    parser.add_argument('--from-csv', metavar='FILE',
                        help="Créer depuis un fichier CSV")
    parser.add_argument('--single', nargs=3, metavar=('NAME', 'SLUG', 'EMAIL'),
                        help="Créer un seul tenant")
    parser.add_argument('--list', '-l', action='store_true',
                        help="Lister tous les tenants existants")
    parser.add_argument('--example-csv', action='store_true',
                        help="Créer un fichier CSV d'exemple")

    args = parser.parse_args()

    # Si aucun argument, afficher l'aide
    if len(sys.argv) == 1:
        parser.print_help()
        print("\n💡 Astuce: Utilisez --interactive pour le mode guidé")
        sys.exit(0)

    if args.example_csv:
        asyncio.run(create_example_csv())

    elif args.list:
        asyncio.run(list_all_tenants())

    elif args.interactive:
        asyncio.run(interactive_mode())

    elif args.from_csv:
        asyncio.run(create_pilots_from_csv(args.from_csv))

    elif args.single:
        name, slug, email = args.single
        asyncio.run(create_single_pilot(name, slug, email))

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
