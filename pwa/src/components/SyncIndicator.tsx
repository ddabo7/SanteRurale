/**
 * Indicateur de statut de synchronisation
 * Affiche si l'app est online/offline et le statut de sync
 */

import { useSyncStatus, useOnlineStatus } from '../hooks/useSync'

export const SyncIndicator = () => {
  const status = useSyncStatus()
  const isOnline = useOnlineStatus()

  // Ne rien afficher si tout va bien
  if (isOnline && status.pendingOperations === 0 && !status.isSyncing) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slideInFromRight">
      <div
        className={`
          flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold backdrop-blur-lg border-2 transition-all transform hover:scale-105
          ${isOnline ? 'bg-white/95 border-blue-200' : 'bg-orange-100/95 border-orange-300'}
        `}
      >
        {/* Indicateur de connectivité avec animation */}
        <div className="relative">
          <div
            className={`
              w-3 h-3 rounded-full animate-pulse
              ${isOnline ? 'bg-green-500' : 'bg-orange-500'}
            `}
          />
          {isOnline && (
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping opacity-75" />
          )}
        </div>

        {/* Message avec icônes */}
        <span className={`flex items-center gap-2 ${isOnline ? 'text-gray-800' : 'text-orange-800'}`}>
          {status.isSyncing && (
            <>
              <span>🔄</span>
              <span>Synchronisation...</span>
            </>
          )}
          {!status.isSyncing && isOnline && status.pendingOperations > 0 && (
            <>
              <span>⏳</span>
              <span>{status.pendingOperations} en attente</span>
            </>
          )}
          {!status.isSyncing && !isOnline && (
            <>
              <span>📱</span>
              <span>Mode hors ligne</span>
            </>
          )}
        </span>

        {/* Spinner pendant la sync avec gradient */}
        {status.isSyncing && (
          <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}

        {/* Nombre d'éléments non synchronisés avec badge animé */}
        {status.unsyncedItems > 0 && !status.isSyncing && (
          <span className="ml-1 px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full text-xs font-bold shadow-lg animate-bounce">
            {status.unsyncedItems}
          </span>
        )}
      </div>

      {/* Message quand hors ligne */}
      {!isOnline && (
        <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-800">
          <p className="font-medium">Mode hors ligne activé</p>
          <p className="mt-1">
            Vos données seront automatiquement synchronisées quand la connexion sera rétablie.
          </p>
        </div>
      )}

      {/* Dernière synchronisation */}
      {status.lastSync && isOnline && (
        <div className="mt-2 text-xs text-gray-500 text-right">
          Dernière sync: {formatLastSync(status.lastSync)}
        </div>
      )}
    </div>
  )
}

/**
 * Formater la date de dernière sync
 */
function formatLastSync(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'À l\'instant'
  if (diffMins < 60) return `Il y a ${diffMins} min`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `Il y a ${diffHours}h`

  const diffDays = Math.floor(diffHours / 24)
  return `Il y a ${diffDays}j`
}
