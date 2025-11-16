-- Migration manuelle: Ajouter les colonnes ville et pays à la table sites
-- Date: 2025-11-16
-- Raison: La migration Alembic a été marquée comme appliquée par le merge sans exécuter le SQL

-- Ajouter la colonne ville
ALTER TABLE sites ADD COLUMN IF NOT EXISTS ville VARCHAR(200);

-- Ajouter la colonne pays
ALTER TABLE sites ADD COLUMN IF NOT EXISTS pays VARCHAR(100);

-- Vérification
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_name = 'sites'
AND column_name IN ('ville', 'pays');
