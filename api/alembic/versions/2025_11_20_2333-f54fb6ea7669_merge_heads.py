"""merge_heads

Revision ID: f54fb6ea7669
Revises: 590231a9f9ef, add_ville_pays_sites
Create Date: 2025-11-20 23:33:56.135811

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f54fb6ea7669'
down_revision: Union[str, None] = ('590231a9f9ef', 'add_ville_pays_sites')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
