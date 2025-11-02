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
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-sm font-medium
          ${isOnline ? 'bg-white border border-gray-200' : 'bg-orange-100 border border-orange-300'}
        `}
      >
        {/* Indicateur de connectivité */}
        <div
          className={`
            w-2 h-2 rounded-full
            ${isOnline ? 'bg-green-500' : 'bg-orange-500'}
          `}
        />

        {/* Message */}
        <span className={isOnline ? 'text-gray-700' : 'text-orange-800'}>
          {status.isSyncing && 'Synchronisation...'}
          {!status.isSyncing && isOnline && status.pendingOperations > 0 && (
            `${status.pendingOperations} opération(s) en attente`
          )}
          {!status.isSyncing && !isOnline && 'Mode hors ligne'}
        </span>

        {/* Spinner pendant la sync */}
        {status.isSyncing && (
          <svg className="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}

        {/* Nombre d'éléments non synchronisés */}
        {status.unsyncedItems > 0 && !status.isSyncing && (
          <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
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
