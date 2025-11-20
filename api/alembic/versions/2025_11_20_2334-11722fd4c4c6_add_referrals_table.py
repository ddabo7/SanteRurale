"""add_referrals_table

Revision ID: 11722fd4c4c6
Revises: f54fb6ea7669
Create Date: 2025-11-20 23:34:07.645843

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '11722fd4c4c6'
down_revision: Union[str, None] = 'f54fb6ea7669'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Créer la table referrals
    op.create_table(
        'referrals',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('encounter_id', sa.UUID(), nullable=False),
        sa.Column('etablissement_destination', sa.String(length=500), nullable=False),
        sa.Column('motif', sa.Text(), nullable=False),
        sa.Column('statut', sa.String(length=50), nullable=False, server_default='en_attente'),
        sa.Column('date_reference', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('date_confirmation', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('commentaire', sa.Text(), nullable=True),
        sa.Column('site_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['encounter_id'], ['encounters.id'], ),
        sa.ForeignKeyConstraint(['site_id'], ['sites.id'], )
    )
    
    # Créer les index
    op.create_index('ix_referrals_encounter_id', 'referrals', ['encounter_id'])
    op.create_index('ix_referrals_site_id', 'referrals', ['site_id'])
    op.create_index('ix_referrals_statut', 'referrals', ['statut'])
    op.create_index('ix_referrals_date_reference', 'referrals', ['date_reference'])


def downgrade() -> None:
    # Supprimer les index
    op.drop_index('ix_referrals_date_reference', table_name='referrals')
    op.drop_index('ix_referrals_statut', table_name='referrals')
    op.drop_index('ix_referrals_site_id', table_name='referrals')
    op.drop_index('ix_referrals_encounter_id', table_name='referrals')
    
    # Supprimer la table
    op.drop_table('referrals')
