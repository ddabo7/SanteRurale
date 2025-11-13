"""change patients limit from per month to total

Revision ID: 2025_11_13_patients_total
Revises: 2025_11_13_feedbacks
Create Date: 2025-11-13

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2025_11_13_patients_total'
down_revision = '2025_11_13_feedbacks'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Renommer la colonne max_patients_per_month en max_patients_total
    op.alter_column('plans', 'max_patients_per_month',
                    new_column_name='max_patients_total',
                    existing_type=sa.Integer(),
                    existing_nullable=True)


def downgrade() -> None:
    # Retour en arrière si nécessaire
    op.alter_column('plans', 'max_patients_total',
                    new_column_name='max_patients_per_month',
                    existing_type=sa.Integer(),
                    existing_nullable=True)
