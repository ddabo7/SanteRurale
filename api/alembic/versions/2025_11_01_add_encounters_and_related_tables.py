"""add encounters and related tables

Revision ID: a1b2c3d4e5f6
Revises: 2025_10_28_add_email_verification_fields
Create Date: 2025-11-01 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'add_email_verification'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Créer la table encounters
    op.create_table(
        'encounters',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('encounter_date', sa.Date(), nullable=False),
        sa.Column('motif', sa.Text(), nullable=True),
        sa.Column('temperature', sa.Numeric(precision=4, scale=1), nullable=True),
        sa.Column('pouls', sa.Integer(), nullable=True),
        sa.Column('pression_systolique', sa.Integer(), nullable=True),
        sa.Column('pression_diastolique', sa.Integer(), nullable=True),
        sa.Column('poids', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('taille', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ),
        sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_encounters_patient_id', 'encounters', ['patient_id'])
    op.create_index('idx_encounters_encounter_date', 'encounters', ['encounter_date'])

    # Créer la table conditions
    op.create_table(
        'conditions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('encounter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('code_icd10', sa.String(length=10), nullable=True),
        sa.Column('libelle', sa.String(length=500), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['encounter_id'], ['encounters.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_conditions_encounter_id', 'conditions', ['encounter_id'])

    # Créer la table medication_requests
    op.create_table(
        'medication_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('encounter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('medicament', sa.String(length=500), nullable=False),
        sa.Column('posologie', sa.String(length=500), nullable=False),
        sa.Column('duree_jours', sa.Integer(), nullable=True),
        sa.Column('quantite', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('unite', sa.String(length=50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['encounter_id'], ['encounters.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_medication_requests_encounter_id', 'medication_requests', ['encounter_id'])

    # Créer la table procedures
    op.create_table(
        'procedures',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('encounter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('type', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('resultat', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['encounter_id'], ['encounters.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_procedures_encounter_id', 'procedures', ['encounter_id'])


def downgrade() -> None:
    # Supprimer les tables dans l'ordre inverse
    op.drop_index('idx_procedures_encounter_id', table_name='procedures')
    op.drop_table('procedures')

    op.drop_index('idx_medication_requests_encounter_id', table_name='medication_requests')
    op.drop_table('medication_requests')

    op.drop_index('idx_conditions_encounter_id', table_name='conditions')
    op.drop_table('conditions')

    op.drop_index('idx_encounters_encounter_date', table_name='encounters')
    op.drop_index('idx_encounters_patient_id', table_name='encounters')
    op.drop_table('encounters')
