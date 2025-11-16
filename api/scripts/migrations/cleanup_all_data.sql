-- Script de nettoyage complet de toutes les données en production
-- Date: 2025-11-17
-- ATTENTION: Ce script supprime TOUTES les données utilisateurs et médicales
-- À exécuter uniquement en production après confirmation

-- ===========================================================================
-- DÉSACTIVER LES CONTRAINTES TEMPORAIREMENT
-- ===========================================================================
SET session_replication_role = 'replica';

-- ===========================================================================
-- SUPPRIMER TOUTES LES DONNÉES MÉDICALES
-- ===========================================================================

-- 1. Supprimer tous les rendez-vous
DELETE FROM appointments;
SELECT 'Rendez-vous supprimés: ' || COUNT(*) FROM appointments;

-- 2. Supprimer toutes les consultations/encounters
DELETE FROM encounters;
SELECT 'Consultations supprimées: ' || COUNT(*) FROM encounters;

-- 3. Supprimer tous les patients
DELETE FROM patients;
SELECT 'Patients supprimés: ' || COUNT(*) FROM patients;

-- ===========================================================================
-- SUPPRIMER TOUS LES UTILISATEURS
-- ===========================================================================

-- 4. Supprimer tous les utilisateurs
DELETE FROM users;
SELECT 'Utilisateurs supprimés: ' || COUNT(*) FROM users;

-- ===========================================================================
-- SUPPRIMER LES DONNÉES DE SYNCHRONISATION ET LOGS
-- ===========================================================================

-- 5. Supprimer les opérations de synchronisation offline
DELETE FROM offline_operations;
SELECT 'Opérations offline supprimées: ' || COUNT(*) FROM offline_operations;

-- 6. Supprimer les logs d'audit si la table existe
DELETE FROM audit_logs WHERE true;
SELECT 'Logs d\'audit supprimés: ' || COUNT(*) FROM audit_logs;

-- 7. Supprimer les tokens de session si la table existe
DELETE FROM sessions WHERE true;
SELECT 'Sessions supprimées: ' || COUNT(*) FROM sessions;

-- ===========================================================================
-- RÉACTIVER LES CONTRAINTES
-- ===========================================================================
SET session_replication_role = 'origin';

-- ===========================================================================
-- VÉRIFICATIONS FINALES
-- ===========================================================================

SELECT '=== VÉRIFICATION FINALE ===' as status;
SELECT 'Users restants: ' || COUNT(*) FROM users;
SELECT 'Patients restants: ' || COUNT(*) FROM patients;
SELECT 'Encounters restants: ' || COUNT(*) FROM encounters;
SELECT 'Appointments restants: ' || COUNT(*) FROM appointments;
SELECT 'Sites restants: ' || COUNT(*) FROM sites;

-- Afficher les sites qui restent (structure préservée)
SELECT 'Sites conservés:' as info;
SELECT id, nom, type, ville, pays, actif FROM sites;

-- ===========================================================================
-- RÉINITIALISER LES SÉQUENCES
-- ===========================================================================

-- Réinitialiser les compteurs auto-incrémentés si nécessaire
-- (PostgreSQL utilise des UUID donc pas de séquences à réinitialiser)

SELECT '=== NETTOYAGE TERMINÉ ===' as status;
SELECT 'Base de données vidée. Structure et sites préservés.' as message;
