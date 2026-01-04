"""Add pharmacy inventory system

Revision ID: 2026_01_03_pharmacy
Revises:
Create Date: 2026-01-03

Creates tables and enums for pharmacy inventory management including:
- Medicaments (drug catalog)
- Stock management per site
- Lots with expiration dates
- Stock movements (audit trail)
- Suppliers
- Purchase orders
- Patient dispensations
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision = '2026_01_03_pharmacy'
down_revision = '16f456eb85aa'  # 2025_11_23_blocking
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ========================================================================
    # 1. CRÉER LES TYPES ENUM
    # ========================================================================

    # Formes pharmaceutiques
    op.execute("""
        CREATE TYPE forme_medicament AS ENUM (
            'comprime',
            'gelule',
            'sirop',
            'suspension',
            'injectable',
            'pommade',
            'collyre',
            'suppositoire',
            'autres'
        )
    """)

    # Types de mouvements de stock
    op.execute("""
        CREATE TYPE type_mouvement AS ENUM (
            'entree',
            'sortie',
            'ajustement_positif',
            'ajustement_negatif',
            'peremption',
            'perte'
        )
    """)

    # Statuts de bons de commande
    op.execute("""
        CREATE TYPE statut_commande AS ENUM (
            'brouillon',
            'validee',
            'en_cours',
            'livree',
            'annulee'
        )
    """)

    # ========================================================================
    # 2. CRÉER LES TABLES
    # ========================================================================

    # 2.1 Table Medicaments (catalogue global)
    op.create_table(
        'medicaments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('nom', sa.String(200), nullable=False),
        sa.Column('dci', sa.String(200)),
        sa.Column('forme', postgresql.ENUM('comprime', 'gelule', 'sirop', 'suspension', 'injectable',
                                           'pommade', 'collyre', 'suppositoire', 'autres',
                                           name='forme_medicament', create_type=False), nullable=False),
        sa.Column('dosage', sa.String(100), nullable=False),
        sa.Column('unite_conditionnement', sa.String(50)),
        sa.Column('quantite_par_unite', sa.Integer),
        sa.Column('prix_unitaire_reference', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('seuil_alerte_defaut', sa.Integer),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )

    # 2.2 Table Fournisseurs (catalogue global) 
    op.create_table(
        'fournisseurs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('nom', sa.String(200), nullable=False),
        sa.Column('contact_nom', sa.String(200)),
        sa.Column('telephone', sa.String(50)),
        sa.Column('email', sa.String(200)),
        sa.Column('adresse', sa.Text),
        sa.Column('ville', sa.String(100)),
        sa.Column('pays', sa.String(100), nullable=False, server_default='Mali'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )

    # 2.3 Table StockSite (stock par site)
    op.create_table(
        'stock_sites',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('medicament_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('quantite_actuelle', sa.Integer, nullable=False, server_default='0'),
        sa.Column('seuil_alerte', sa.Integer),
        sa.Column('valeur_stock', sa.Numeric(10, 2)),
        sa.Column('derniere_entree', sa.DateTime(timezone=True)),
        sa.Column('derniere_sortie', sa.DateTime(timezone=True)),
        sa.Column('version', sa.Integer, nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['medicament_id'], ['medicaments.id']),
        sa.ForeignKeyConstraint(['site_id'], ['sites.id']),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 2.4 Table BonsCommande
    op.create_table(
        'bons_commande',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('numero', sa.String(50), nullable=False),
        sa.Column('fournisseur_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('validated_by', postgresql.UUID(as_uuid=True)),
        sa.Column('date_commande', sa.Date, nullable=False),
        sa.Column('date_livraison_prevue', sa.Date),
        sa.Column('date_livraison_effective', sa.Date),
        sa.Column('statut', postgresql.ENUM('brouillon', 'validee', 'en_cours', 'livree', 'annulee',
                                            name='statut_commande', create_type=False),
                  nullable=False, server_default='brouillon'),
        sa.Column('montant_total', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('commentaire', sa.Text),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['fournisseur_id'], ['fournisseurs.id']),
        sa.ForeignKeyConstraint(['site_id'], ['sites.id']),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['validated_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('numero')
    )

    # 2.5 Table BonsCommandeLignes
    op.create_table(
        'bons_commande_lignes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('bon_commande_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('medicament_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('quantite_commandee', sa.Integer, nullable=False),
        sa.Column('quantite_recue', sa.Integer, nullable=False, server_default='0'),
        sa.Column('prix_unitaire', sa.Numeric(10, 2), nullable=False),
        sa.Column('montant_ligne', sa.Numeric(10, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['bon_commande_id'], ['bons_commande.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['medicament_id'], ['medicaments.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # 2.6 Table LotsMedicament
    op.create_table(
        'lots_medicament',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('medicament_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('bon_commande_ligne_id', postgresql.UUID(as_uuid=True)),
        sa.Column('numero_lot', sa.String(100), nullable=False),
        sa.Column('date_peremption', sa.Date, nullable=False),
        sa.Column('quantite_restante', sa.Integer, nullable=False),
        sa.Column('prix_achat_unitaire', sa.Numeric(10, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['medicament_id'], ['medicaments.id']),
        sa.ForeignKeyConstraint(['site_id'], ['sites.id']),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['bon_commande_ligne_id'], ['bons_commande_lignes.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # 2.7 Table DelivrancesPatient
    op.create_table(
        'delivrances_patient',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('encounter_id', postgresql.UUID(as_uuid=True)),
        sa.Column('medication_request_id', postgresql.UUID(as_uuid=True)),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('delivered_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('date_delivrance', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('commentaire', sa.Text),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['patient_id'], ['patients.id']),
        sa.ForeignKeyConstraint(['encounter_id'], ['encounters.id']),
        sa.ForeignKeyConstraint(['medication_request_id'], ['medication_requests.id']),
        sa.ForeignKeyConstraint(['site_id'], ['sites.id']),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['delivered_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # 2.8 Table DelivrancesLignes
    op.create_table(
        'delivrances_lignes',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('delivrance_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('medicament_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('lot_id', postgresql.UUID(as_uuid=True)),
        sa.Column('quantite', sa.Integer, nullable=False),
        sa.Column('instructions', sa.Text),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['delivrance_id'], ['delivrances_patient.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['medicament_id'], ['medicaments.id']),
        sa.ForeignKeyConstraint(['lot_id'], ['lots_medicament.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # 2.9 Table StockMovements
    op.create_table(
        'stock_movements',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, default=uuid.uuid4),
        sa.Column('medicament_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('site_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('lot_id', postgresql.UUID(as_uuid=True)),
        sa.Column('bon_commande_id', postgresql.UUID(as_uuid=True)),
        sa.Column('delivrance_id', postgresql.UUID(as_uuid=True)),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('type_mouvement', postgresql.ENUM('entree', 'sortie', 'ajustement_positif',
                                                    'ajustement_negatif', 'peremption', 'perte',
                                                    name='type_mouvement', create_type=False), nullable=False),
        sa.Column('quantite', sa.Integer, nullable=False),
        sa.Column('date_mouvement', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('reference_externe', sa.String(200)),
        sa.Column('commentaire', sa.Text),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['medicament_id'], ['medicaments.id']),
        sa.ForeignKeyConstraint(['site_id'], ['sites.id']),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['lot_id'], ['lots_medicament.id']),
        sa.ForeignKeyConstraint(['bon_commande_id'], ['bons_commande.id']),
        sa.ForeignKeyConstraint(['delivrance_id'], ['delivrances_patient.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # ========================================================================
    # 3. CRÉER LES INDEX
    # ========================================================================

    # Index pour medicaments
    op.create_index('idx_medicaments_code', 'medicaments', ['code'])
    op.create_index('idx_medicaments_nom', 'medicaments', ['nom'])
    op.create_index('idx_medicaments_dci', 'medicaments', ['dci'])
    op.create_index('idx_medicaments_forme', 'medicaments', ['forme'])

    # Index pour fournisseurs
    op.create_index('idx_fournisseurs_code', 'fournisseurs', ['code'])
    op.create_index('idx_fournisseurs_nom', 'fournisseurs', ['nom'])

    # Index pour stock_sites
    op.create_index('idx_stock_sites_medicament', 'stock_sites', ['medicament_id'])
    op.create_index('idx_stock_sites_site', 'stock_sites', ['site_id'])
    op.create_index('idx_stock_sites_tenant', 'stock_sites', ['tenant_id'])
    op.create_index('idx_stock_sites_site_tenant', 'stock_sites', ['site_id', 'tenant_id'])

    # Index pour bons_commande
    op.create_index('idx_bc_fournisseur', 'bons_commande', ['fournisseur_id'])
    op.create_index('idx_bc_site', 'bons_commande', ['site_id'])
    op.create_index('idx_bc_tenant', 'bons_commande', ['tenant_id'])
    op.create_index('idx_bc_statut', 'bons_commande', ['statut'])
    op.create_index('idx_bc_numero', 'bons_commande', ['numero'])
    op.create_index('idx_bc_site_tenant', 'bons_commande', ['site_id', 'tenant_id'])

    # Index pour bons_commande_lignes
    op.create_index('idx_bc_lignes_commande', 'bons_commande_lignes', ['bon_commande_id'])
    op.create_index('idx_bc_lignes_medicament', 'bons_commande_lignes', ['medicament_id'])

    # Index pour lots_medicament
    op.create_index('idx_lots_medicament', 'lots_medicament', ['medicament_id'])
    op.create_index('idx_lots_site', 'lots_medicament', ['site_id'])
    op.create_index('idx_lots_tenant', 'lots_medicament', ['tenant_id'])
    op.create_index('idx_lots_peremption', 'lots_medicament', ['date_peremption'])
    op.create_index('idx_lots_medicament_site', 'lots_medicament', ['medicament_id', 'site_id'])

    # Index pour delivrances_patient
    op.create_index('idx_delivrances_patient', 'delivrances_patient', ['patient_id'])
    op.create_index('idx_delivrances_encounter', 'delivrances_patient', ['encounter_id'])
    op.create_index('idx_delivrances_site', 'delivrances_patient', ['site_id'])
    op.create_index('idx_delivrances_tenant', 'delivrances_patient', ['tenant_id'])
    op.create_index('idx_delivrances_date', 'delivrances_patient', ['date_delivrance'])
    op.create_index('idx_delivrances_site_tenant', 'delivrances_patient', ['site_id', 'tenant_id'])

    # Index pour delivrances_lignes
    op.create_index('idx_delivrances_lignes_delivrance', 'delivrances_lignes', ['delivrance_id'])
    op.create_index('idx_delivrances_lignes_medicament', 'delivrances_lignes', ['medicament_id'])

    # Index pour stock_movements
    op.create_index('idx_movements_medicament', 'stock_movements', ['medicament_id'])
    op.create_index('idx_movements_site', 'stock_movements', ['site_id'])
    op.create_index('idx_movements_tenant', 'stock_movements', ['tenant_id'])
    op.create_index('idx_movements_type', 'stock_movements', ['type_mouvement'])
    op.create_index('idx_movements_date', 'stock_movements', ['date_mouvement'])
    op.create_index('idx_movements_medicament_date', 'stock_movements', ['medicament_id', 'date_mouvement'])
    op.create_index('idx_movements_site_tenant', 'stock_movements', ['site_id', 'tenant_id'])


def downgrade() -> None:
    # ========================================================================
    # 1. SUPPRIMER LES INDEX
    # ========================================================================

    # Drop index in reverse order
    op.drop_index('idx_movements_site_tenant', 'stock_movements')
    op.drop_index('idx_movements_medicament_date', 'stock_movements')
    op.drop_index('idx_movements_date', 'stock_movements')
    op.drop_index('idx_movements_type', 'stock_movements')
    op.drop_index('idx_movements_tenant', 'stock_movements')
    op.drop_index('idx_movements_site', 'stock_movements')
    op.drop_index('idx_movements_medicament', 'stock_movements')

    op.drop_index('idx_delivrances_lignes_medicament', 'delivrances_lignes')
    op.drop_index('idx_delivrances_lignes_delivrance', 'delivrances_lignes')

    op.drop_index('idx_delivrances_site_tenant', 'delivrances_patient')
    op.drop_index('idx_delivrances_date', 'delivrances_patient')
    op.drop_index('idx_delivrances_tenant', 'delivrances_patient')
    op.drop_index('idx_delivrances_site', 'delivrances_patient')
    op.drop_index('idx_delivrances_encounter', 'delivrances_patient')
    op.drop_index('idx_delivrances_patient', 'delivrances_patient')

    op.drop_index('idx_lots_medicament_site', 'lots_medicament')
    op.drop_index('idx_lots_peremption', 'lots_medicament')
    op.drop_index('idx_lots_tenant', 'lots_medicament')
    op.drop_index('idx_lots_site', 'lots_medicament')
    op.drop_index('idx_lots_medicament', 'lots_medicament')

    op.drop_index('idx_bc_lignes_medicament', 'bons_commande_lignes')
    op.drop_index('idx_bc_lignes_commande', 'bons_commande_lignes')

    op.drop_index('idx_bc_site_tenant', 'bons_commande')
    op.drop_index('idx_bc_numero', 'bons_commande')
    op.drop_index('idx_bc_statut', 'bons_commande')
    op.drop_index('idx_bc_tenant', 'bons_commande')
    op.drop_index('idx_bc_site', 'bons_commande')
    op.drop_index('idx_bc_fournisseur', 'bons_commande')

    op.drop_index('idx_stock_sites_site_tenant', 'stock_sites')
    op.drop_index('idx_stock_sites_tenant', 'stock_sites')
    op.drop_index('idx_stock_sites_site', 'stock_sites')
    op.drop_index('idx_stock_sites_medicament', 'stock_sites')

    op.drop_index('idx_fournisseurs_nom', 'fournisseurs')
    op.drop_index('idx_fournisseurs_code', 'fournisseurs')

    op.drop_index('idx_medicaments_forme', 'medicaments')
    op.drop_index('idx_medicaments_dci', 'medicaments')
    op.drop_index('idx_medicaments_nom', 'medicaments')
    op.drop_index('idx_medicaments_code', 'medicaments')

    # ========================================================================
    # 2. SUPPRIMER LES TABLES
    # ========================================================================

    op.drop_table('stock_movements')
    op.drop_table('delivrances_lignes')
    op.drop_table('delivrances_patient')
    op.drop_table('lots_medicament')
    op.drop_table('bons_commande_lignes')
    op.drop_table('bons_commande')
    op.drop_table('stock_sites')
    op.drop_table('fournisseurs')
    op.drop_table('medicaments')

    # ========================================================================
    # 3. SUPPRIMER LES TYPES ENUM
    # ========================================================================

    op.execute("DROP TYPE IF EXISTS statut_commande")
    op.execute("DROP TYPE IF EXISTS type_mouvement")
    op.execute("DROP TYPE IF EXISTS forme_medicament")
