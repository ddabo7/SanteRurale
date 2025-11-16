"""add ville and pays to sites

Revision ID: add_ville_pays_sites
Revises: 2025_11_13_change_patients_limit_to_total
Create Date: 2025-11-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_ville_pays_sites'
down_revision: Union[str, None] = '2025_11_13_patients_total'  # Will be updated when running alembic
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add ville and pays columns to sites table
    op.add_column('sites', sa.Column('ville', sa.String(length=200), nullable=True))
    op.add_column('sites', sa.Column('pays', sa.String(length=100), nullable=True))


def downgrade() -> None:
    # Remove ville and pays columns from sites table
    op.drop_column('sites', 'pays')
    op.drop_column('sites', 'ville')
