"""update_free_plan_description

Revision ID: 401f36b8af2e
Revises: 11722fd4c4c6
Create Date: 2025-11-20 23:48:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '401f36b8af2e'
down_revision: Union[str, None] = '11722fd4c4c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Mettre à jour la description du plan gratuit
    op.execute("""
        UPDATE plans 
        SET description = 'Plan d''essai - Limité à 50 patients'
        WHERE code = 'free'
    """)


def downgrade() -> None:
    # Revenir à l'ancienne description
    op.execute("""
        UPDATE plans 
        SET description = 'Pour les centres pilotes - Phase 1'
        WHERE code = 'free'
    """)
