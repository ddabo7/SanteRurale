"""rename_referrals_columns

Revision ID: 316397d8731c
Revises: 401f36b8af2e
Create Date: 2025-11-21 20:38:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '316397d8731c'
down_revision: Union[str, None] = '401f36b8af2e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.alter_column('referrals', 'destination', new_column_name='etablissement_destination')
    op.alter_column('referrals', 'raison', new_column_name='motif')
    op.alter_column('referrals', 'eta', new_column_name='date_reference')
    op.alter_column('referrals', 'notes', new_column_name='commentaire')

def downgrade() -> None:
    op.alter_column('referrals', 'etablissement_destination', new_column_name='destination')
    op.alter_column('referrals', 'motif', new_column_name='raison')
    op.alter_column('referrals', 'date_reference', new_column_name='eta')
    op.alter_column('referrals', 'commentaire', new_column_name='notes')
