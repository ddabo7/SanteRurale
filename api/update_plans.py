#!/usr/bin/env python3
"""
Script pour mettre à jour les plans d'abonnement avec les bonnes limites de patients.

Plan Gratuit: max_patients_total = 50, max_patients_per_month = None
Plan Starter: max_patients_total = None, max_patients_per_month = 500
Plan Pro/Enterprise: max_patients_total = None, max_patients_per_month = None (illimité)
"""
import asyncio
from decimal import Decimal
from sqlalchemy import select, update

from app.database import AsyncSessionLocal
from app.models.tenant import Plan


async def update_plans():
    """Met à jour les plans avec les bonnes valeurs de limites patients"""

    async with AsyncSessionLocal() as session:
        async with session.begin():
            # Récupérer tous les plans
            result = await session.execute(select(Plan))
            plans = result.scalars().all()

            print("=" * 70)
            print("📋 Mise à jour des plans d'abonnement")
            print("=" * 70)

            for plan in plans:
                print(f"\n🔄 Plan: {plan.name} ({plan.code})")
                print(f"   Avant: max_patients_total={plan.max_patients_total}, max_patients_per_month={plan.max_patients_per_month}")

                if plan.code == "free":
                    plan.max_patients_total = 50  # Limite TOTALE pour le gratuit
                    plan.max_patients_per_month = None  # Pas de limite mensuelle
                    plan.description = "Plan d'essai - Limité à 50 patients au total"

                elif plan.code == "starter":
                    plan.max_patients_total = None  # Pas de limite totale
                    plan.max_patients_per_month = 500  # Limite MENSUELLE
                    plan.description = "Abonnement mensuel - 500 nouveaux patients/mois"

                elif plan.code == "pro":
                    plan.max_patients_total = None  # Illimité
                    plan.max_patients_per_month = None  # Illimité
                    plan.description = "Abonnement mensuel - Patients illimités + fonctionnalités avancées"

                elif plan.code == "enterprise":
                    plan.max_patients_total = None  # Illimité
                    plan.max_patients_per_month = None  # Illimité
                    plan.description = "Abonnement mensuel - Solution complète pour réseaux de santé"

                print(f"   Après: max_patients_total={plan.max_patients_total}, max_patients_per_month={plan.max_patients_per_month}")
                print(f"   Description: {plan.description}")

            # Commit automatique à la sortie du bloc with session.begin()

    print("\n" + "=" * 70)
    print("✅ Mise à jour des plans terminée avec succès!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(update_plans())
