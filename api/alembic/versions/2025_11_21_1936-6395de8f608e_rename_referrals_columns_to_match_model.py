"""rename referrals columns to match model

Revision ID: 6395de8f608e
Revises: 401f36b8af2e
Create Date: 2025-11-21 19:36:08.466636

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6395de8f608e'
down_revision: Union[str, None] = '401f36b8af2e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
