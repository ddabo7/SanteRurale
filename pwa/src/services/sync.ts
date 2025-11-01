/**
 * Service de synchronisation offline
 *
 * Responsabilités:
 * - Détecter le statut réseau (online/offline)
 * - Synchroniser la queue d'opérations (outbox) vers le serveur
 * - Récupérer les changements depuis le serveur (pull)
 * - Gérer les conflits de version
 * - Retry automatique avec backoff exponentiel
 */

import { db, OutboxOperation } from '../db'
import { apiClient } from './api'

// ===========================================================================
// TYPES
// ===========================================================================

export interface SyncStatus {
  isOnline: boolean
  isSyncing: boolean
  lastSyncTime: string | null
  pendingCount: number
  error: string | null
}

export interface SyncResult {
  success: boolean
  synced: number
  conflicts: number
  errors: number
}

// ===========================================================================
// SYNC SERVICE
// ===========================================================================

class SyncService {
  private isOnline: boolean = navigator.onLine
  private isSyncing: boolean = false
  private syncIntervalId: number | null = null
  private retryTimeouts: Map<string, number> = new Map()

  // Callbacks pour notifier l'UI
  private statusListeners: Set<(status: SyncStatus) => void> = new Set()

  constructor() {
    this.setupNetworkListeners()
    this.startAutoSync()
  }

