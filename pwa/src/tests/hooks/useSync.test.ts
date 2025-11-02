/**
 * Tests pour les hooks de synchronisation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSyncStatus, useOnlineStatus, useSync } from '../../hooks/useSync'
import { syncService, connectivityMonitor } from '../../services/syncService'

// Mock des services
vi.mock('../../services/syncService', () => ({
  syncService: {
    getStatus: vi.fn(),
    addStatusListener: vi.fn(),
    forceSync: vi.fn(),
    startAutoSync: vi.fn(),
    stopAutoSync: vi.fn(),
  },
  connectivityMonitor: {
    isOnline: vi.fn(),
    addListener: vi.fn(),
  },
}))

describe('useSync Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useSyncStatus', () => {
    it('should return initial sync status', async () => {
      const mockStatus = {
        isOnline: true,
        isSyncing: false,
        lastSync: null,
        pendingOperations: 0,
        unsyncedItems: 0,
      }

      vi.mocked(syncService.getStatus).mockResolvedValue(mockStatus)
      vi.mocked(syncService.addStatusListener).mockReturnValue(() => {})

      const { result } = renderHook(() => useSyncStatus())

      await waitFor(() => {
        expect(result.current.isOnline).toBe(true)
      })

      expect(result.current.isSyncing).toBe(false)
      expect(result.current.pendingOperations).toBe(0)
    })

    it('should update when sync status changes', async () => {
      const initialStatus = {
        isOnline: true,
        isSyncing: false,
        lastSync: null,
        pendingOperations: 0,
        unsyncedItems: 0,
      }

      let statusCallback: any
      vi.mocked(syncService.getStatus).mockResolvedValue(initialStatus)
      vi.mocked(syncService.addStatusListener).mockImplementation((cb) => {
        statusCallback = cb
        return () => {}
      })

      const { result } = renderHook(() => useSyncStatus())

      await waitFor(() => {
        expect(result.current.isOnline).toBe(true)
      })

      // Simuler un changement de statut
      const newStatus = {
        ...initialStatus,
        isSyncing: true,
        pendingOperations: 5,
      }
      statusCallback(newStatus)

      await waitFor(() => {
        expect(result.current.isSyncing).toBe(true)
        expect(result.current.pendingOperations).toBe(5)
      })
    })

    it('should cleanup listener on unmount', async () => {
      const unsubscribe = vi.fn()
      vi.mocked(syncService.getStatus).mockResolvedValue({
        isOnline: true,
        isSyncing: false,
        lastSync: null,
        pendingOperations: 0,
        unsyncedItems: 0,
      })
      vi.mocked(syncService.addStatusListener).mockReturnValue(unsubscribe)

      const { unmount } = renderHook(() => useSyncStatus())

      unmount()

      expect(unsubscribe).toHaveBeenCalled()
    })
  })

  describe('useOnlineStatus', () => {
    it('should return navigator.onLine initially', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      })

      const { result } = renderHook(() => useOnlineStatus())

      expect(result.current).toBe(true)
    })

    it('should update when connectivity changes', async () => {
      let connectivityCallback: any
      vi.mocked(connectivityMonitor.addListener).mockImplementation((cb) => {
        connectivityCallback = cb
        return () => {}
      })

      const { result } = renderHook(() => useOnlineStatus())

      // Simuler une perte de connexion
      connectivityCallback(false)

      await waitFor(() => {
        expect(result.current).toBe(false)
      })

      // Simuler un retour de connexion
      connectivityCallback(true)

      await waitFor(() => {
        expect(result.current).toBe(true)
      })
    })

    it('should cleanup listener on unmount', () => {
      const unsubscribe = vi.fn()
      vi.mocked(connectivityMonitor.addListener).mockReturnValue(unsubscribe)

      const { unmount } = renderHook(() => useOnlineStatus())

      unmount()

      expect(unsubscribe).toHaveBeenCalled()
    })
  })

  describe('useSync', () => {
    it('should initially not be syncing', () => {
      const { result } = renderHook(() => useSync())

      expect(result.current.isSyncing).toBe(false)
      expect(result.current.lastResult).toBeNull()
    })

    it('should call syncService.forceSync when sync is triggered', async () => {
      const mockResult = {
        success: true,
        synced: 5,
        failed: 0,
        errors: [],
      }

      vi.mocked(syncService.forceSync).mockResolvedValue(mockResult)

      const { result } = renderHook(() => useSync())

      const syncPromise = result.current.sync()

      // Devrait être en cours de sync
      await waitFor(() => {
        expect(result.current.isSyncing).toBe(true)
      })

      await syncPromise

      // Devrait être terminé
      await waitFor(() => {
        expect(result.current.isSyncing).toBe(false)
        expect(result.current.lastResult).toEqual(mockResult)
      })

      expect(syncService.forceSync).toHaveBeenCalledTimes(1)
    })

    it('should handle sync errors gracefully', async () => {
      const mockError = new Error('Sync failed')
      vi.mocked(syncService.forceSync).mockRejectedValue(mockError)

      const { result } = renderHook(() => useSync())

      await expect(result.current.sync()).rejects.toThrow('Sync failed')

      // Devrait ne plus être en cours de sync même après erreur
      await waitFor(() => {
        expect(result.current.isSyncing).toBe(false)
      })
    })

    it('should set isSyncing to false even if sync fails', async () => {
      vi.mocked(syncService.forceSync).mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useSync())

      try {
        await result.current.sync()
      } catch (error) {
        // Expected error
      }

      await waitFor(() => {
        expect(result.current.isSyncing).toBe(false)
      })
    })
  })
})
