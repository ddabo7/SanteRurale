"""merge heads

Revision ID: 16f456eb85aa
Revises: 6395de8f608e, 2025_11_23_monthly_limits
Create Date: 2025-11-23 15:19:24.327537

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '16f456eb85aa'
down_revision: Union[str, None] = ('6395de8f608e', '2025_11_23_monthly_limits')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
