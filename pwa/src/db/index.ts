/**
 * Base de données IndexedDB locale avec Dexie
 *
 * Architecture offline-first:
 * - Stockage local de tous les patients, consultations, etc.
 * - Outbox queue pour synchronisation des modifications
 * - Gestion des conflits via versioning
 */

import Dexie, { Table } from 'dexie'

// ===========================================================================
// TYPES 
// ===========================================================================

export interface Patient {
  id: string // UUID
  nom: string
  prenom?: string
  sexe: 'M' | 'F'
  annee_naissance?: number
  telephone?: string
  village?: string
  site_id: string
  matricule?: string
  deleted_at?: string | null

  created_at: string
  updated_at: string
  version: number

  // Client-side only
  _synced?: boolean
  _local_id?: string // ID local avant sync
}

export interface Encounter {
  id: string
  patient_id: string
  site_id: string
  user_id: string

  date: string // ISO date
  motif?: string
  temperature?: number
  pouls?: number
  pression_systolique?: number
  pression_diastolique?: number
  poids?: number
  taille?: number
  notes?: string

  created_at: string
  updated_at: string
  version: number

  _synced?: boolean
  _local_id?: string
}

export interface Condition {
  id: string
  encounter_id: string
  code_icd10?: string
  libelle: string
  notes?: string
  created_at: string
  _synced?: boolean
}

export interface MedicationRequest {
  id: string
  encounter_id: string
  medicament: string
  posologie: string
  duree_jours?: number
  quantite?: number
  unite?: string
  notes?: string
  created_at: string
  _synced?: boolean
}

export interface Procedure {
  id: string
  encounter_id: string
  type: string
  description?: string
  resultat?: string
  created_at: string
  _synced?: boolean
}

export interface Reference {
  id: string
  encounter_id: string
  destination: string
  raison: string
  statut: 'en_attente' | 'confirme' | 'complete' | 'annule'
  eta?: string
  notes?: string
  created_at: string
  updated_at: string
  _synced?: boolean
}

export interface Attachment {
  id: string
  patient_id?: string
  encounter_id?: string
  filename: string
  mime_type: string
  size_bytes: number
  uploaded: boolean
  blob_data?: Blob // Données du fichier (si pas encore uploadé)
  s3_key?: string
  created_at: string
}

/**
 * Outbox: file d'attente des opérations à synchroniser
 */
export interface OutboxOperation {
  id: string // UUID local
  operation: 'create' | 'update' | 'delete'
  entity: 'patient' | 'encounter' | 'condition' | 'medication_request' | 'procedure' | 'reference'
  idempotency_key: string // UUID pour garantir l'idempotence
  client_id?: string // ID local de l'entité
  payload: any
  attempts: number
  last_error?: string
  created_at: string
  processed?: number // 0 = non traité, 1 = traité (Dexie utilise des nombres pour indexation)
}

/**
 * Sync metadata
 */
export interface SyncMeta {
  key: string // ex: 'last_sync_cursor', 'last_sync_time'
  value: string
  updated_at: string
}

/**
 * User session (sans les tokens - ils sont dans les cookies HttpOnly)
 */
export interface UserSession {
  id: string
  email: string
  nom: string
  prenom?: string
  telephone?: string
  role: string
  site_id: string
  avatar_url?: string
}

// ===========================================================================
// DATABASE CLASS
// ===========================================================================

export class SanteDB extends Dexie {
  // Tables
  patients!: Table<Patient, string>
  encounters!: Table<Encounter, string>
  conditions!: Table<Condition, string>
  medication_requests!: Table<MedicationRequest, string>
  procedures!: Table<Procedure, string>
  references!: Table<Reference, string>
  attachments!: Table<Attachment, string>

  outbox!: Table<OutboxOperation, string>
  sync_meta!: Table<SyncMeta, string>
  user_session!: Table<UserSession, string>

