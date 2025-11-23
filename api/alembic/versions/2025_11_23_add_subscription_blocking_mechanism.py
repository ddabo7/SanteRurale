"""add subscription blocking mechanism

Revision ID: 2025_11_23_blocking
Revises: 16f456eb85aa
Create Date: 2025-11-23

Ajoute les champs nécessaires pour le mécanisme de blocage progressif:
- expires_at: Date d'expiration du paiement
- grace_period_ends_at: Fin de la période de grâce (7 jours)
- degraded_at: Passage en mode dégradé
- read_only_at: Passage en lecture seule
- suspended_at: Date de suspension
- delete_scheduled_at: Date de suppression prévue
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2025_11_23_blocking'
down_revision: Union[str, None] = '16f456eb85aa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ajouter les colonnes pour le mécanisme de blocage
    op.add_column('subscriptions', sa.Column('expires_at', sa.DateTime(), nullable=True))
    op.add_column('subscriptions', sa.Column('grace_period_ends_at', sa.DateTime(), nullable=True))
    op.add_column('subscriptions', sa.Column('degraded_at', sa.DateTime(), nullable=True))
    op.add_column('subscriptions', sa.Column('read_only_at', sa.DateTime(), nullable=True))
    op.add_column('subscriptions', sa.Column('suspended_at', sa.DateTime(), nullable=True))
    op.add_column('subscriptions', sa.Column('delete_scheduled_at', sa.DateTime(), nullable=True))

    # Initialiser expires_at avec current_period_end pour les abonnements existants
    op.execute("""
        UPDATE subscriptions
        SET expires_at = current_period_end,
            grace_period_ends_at = current_period_end + INTERVAL '7 days'
        WHERE expires_at IS NULL
    """)


def downgrade() -> None:
    op.drop_column('subscriptions', 'delete_scheduled_at')
    op.drop_column('subscriptions', 'suspended_at')
    op.drop_column('subscriptions', 'read_only_at')
    op.drop_column('subscriptions', 'degraded_at')
    op.drop_column('subscriptions', 'grace_period_ends_at')
    op.drop_column('subscriptions', 'expires_at')
