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
        // Attendre 2 secondes après reconnexion pour laisser le serveur se stabiliser
        console.log('Connection restored, scheduling sync in 2s...')
        setTimeout(() => {
          if (connectivityMonitor.isOnline() && !this.isSyncing) {
            this.sync()
          }
        }, 2000)
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

    // Sync immédiate au démarrage (mais seulement si on a une session)
    db.user_session.toCollection().first().then(session => {
      if (session?.id) {
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

    // Timeout de sécurité: forcer reset après 60 secondes
    const timeoutId = setTimeout(() => {
      if (this.isSyncing) {
        console.error('Sync timeout after 60s, forcing reset')
        this.isSyncing = false
        this.notifyStatusChange()
      }
    }, 60000)

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
      clearTimeout(timeoutId)
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
      // Vérifier si on a déjà synchronisé récemment (éviter les syncs trop fréquentes)
      const lastSyncMeta = await db.sync_meta.get('last_sync_time')
      if (lastSyncMeta) {
        const lastSync = new Date(lastSyncMeta.value)
        const timeSinceLastSync = Date.now() - lastSync.getTime()
        const minSyncInterval = 30000 // 30 secondes minimum entre deux syncs

        if (timeSinceLastSync < minSyncInterval) {
          console.log(`Skipping pull, last sync was ${Math.round(timeSinceLastSync / 1000)}s ago`)
          return result
        }
      }

      // Pull patients avec retry sur 503
      try {
        const patientsResponse = await this.retryOnServerError(() =>
          patientsService.list({ limit: 50 })
        )
        for (const patient of patientsResponse.data || []) {
          await db.patients.put({
            ...patient,
            _synced: true,
          })
          result.synced++
        }
      } catch (error: any) {
        // Si échec après retries, on continue quand même (mode dégradé)
        console.warn('Failed to pull patients after retries:', error.message)
        result.errors.push(`Patients sync skipped: ${error.message}`)
      }

      // Pull encounters (derniers 7 jours seulement pour réduire la charge)
      try {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const encountersResponse = await this.retryOnServerError(() =>
          encountersService.list({
            from_date: sevenDaysAgo.toISOString().split('T')[0],
          })
        )

        for (const encounter of encountersResponse || []) {
          await db.encounters.put({
            ...encounter,
            _synced: true,
          })
          result.synced++
        }
      } catch (error: any) {
        // Si échec après retries, on continue quand même (mode dégradé)
        console.warn('Failed to pull encounters after retries:', error.message)
        result.errors.push(`Encounters sync skipped: ${error.message}`)
      }

    } catch (error: any) {
      console.error('Pull error:', error)
      result.failed++
      result.errors.push(error.message)
      // Ne pas relancer l'erreur, juste la logger
    }

    return result
  }

  /**
   * Retry avec backoff exponentiel sur erreurs serveur 503/502/504
   */
  private async retryOnServerError<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelayMs: number = 1000
  ): Promise<T> {
    let lastError: any

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error: any) {
        lastError = error

        // Retry uniquement sur erreurs serveur temporaires
        const isRetryable =
          error.response?.status === 503 || // Service Unavailable
          error.response?.status === 502 || // Bad Gateway
          error.response?.status === 504 || // Gateway Timeout
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT'

        if (!isRetryable || attempt === maxRetries - 1) {
          throw error
        }

        // Backoff exponentiel: 1s, 2s, 4s
        const delay = initialDelayMs * Math.pow(2, attempt)
        console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms due to ${error.response?.status || error.code}`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError
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
