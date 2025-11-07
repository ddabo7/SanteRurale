/**
 * Service de synchronisation offline-first
 *
 * Stratégie:
 * 1. Écriture locale immédiate (optimistic UI)
 * 2. Ajout à l'outbox queue
 * 3. Synchronisation en background
 * 4. Gestion des conflits via version
 */

import { db, OutboxOperation } from '../db'
import { apiClient, patientsService, encountersService, conditionsService, medicationsService, proceduresService } from './api'

// ===========================================================================
// TYPES
// ===========================================================================

export interface SyncResult {
  success: boolean
  synced: number
  failed: number
  errors: string[]
}

export interface SyncStatus {
  isOnline: boolean
  isSyncing: boolean
  lastSync: Date | null
  pendingOperations: number
  unsyncedItems: number
}

// ===========================================================================
// DÉTECTION DE CONNECTIVITÉ
// ===========================================================================

class ConnectivityMonitor {
  private isOnlineState = navigator.onLine
  private listeners: Set<(isOnline: boolean) => void> = new Set()

  constructor() {
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)
  }

  private handleOnline = () => {
    this.isOnlineState = true
    this.notifyListeners(true)
  }

  private handleOffline = () => {
    this.isOnlineState = false
    this.notifyListeners(false)
  }

  private notifyListeners(isOnline: boolean) {
    this.listeners.forEach(listener => listener(isOnline))
  }

  isOnline(): boolean {
    return this.isOnlineState
  }

  addListener(listener: (isOnline: boolean) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async checkConnectivity(): Promise<boolean> {
    if (!navigator.onLine) {
      return false
    }

    try {
      // Ping l'API avec timeout court
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)

      const response = await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      return response.ok
    } catch {
      return false
    }
  }
}

export const connectivityMonitor = new ConnectivityMonitor()

// ===========================================================================
// SERVICE DE SYNCHRONISATION
// ===========================================================================

class SyncService {
  private isSyncing = false
  private syncInterval: NodeJS.Timeout | null = null
  private statusListeners: Set<(status: SyncStatus) => void> = new Set()

  constructor() {
    // Écouter les changements de connectivité
    connectivityMonitor.addListener((isOnline) => {
      if (isOnline && !this.isSyncing) {
        this.sync()
      }
    })
  }

  /**
   * Démarrer la synchronisation automatique
   */
  startAutoSync(intervalMs: number = 60000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }

    // Sync immédiate au démarrage (mais seulement si on a un token)
    db.user_session.toCollection().first().then(session => {
      if (session?.access_token) {
        this.sync()
      }
    })

