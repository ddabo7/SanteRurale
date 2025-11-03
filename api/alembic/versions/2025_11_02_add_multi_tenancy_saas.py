"""add multi-tenancy SaaS system

Revision ID: 2025_11_02_saas
Revises: 2025_11_01
Create Date: 2025-11-02 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision = '2025_11_02_saas'
down_revision = 'a1b2c3d4e5f6'  # Dernière migration : add_encounters_and_related_tables
branch_labels = None
depends_on = None


def upgrade():
    # 1. Créer la table plans
    op.create_table(
        'plans',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('code', sa.String(50), unique=True, nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.String(500)),
        sa.Column('price_monthly', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('price_yearly', sa.Numeric(10, 2)),
        sa.Column('max_users', sa.Integer()),
        sa.Column('max_patients_per_month', sa.Integer()),
        sa.Column('max_sites', sa.Integer(), server_default='1'),
        sa.Column('max_storage_gb', sa.Integer(), server_default='5'),
        sa.Column('features', postgresql.JSON, server_default='[]'),
        sa.Column('stripe_price_id', sa.String(100)),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # 2. Créer la table tenants
    op.create_table(
        'tenants',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('slug', sa.String(100), unique=True, nullable=False),
        sa.Column('email', sa.String(200), nullable=False),
        sa.Column('phone', sa.String(50)),
        sa.Column('address', sa.String(500)),
        sa.Column('city', sa.String(100)),
        sa.Column('country_code', sa.String(2)),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('is_pilot', sa.Boolean(), server_default='false'),
        sa.Column('stripe_customer_id', sa.String(100)),
        sa.Column('settings', postgresql.JSON, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('idx_tenants_slug', 'tenants', ['slug'])
    op.create_index('idx_tenants_is_active', 'tenants', ['is_active'])

    # 3. Créer la table subscriptions
    op.create_table(
        'subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('plan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('plans.id'), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('trial_end', sa.DateTime()),
        sa.Column('current_period_start', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('current_period_end', sa.DateTime(), nullable=False),
        sa.Column('canceled_at', sa.DateTime()),
        sa.Column('stripe_subscription_id', sa.String(100)),
        sa.Column('current_usage', postgresql.JSON, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('idx_subscriptions_tenant', 'subscriptions', ['tenant_id'])
    op.create_index('idx_subscriptions_status', 'subscriptions', ['status'])

    # 4. Créer la table tenant_usage_logs
    op.create_table(
        'tenant_usage_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('date', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('active_users', sa.Integer(), server_default='0'),
        sa.Column('patients_created', sa.Integer(), server_default='0'),
        sa.Column('encounters_created', sa.Integer(), server_default='0'),
        sa.Column('api_calls', sa.Integer(), server_default='0'),
        sa.Column('storage_used_mb', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('idx_usage_logs_tenant_date', 'tenant_usage_logs', ['tenant_id', 'date'])

    # 5. Ajouter tenant_id aux tables existantes
    # Note: Mettre seulement les tables qui existent réellement dans votre DB
    tables_to_update = [
        'users',
        'patients',
        'encounters',
        'referrals',
        # Tables optionnelles (décommenter si elles existent):
        # 'encounter_vital_signs',
        # 'encounter_diagnoses',
        # 'encounter_prescriptions',
        # 'encounter_procedures',
        # 'reports'
    ]

    for table_name in tables_to_update:
        # Ajouter la colonne tenant_id
        op.add_column(table_name, sa.Column('tenant_id', postgresql.UUID(as_uuid=True)))

        # Créer un tenant par défaut pour les données existantes
        # Ce tenant sera créé dans le script de seed

        # Ajouter foreign key
        op.create_foreign_key(
            f'fk_{table_name}_tenant',
            table_name,
            'tenants',
            ['tenant_id'],
            ['id'],
            ondelete='CASCADE'
        )

        # Créer index pour performance
        op.create_index(f'idx_{table_name}_tenant', table_name, ['tenant_id'])

    # 6. Insérer les plans par défaut
    plans_table = sa.table('plans',
        sa.column('id', postgresql.UUID),
        sa.column('code', sa.String),
        sa.column('name', sa.String),
        sa.column('description', sa.String),
        sa.column('price_monthly', sa.Numeric),
        sa.column('price_yearly', sa.Numeric),
        sa.column('max_users', sa.Integer),
        sa.column('max_patients_per_month', sa.Integer),
        sa.column('max_sites', sa.Integer),
        sa.column('max_storage_gb', sa.Integer),
        sa.column('features', postgresql.JSON),
    )

    op.bulk_insert(plans_table, [
        {
            'id': uuid.uuid4(),
            'code': 'free',
            'name': 'Plan Gratuit (Pilote)',
            'description': 'Pour les centres pilotes - Phase 1',
            'price_monthly': 0,
            'price_yearly': 0,
            'max_users': 5,
            'max_patients_per_month': None,  # Illimité
            'max_sites': 1,
            'max_storage_gb': 10,
            'features': ['basic_features'],
        },
        {
            'id': uuid.uuid4(),
            'code': 'starter',
            'name': 'Plan Starter',
            'description': 'Pour les petits centres de santé',
            'price_monthly': 50,
            'price_yearly': 500,  # 2 mois gratuits
            'max_users': 5,
            'max_patients_per_month': 500,
            'max_sites': 1,
            'max_storage_gb': 20,
            'features': ['basic_features', 'mobile_app'],
        },
        {
            'id': uuid.uuid4(),
            'code': 'pro',
            'name': 'Plan Pro',
            'description': 'Pour les districts et centres moyens',
            'price_monthly': 150,
            'price_yearly': 1500,
            'max_users': 50,
            'max_patients_per_month': None,  # Illimité
            'max_sites': 10,
            'max_storage_gb': 100,
            'features': ['basic_features', 'mobile_app', 'dhis2_export', 'multi_sites', 'advanced_reports'],
        },
        {
            'id': uuid.uuid4(),
            'code': 'enterprise',
            'name': 'Plan Entreprise',
            'description': 'Pour les régions et grandes organisations',
            'price_monthly': 500,
            'price_yearly': 5000,
            'max_users': None,  # Illimité
            'max_patients_per_month': None,
            'max_sites': None,
            'max_storage_gb': 500,
            'features': ['basic_features', 'mobile_app', 'dhis2_export', 'multi_sites', 'advanced_reports', 'api_access', 'white_label', 'dedicated_support'],
        },
    ])


def downgrade():
    # Supprimer les foreign keys et colonnes tenant_id
    tables_to_update = [
        'users',
        'patients',
        'encounters',
        'referrals',
    ]

    for table_name in tables_to_update:
        op.drop_index(f'idx_{table_name}_tenant', table_name)
        op.drop_constraint(f'fk_{table_name}_tenant', table_name, type_='foreignkey')
        op.drop_column(table_name, 'tenant_id')

    # Supprimer les tables
    op.drop_index('idx_usage_logs_tenant_date', 'tenant_usage_logs')
    op.drop_table('tenant_usage_logs')

    op.drop_index('idx_subscriptions_status', 'subscriptions')
    op.drop_index('idx_subscriptions_tenant', 'subscriptions')
    op.drop_table('subscriptions')

    op.drop_index('idx_tenants_is_active', 'tenants')
    op.drop_index('idx_tenants_slug', 'tenants')
    op.drop_table('tenants')

    op.drop_table('plans')
