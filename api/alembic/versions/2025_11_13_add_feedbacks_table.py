"""add feedbacks table

Revision ID: 2025_11_13_feedbacks
Revises: 2025_11_02_saas
Create Date: 2025-11-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '2025_11_13_feedbacks'
down_revision = '2025_11_02_saas'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Créer les types enum
    feedback_type_enum = postgresql.ENUM(
        'bug', 'feature_request', 'improvement', 'general', 'complaint',
        name='feedbacktype',
        create_type=False
    )
    feedback_type_enum.create(op.get_bind(), checkfirst=True)

    feedback_status_enum = postgresql.ENUM(
        'new', 'in_progress', 'resolved', 'closed',
        name='feedbackstatus',
        create_type=False
    )
    feedback_status_enum.create(op.get_bind(), checkfirst=True)

    # Créer la table feedbacks
    op.create_table(
        'feedbacks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('type', feedback_type_enum, nullable=False, server_default='general'),
        sa.Column('status', feedback_status_enum, nullable=False, server_default='new'),
        sa.Column('subject', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('user_email', sa.String(length=255), nullable=True),
        sa.Column('user_name', sa.String(length=255), nullable=True),
        sa.Column('browser_info', sa.Text(), nullable=True),
        sa.Column('screen_size', sa.String(length=50), nullable=True),
        sa.Column('url', sa.String(length=500), nullable=True),
        sa.Column('admin_response', sa.Text(), nullable=True),
        sa.Column('admin_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('responded_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['admin_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Créer les index
    op.create_index(op.f('ix_feedbacks_id'), 'feedbacks', ['id'], unique=False)
    op.create_index(op.f('ix_feedbacks_user_id'), 'feedbacks', ['user_id'], unique=False)
    op.create_index(op.f('ix_feedbacks_status'), 'feedbacks', ['status'], unique=False)
    op.create_index(op.f('ix_feedbacks_type'), 'feedbacks', ['type'], unique=False)
    op.create_index(op.f('ix_feedbacks_created_at'), 'feedbacks', ['created_at'], unique=False)


def downgrade() -> None:
    # Supprimer les index
    op.drop_index(op.f('ix_feedbacks_created_at'), table_name='feedbacks')
    op.drop_index(op.f('ix_feedbacks_type'), table_name='feedbacks')
    op.drop_index(op.f('ix_feedbacks_status'), table_name='feedbacks')
    op.drop_index(op.f('ix_feedbacks_user_id'), table_name='feedbacks')
    op.drop_index(op.f('ix_feedbacks_id'), table_name='feedbacks')

    # Supprimer la table
    op.drop_table('feedbacks')

    # Supprimer les types enum
    sa.Enum(name='feedbackstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='feedbacktype').drop(op.get_bind(), checkfirst=True)