  /**
   * Écouter les changements de statut réseau
   */
  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('🌐 Réseau détecté - démarrage de la synchronisation')
      this.isOnline = true
      this.notifyStatusChange()
      this.syncNow()
    })

    window.addEventListener('offline', () => {
      console.log('📴 Hors ligne - mode offline activé')
      this.isOnline = false
      this.notifyStatusChange()
    })
  }

  /**
   * Démarrer la synchronisation automatique périodique
   */
  private startAutoSync() {
    // Tenter une sync toutes les 30 secondes si online
    this.syncIntervalId = window.setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.syncNow()
      }
    }, 30000) // 30s
  }

  /**
   * Arrêter la synchronisation automatique
   */
  public stopAutoSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId)
      this.syncIntervalId = null
    }
  }

  /**
   * S'abonner aux changements de statut
   */
  public onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.statusListeners.add(callback)

    // Notifier immédiatement du statut actuel
    this.notifyStatusChange()

    // Retourner une fonction de désabonnement
    return () => {
      this.statusListeners.delete(callback)
    }
  }

  /**
   * Notifier les listeners du changement de statut
   */
  private async notifyStatusChange() {
    const status = await this.getStatus()
    this.statusListeners.forEach(listener => listener(status))
  }

  /**
   * Obtenir le statut actuel de synchronisation
   */
  public async getStatus(): Promise<SyncStatus> {
    const pendingOps = await db.getPendingOperations()
    const lastSyncMeta = await db.sync_meta.get('last_sync_time')

    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSyncTime: lastSyncMeta?.value || null,
      pendingCount: pendingOps.length,
      error: null,
    }
  }

  /**
   * Lancer une synchronisation maintenant
   */
  public async syncNow(): Promise<SyncResult> {
    if (!this.isOnline) {
      console.log('⏸️  Synchronisation impossible (hors ligne)')
      return { success: false, synced: 0, conflicts: 0, errors: 0 }
    }

    if (this.isSyncing) {
      console.log('⏸️  Synchronisation déjà en cours')
      return { success: false, synced: 0, conflicts: 0, errors: 0 }
    }

    console.log('🔄 Démarrage de la synchronisation')
    this.isSyncing = true
    this.notifyStatusChange()

    try {
      // 1. Push: envoyer les opérations locales vers le serveur
      const pushResult = await this.pushLocalChanges()

      // 2. Pull: récupérer les changements depuis le serveur
      const pullResult = await this.pullRemoteChanges()

      // 3. Nettoyer les anciennes opérations
      await db.cleanupOldOperations()

      // 4. Mettre à jour le timestamp de dernière sync
      await db.sync_meta.put({
        key: 'last_sync_time',
        value: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      console.log('✅ Synchronisation terminée', { pushResult, pullResult })

      return {
        success: true,
        synced: pushResult.synced,
        conflicts: pushResult.conflicts,
        errors: pushResult.errors,
      }
    } catch (error) {
      console.error('❌ Erreur de synchronisation', error)
      return { success: false, synced: 0, conflicts: 0, errors: 1 }
    } finally {
      this.isSyncing = false
      this.notifyStatusChange()
    }
  }

  /**
   * Push: envoyer les opérations locales vers le serveur
   */
  private async pushLocalChanges(): Promise<SyncResult> {
    const pendingOps = await db.getPendingOperations()

    if (pendingOps.length === 0) {
      return { success: true, synced: 0, conflicts: 0, errors: 0 }
    }

    console.log(`📤 Push: ${pendingOps.length} opérations en attente`)

    // Grouper par batches de 20
    const batchSize = 20
    let totalSynced = 0
    let totalConflicts = 0
    let totalErrors = 0

    for (let i = 0; i < pendingOps.length; i += batchSize) {
      const batch = pendingOps.slice(i, i + batchSize)

      try {
        // Appel API: /sync/batch
        const response = await apiClient.post('/sync/batch', {
          operations: batch.map(op => ({
            operation: op.operation,
            entity: op.entity,
            idempotency_key: op.idempotency_key,
            client_id: op.client_id,
            payload: op.payload,
          })),
        })

        const { synced, conflicts, errors } = response.data

        // Traiter les opérations réussies
        for (const result of synced) {
          const op = batch.find(o => o.idempotency_key === result.idempotency_key)
          if (op) {
            await db.markOperationProcessed(op.id)

            // Mettre à jour l'entité locale avec le server_id si créé
            if (result.server_id && op.client_id) {
              await this.updateLocalEntityWithServerId(
                op.entity,
                op.client_id,
                result.server_id
              )
            }

            totalSynced++
          }
        }

        // Traiter les conflits
        for (const conflict of conflicts || []) {
          const op = batch.find(o => o.idempotency_key === conflict.idempotency_key)
          if (op) {
            console.warn('⚠️  Conflit détecté', conflict)
            // TODO: implémenter résolution de conflit
            await db.incrementOperationAttempts(op.id, conflict.error)
            totalConflicts++
          }
        }

        // Traiter les erreurs
        for (const error of errors || []) {
          const op = batch.find(o => o.idempotency_key === error.idempotency_key)
          if (op) {
            await db.incrementOperationAttempts(op.id, error.error)
            totalErrors++

            // Abandon après 5 tentatives
            if (op.attempts >= 5) {
              console.error('❌ Opération abandonnée après 5 tentatives', error)
              await db.markOperationProcessed(op.id) // Marquer comme "traitée" pour éviter retry infini
            }
          }
        }
      } catch (error: any) {
        console.error('❌ Erreur batch sync', error)

        // Retry avec backoff exponentiel
        for (const op of batch) {
          await db.incrementOperationAttempts(op.id, error.message)
        }

        totalErrors += batch.length
      }
    }

    return {
      success: totalErrors === 0,
      synced: totalSynced,
      conflicts: totalConflicts,
      errors: totalErrors,
    }
  }

  /**
   * Pull: récupérer les changements depuis le serveur
   */
  private async pullRemoteChanges(): Promise<{ pulled: number }> {
    try {
      const lastCursor = await db.getLastSyncCursor()

      console.log('📥 Pull: récupération des changements', { since: lastCursor })

      // Appel API: /sync/changes?since=cursor
      const response = await apiClient.get('/sync/changes', {
        params: {
          since: lastCursor || new Date(0).toISOString(),
          limit: 100,
        },
      })

      const { changes, next_cursor } = response.data

      // Appliquer les changements localement
      for (const change of changes) {
        await this.applyRemoteChange(change)
      }

      // Mettre à jour le curseur
      if (next_cursor) {
        await db.setLastSyncCursor(next_cursor)
      }

      console.log(`📥 Pull: ${changes.length} changements appliqués`)

      return { pulled: changes.length }
    } catch (error) {
      console.error('❌ Erreur pull sync', error)
      return { pulled: 0 }
    }
  }

  /**
   * Appliquer un changement distant localement
   */
  private async applyRemoteChange(change: any) {
    const { entity, operation, id, data } = change

    try {
      switch (operation) {
        case 'create':
        case 'update':
          // Upsert dans la table locale
          const table = db[`${entity}s` as keyof typeof db] as any
          await table.put({ ...data, _synced: true })
          break

        case 'delete':
          const deleteTable = db[`${entity}s` as keyof typeof db] as any
          await deleteTable.delete(id)
          break
      }
    } catch (error) {
      console.error('❌ Erreur application changement', { change, error })
    }
  }

  /**
   * Mettre à jour l'ID local avec l'ID serveur
   */
  private async updateLocalEntityWithServerId(
    entity: string,
    clientId: string,
    serverId: string
  ) {
    try {
      const table = db[`${entity}s` as keyof typeof db] as any

      // Récupérer l'entité locale
      const localEntity = await table.get(clientId)

      if (localEntity) {
        // Supprimer l'ancienne entrée
        await table.delete(clientId)

        // Créer la nouvelle avec l'ID serveur
        await table.put({
          ...localEntity,
          id: serverId,
          _synced: true,
          _local_id: undefined,
        })
      }
    } catch (error) {
      console.error('❌ Erreur mise à jour ID serveur', { entity, clientId, serverId, error })
    }
  }
}

// ===========================================================================
// INSTANCE GLOBALE
// ===========================================================================

export const syncService = new SyncService()

// Hook React pour utiliser le statut de sync
import { useState, useEffect } from 'react'

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncTime: null,
    pendingCount: 0,
    error: null,
  })

  useEffect(() => {
    const unsubscribe = syncService.onStatusChange(setStatus)
    return unsubscribe
  }, [])

  return status
}
