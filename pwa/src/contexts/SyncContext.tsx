/**
 * Contexte global pour la synchronisation
 * Initialise et gère la sync automatique dans toute l'application
 */

import { createContext, useContext, useEffect, ReactNode, useRef, useMemo, useCallback } from 'react'
import { syncService } from '../services/syncService'
import { useSyncStatus, useOnlineStatus } from '../hooks/useSync'
import { useAuth } from './AuthContext'

interface SyncContextValue {
  isOnline: boolean
  isSyncing: boolean
  lastSync: Date | null
  pendingOperations: number
  unsyncedItems: number
  forceSync: () => Promise<void>
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined)

export function SyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const isSyncStartedRef = useRef(false)

  // Hooks de synchronisation - appelés après pour éviter les re-renders avant l'auth
  const status = useSyncStatus()
  const isOnline = useOnlineStatus()

  useEffect(() => {
    // Ne rien faire pendant le chargement initial
    if (isLoading) {
      return
    }

    // Démarrer la synchronisation automatique uniquement si l'utilisateur est connecté
    if (isAuthenticated && !isSyncStartedRef.current) {
      console.log('[SyncContext] Starting auto sync')
      syncService.startAutoSync(120000)
      isSyncStartedRef.current = true
    } else if (!isAuthenticated && isSyncStartedRef.current) {
      console.log('[SyncContext] Stopping auto sync')
      syncService.stopAutoSync()
      isSyncStartedRef.current = false
    }

    return () => {
      if (isSyncStartedRef.current) {
        console.log('[SyncContext] Cleanup: stopping auto sync')
        syncService.stopAutoSync()
        isSyncStartedRef.current = false
      }
    }
  }, [isAuthenticated, isLoading])

  const forceSync = useCallback(async () => {
    await syncService.forceSync()
  }, [])

  // Utiliser useMemo pour éviter que l'objet value change à chaque render
  const value: SyncContextValue = useMemo(() => ({
    isOnline,
    isSyncing: status.isSyncing,
    lastSync: status.lastSync,
    pendingOperations: status.pendingOperations,
    unsyncedItems: status.unsyncedItems,
    forceSync,
  }), [isOnline, status.isSyncing, status.lastSync, status.pendingOperations, status.unsyncedItems, forceSync])

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync() {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error('useSync must be used within SyncProvider')
  }
  return context
}
