/**
 * Hook React pour la synchronisation offline-first
 */

import { useState, useEffect } from 'react'
import { syncService, connectivityMonitor, SyncStatus, SyncResult } from '../services/syncService'

/**
 * Hook pour surveiller le statut de synchronisation
 */
export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSync: null,
    pendingOperations: 0,
    unsyncedItems: 0,
  })

  useEffect(() => {
    // Charger le statut initial
    syncService.getStatus().then(setStatus)

    // Écouter les changements
    const unsubscribe = syncService.addStatusListener(setStatus)

    return unsubscribe
  }, [])

  return status
}

/**
 * Hook pour surveiller la connectivité
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const unsubscribe = connectivityMonitor.addListener(setIsOnline)
    return unsubscribe
  }, [])

  return isOnline
}

/**
 * Hook pour déclencher une synchronisation
 */
export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)

  const sync = async () => {
    setIsSyncing(true)
    try {
      const result = await syncService.forceSync()
      setLastResult(result)
      return result
    } finally {
      setIsSyncing(false)
    }
  }

  return {
    sync,
    isSyncing,
    lastResult,
  }
}
