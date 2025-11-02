/**
 * Contexte global pour la synchronisation
 * Initialise et gère la sync automatique dans toute l'application
 */

import { createContext, useContext, useEffect, ReactNode } from 'react'
import { syncService } from '../services/syncService'
import { useSyncStatus, useOnlineStatus } from '../hooks/useSync'

interface SyncContextValue {
  isOnline: boolean
  isSyncing: boolean
  lastSync: Date | null
  pendingOperations: number
  unsyncedItems: number
  forceSync: () => Promise<void>
}

export const SyncContext = createContext<SyncContextValue | undefined>(undefined)

export function SyncProvider({ children }: { children: ReactNode }) {
  const status = useSyncStatus()
  const isOnline = useOnlineStatus()

  useEffect(() => {
    // Démarrer la synchronisation automatique toutes les 2 minutes
    syncService.startAutoSync(120000)

    return () => {
      syncService.stopAutoSync()
    }
  }, [])

  const forceSync = async () => {
    await syncService.forceSync()
  }

  const value: SyncContextValue = {
    isOnline,
    isSyncing: status.isSyncing,
    lastSync: status.lastSync,
    pendingOperations: status.pendingOperations,
    unsyncedItems: status.unsyncedItems,
    forceSync,
  }

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync() {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error('useSync must be used within SyncProvider')
  }
  return context
}