    // Puis sync périodique
    this.syncInterval = setInterval(() => {
      if (connectivityMonitor.isOnline() && !this.isSyncing) {
        this.sync()
      }
    }, intervalMs)
  }

  /**
   * Arrêter la synchronisation automatique
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  /**
   * Synchronisation complète (bidirectionnelle)
   */
  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping')
      return { success: true, synced: 0, failed: 0, errors: [] }
    }

    if (!connectivityMonitor.isOnline()) {
      console.log('Offline, skipping sync')
      return { success: false, synced: 0, failed: 0, errors: ['Offline'] }
    }

    this.isSyncing = true
    this.notifyStatusChange()

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    }

    try {
      // 1. Pousser les modifications locales (outbox)
      const pushResult = await this.pushLocalChanges()
      result.synced += pushResult.synced
      result.failed += pushResult.failed
      result.errors.push(...pushResult.errors)

      // 2. Tirer les modifications du serveur
      const pullResult = await this.pullServerChanges()
      result.synced += pullResult.synced
      result.failed += pullResult.failed
      result.errors.push(...pullResult.errors)

      // 3. Nettoyer les anciennes opérations
      await db.cleanupOldOperations()

      // 4. Mettre à jour le timestamp de dernière sync
      await db.sync_meta.put({
        key: 'last_sync_time',
        value: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      result.success = result.failed === 0
    } catch (error: any) {
      console.error('Sync error:', error)
      result.success = false
      result.errors.push(error.message)
    } finally {
      this.isSyncing = false
      this.notifyStatusChange()
    }

    return result
  }

  /**
   * Pousser les modifications locales vers le serveur
   */
  private async pushLocalChanges(): Promise<SyncResult> {
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] }

    const pendingOps = await db.getPendingOperations()

    for (const op of pendingOps) {
      try {
        await this.processOperation(op)
        await db.markOperationProcessed(op.id)
        result.synced++
      } catch (error: any) {
        console.error(`Failed to process operation ${op.id}:`, error)
        result.failed++
        result.errors.push(`${op.entity} ${op.operation}: ${error.message}`)

        await db.incrementOperationAttempts(op.id, error.message)

        // Abandonner après 5 tentatives
        if (op.attempts >= 5) {
          await db.markOperationProcessed(op.id)
        }
      }
    }

    return result
  }

  /**
   * Traiter une opération de l'outbox
   */
  private async processOperation(op: OutboxOperation): Promise<void> {
    const { operation, entity, payload, idempotency_key } = op

    // Ajouter l'idempotency key dans les headers
    const headers = { 'X-Idempotency-Key': idempotency_key }

    switch (entity) {
      case 'patient':
        if (operation === 'create') {
          const response = await patientsService.create(payload)
          // Mettre à jour l'ID local avec l'ID serveur
          if (op.client_id && response.id !== op.client_id) {
            await db.patients.update(op.client_id, { id: response.id, _synced: true })
          }
        } else if (operation === 'update') {
          await patientsService.update(payload.id, payload)
          await db.patients.update(payload.id, { _synced: true })
        }
        break

      case 'encounter':
        if (operation === 'create') {
          const response = await encountersService.create(payload)
          if (op.client_id && response.id !== op.client_id) {
            await db.encounters.update(op.client_id, { id: response.id, _synced: true })
          }
        }
        break

      case 'condition':
        if (operation === 'create') {
          await conditionsService.create(payload)
          await db.conditions.update(payload.id, { _synced: true })
        }
        break

      case 'medication_request':
        if (operation === 'create') {
          await medicationsService.create(payload)
          await db.medication_requests.update(payload.id, { _synced: true })
        }
        break

      case 'procedure':
        if (operation === 'create') {
          await proceduresService.create(payload)
          await db.procedures.update(payload.id, { _synced: true })
        }
        break

      default:
        throw new Error(`Unknown entity: ${entity}`)
    }
  }

  /**
   * Tirer les modifications du serveur
   */
  private async pullServerChanges(): Promise<SyncResult> {
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] }

    try {
      // Récupérer le curseur de dernière sync
      const cursor = await db.getLastSyncCursor()

      // Pour le moment, on fait un pull simple de toutes les données
      // TODO: Implémenter un vrai système de curseur côté serveur

      // Pull patients
      const patientsResponse = await patientsService.list({ limit: 200 })
      for (const patient of patientsResponse.data || []) {
        await db.patients.put({
          ...patient,
          _synced: true,
        })
        result.synced++
      }

      // Pull encounters (derniers 30 jours)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const encountersResponse = await encountersService.list({
        from_date: thirtyDaysAgo.toISOString().split('T')[0],
      })

      for (const encounter of encountersResponse || []) {
        await db.encounters.put({
          ...encounter,
          _synced: true,
        })
        result.synced++
      }

    } catch (error: any) {
      console.error('Pull error:', error)
      result.failed++
      result.errors.push(error.message)
    }

    return result
  }

  /**
   * Obtenir le statut de synchronisation
   */
  async getStatus(): Promise<SyncStatus> {
    const pendingOps = await db.outbox.where('processed').equals(0).count()
    const unsyncedItems = await db.getUnsyncedCount()

    const lastSyncMeta = await db.sync_meta.get('last_sync_time')
    const lastSync = lastSyncMeta ? new Date(lastSyncMeta.value) : null

    return {
      isOnline: connectivityMonitor.isOnline(),
      isSyncing: this.isSyncing,
      lastSync,
      pendingOperations: pendingOps,
      unsyncedItems,
    }
  }

  /**
   * Écouter les changements de statut
   */
  addStatusListener(listener: (status: SyncStatus) => void): () => void {
    this.statusListeners.add(listener)
    return () => {
      this.statusListeners.delete(listener)
    }
  }

  private async notifyStatusChange() {
    const status = await this.getStatus()
    this.statusListeners.forEach(listener => listener(status))
  }

  /**
   * Forcer une synchronisation immédiate
   */
  async forceSync(): Promise<SyncResult> {
    return this.sync()
  }
}

// ===========================================================================
// INSTANCE GLOBALE
// ===========================================================================

export const syncService = new SyncService()

// ===========================================================================
// HELPERS POUR MODE OFFLINE
// ===========================================================================

/**
 * Wrapper pour écriture offline-first
 */
export async function offlineWrite<T>(
  operation: 'create' | 'update' | 'delete',
  entity: OutboxOperation['entity'],
  data: T,
  localWrite: () => Promise<void>
): Promise<void> {
  // 1. Écriture locale immédiate (optimistic UI)
  await localWrite()

  // 2. Ajouter à l'outbox si online
  await db.addToOutbox(operation, entity, data)

  // 3. Sync si possible
  if (connectivityMonitor.isOnline() && !syncService['isSyncing']) {
    syncService.sync().catch(err => console.error('Background sync failed:', err))
  }
}

// ===========================================================================
// EXPORTS POUR LES TESTS
// ===========================================================================

export { ConnectivityMonitor, SyncService }