  constructor() {
    super('SanteRurale')

    // Version 1 - Schéma initial
    this.version(1).stores({
      // Index: champs indexés pour recherche rapide
      patients: 'id, nom, prenom, telephone, village, site_id, created_at, _synced',
      encounters: 'id, patient_id, site_id, user_id, date, created_at, _synced',
      conditions: 'id, encounter_id, libelle, created_at, _synced',
      medication_requests: 'id, encounter_id, medicament, created_at, _synced',
      procedures: 'id, encounter_id, type, created_at, _synced',
      references: 'id, encounter_id, statut, created_at, _synced',
      attachments: 'id, patient_id, encounter_id, filename, created_at',

      outbox: 'id, entity, idempotency_key, created_at, processed',
      sync_meta: 'key',
      user_session: 'id',
    })

    // Version 2 - Migration vers cookies HttpOnly (suppression des tokens)
    this.version(2).stores({
      // Les stores restent identiques, mais on nettoie les données sensibles
      patients: 'id, nom, prenom, telephone, village, site_id, created_at, _synced',
      encounters: 'id, patient_id, site_id, user_id, date, created_at, _synced',
      conditions: 'id, encounter_id, libelle, created_at, _synced',
      medication_requests: 'id, encounter_id, medicament, created_at, _synced',
      procedures: 'id, encounter_id, type, created_at, _synced',
      references: 'id, encounter_id, statut, created_at, _synced',
      attachments: 'id, patient_id, encounter_id, filename, created_at',

      outbox: 'id, entity, idempotency_key, created_at, processed',
      sync_meta: 'key',
      user_session: 'id',
    }).upgrade(async () => {
      // Nettoyer les anciens tokens du localStorage lors de la migration
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user')
      }
    })
  }

  /**
   * Ajouter une opération à l'outbox
   */
  async addToOutbox(
    operation: 'create' | 'update' | 'delete',
    entity: OutboxOperation['entity'],
    payload: any,
    clientId?: string
  ): Promise<void> {
    const { v4: uuidv4 } = await import('uuid')

    const op: OutboxOperation = {
      id: uuidv4(),
      operation,
      entity,
      idempotency_key: uuidv4(), // Nouvelle clé pour chaque opération
      client_id: clientId,
      payload,
      attempts: 0,
      created_at: new Date().toISOString(),
      processed: 0, // 0 = non traité, 1 = traité
    }

    await this.outbox.add(op)
  }

  /**
   * Récupérer les opérations en attente de sync
   */
  async getPendingOperations(): Promise<OutboxOperation[]> {
    return await this.outbox
      .where('processed')
      .equals(0)
      .sortBy('created_at')
  }

  /**
   * Marquer une opération comme traitée
   */
  async markOperationProcessed(id: string): Promise<void> {
    await this.outbox.update(id, { processed: 1 })
  }

  /**
   * Incrémenter le nombre de tentatives
   */
  async incrementOperationAttempts(id: string, error?: string): Promise<void> {
    const op = await this.outbox.get(id)
    if (op) {
      await this.outbox.update(id, {
        attempts: op.attempts + 1,
        last_error: error,
      })
    }
  }

  /**
   * Récupérer le curseur de dernière sync
   */
  async getLastSyncCursor(): Promise<string | null> {
    const meta = await this.sync_meta.get('last_sync_cursor')
    return meta?.value || null
  }

  /**
   * Mettre à jour le curseur de sync
   */
  async setLastSyncCursor(cursor: string): Promise<void> {
    await this.sync_meta.put({
      key: 'last_sync_cursor',
      value: cursor,
      updated_at: new Date().toISOString(),
    })
  }

  /**
   * Nettoyer les opérations traitées (plus de 30 jours)
   */
  async cleanupOldOperations(): Promise<void> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    await this.outbox
      .where('created_at')
      .below(thirtyDaysAgo.toISOString())
      .and(op => op.processed === 1)
      .delete()
  }

  /**
   * Rechercher des patients (fuzzy)
   */
  async searchPatients(query: string, limit: number = 50): Promise<Patient[]> {
    const lowerQuery = query.toLowerCase()

    return await this.patients
      .filter(patient => {
        return (
          patient.nom.toLowerCase().includes(lowerQuery) ||
          (patient.prenom?.toLowerCase().includes(lowerQuery) ?? false) ||
          (patient.telephone?.includes(query) ?? false) ||
          (patient.village?.toLowerCase().includes(lowerQuery) ?? false)
        )
      })
      .limit(limit)
      .toArray()
  }

  /**
   * Récupérer les consultations d'un patient
   */
  async getPatientEncounters(patientId: string): Promise<Encounter[]> {
    return await this.encounters
      .where('patient_id')
      .equals(patientId)
      .reverse()
      .sortBy('date')
  }

  /**
   * Récupérer les détails complets d'une consultation
   */
  async getEncounterDetails(encounterId: string) {
    const encounter = await this.encounters.get(encounterId)
    if (!encounter) return null

    const [conditions, medications, procedures, reference] = await Promise.all([
      this.conditions.where('encounter_id').equals(encounterId).toArray(),
      this.medication_requests.where('encounter_id').equals(encounterId).toArray(),
      this.procedures.where('encounter_id').equals(encounterId).toArray(),
      this.references.where('encounter_id').equals(encounterId).first(),
    ])

    return {
      encounter,
      conditions,
      medications,
      procedures,
      reference,
    }
  }

  /**
   * Compte des éléments non synchronisés
   */
  async getUnsyncedCount(): Promise<number> {
    const [patients, encounters, conditions, medications, procedures, references] = await Promise.all([
      this.patients.where('_synced').equals(0).count(),
      this.encounters.where('_synced').equals(0).count(),
      this.conditions.where('_synced').equals(0).count(),
      this.medication_requests.where('_synced').equals(0).count(),
      this.procedures.where('_synced').equals(0).count(),
      this.references.where('_synced').equals(0).count(),
    ])

    return patients + encounters + conditions + medications + procedures + references
  }

  /**
   * Vider toutes les données (déconnexion)
   */
  async clearAllData(): Promise<void> {
    await Promise.all([
      this.patients.clear(),
      this.encounters.clear(),
      this.conditions.clear(),
      this.medication_requests.clear(),
      this.procedures.clear(),
      this.references.clear(),
      this.attachments.clear(),
      this.outbox.clear(),
      this.sync_meta.clear(),
      this.user_session.clear(),
    ])
  }
}

// ===========================================================================
// INSTANCE GLOBALE
// ===========================================================================

export const db = new SanteDB()

// Export hooks Dexie-React
export { useLiveQuery } from 'dexie-react-hooks'
