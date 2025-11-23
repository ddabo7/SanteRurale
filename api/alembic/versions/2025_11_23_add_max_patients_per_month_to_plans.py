"""add max_patients_per_month to plans

Revision ID: 2025_11_23_monthly_limits
Revises: 316397d8731c
Create Date: 2025-11-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2025_11_23_monthly_limits'
down_revision: Union[str, None] = '316397d8731c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ajouter la colonne max_patients_per_month (limite mensuelle pour plans payants)
    op.add_column('plans', sa.Column('max_patients_per_month', sa.Integer(), nullable=True))
    
    # Mettre à jour les plans existants:
    # - Gratuit: max_patients_total=50, max_patients_per_month=NULL (limite totale uniquement)
    # - Starter: max_patients_total=NULL, max_patients_per_month=500 (limite mensuelle - nécessite renouvellement)
    # - Pro: max_patients_total=NULL, max_patients_per_month=NULL (illimité tant que abonnement actif)
    # - Enterprise: max_patients_total=NULL, max_patients_per_month=NULL (illimité tant que abonnement actif)
    
    # Important: Starter a une limite mensuelle qui force le renouvellement
    op.execute("""
        UPDATE plans 
        SET max_patients_per_month = 500, 
            max_patients_total = NULL,
            max_users = 10,
            max_storage_gb = 20
        WHERE code = 'starter'
    """)
    
    # Pro et Enterprise: illimités mais nécessitent abonnement actif pour accès aux fonctionnalités
    op.execute("""
        UPDATE plans 
        SET max_patients_per_month = NULL, 
            max_patients_total = NULL,
            max_storage_gb = 100
        WHERE code = 'pro'
    """)
    
    op.execute("""
        UPDATE plans 
        SET max_patients_per_month = NULL, 
            max_patients_total = NULL,
            max_storage_gb = 500
        WHERE code = 'enterprise'
    """)


def downgrade() -> None:
    # Supprimer la colonne max_patients_per_month
    op.drop_column('plans', 'max_patients_per_month')
