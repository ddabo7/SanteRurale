"""add email verification fields

Revision ID: add_email_verification
Revises: 61184db249b4
Create Date: 2025-10-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_email_verification'
down_revision = '61184db249b4'
branch_labels = None
depends_on = None


def upgrade():
    # Ajouter les colonnes pour la vérification d'email et réinitialisation de mot de passe
    op.add_column('users', sa.Column('email_verified', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('verification_token', sa.String(length=500), nullable=True))
    op.add_column('users', sa.Column('verification_token_expires', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('reset_token', sa.String(length=500), nullable=True))
    op.add_column('users', sa.Column('reset_token_expires', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('prenom', sa.String(length=200), nullable=True))

    # Mettre à jour les utilisateurs existants comme vérifiés
    op.execute("UPDATE users SET email_verified = true WHERE email_verified = false")


def downgrade():
    # Supprimer les colonnes ajoutées
    op.drop_column('users', 'reset_token_expires')
    op.drop_column('users', 'reset_token')
    op.drop_column('users', 'verification_token_expires')
    op.drop_column('users', 'verification_token')
    op.drop_column('users', 'email_verified')
    op.drop_column('users', 'prenom')
