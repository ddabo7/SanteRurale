import { useState } from 'react'
import { db } from '../db'

export const DebugPage = () => {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const clearAllData = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer TOUTES les données locales ?')) {
      return
    }

    setLoading(true)
    setMessage('')

    try {
      await db.clearAllData()
      setMessage('✅ Toutes les données ont été supprimées avec succès!')

      // Recharger la page après 1 seconde
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
      setMessage('❌ Erreur lors de la suppression des données')
    } finally {
      setLoading(false)
    }
  }

  const getStats = async () => {
    setLoading(true)
    try {
      const [patients, encounters, conditions, unsyncedCount] = await Promise.all([
        db.patients.count(),
        db.encounters.count(),
        db.conditions.count(),
        db.getUnsyncedCount(),
      ])

      setMessage(`
📊 Statistiques IndexedDB:
- Patients: ${patients}
- Consultations: ${encounters}
- Diagnostics: ${conditions}
- Non synchronisés: ${unsyncedCount}
      `.trim())
    } catch (error) {
      console.error('Erreur:', error)
      setMessage('❌ Erreur lors de la récupération des stats')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">🔧 Debug & Administration</h1>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-4">Base de données locale (IndexedDB)</h2>

          <div className="space-y-3">
            <button
              onClick={getStats}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium"
            >
              {loading ? 'Chargement...' : 'Voir les statistiques'}
            </button>

            <button
              onClick={clearAllData}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium"
            >
              {loading ? 'Suppression...' : '🗑️ Vider toutes les données'}
            </button>
          </div>

          {message && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg whitespace-pre-line font-mono text-sm">
              {message}
            </div>
          )}
        </div>

        <div className="border-t pt-4 mt-4">
          <h3 className="font-semibold mb-2">ℹ️ Information</h3>
          <p className="text-sm text-gray-600">
            Cette page permet de gérer les données locales stockées dans IndexedDB.
            <br />
            <strong>Attention:</strong> La suppression des données est irréversible et supprimera
            toutes les données non synchronisées avec le serveur.
          </p>
        </div>
      </div>
    </div>
  )
}
