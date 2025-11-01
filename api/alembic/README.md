# Migrations Alembic - Santé Rurale Mali

## 📋 Vue d'ensemble

Ce répertoire contient les migrations de base de données gérées par Alembic.

**Note importante** : Le schéma initial est créé directement depuis `schema.sql` lors du premier démarrage Docker. Les migrations Alembic sont utilisées pour les modifications ultérieures du schéma.

## 🚀 Commandes principales

### Créer une nouvelle migration

#### Migration automatique (recommandé)
```bash
# Génère automatiquement la migration en comparant les modèles avec la base
alembic revision --autogenerate -m "description de la migration"
```

#### Migration manuelle
```bash
# Crée un fichier de migration vide à remplir manuellement
alembic revision -m "description de la migration"
```

### Appliquer les migrations

```bash
# Appliquer toutes les migrations en attente
alembic upgrade head

# Appliquer jusqu'à une révision spécifique
alembic upgrade abc123

# Appliquer la prochaine migration seulement
alembic upgrade +1
```

### Annuler les migrations

```bash
# Annuler la dernière migration
alembic downgrade -1

# Annuler jusqu'à une révision spécifique
alembic downgrade abc123

# Revenir à la base (DANGER: supprime tout)
alembic downgrade base
```

### Informations

```bash
# Voir l'historique des migrations
alembic history

# Voir les migrations en attente
alembic history -r base:head

# Voir la révision actuelle
alembic current

# Voir le SQL généré sans l'exécuter
alembic upgrade head --sql
```

## 🐳 Avec Docker

```bash
# Entrer dans le conteneur API
docker-compose -f docker-compose.dev.yml exec api bash

# Puis exécuter les commandes Alembic
alembic upgrade head
```

## 📝 Bonnes pratiques

### 1. Toujours vérifier avant d'appliquer

```bash
# Générer le SQL sans l'exécuter
alembic upgrade head --sql > migration.sql

# Vérifier le fichier
less migration.sql

# Si OK, appliquer
alembic upgrade head
```

### 2. Tester en développement d'abord

```bash
# En développement
alembic upgrade head

# Tester l'application

# Si problème, rollback
alembic downgrade -1
```

### 3. Migrations réversibles

Toujours implémenter `downgrade()` pour pouvoir annuler :

```python
def upgrade() -> None:
    op.add_column('patients', sa.Column('email', sa.String(255)))

def downgrade() -> None:
    op.drop_column('patients', 'email')
```

### 4. Migrations de données

Pour les migrations complexes avec données :

```python
from alembic import op
from sqlalchemy import orm

def upgrade() -> None:
    # Créer une session
    bind = op.get_bind()
    session = orm.Session(bind=bind)

    # Migrer les données
    session.execute(
        "UPDATE patients SET age = EXTRACT(YEAR FROM NOW()) - annee_naissance"
    )

    session.commit()
```

## ⚠️ Attention

### Migrations en production

1. **Sauvegarder** la base de données avant toute migration
2. **Tester** en staging d'abord
3. **Planifier** une fenêtre de maintenance si nécessaire
4. **Avoir un plan de rollback**

### Migrations dangereuses

Ces opérations nécessitent une attention particulière :

- `DROP TABLE` - Perte de données
- `DROP COLUMN` - Perte de données
- `ALTER COLUMN` type - Peut échouer si données incompatibles
- Ajout de `NOT NULL` sans default - Échouera si données existantes

### Exemple migration sécurisée pour NOT NULL

```python
def upgrade() -> None:
    # 1. Ajouter la colonne nullable avec default
    op.add_column('patients',
        sa.Column('telephone', sa.String(20), server_default=''))

    # 2. Remplir les valeurs NULL existantes
    op.execute("UPDATE patients SET telephone = '' WHERE telephone IS NULL")

    # 3. Rendre NOT NULL
    op.alter_column('patients', 'telephone', nullable=False)

    # 4. Retirer le default (optionnel)
    op.alter_column('patients', 'telephone', server_default=None)
```

## 🔧 Résolution de problèmes

### "Target database is not up to date"

```bash
# Voir l'état actuel
alembic current

# Forcer la version (DANGER)
alembic stamp head
```

### "Multiple head revisions"

Fusionner les branches :

```bash
alembic merge -m "merge branches" head1 head2
```

### Réinitialiser complètement

```bash
# ATTENTION: Supprime toutes les données!
alembic downgrade base
alembic upgrade head
```

## 📚 Ressources

- [Documentation Alembic](https://alembic.sqlalchemy.org/)
- [Alembic Tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html)
- [SQLAlchemy 2.0](https://docs.sqlalchemy.org/en/20/)
